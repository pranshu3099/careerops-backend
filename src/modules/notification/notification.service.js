import { FollowUpService } from "../followup/followup.service.js";
import {
  countUnreadNotifications,
  createNotification,
  deleteNotification,
  findNotificationsByUser,
  findUserIdsForNotificationSync,
  findUpcomingInterviewsForReminder,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification.repo.js";

const DEFAULT_NOTIFICATION_LIMIT = 50;

const getEndOfTomorrow = (now) => {
  const end = new Date(now);
  end.setDate(end.getDate() + 1);
  end.setHours(23, 59, 59, 999);
  return end;
};

const normalizeLimit = (limit) => {
  const value = Number(limit);
  if (!Number.isFinite(value)) return DEFAULT_NOTIFICATION_LIMIT;
  return Math.min(Math.max(value, 1), 100);
};

const toNotificationResponse = (notification) => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  data: notification.data,
  applicationId: notification.applicationId,
  followUpId: notification.followUpId,
  interviewId: notification.interviewId,
  isRead: Boolean(notification.readAt),
  readAt: notification.readAt,
  createdAt: notification.createdAt,
});

export class NotificationService {
  static async create(data) {
    return createNotification(data);
  }

  static async createFollowUpDueNotifications(userId, now = new Date()) {
    const dueFollowUps = await FollowUpService.getDueSoonFollowUps(userId, now);

    const results = await Promise.allSettled(
      dueFollowUps.map((followUp) =>
        createNotification({
          userId,
          applicationId: followUp.applicationId,
          followUpId: followUp.followUpId,
          type: "FOLLOW_UP_DUE",
          title: "Follow-up due",
          message: `Follow-up due for ${followUp.role} at ${
            followUp.company || "this company"
          }.`,
          sourceKey: `follow-up-due:${followUp.followUpId}`,
          data: {
            followUpId: followUp.followUpId,
            applicationId: followUp.applicationId,
            company: followUp.company,
            role: followUp.role,
            scheduledAt: followUp.scheduledAt,
            followUpType: followUp.type,
            sequence: followUp.sequence,
          },
        }),
      ),
    );

    return results.filter((result) => result.status === "fulfilled").length;
  }

  static async createInterviewReminderNotifications(userId, now = new Date()) {
    const interviews = await findUpcomingInterviewsForReminder(
      userId,
      now,
      getEndOfTomorrow(now),
    );

    const results = await Promise.allSettled(
      interviews.map((interview) =>
        createNotification({
          userId,
          applicationId: interview.applicationId,
          interviewId: interview.id,
          type: "INTERVIEW_REMINDER",
          title: "Interview reminder",
          message: `Interview scheduled for ${interview.application.role} at ${
            interview.application.company?.name || "this company"
          }.`,
          sourceKey: `interview-reminder:${interview.id}`,
          data: {
            interviewId: interview.id,
            applicationId: interview.applicationId,
            company: interview.application.company?.name || null,
            role: interview.application.role,
            round: interview.round,
            roundName: interview.roundName,
            interviewType: interview.type,
            interviewer: interview.interviewer,
            scheduledAt: interview.scheduledAt,
          },
        }),
      ),
    );

    return results.filter((result) => result.status === "fulfilled").length;
  }

  static async syncUserNotifications(userId, now = new Date()) {
    const [followUpsCreated, interviewsCreated] = await Promise.all([
      this.createFollowUpDueNotifications(userId, now),
      this.createInterviewReminderNotifications(userId, now),
    ]);

    return {
      followUpsCreated,
      interviewsCreated,
    };
  }

  static async syncAllUsersNotifications(now = new Date()) {
    const users = await findUserIdsForNotificationSync();
    const results = await Promise.allSettled(
      users.map((user) => this.syncUserNotifications(user.id, now)),
    );

    const syncedUsers = results.filter((result) => result.status === "fulfilled").length;
    const failedUsers = results.length - syncedUsers;

    return {
      usersChecked: users.length,
      syncedUsers,
      failedUsers,
    };
  }

  static async createGhostWarning({ application, score }) {
    return createNotification({
      userId: application.userId,
      applicationId: application.id,
      type: "GHOST_STALE_WARNING",
      title: "Application may be stale",
      message: `${application.role} at ${
        application.company?.name || "this company"
      } has had low recent activity.`,
      sourceKey: `ghost-stale-warning:${application.id}`,
      data: {
        applicationId: application.id,
        company: application.company?.name || null,
        role: application.role,
        score,
      },
    });
  }

  static async createApplicationGhosted({ application, score }) {
    return createNotification({
      userId: application.userId,
      applicationId: application.id,
      type: "APPLICATION_GHOSTED",
      title: "Application marked ghosted",
      message: `${application.role} at ${
        application.company?.name || "this company"
      } was marked as ghosted.`,
      sourceKey: `application-ghosted:${application.id}`,
      data: {
        applicationId: application.id,
        company: application.company?.name || null,
        role: application.role,
        score,
      },
    });
  }

  static async getNotifications(userId, query = {}) {
    const notifications = await findNotificationsByUser(userId, {
      unreadOnly: query.unreadOnly === "true" || query.unreadOnly === true,
      limit: normalizeLimit(query.limit),
    });

    return notifications.map(toNotificationResponse);
  }

  static async getUnreadCount(userId) {
    return {
      unread: await countUnreadNotifications(userId),
    };
  }

  static async markRead(id, userId) {
    const result = await markNotificationRead(id, userId);
    return {
      success: true,
      updated: result.count,
    };
  }

  static async markAllRead(userId) {
    const result = await markAllNotificationsRead(userId);
    return {
      success: true,
      updated: result.count,
    };
  }

  static async delete(id, userId) {
    const result = await deleteNotification(id, userId);
    return {
      success: true,
      deleted: result.count,
    };
  }
}
