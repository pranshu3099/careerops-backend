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

export const findAllByUser = (userId) => {
  return prisma.followUp.findMany({
    where: {
      application: {
        userId,
        isDeleted: false,
      },
    },
    orderBy: [{ scheduledAt: "desc" }, { sequence: "asc" }],
    include: {
      application: {
        include: {
          company: true,
        },
      },
    },
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
              scheduledAt: true,
              status: true,
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
              scheduledAt: true,
              status: true,
            },
          },
        },
      },
    },
  });
};
