import { followupQueue } from "../queues/followup.queue.js";
class FollowUpEmailService {
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
        },
        {
          delay: 5000,
          attempts: 3, // retry 3 times
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    } catch (error) {
      const err = new Error("Failed to enqueue email job");
      err.cause = error;
      throw err;
    }
  }
}

export default FollowUpEmailService;
