import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Worker } from "bullmq";
import redisConnection from "../config/redis.js";
import { sendFollowUpEmail } from "../utils/followupmailer.js";
import { FOLLOWUPTYPE } from "../constants/followup.js";
const prisma = new PrismaClient();

const hasInterviewResult = (interviews = []) =>
  interviews.some((interview) => interview.result && interview.result !== "PENDING");

const isFollowUpStillValid = (followUp) => {
  const app = followUp.application;

  switch (followUp.type) {
    case FOLLOWUPTYPE.SHORTLISTED_CHECKIN:
      return app.status === "SHORTLISTED";
    case FOLLOWUPTYPE.INTERVIEW_FEEDBACK:
      return app.status === "INTERVIEWING" && !hasInterviewResult(app.interviews);
    case FOLLOWUPTYPE.OFFER_FOLLOWUP:
      return app.status === "OFFERED";
    case FOLLOWUPTYPE.GENERAL_STATUS_CHECK:
      return !["REJECTED", "GHOSTED"].includes(app.status);
    case FOLLOWUPTYPE.APPLICATION_CHECK:
    default:
      return app.status === "APPLIED" && !app.lastResponseAt;
  }
};

export const followupWorker = new Worker(
  "followup-queue",
  async (job) => {
    const {
      followUpId,
      type: jobType,
      sequence: jobSequence,
      to,
      role,
      company,
      appliedDate,
      hrName,
      userName,
      userEmail,
    } = job.data;

    if (job.name !== "send-followup-reminder") {
      return;
    }

    if (!followUpId) {
      console.error(`Missing followUpId for job ${job.id}`);
      return;
    }

    try {
      const followUp = await prisma.followUp.findUnique({
        where: { id: followUpId },
        include: {
          application: {
            include: {
              company: true,
              user: true,
              interviews: {
                select: {
                  result: true,
                },
              },
            },
          },
        },
      });

      if (!followUp) {
        console.error(`FollowUp not found for id ${followUpId}`);
        return;
      }

      if (followUp.status !== "PENDING") {
        console.log(
          `Skipping followUp ${followUpId} because status is ${followUp.status}`,
        );
        return;
      }

      const typedFollowUp = {
        ...followUp,
        type: followUp.type || jobType || FOLLOWUPTYPE.APPLICATION_CHECK,
        sequence: followUp.sequence || jobSequence || 1,
      };

      if (
        typedFollowUp.type === FOLLOWUPTYPE.APPLICATION_CHECK &&
        typedFollowUp.application.status === "APPLIED" &&
        typedFollowUp.application.lastResponseAt
      ) {
        return;
      }

      if (!isFollowUpStillValid(typedFollowUp)) {
        await prisma.followUp.update({
          where: { id: followUpId },
          data: { status: "CANCELLED" },
        });
        return;
      }

      const recipient = typedFollowUp.application.company?.hrEmail?.trim() || to;

      // send email
      await sendFollowUpEmail({
        followUpId,
        type: typedFollowUp.type,
        sequence: typedFollowUp.sequence,
        to: recipient,
        role: typedFollowUp.application.role || role,
        company: typedFollowUp.application.company?.name || company,
        appliedDate: typedFollowUp.application.appliedAt || appliedDate,
        hrName: typedFollowUp.application.company?.hrName || hrName,
        userName: typedFollowUp.application.user?.name || userName,
        userEmail: typedFollowUp.application.user?.email || userEmail,
      });

      const updatedFollowUp = await prisma.followUp.update({
        where: { id: followUpId },
        data: {
          status: "SENT",
          executedAt: new Date(),
        },
      });

      console.log(
        `FollowUp ${updatedFollowUp.id} marked as ${updatedFollowUp.status}`,
      );
    } catch (err) {
      await prisma.followUp.updateMany({
        where: { id: followUpId },
        data: {
          status: "FAILED",
          executedAt: new Date(),
        },
      });

      throw err; // so BullMQ can retry
    }
  },
  {
    connection: redisConnection,
  },
);

followupWorker.on("completed", (job) => {
  console.log(`Followup job with ID ${job.id} has been completed.`);
});

followupWorker.on("failed", (job, err) => {
  console.error(
    `Followup job with ID ${job.id} has failed. Error: ${err.message}`,
  );
});
