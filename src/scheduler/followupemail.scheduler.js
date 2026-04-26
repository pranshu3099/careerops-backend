import { followupQueue } from "../queues/followup.queue.js";
import { FOLLOWUPTYPE, getFollowUpMessage } from "../constants/followup.js";

const ApplicationCheckMessageAfter3days = getFollowUpMessage(
  FOLLOWUPTYPE.APPLICATION_CHECK,
  3,
);
const ApplicationCheckMessageAfter7days = getFollowUpMessage(
  FOLLOWUPTYPE.APPLICATION_CHECK,
  7,
);
const ApplicationCheckMessageAfter14days = getFollowUpMessage(
  FOLLOWUPTYPE.APPLICATION_CHECK,
  14,
);
class FollowUpEmailScheduler {
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
    try {
      if (!hrEmail) {
        throw new Error("Invalid user object passed to sendFollowupEmailJob");
      }

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
          followupmessage: ApplicationCheckMessageAfter3days,
        },
        {
          delay: 3 * 24 * 60 * 60 * 1000,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

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
          message: ApplicationCheckMessageAfter7days
        },
        {
          delay: 7 * 24 * 60 * 60 * 1000,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

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
          message: ApplicationCheckMessageAfter14days
        },
        {
          delay: 14 * 24 * 60 * 60 * 1000,
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
}

export default FollowUpEmailScheduler;
