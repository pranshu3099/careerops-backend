import { notificationQueue } from "../queues/notification.queue.js";

const NOTIFICATION_SYNC_INTERVAL_MS = 60 * 60 * 1000;

class NotificationScheduler {
  //for scheduleRecurringSyncJob the jobId should not be unique per user That prevents accidentally registering multiple identical hourly sync jobs.
  static async scheduleRecurringSyncJob() {
    return notificationQueue.add(
      "sync-all-notifications",
      {},
      {
        jobId: "sync-all-notifications",
        repeat: {
          every: NOTIFICATION_SYNC_INTERVAL_MS,
        },
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    );
  }

  static async scheduleUserSyncJob(userId) {
    try {
      if (!userId) return null;

      return await notificationQueue.add(
        "sync-user-notifications",
        { userId },
        {
          jobId: `sync-user-notifications-${userId}`,
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        },
      );
    } catch (err) {
      console.error(
        `Failed to enqueue notification sync for user ${userId}: ${err.message}`,
      );
      return null;
    }
  }
}

export default NotificationScheduler;
