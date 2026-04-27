import { PrismaClient } from "@prisma/client";
import { Worker } from "bullmq";
import redisConnection from "../config/redis.js";
import { calculateGhostScore } from "../services/ghostScoring.service.js";
import { getNextCheckDelay } from "../services/ghostScheduler.service.js";
import { ghostQueue } from "../queues/ghost.queue.js";
import { followupQueue } from "../queues/followup.queue.js";
const prisma = new PrismaClient();
export const ghostWorker = new Worker(
  "ghost-detection",
  async (job) => {
    const {
      applicationId,
      followUpId,
      hrEmail,
      role,
      company,
      appliedDate,
      hrName,
      userName,
      userEmail,
    } = job.data;

    const app = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
    });

    if (!app) return;

    if (["REJECTED", "OFFERED"].includes(app.status)) return;

    const score = calculateGhostScore(app);

    const followupCount = await prisma.followUp.count({
      where: {
        applicationId,
        status: "SENT",
      },
    });

    if (score > 0.7 && followupCount < 2) {
      await followupQueue.add(
        "send-followup-reminder",
        {
          followUpId,
          to: hrEmail,
          role,
          company,
          appliedDate,
          hrName,
          userName,
          userEmail,
        },
        {
          delay: 5000,
          jobId: `followup:${followUpId}`,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    }

    const isGhosted = score >= 0.8;
    const nextCheckAt = new Date(Date.now() + getNextCheckDelay(score))
    try {
      const existing = await prisma.ghostDetection.findUnique({
        where: { applicationId },
      });

      if (existing) {
        await prisma.ghostDetection.update({
          where: { applicationId },
          data: {
            confidenceScore: score,
            isGhosted,
            lastCheckedAt: new Date(),
            nextCheckAt
          },
        });
      } else {
        await prisma.ghostDetection.create({
          data: {
            applicationId,
            confidenceScore: score,
            isGhosted,
            lastCheckedAt: new Date(),
            nextCheckAt
          },
        });
      }
    } catch (err) {
      if (err.code === "P2002") {
        await prisma.ghostDetection.update({
          where: { applicationId },
          data: {
            confidenceScore: score,
            isGhosted,
            lastCheckedAt: new Date(),
            nextCheckAt
          },
        });
      } else {
        throw err;
      }
    }

    if (isGhosted && app.status !== "GHOSTED") {
      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: {
          status: "GHOSTED",
          ghostedAt: new Date(),
        },
      });

      await prisma.eventLog.create({
        data: {
          userId: app.userId,
          applicationId,
          type: "GHOST_DETECTED",
          payload: { score },
        },
      });
    }

    const delay = getNextCheckDelay(score);

    await ghostQueue.add(
      "check-ghost",
      { applicationId },
      {
        delay,
        jobId: applicationId,
        removeOnComplete: true,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    );
  },
  {
    connection: redisConnection,
    concurrency: 10,
  },
);

ghostWorker.on("completed", (job) => {
  console.log(`Ghost job with ID ${job.id} has been completed.`);
});

ghostWorker.on("failed", (job, err) => {
  console.error(
    `Ghost job with ID ${job.id} has failed. Error: ${err.message}`,
  );
});
