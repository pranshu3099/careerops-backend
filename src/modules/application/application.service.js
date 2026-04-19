import { PrismaClient } from "@prisma/client";
import mapSource from "../../utils/application";
import isValidTransition from "../../utils/application";
const prisma = new PrismaClient();
export class ApplicationService {
  static async createApplication(userId, data) {
    const { company, role, location, platform, appliedDate, hrEmail } = data;

    const companyRecord = await prisma.company.upsert({
      where: { name: company },
      update: {},
      create: { name: company },
    });

    const application = await prisma.jobApplication.create({
      data: {
        userId,
        companyId: companyRecord.id,
        role,
        location,
        source: mapSource(platform),
        status: "APPLIED",
        appliedAt: new Date(appliedDate),
      },
    });

    await prisma.eventLog.create({
      data: {
        userId,
        applicationId: application.id,
        type: "APPLICATION_CREATED",
        payload: {
          company,
          role,
          hrEmail,
        },
      },
    });

    return application;
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

    // 📜 event log
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
