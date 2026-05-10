import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const createNotification = (data) => {
  if (data.sourceKey) {
    return prisma.notification.upsert({
      where: { sourceKey: data.sourceKey },
      update: {
        title: data.title,
        message: data.message,
        data: data.data,
      },
      create: data,
    });
  }

  return prisma.notification.create({ data });
};

export const findNotificationsByUser = (userId, { unreadOnly = false, limit = 50 } = {}) => {
  return prisma.notification.findMany({
    where: {
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
};

export const countUnreadNotifications = (userId) => {
  return prisma.notification.count({
    where: {
      userId,
      readAt: null,
    },
  });
};

export const markNotificationRead = (id, userId) => {
  return prisma.notification.updateMany({
    where: {
      id,
      userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });
};

export const markAllNotificationsRead = (userId) => {
  return prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });
};

export const deleteNotification = (id, userId) => {
  return prisma.notification.deleteMany({
    where: {
      id,
      userId,
    },
  });
};

export const findUpcomingInterviewsForReminder = (userId, from, to) => {
  return prisma.interview.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: {
        gte: from,
        lte: to,
      },
      application: {
        userId,
        isDeleted: false,
      },
    },
    orderBy: { scheduledAt: "asc" },
    include: {
      application: {
        include: {
          company: true,
        },
      },
    },
  });
};


//The below query finds users who might need notification syncing.

//Specifically, it returns users who have at least one non-deleted application with either:

//a pending follow-up, or a scheduled interview

export const findUserIdsForNotificationSync = () => {
  return prisma.user.findMany({
    select: { id: true },
    where: {
      OR: [
        {
          applications: {
            some: {
              isDeleted: false,
              followUps: {
                some: {
                  status: "PENDING",
                  executedAt: null,
                },
              },
            },
          },
        },
        {
          applications: {
            some: {
              isDeleted: false,
              interviews: {
                some: {
                  status: "SCHEDULED",
                },
              },
            },
          },
        },
      ],
    },
  });
};
