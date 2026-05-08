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

export const getGhost = (applicationId, userId) => {
  return prisma.ghostDetection.findFirst({
    where: {
      applicationId,
      application: { userId },
    },
  });
};

export const getStats = async (userId) => {
  const grouped = await prisma.jobApplication.groupBy({
    by: ["status"],
    where: {
      userId,
      isDeleted: false,
    },
    _count: {
      status: true,
    },
  });

  const stats = {
    applied: 0,
    shortlisted: 0,
    interviewing: 0,
    offered: 0,
    accepted: 0,
    offerDeclined: 0,
    rejected: 0,
    ghosted: 0,
  };

  grouped.forEach((item) => {
    const count = item._count.status;

    if (item.status === "APPLIED") stats.applied = count;
    if (item.status === "SHORTLISTED") stats.shortlisted = count;
    if (item.status === "INTERVIEWING") stats.interviewing = count;
    if (item.status === "OFFERED") stats.offered = count;
    if (item.status === "ACCEPTED") stats.accepted = count;
    if (item.status === "OFFER_DECLINED") stats.offerDeclined = count;
    if (item.status === "REJECTED") stats.rejected = count;
    if (item.status === "GHOSTED") stats.ghosted = count;
  });

  return stats;
};

