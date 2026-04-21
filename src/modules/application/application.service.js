import { PrismaClient } from "@prisma/client";
import { mapSource, isValidTransition } from "../../utils/application.js";
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
        include: {
          followUps: {
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
      application,
      followUpId: followUp.id,
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
}
