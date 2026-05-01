import { PrismaClient } from "@prisma/client";
import { mapSource, isValidTransition } from "../../utils/application.js";
import {
  findAllByUser,
  findById,
  getGhost,
  getStats,
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
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const withFollowUpMessage = (followUp) =>
  followUp
    ? {
        ...followUp,
        message: getFollowUpMessage(followUp.type, followUp.sequence),
      }
    : null;

const getValidPendingFollowUpTypesForStatus = (status) => {
  switch (status) {
    case "APPLIED":
      return [
        FOLLOWUPTYPE.APPLICATION_CHECK,
        FOLLOWUPTYPE.GENERAL_STATUS_CHECK,
      ];
    case "SHORTLISTED":
      return [
        FOLLOWUPTYPE.SHORTLISTED_CHECKIN,
        FOLLOWUPTYPE.GENERAL_STATUS_CHECK,
      ];
    case "INTERVIEWING":
      return [
        FOLLOWUPTYPE.INTERVIEW_FEEDBACK,
        FOLLOWUPTYPE.GENERAL_STATUS_CHECK,
      ];
    case "OFFERED":
      return [FOLLOWUPTYPE.OFFER_FOLLOWUP, FOLLOWUPTYPE.GENERAL_STATUS_CHECK];
    case "REJECTED":
    case "GHOSTED":
    default:
      return [];
  }
};

const cancelInvalidPendingFollowUps = (tx, applicationId, status) => {
  const validTypes = getValidPendingFollowUpTypesForStatus(status);

  return tx.followUp.updateMany({
    where: {
      applicationId,
      status: "PENDING",
      executedAt: null,
      ...(validTypes.length ? { type: { notIn: validTypes } } : {}),
    },
    data: {
      status: "CANCELLED",
    },
  });
};

const isSameTime = (a, b) => a?.getTime() === b?.getTime();

const trimIfString = (value) =>
  typeof value === "string" ? value.trim() : value;

const getApplicationCheckScheduledAt = (appliedAt, sequence) => {
  const days =
    FOLLOWUP_SCHEDULE_DAYS[FOLLOWUPTYPE.APPLICATION_CHECK]?.[sequence - 1];

  return days ? new Date(appliedAt.getTime() + days * MS_PER_DAY) : null;
};

export class ApplicationService {
  static async createApplication(userId, data) {
    const { company, role, location, platform, appliedDate, hrEmail, hrName } =
      data;

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
              nextCheckAt: new Date(
                now.getTime() + INITIAL_GHOST_CHECK_DELAY_MS,
              ),
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

    try {
      await FollowUpEmailScheduler.scheduleFollowUpJob({
        followUpId: followUp.id,
        type,
        sequence,
        delayMs,
      });
    } catch (err) {
      console.error(
        `Failed to enqueue followup ${followUp.id}: ${err.message}`,
      );
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

    const updated = await prisma.$transaction(async (tx) => {
      const updatedApplication = await tx.jobApplication.update({
        where: { id: applicationId },
        data: updateData,
      });

      await cancelInvalidPendingFollowUps(tx, applicationId, newStatus);

      await tx.eventLog.create({
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

      return updatedApplication;
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
      const followUp = await this.createStageFollowUp(
        applicationForFollowUp,
        followUpType,
      );
      updated.latestFollowUp = withFollowUpMessage(followUp);
    }

    return updated;
  }

  static async getApplications(userId) {
    const apps = await findAllByUser(userId);
    return apps.map((a) => ({
      id: a.id,
      company: a.company?.name || null,
      hrName: a.company.hrName,
      hrEmail: a.company.hrEmail,
      role: a.role,
      location: a.location,
      source: a.source,
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
    const application = await prisma.jobApplication.findFirst({
      where: { id, userId, isDeleted: false },
      include: { company: true },
    });

    if (!application) throw new Error("Application not found");
    if (["REJECTED", "OFFERED", "GHOSTED"].includes(application.status)) {
      throw new Error("Application cannot be edited after it is closed");
    }

    const applicationData = {};
    const companyData = {};
    const changedFields = [];
    let appliedDateChanged = false;

    if (data.role !== undefined) {
      const role = trimIfString(data.role);
      if (role && role !== application.role) {
        applicationData.role = role;
        changedFields.push("role");
      }
    }

    if (data.location !== undefined) {
      const location = trimIfString(data.location);
      if (location !== application.location) {
        applicationData.location = location;
        changedFields.push("location");
      }
    }

    const sourceInput = data.source ?? data.platform;
    if (sourceInput !== undefined) {
      const source = mapSource(sourceInput);
      if (source !== application.source) {
        applicationData.source = source;
        changedFields.push("source");
      }
    }

    if (data.appliedDate !== undefined && application.status !== "APPLIED") {
      throw new Error(
        "Applied date can only be updated while application is APPLIED",
      );
    }

    if (data.appliedDate !== undefined) {
      const appliedAt = new Date(data.appliedDate);

      if (Number.isNaN(appliedAt.getTime())) {
        throw new Error("Invalid appliedDate");
      }

      if (!isSameTime(appliedAt, application.appliedAt)) {
        applicationData.appliedAt = appliedAt;
        appliedDateChanged = true;
        changedFields.push("appliedDate");
      }
    }

    if (data.hrName !== undefined) {
      const hrName = trimIfString(data.hrName);
      if (hrName !== application.company?.hrName) {
        companyData.hrName = hrName;
        changedFields.push("hrName");
      }
    }

    if (data.hrEmail !== undefined) {
      const hrEmail = trimIfString(data.hrEmail);
      if (hrEmail !== application.company?.hrEmail) {
        companyData.hrEmail = hrEmail;
        changedFields.push("hrEmail");
      }
    }

    if (!changedFields.length) {
      return {
        success: true,
        updated: false,
        changedFields,
      };
    }

    const followUpsToReschedule = await prisma.$transaction(async (tx) => {
      if (Object.keys(applicationData).length) {
        await tx.jobApplication.update({
          where: { id },
          data: applicationData,
        });
      }

      if (Object.keys(companyData).length) {
        await tx.company.update({
          where: { id: application.companyId },
          data: companyData,
        });
      }

      if (!appliedDateChanged) return [];

      const pendingApplicationFollowUps = await tx.followUp.findMany({
        where: {
          applicationId: id,
          type: FOLLOWUPTYPE.APPLICATION_CHECK,
          status: "PENDING",
          executedAt: null,
          sequence: { not: null },
        },
        select: {
          id: true,
          type: true,
          sequence: true,
          scheduledAt: true,
        },
      });

      const rescheduled = [];
      const nextAppliedAt = applicationData.appliedAt;

      for (const followUp of pendingApplicationFollowUps) {
        const scheduledAt = getApplicationCheckScheduledAt(
          nextAppliedAt,
          followUp.sequence,
        );

        if (!scheduledAt || isSameTime(scheduledAt, followUp.scheduledAt)) {
          continue;
        }

        await tx.followUp.update({
          where: { id: followUp.id },
          data: { scheduledAt },
        });

        rescheduled.push({
          ...followUp,
          oldScheduledAt: followUp.scheduledAt,
          scheduledAt,
          newScheduledAt: scheduledAt,
        });
      }

      return rescheduled;
    });

    const rescheduleResults = await Promise.allSettled(
      followUpsToReschedule.map((followUp) =>
        FollowUpEmailScheduler.rescheduleFollowUpJob({
          followUpId: followUp.id,
          type: followUp.type,
          sequence: followUp.sequence,
          delayMs: Math.max(followUp.scheduledAt.getTime() - Date.now(), 0),
        }),
      ),
    );

    rescheduleResults.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `Failed to reschedule followup ${followUpsToReschedule[index].id}: ${result.reason?.message}`,
        );
      }
    });

    const response = {
      success: true,
      updated: true,
      changedFields,
      appliedDateChanged,
      rescheduledFollowUps: followUpsToReschedule.length,
    };

    if (followUpsToReschedule.length > 0) {
      response.role = applicationData.role ?? application.role;
      response.company = application.company?.name ?? null;
      response.scheduleChanges = followUpsToReschedule.map((followUp) => ({
        followUpId: followUp.id,
        oldScheduledAt: followUp.oldScheduledAt,
        newScheduledAt: followUp.newScheduledAt,
      }));
    }

    return response;
  }

  static async deleteApplication(id, userId) {
    const { application, pendingFollowUps } = await prisma.$transaction(async (tx) => {
      const application = await tx.jobApplication.findFirst({
        where: { id, userId, isDeleted: false },
        select: {
          id: true,
          role: true,
          company: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!application) throw new Error("Application not found");

      const pendingFollowUps = await tx.followUp.findMany({
        where: {
          applicationId: id,
          status: "PENDING",
          executedAt: null,
        },
        select: { id: true },
      });

      await tx.jobApplication.update({
        where: { id },
        data: { isDeleted: true },
      });

      if (pendingFollowUps.length > 0) {
        await tx.followUp.updateMany({
          where: {
            applicationId: id,
            status: "PENDING",
            executedAt: null,
          },
          data: { status: "CANCELLED" },
        });
      }

      return { application, pendingFollowUps };
    });

    const queueResults = await Promise.allSettled(
      pendingFollowUps.map((followUp) =>
        FollowUpEmailScheduler.removeFollowUpJob(followUp.id),
      ),
    );

    queueResults.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `Failed to remove followup job ${pendingFollowUps[index].id}: ${result.reason?.message}`,
        );
      }
    });

    return {
      success: true,
      deleted: true,
      role: application.role,
      company: application.company?.name ?? null,
      cancelledFollowUps: pendingFollowUps.length,
    };
  }

  static async getGhostApplication(id, userId) {
    return getGhost(id, userId);
  }

  static async getApplicationStats(userId) {
    return getStats(userId);
  }
}
