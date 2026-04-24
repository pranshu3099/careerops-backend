import { PrismaClient } from "@prisma/client";
import { mapSource, isValidTransition } from "../../utils/application.js";
import { findAllByUser, findById, getFollowUps, getGhost, getStats, softDelete, updateById } from "./application.repo.js";
const prisma = new PrismaClient();
export class ApplicationService {
  static async createApplication(userId, data) {
    const { company, role, location, platform, appliedDate, hrEmail } = data;

    let companyRecord = await prisma.company.findFirst({
      where: { name: company },
    });

    if (!companyRecord) {
      companyRecord = await prisma.company.create({
        data: { name: company, hrEmail },
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

    const { application, followUp } = await prisma.$transaction(async (tx) => {
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
            create: {
              scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
              status: "PENDING",
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
            },
            orderBy: { createdAt: "desc" },
            take: 1,
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
        followUp: applicationRecord.followUps[0],
      };
    });

    return {
      applicationId: application.id,
      status: application.status,
      appliedAt: application.appliedAt,
      followUpId: followUp.id,
      nextFollowUpAt: followUp.scheduledAt,
    };
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
      latestFollowUp: a.followUps[0] || null,
    }));
  }

  static async getApplicationById(id, userId) {
    const app = await findById(id, userId);
    if (!app) throw new Error("Not found");

    return app;
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
    return getFollowUps(id, userId);
  }

  static async getGhostApplication(id, userId) {
    return getGhost(id, userId);
  }

  static async getApplicationStats(userId) {
    return getStats(userId);
  }
}
