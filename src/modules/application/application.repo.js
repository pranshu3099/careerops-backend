import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const findAllByUser = (userId) => {
  return prisma.jobApplication.findMany({
    where: {
      userId,
      isDeleted: false,
    },
    orderBy: { createdAt: "desc" },
    include: {
      company: true,
      ghostDetection: true,
    },
  });
};


export const findById = (id, userId) => {
  return prisma.jobApplication.findFirst({
    where: { id, userId, isDeleted: false },
    include: {
      company: true,
      ghostDetection: true,
      followUps: { orderBy: { scheduledAt: "desc" } },
    },
  });
};

export const updateById = (id, userId, data) => {
  return prisma.jobApplication.updateMany({
    where: { id, userId },
    data,
  });
};

export const softDelete = (id, userId) => {
  return prisma.jobApplication.updateMany({
    where: { id, userId },
    data: { isDeleted: true },
  });
};

export const getFollowUps = (applicationId, userId) => {
  return prisma.followUp.findMany({
    where: {
      applicationId,
      application: { userId },
    },
    orderBy: { scheduledAt: "desc" },
  });
};

export const getGhost = (applicationId, userId) => {
  return prisma.ghostDetection.findFirst({
    where: {
      applicationId,
      application: { userId },
    },
  });
};

export const getStats = async (userId) => {
  const apps = await prisma.jobApplication.findMany({
    where: { userId, isDeleted: false },
    include: { ghostDetection: true },
  });

  const stats = {
    applied: 0,
    interviewing: 0,
    offered: 0,
    rejected: 0,
    ghosted: 0,
  };

  apps.forEach((a) => {
    if (a.status === "APPLIED") stats.applied++;
    if (a.status === "INTERVIEWING") stats.interviewing++;
    if (a.status === "OFFERED") stats.offered++;
    if (a.status === "REJECTED") stats.rejected++;
    if (a.ghostDetection?.isGhosted) stats.ghosted++;
  });

  return stats;
};
