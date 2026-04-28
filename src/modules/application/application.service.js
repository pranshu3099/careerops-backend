import { PrismaClient } from "@prisma/client";
import { mapSource, isValidTransition } from "../../utils/application.js";
import {
  findAllByUser,
  findById,
  getFollowUps,
  getGhost,
  getStats,
  getUpcomingFollowUps as findUpcomingFollowUps,
  softDelete,
  updateById,
} from "./application.repo.js";
import {
  FOLLOWUPTYPE,
  FOLLOWUP_SCHEDULE_DAYS,
  FOLLOWUP_TYPE_BY_STATUS,
  getFollowUpDelayMs,
  getFollowUpMessage,
} from "../../constants/followup.js";
import FollowUpEmailScheduler from "../../scheduler/followupemail.scheduler.js";
const prisma = new PrismaClient();
const INITIAL_GHOST_CHECK_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

const withFollowUpMessage = (followUp) =>
  followUp
    ? {
        ...followUp,
        message: getFollowUpMessage(followUp.type, followUp.sequence),
      }
    : null;

const hasInterviewResult = (interviews = []) =>
  interviews.some(
    (interview) => interview.result && interview.result !== "PENDING",
  );

const isUpcomingFollowUpValid = (followUp) => {
  const application = followUp.application;

  switch (followUp.type) {
    case FOLLOWUPTYPE.APPLICATION_CHECK:
      return application.status === "APPLIED";
    case FOLLOWUPTYPE.SHORTLISTED_CHECKIN:
      return application.status === "SHORTLISTED";
    case FOLLOWUPTYPE.INTERVIEW_FEEDBACK:
      return (
        application.status === "INTERVIEWING" &&
        !hasInterviewResult(application.interviews)
      );
    case FOLLOWUPTYPE.OFFER_FOLLOWUP:
      return application.status === "OFFERED";
    case FOLLOWUPTYPE.GENERAL_STATUS_CHECK:
      return !["REJECTED", "GHOSTED"].includes(application.status);
    default:
      return false;
  }
};

const toUpcomingFollowUpResponse = (followUp) => ({
  followUpId: followUp.id,
  applicationId: followUp.applicationId,
  company: followUp.application.company?.name || null,
  role: followUp.application.role,
  type: followUp.type,
  sequence: followUp.sequence,
  scheduledAt: followUp.scheduledAt,
  status: followUp.application.status,
  appliedAt:followUp.application.appliedAt,
  message: getFollowUpMessage(followUp.type, followUp.sequence),
});

