import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const defaultSettings = {
  followUpAlertsEnabled: true,
  followUpAlertDays: 1,
};

export const getOrCreateSettings = (userId) => {
  return prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      ...defaultSettings,
    },
  });
};

export const updateSettings = (userId, data) => {
  return prisma.userSettings.upsert({
    where: { userId },
    update: data,
    create: {
      userId,
      ...defaultSettings,
      ...data,
    },
  });
};
