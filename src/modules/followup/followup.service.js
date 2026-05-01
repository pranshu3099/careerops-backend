import { FOLLOWUPTYPE, getFollowUpMessage } from "../../constants/followup.js";
import {
  findByApplication,
  findUpcomingByUser,
} from "./followup.repo.js";

const withFollowUpMessage = (followUp) =>
  followUp
    ? {
        ...followUp,
        message: getFollowUpMessage(followUp.type, followUp.sequence),
      }
    : null;

const hasInterviewResult = (interviews = []) =>
  interviews.some(
    (interview) => interview.result && interview.result !== "PENDING",
  );

const isUpcomingFollowUpValid = (followUp) => {
  const application = followUp.application;

  switch (followUp.type) {
    case FOLLOWUPTYPE.APPLICATION_CHECK:
      return application.status === "APPLIED";
    case FOLLOWUPTYPE.SHORTLISTED_CHECKIN:
      return application.status === "SHORTLISTED";
    case FOLLOWUPTYPE.INTERVIEW_FEEDBACK:
      return (
        application.status === "INTERVIEWING" &&
        !hasInterviewResult(application.interviews)
      );
    case FOLLOWUPTYPE.OFFER_FOLLOWUP:
      return application.status === "OFFERED";
    case FOLLOWUPTYPE.GENERAL_STATUS_CHECK:
      return !["REJECTED", "GHOSTED"].includes(application.status);
    default:
      return false;
  }
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

export class FollowUpService {
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
}