export class ApplicationService {
  static async createApplication(userId, data) {
    const { company, role, location, platform, appliedDate, hrEmail, hrName } = data;

    let companyRecord = await prisma.company.findFirst({
      where: { name: company },
    });

    if (!companyRecord) {
      companyRecord = await prisma.company.create({
        data: { name: company, hrEmail, hrName },
      });
    }

    const existingApplication = await prisma.jobApplication.findFirst({
      where: {
        userId,
        companyId: companyRecord.id,
        role,
      },
    });

    if (existingApplication) {
      throw new Error("Application already exists");
    }

    const applicationCheckFollowUps = FOLLOWUP_SCHEDULE_DAYS[
      FOLLOWUPTYPE.APPLICATION_CHECK
    ].map((days, index) => ({
      scheduledAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      status: "PENDING",
      type: FOLLOWUPTYPE.APPLICATION_CHECK,
      sequence: index + 1,
    }));

    const { application, followUps } = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const applicationRecord = await tx.jobApplication.create({
        data: {
          userId,
          companyId: companyRecord.id,
          role,
          location,
          source: mapSource(platform),
          status: "APPLIED",
          appliedAt: new Date(appliedDate),
          followUps: {
            create: applicationCheckFollowUps,
          },
          ghostDetection: {
            create: {
              lastCheckedAt: now,
              nextCheckAt: new Date(now.getTime() + INITIAL_GHOST_CHECK_DELAY_MS),
              confidenceScore: 0,
              isGhosted: false,
            },
          },
        },
        select: {
          id: true,
          status: true,
          appliedAt: true,
          followUps: {
            select: {
              id: true,
              scheduledAt: true,
              status: true,
              type: true,
              sequence: true,
            },
            orderBy: { scheduledAt: "asc" },
          },
        },
      });

      await tx.eventLog.create({
        data: {
          userId,
          applicationId: applicationRecord.id,
          type: "APPLICATION_CREATED",
          payload: {
            company,
            role,
            hrEmail,
          },
        },
      });

      return {
        application: applicationRecord,
        followUps: applicationRecord.followUps,
      };
    });

    const nextFollowUp = followUps[0];

    return {
      applicationId: application.id,
      status: application.status,
      appliedAt: application.appliedAt,
      followUpId: nextFollowUp.id,
      nextFollowUpAt: nextFollowUp.scheduledAt,
      followUps: followUps.map(withFollowUpMessage),
    };
  }

  static async createStageFollowUp(application, type, sequence = 1) {
    if (!type) return null;

    const existing = await prisma.followUp.findFirst({
      where: {
        applicationId: application.id,
        type,
        sequence,
        status: "PENDING",
        executedAt: null,
      },
    });

    if (existing) return existing;

    const delayMs = getFollowUpDelayMs(type, sequence);
    const followUp = await prisma.followUp.create({
      data: {
        applicationId: application.id,
        scheduledAt: new Date(Date.now() + delayMs),
        status: "PENDING",
        type,
        sequence,
      },
    });

    if (application.company?.hrEmail) {
      try {
        await FollowUpEmailScheduler.scheduleFollowUpJob({
          followUpId: followUp.id,
          type,
          sequence,
          hrEmail: application.company.hrEmail,
          role: application.role,
          company: application.company?.name,
          appliedDate: application.appliedAt,
          hrName: application.company?.hrName,
          userName: application.user?.name,
          userEmail: application.user?.email,
          delayMs,
        });
      } catch (err) {
        console.error(
          `Failed to enqueue followup ${followUp.id}: ${err.message}`,
        );
      }
    }

    return followUp;
  }

  static async updateApplicationStatus(userId, applicationId, newStatus) {
    const app = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
    });

    if (!app) throw new Error("Application not found");

    if (app.userId !== userId) {
      throw new Error("Unauthorized");
    }

    if (!isValidTransition(app.status, newStatus)) {
      throw new Error("Invalid status transition");
    }

    const updateData = {
      status: newStatus,
      lastResponseAt: new Date(),
    };

    if (newStatus === "GHOSTED") {
      updateData.ghostedAt = new Date();
    }

    const updated = await prisma.jobApplication.update({
      where: { id: applicationId },
      data: updateData,
    });

    await prisma.eventLog.create({
      data: {
        userId,
        applicationId,
        type: "STATUS_UPDATED",
        payload: {
          from: app.status,
          to: newStatus,
        },
      },
    });

    const followUpType = FOLLOWUP_TYPE_BY_STATUS[newStatus];
    if (followUpType) {
      const applicationForFollowUp = await prisma.jobApplication.findUnique({
        where: { id: applicationId },
        include: {
          company: true,
          user: true,
        },
      });
      const followUp = await this.createStageFollowUp(applicationForFollowUp, followUpType);
      updated.latestFollowUp = withFollowUpMessage(followUp);
    }

    return updated;
  }

  static async getApplications(userId) {
    const apps = await findAllByUser(userId);
    return apps.map((a) => ({
      id: a.id,
      company: a.company?.name || null,
      role: a.role,
      platform: a.source,
      appliedAt: a.appliedAt,
      currentStatus: a.status,
      lastResponseAt: a.lastResponseAt || null,
      ghostDetection: a.ghostDetection
        ? {
            isGhosted: a.ghostDetection.isGhosted,
            confidenceScore: a.ghostDetection.confidenceScore,
          }
        : null,
    }));
  }

  static async getApplicationById(id, userId) {
    const app = await findById(id, userId);
    if (!app) throw new Error("Not found");

    return {
      ...app,
      followUps: app.followUps.map(withFollowUpMessage),
    };
  }

  static async updateApplication(id, userId, data) {
    const allowed = [
      "role",
      "location",
      "platform",
      "hrEmail",
      "appliedDate",
      "notes",
    ];

    const updateData = {};
    allowed.forEach((key) => {
      if (data[key] !== undefined) updateData[key] = data[key];
    });

    await updateById(id, userId, updateData);
    return { success: true };
  }

  static async deleteApplication(id, userId) {
    await softDelete(id, userId);
    return { success: true };
  }

  static async getUserFollowUps(id, userId) {
    const followUps = await getFollowUps(id, userId);
    return followUps.map(withFollowUpMessage);
  }

  static async getUpcomingFollowUps(userId) {
    const followUps = await findUpcomingFollowUps(userId);
    const nextByApplication = new Map();
    followUps.forEach((followUp) => {
      if (nextByApplication.has(followUp.applicationId)) return;
      if (!isUpcomingFollowUpValid(followUp)) return;

      nextByApplication.set(
        followUp.applicationId,
        toUpcomingFollowUpResponse(followUp),
      );
    });

    return [...nextByApplication.values()];
  }

  static async getGhostApplication(id, userId) {
    return getGhost(id, userId);
  }

  static async getApplicationStats(userId) {
    return getStats(userId);
  }
}
