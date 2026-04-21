import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Worker } from "bullmq";
import redisConnection from "../config/redis.js";
import { sendFollowUpEmail } from "../utils/followupmailer.js";
const prisma = new PrismaClient();
export const followupWorker = new Worker(
  "followup-queue",
  async (job) => {
    const {
      followUpId,
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
        include: { application: true },
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

      const app = followUp.application;
      if (app.lastResponseAt) return;
      if (["REJECTED", "OFFERED", "INTERVIEWING"].includes(app.status)) return;

      // check if still relevant
      if (app.status !== "APPLIED") {
        await prisma.followUp.update({
          where: { id: followUpId },
          data: { status: "CANCELLED" },
        });
        return;
      }

      // send email
      await sendFollowUpEmail({
        followUpId,
        to,
        role,
        company,
        appliedDate,
        hrName,
        userName,
        userEmail,
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
