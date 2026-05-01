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
    await this.removeFollowUpJob(args.followUpId);

    return this.scheduleFollowUpJob(args);
  }

  static async removeFollowUpJob(followUpId) {
    const existingJob = await followupQueue.getJob(`followup-${followUpId}`);

    if (!existingJob) {
      return {
        removed: false,
        reason: "NOT_FOUND",
      };
    }

    try {
      await existingJob.remove();
      return { removed: true };
    } catch (err) {
      if (await existingJob.isActive()) {
        return {
          removed: false,
          reason: "JOB_ALREADY_ACTIVE",
        };
      }

      throw err;
    }
  }

}

export default FollowUpEmailScheduler;
