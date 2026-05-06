import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const findApplicationForInterview = (applicationId, userId) => {
  return prisma.jobApplication.findFirst({
    where: {
      id: applicationId,
      userId,
      isDeleted: false,
    },
    select: {
      id: true,
      userId: true,
      status: true,
      role: true,
      company: {
        select: {
          name: true,
        },
      },
    },
  });
};

export const createInterview = ({
  application,
  interviewData,
}) => {
  return prisma.$transaction(async (tx) => {
    const interview = await tx.interview.create({
      data: interviewData,
    });

    await tx.eventLog.create({
      data: {
        userId: application.userId,
        applicationId: application.id,
        type: "INTERVIEW_SCHEDULED",
        payload: {
          interviewId: interview.id,
          round: interview.round,
          type: interview.type,
          scheduledAt: interview.scheduledAt,
        },
      },
    });

    return interview;
  });
};

export const findByApplication = (applicationId, userId) => {
  return prisma.interview.findMany({
    where: {
      applicationId,
      application: {
        userId,
        isDeleted: false,
      },
    },
    orderBy: [{ round: "asc" }, { scheduledAt: "asc" }],
  });
};

export const findAllByUser = (userId) => {
  return prisma.interview.findMany({
    where: {
      application: {
        userId,
        isDeleted: false,
      },
    },
    orderBy: [{ scheduledAt: "desc" }, { round: "asc" }],
    include: {
      application: {
        select: {
          id: true,
          role: true,
          location: true,
          status: true,
          appliedAt: true,
          company: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });
};

export const findByIdForUser = (id, userId) => {
  return prisma.interview.findFirst({
    where: {
      id,
      application: {
        userId,
        isDeleted: false,
      },
    },
    include: {
      application: {
        select: {
          id: true,
          userId: true,
          status: true,
        },
      },
    },
  });
};

export const updateInterviewById = (id, data) => {
  return prisma.interview.update({
    where: { id },
    data,
  });
};

export const updateInterviewResult = ({ interview, data }) => {
  return prisma.$transaction(async (tx) => {
    const updatedInterview = await tx.interview.update({
      where: { id: interview.id },
      data,
    });

    let cancelledFollowUps = [];

    if (data.result === "FAILED") {
      await tx.jobApplication.update({
        where: { id: interview.applicationId },
        data: {
          status: "REJECTED",
          lastResponseAt: new Date(),
        },
      });

      cancelledFollowUps = await tx.followUp.findMany({
        where: {
          applicationId: interview.applicationId,
          status: "PENDING",
          executedAt: null,
        },
        select: { id: true },
      });

      if (cancelledFollowUps.length > 0) {
        await tx.followUp.updateMany({
          where: {
            applicationId: interview.applicationId,
            status: "PENDING",
            executedAt: null,
          },
          data: { status: "CANCELLED" },
        });
      }

      await tx.eventLog.create({
        data: {
          userId: interview.application.userId,
          applicationId: interview.applicationId,
          type: "STATUS_UPDATED",
          payload: {
            from: interview.application.status,
            to: "REJECTED",
            reason: "INTERVIEW_FAILED",
            interviewId: interview.id,
          },
        },
      });
    }

    return { updatedInterview, cancelledFollowUps };
  });
};
