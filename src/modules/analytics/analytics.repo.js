import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getApplicationsForAnalytics = (userId) => {
  return prisma.jobApplication.findMany({
    where: {
      userId,
      isDeleted: false,
    },
    select: {
      id: true,
      role: true,
      source: true,
      status: true,
      appliedAt: true,
      createdAt: true,
      company: {
        select: {
          name: true,
        },
      },
      interviews: {
        select: {
          id: true,
          round: true,
          type: true,
          status: true,
          result: true,
          scheduledAt: true,
          createdAt: true,
        },
      },
      followUps: {
        select: {
          id: true,
          type: true,
          status: true,
          scheduledAt: true,
          executedAt: true,
          createdAt: true,
        },
      },
    },
  });
};

export const getEventLogsForAnalytics = (userId, from) => {
  return prisma.eventLog.findMany({
    where: {
      userId,
      ...(from ? { createdAt: { gte: from } } : {}),
    },
    select: {
      id: true,
      applicationId: true,
      type: true,
      payload: true,
      createdAt: true,
      application: {
        select: {
          isDeleted: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  }).then((events) =>
    events
      .filter((event) => event.applicationId && !event.application?.isDeleted)
      .map(({ application, ...event }) => event),
  );
};
