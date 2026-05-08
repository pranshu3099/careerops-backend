import { FOLLOWUPTYPE, getFollowUpMessage } from "../../constants/followup.js";
import {
  findAllByUser,
  findByApplication,
  findDueSoonByUser,
  findUpcomingByUser,
} from "./followup.repo.js";
import { getOrCreateSettings } from "../settings/settings.repo.js";

const TERMINAL_APPLICATION_STATUSES = [
  "ACCEPTED",
  "OFFER_DECLINED",
  "REJECTED",
  "GHOSTED",
];

const withFollowUpMessage = (followUp) =>
  followUp
    ? {
        ...followUp,
        message: getFollowUpMessage(followUp.type, followUp.sequence),
      }
    : null;

const getLatestActiveInterview = (interviews = []) =>
  interviews
    .filter((interview) => interview.status !== "CANCELLED")
    .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())[0];

const isInterviewFeedbackFollowUpValid = (application) => {
  if (application.status !== "INTERVIEWING") return false;

  const latestInterview = getLatestActiveInterview(application.interviews);
  if (!latestInterview) return false;
  if (latestInterview.scheduledAt > new Date()) return false;

  return !latestInterview.result || latestInterview.result === "PENDING";
};

const isUpcomingFollowUpValid = (followUp) => {
  const application = followUp.application;

  switch (followUp.type) {
    case FOLLOWUPTYPE.APPLICATION_CHECK:
      return application.status === "APPLIED";
    case FOLLOWUPTYPE.SHORTLISTED_CHECKIN:
      return application.status === "SHORTLISTED";
    case FOLLOWUPTYPE.INTERVIEW_FEEDBACK:
      return isInterviewFeedbackFollowUpValid(application);
    case FOLLOWUPTYPE.OFFER_FOLLOWUP:
      return application.status === "OFFERED";
    case FOLLOWUPTYPE.GENERAL_STATUS_CHECK:
      return !TERMINAL_APPLICATION_STATUSES.includes(application.status);
    default:
      return false;
  }
};

const isApplicationCheckFollowUpValid = (followUp) =>
  followUp.application.status === "APPLIED";

const isPendingApplicationCheck = (followUp) =>
  followUp.type === FOLLOWUPTYPE.APPLICATION_CHECK &&
  followUp.status === "PENDING";

const filterApplicationCheckFollowUps = (followUps) => {
  const nextApplicationCheckIds = new Set();
  const nextByApplication = new Set();

  [...followUps]
    .sort((a, b) => {
      const scheduledDiff = a.scheduledAt.getTime() - b.scheduledAt.getTime();
      return scheduledDiff || a.sequence - b.sequence;
    })
    .forEach((followUp) => {
      if (!isPendingApplicationCheck(followUp)) return;
      if (nextByApplication.has(followUp.applicationId)) return;
      if (!isApplicationCheckFollowUpValid(followUp)) return;

      nextByApplication.add(followUp.applicationId);
      nextApplicationCheckIds.add(followUp.id);
    });

  return followUps.filter(
    (followUp) =>
      !isPendingApplicationCheck(followUp) ||
      nextApplicationCheckIds.has(followUp.id),
  );
};

const toUpcomingFollowUpResponse = (followUp) => ({
  followUpId: followUp.id,
  applicationId: followUp.applicationId,
  company: followUp.application.company?.name || null,
  role: followUp.application.role,
  location: followUp.application.location,
  type: followUp.type,
  sequence: followUp.sequence,
  scheduledAt: followUp.scheduledAt,
  status: followUp.application.status,
  appliedAt: followUp.application.appliedAt,
  message: getFollowUpMessage(followUp.type, followUp.sequence),
});

const toDueSoonFollowUpResponse = (followUp) => ({
  ...toUpcomingFollowUpResponse(followUp),
  alert: {
    title: "Follow-up scheduled soon",
    message: `Follow-up scheduled soon for ${followUp.application.role} at ${
      followUp.application.company?.name || "this company"
    }.`,
    actions: ["UPDATE_STATUS", "VIEW_APPLICATION"],
  },
});

const toFollowUpResponse = (followUp) => ({
  followUpId: followUp.id,
  applicationId: followUp.applicationId,
  company: followUp.application.company?.name || null,
  role: followUp.application.role,
  location: followUp.application.location,
  type: followUp.type,
  sequence: followUp.sequence,
  scheduledAt: followUp.scheduledAt,
  executedAt: followUp.executedAt,
  status: followUp.status,
  applicationStatus: followUp.application.status,
  appliedAt: followUp.application.appliedAt,
  message: getFollowUpMessage(followUp.type, followUp.sequence),
});

export const getEndOfTomorrow = (now) => {
  const end = new Date(now);
  end.setDate(end.getDate() + 1);
  end.setHours(23, 59, 59, 999);
  return end;
};

export const getAlertWindowEnd = (now, alertDays) => {
  if (alertDays <= 0) {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  const end = new Date(now);
  end.setDate(end.getDate() + alertDays);
  end.setHours(23, 59, 59, 999);
  return end;
};

export class FollowUpService {
  static async getAllFollowUps(userId) {
    const followUps = await findAllByUser(userId);
    return filterApplicationCheckFollowUps(followUps).map(toFollowUpResponse);
  }

  static async getApplicationFollowUps(applicationId, userId) {
    const followUps = await findByApplication(applicationId, userId);
    return followUps.map(withFollowUpMessage);
  }

  static async getUpcomingFollowUps(userId) {
    const followUps = await findUpcomingByUser(userId);
    const nextByApplication = new Map();

    followUps.forEach((followUp) => {
      if (nextByApplication.has(followUp.applicationId)) return;
      if (!isUpcomingFollowUpValid(followUp)) return;

      nextByApplication.set(
        followUp.applicationId,
        toUpcomingFollowUpResponse(followUp),
      );
    });

    return [...nextByApplication.values()];
  }

  static async getDueSoonFollowUps(userId, now = new Date()) {
    const settings = await getOrCreateSettings(userId);
    if (!settings.followUpAlertsEnabled) return [];

    const windowEnd = getAlertWindowEnd(now, settings.followUpAlertDays);
    const followUps = await findDueSoonByUser(userId, now, windowEnd);

    return followUps
      .filter(isUpcomingFollowUpValid)
      .map(toDueSoonFollowUpResponse);
  }
}
