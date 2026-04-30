import { followupQueue } from "../queues/followup.queue.js";
import { FOLLOWUPTYPE, getFollowUpDelayMs } from "../constants/followup.js";

class FollowUpEmailScheduler {
  static async scheduleFollowUpJob({
    followUpId,
    type = FOLLOWUPTYPE.APPLICATION_CHECK,
    sequence = 1,
    delayMs = getFollowUpDelayMs(type, sequence),
  }) {
    try {
      await followupQueue.add(
        "send-followup-reminder",
        {
          followUpId,
          type,
          sequence,
        },
        {
          delay: delayMs,
          jobId: `followup-${followUpId}`,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    } catch (error) {
      const err = new Error(
        `Failed to enqueue followup job: ${error.message}`,
      );
      err.cause = error;
      throw err;
    }
  }

  static async rescheduleFollowUpJob(args) {
    const existingJob = await followupQueue.getJob(`followup-${args.followUpId}`);

    if (existingJob) {
      try {
        await existingJob.remove();
      } catch (err) {
        if (await existingJob.isActive()) {
          return {
            skipped: true,
            reason: "JOB_ALREADY_ACTIVE",
          };
        }

        throw err;
      }
    }

    return this.scheduleFollowUpJob(args);
  }

}

export default FollowUpEmailScheduler;
