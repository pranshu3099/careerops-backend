import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const findByApplication = (applicationId, userId) => {
  return prisma.followUp.findMany({
    where: {
      applicationId,
      application: {
        userId,
        isDeleted: false,
      },
    },
    orderBy: { scheduledAt: "desc" },
  });
};

export const findUpcomingByUser = (userId) => {
  return prisma.followUp.findMany({
    where: {
      status: "PENDING",
      executedAt: null,
      application: {
        userId,
        isDeleted: false,
      },
    },
    orderBy: [{ scheduledAt: "asc" }, { sequence: "asc" }],
    include: {
      application: {
        include: {
          company: true,
          interviews: {
            select: {
              result: true,
            },
          },
        },
      },
    },
  });
};

export const findDueSoonByUser = (userId, from, to) => {
  return prisma.followUp.findMany({
    where: {
      status: "PENDING",
      executedAt: null,
      scheduledAt: {
        gte: from,
        lte: to,
      },
      application: {
        userId,
        isDeleted: false,
      },
    },
    orderBy: [{ scheduledAt: "asc" }, { sequence: "asc" }],
    include: {
      application: {
        include: {
          company: true,
          interviews: {
            select: {
              result: true,
            },
          },
        },
      },
    },
  });
};
