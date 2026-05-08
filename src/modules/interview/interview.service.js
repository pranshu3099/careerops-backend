import {
  createInterview as createInterviewInRepo,
  findAllByUser,
  findApplicationForInterview,
  findByApplication,
  findByIdForUser,
  updateInterviewById,
  updateInterviewResult as updateInterviewResultInRepo,
} from "./interview.repo.js";
import FollowUpEmailScheduler from "../../scheduler/followupemail.scheduler.js";

const toInterviewResponse = (interview) => ({
  id: interview.id,
  applicationId: interview.applicationId,
  round: interview.round,
  roundName: interview.roundName,
  type: interview.type,
  interviewer: interview.interviewer,
  scheduledAt: interview.scheduledAt,
  status: interview.status,
  feedback: interview.feedback,
  result: interview.result,
  createdAt: interview.createdAt,
  updatedAt: interview.updatedAt,
});

const toUserInterviewResponse = (interview) => ({
  ...toInterviewResponse(interview),
  application: {
    id: interview.application.id,
    company: interview.application.company?.name || null,
    role: interview.application.role,
    location: interview.application.location,
    status: interview.application.status,
    appliedAt: interview.application.appliedAt,
  },
});

const trimIfString = (value) =>
  typeof value === "string" ? value.trim() : value;

const getNextInterviewRound = (interviews) => {
  if (interviews.some((interview) => interview.status === "SCHEDULED")) {
    throw new Error(
      "Complete or cancel the scheduled interview before adding another round",
    );
  }

  const nonCancelledRounds = interviews
    .filter((interview) => interview.status !== "CANCELLED")
    .sort((a, b) => a.round - b.round);

  if (nonCancelledRounds.length === 0) return 1;

  const latestnonCancelledRounds = nonCancelledRounds[nonCancelledRounds.length - 1];
  if (
    latestnonCancelledRounds.status !== "COMPLETED" ||
    latestnonCancelledRounds.result !== "PASSED"
  ) {
    throw new Error(
      "Next round can only be added after passing the current round",
    );
  }

  let nextRound = 1;
  const usedRounds = new Set(nonCancelledRounds.map((interview) => interview.round));
  while (usedRounds.has(nextRound)) nextRound++;

  return nextRound;
};

const removeQueuedFollowUps = async (followUps) => {
  const results = await Promise.allSettled(
    followUps.map((followUp) =>
      FollowUpEmailScheduler.removeFollowUpJob(followUp.id),
    ),
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        `Failed to remove followup job ${followUps[index].id}: ${result.reason?.message}`,
      );
    }
  });
};

export class InterviewService {
  static async getAllInterviews(userId) {
    const interviews = await findAllByUser(userId);
    return interviews.map(toUserInterviewResponse);
  }

  static async createInterview(userId, data) {
    const application = await findApplicationForInterview(
      data.applicationId,
      userId,
    );

    if (!application) throw new Error("Application not found");
    if (application.status !== "INTERVIEWING") {
      throw new Error(
        "Interview can only be scheduled for interviewing applications",
      );
    }

    const scheduledAt = new Date(data.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new Error("Invalid scheduledAt");
    }

    const interviews = await findByApplication(application.id, userId);
    const nextRound = getNextInterviewRound(interviews);

    const interview = await createInterviewInRepo({
      application,
      interviewData: {
        applicationId: application.id,
        round: nextRound,
        roundName: trimIfString(data.roundName),
        type: data.type,
        interviewer: trimIfString(data.interviewer),
        scheduledAt,
        status: "SCHEDULED",
      },
    });

    return {
      success: true,
      interview: toInterviewResponse(interview),
      applicationStatus: application.status,
    };
  }

  static async getApplicationInterviews(applicationId, userId) {
    const interviews = await findByApplication(applicationId, userId);
    return interviews.map(toInterviewResponse);
  }

  static async updateInterview(id, userId, data) {
    const interview = await findByIdForUser(id, userId);
    if (!interview) throw new Error("Interview not found");
    if (interview.status !== "SCHEDULED") {
      throw new Error("Only scheduled interviews can be updated");
    }

    const updateData = {};

    if (data.roundName !== undefined) {
      updateData.roundName = trimIfString(data.roundName);
    }
    if (data.type !== undefined) updateData.type = data.type;
    if (data.interviewer !== undefined) {
      updateData.interviewer = trimIfString(data.interviewer);
    }
    if (data.feedback !== undefined) {
      updateData.feedback = trimIfString(data.feedback);
    }
    if (data.scheduledAt !== undefined) {
      const scheduledAt = new Date(data.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime())) {
        throw new Error("Invalid scheduledAt");
      }
      updateData.scheduledAt = scheduledAt;
    }

    const updated = await updateInterviewById(id, updateData);

    return {
      success: true,
      interview: toInterviewResponse(updated),
    };
  }

  static async cancelInterview(id, userId) {
    const interview = await findByIdForUser(id, userId);
    if (!interview) throw new Error("Interview not found");
    if (interview.status !== "SCHEDULED") {
      throw new Error("Only scheduled interviews can be cancelled");
    }

    const updated = await updateInterviewById(id, {
      status: "CANCELLED",
      result: null,
    });

    return {
      success: true,
      interview: toInterviewResponse(updated),
    };
  }

  static async updateInterviewResult(id, userId, data) {
    const interview = await findByIdForUser(id, userId);
    if (!interview) throw new Error("Interview not found");
    if (interview.status === "CANCELLED") {
      throw new Error("Cancelled interviews cannot be updated with a result");
    }
    if (interview.status !== "SCHEDULED") {
      throw new Error("Only scheduled interviews can be completed");
    }

    const nextStatus = data.result === "PENDING" ? "SCHEDULED" : "COMPLETED";


    const { updatedInterview, cancelledFollowUps } =
      await updateInterviewResultInRepo({
        interview,
        data: {
          result: data.result,
          feedback: trimIfString(data.feedback),
          status: nextStatus,
        },
      });

    if (cancelledFollowUps.length > 0) {
      await removeQueuedFollowUps(cancelledFollowUps);
    }

    return {
      success: true,
      interview: toInterviewResponse(updatedInterview),
      applicationStatus:
        data.result === "FAILED" ? "REJECTED" : interview.application.status,
      cancelledFollowUps: cancelledFollowUps.length,
    };
  }
}
