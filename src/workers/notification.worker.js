import { Worker } from "bullmq";
import redisConnection from "../config/redis.js";
import NotificationScheduler from "../scheduler/notification.scheduler.js";
import { NotificationService } from "../modules/notification/notification.service.js";

export const notificationWorker = new Worker(
  "notification-queue",
  async (job) => {
    if (job.name === "sync-all-notifications") {
      return NotificationService.syncAllUsersNotifications();
    }

    if (job.name === "sync-user-notifications") {
      const { userId } = job.data;
      if (!userId) throw new Error("Missing userId for notification sync job");
      return NotificationService.syncUserNotifications(userId);
    }

    return null;
  },
  {
    connection: redisConnection,
    concurrency: 5,
  },
);

notificationWorker.on("completed", (job) => {
  console.log(`Notification job with ID ${job.id} has been completed.`);
});

notificationWorker.on("failed", (job, err) => {
  console.error(
    `Notification job with ID ${job?.id} has failed. Error: ${err.message}`,
  );
});

NotificationScheduler.scheduleRecurringSyncJob().catch((err) => {
  console.error(`Failed to schedule notification sync job: ${err.message}`);
});
