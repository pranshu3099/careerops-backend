import { followupQueue } from "../queues/followup.queue.js";
import { FOLLOWUPTYPE, getFollowUpDelayMs, getFollowUpMessage } from "../constants/followup.js";

class FollowUpEmailScheduler {
  static async scheduleFollowUpJob({
    followUpId,
    type = FOLLOWUPTYPE.APPLICATION_CHECK,
    sequence = 1,
    hrEmail,
    role,
    company,
    appliedDate,
    hrName,
    userName,
    userEmail,
    delayMs = getFollowUpDelayMs(type, sequence),
  }) {
    try {
      if (!hrEmail) {
        throw new Error("Invalid user object passed to sendFollowupEmailJob");
      }

      await followupQueue.add(
        "send-followup-reminder",
        {
          followUpId,
          type,
          sequence,
          to: hrEmail,
          role,
          company,
          appliedDate,
          hrName,
          userName,
          userEmail,
          followupmessage: getFollowUpMessage(type, sequence),
        },
        {
          delay: delayMs,
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
    } catch (error) {
      const err = new Error("Failed to enqueue followup job");
      err.cause = error;
      throw err;
    }
  }

  static async sendFollowupEmailJob(
    followUpId,
    hrEmail,
    role,
    company,
    appliedDate,
    hrName,
    userName,
    userEmail,
  ) {
    return this.scheduleFollowUpJob({
      followUpId,
      type: FOLLOWUPTYPE.APPLICATION_CHECK,
      sequence: 1,
      hrEmail,
      role,
      company,
      appliedDate,
      hrName,
      userName,
      userEmail,
    });
  }
}

export default FollowUpEmailScheduler;
