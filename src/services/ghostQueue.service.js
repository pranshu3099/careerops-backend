import { ghostQueue } from "../queues/ghost.queue.js";

export const TERMINAL_GHOST_APPLICATION_STATUSES = [
  "ACCEPTED",
  "OFFER_DECLINED",
  "REJECTED",
  "OFFERED",
  "GHOSTED",
];

const REMOVABLE_GHOST_JOB_STATES = [
  "waiting",
  "delayed",
  "paused",
  "prioritized",
  "waiting-children",
];

const createGhostJobId = (applicationId, delayMs) =>
  `ghost-${applicationId}-${Date.now() + delayMs}`;

export const enqueueGhostCheck = async (data, delayMs) => {
  try {
    await ghostQueue.add("check-ghost", data, {
      delay: delayMs,
      jobId: createGhostJobId(data.applicationId, delayMs),
      removeOnComplete: true,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    });
  } catch (err) {
    console.error(
      `Failed to enqueue ghost check for application ${data.applicationId}: ${err.message}`,
    );
  }
};

export const removeQueuedGhostChecks = async (applicationId, options = {}) => {
  if (!applicationId) return { removed: 0 };

  const { excludeJobId } = options;
  const jobs = await ghostQueue.getJobs(REMOVABLE_GHOST_JOB_STATES);
  const jobsToRemove = jobs.filter(
    (job) =>
      job?.data?.applicationId === applicationId &&
      (!excludeJobId || job.id !== excludeJobId),
  );

  const results = await Promise.allSettled(
    jobsToRemove.map((job) => job.remove()),
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        `Failed to remove stale ghost job ${jobsToRemove[index].id}: ${result.reason?.message}`,
      );
    }
  });

  return {
    removed: results.filter((result) => result.status === "fulfilled").length,
  };
};
