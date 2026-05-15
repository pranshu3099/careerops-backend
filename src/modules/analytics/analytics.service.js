import {
  getApplicationsForAnalytics,
  getEventLogsForAnalytics,
} from "./analytics.repo.js";
import { CACHE_TTL_SECONDS, cacheKeys } from "../../constants/cacheKeys.js";
import { getOrSetJson } from "../../services/cache.service.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const STATUS_ORDER = [
  "APPLIED",
  "SHORTLISTED",
  "INTERVIEWING",
  "OFFERED",
  "ACCEPTED",
];
const TERMINAL_STATUSES = ["ACCEPTED", "OFFER_DECLINED", "REJECTED", "GHOSTED"];
const APPLICATION_STATUSES = [
  "APPLIED",
  "SHORTLISTED",
  "INTERVIEWING",
  "OFFERED",
  "ACCEPTED",
  "OFFER_DECLINED",
  "REJECTED",
  "GHOSTED",
];
const APPLICATION_SOURCES = [
  "CAREER_PAGE",
  "REFERRAL",
  "LINKEDIN",
  "NAUKRI",
  "RECRUITER",
  "OTHER",
];
const INTERVIEW_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"];
const INTERVIEW_RESULTS = ["PASSED", "FAILED", "PENDING"];
const INTERVIEW_TYPES = [
  "DSA",
  "TECHNICAL",
  "SYSTEM_DESIGN",
  "HR",
  "MANAGERIAL",
  "BEHAVIORAL",
  "TAKE_HOME",
  "OTHER",
];
const FOLLOWUP_STATUSES = ["PENDING", "SENT", "FAILED", "CANCELLED"];
const FOLLOWUP_TYPES = [
  "APPLICATION_CHECK",
  "SHORTLISTED_CHECKIN",
  "INTERVIEW_FEEDBACK",
  "OFFER_FOLLOWUP",
  "GENERAL_STATUS_CHECK",
];
const STATUS_RANK = APPLICATION_STATUSES.reduce(
  (acc, status, index) => ({ ...acc, [status]: index }),
  {},
);

const zeroCounts = (keys) =>
  keys.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

const increment = (counts, key) => {
  counts[key] = (counts[key] || 0) + 1;
};

const round = (value, decimals = 2) =>
  Number.isFinite(value) ? Number(value.toFixed(decimals)) : 0;

const percentage = (numerator, denominator) =>
  denominator > 0 ? round((numerator / denominator) * 100) : 0;

const average = (values) =>
  values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;

const daysBetween = (from, to) => (to.getTime() - from.getTime()) / MS_PER_DAY;

const getRangeStart = (range = "90d", now = new Date()) => {
  const match = String(range).match(/^(\d+)(d|w|m|y)$/);
  if (!match) return new Date(now.getTime() - 90 * MS_PER_DAY);

  const amount = Number(match[1]);
  const unit = match[2];
  const date = new Date(now);

  if (unit === "d") date.setDate(date.getDate() - amount);
  if (unit === "w") date.setDate(date.getDate() - amount * 7);
  if (unit === "m") date.setMonth(date.getMonth() - amount);
  if (unit === "y") date.setFullYear(date.getFullYear() - amount);

  return date;
};

const getBucketKey = (date, bucket = "week") => {
  const value = new Date(date);

  if (bucket === "month") {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  const day = value.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setUTCDate(value.getUTCDate() + diff);
  return value.toISOString().slice(0, 10);
};

const getEventStatus = (event, key) => {
  const value = event?.payload?.[key];
  return typeof value === "string" ? value : null;
};

const getCurrentStageReached = (status, stage) => {
  if (status === stage) return true;
  if (stage === "ACCEPTED") return status === "ACCEPTED";
  return (STATUS_RANK[status] ?? -1) >= (STATUS_RANK[stage] ?? 999);
};

const getReachedJourneyStages = (history, currentStatus) => {
  const reached = new Set(
    history
      .map((entry) => entry.status)
      .filter((status) => STATUS_ORDER.includes(status)),
  );
  const currentStageIndex = STATUS_ORDER.indexOf(currentStatus);

  if (currentStageIndex >= 0) {
    STATUS_ORDER.slice(0, currentStageIndex + 1).forEach((stage) =>
      reached.add(stage),
    );
  }

  return STATUS_ORDER.filter((stage) => reached.has(stage));
};

const getApplicationProgressRate = (reachedStages) => {
  const maxStageIndex = Math.max(
    ...reachedStages.map((stage) => STATUS_ORDER.indexOf(stage)),
    0,
  );

  return percentage(maxStageIndex + 1, STATUS_ORDER.length);
};

const normalizeStatusPath = (history, currentStatus) => {
  const path = [];

  history.forEach((entry) => {
    if (entry.status && path[path.length - 1]?.status !== entry.status) {
      path.push(entry);
    }
  });

  if (currentStatus && path[path.length - 1]?.status !== currentStatus) {
    path.push({
      status: currentStatus,
      at: path[path.length - 1]?.at || new Date(),
    });
  }

  return path;
};

const buildStatusHistory = (applications, events) => {
  const historyByApplication = new Map();

  applications.forEach((application) => {
    historyByApplication.set(application.id, [
      {
        status: "APPLIED",
        at: application.appliedAt || application.createdAt,
      },
    ]);
  });

  events.forEach((event) => {
    if (!event.applicationId || event.type !== "STATUS_UPDATED") return;

    const from = getEventStatus(event, "from");
    const to = getEventStatus(event, "to");
    if (!to) return;

    const history = historyByApplication.get(event.applicationId) || [];
    if (from) history.push({ status: from, at: event.createdAt });
    history.push({ status: to, at: event.createdAt });
    historyByApplication.set(event.applicationId, history);
  });

  historyByApplication.forEach((history) => {
    history.sort((a, b) => a.at.getTime() - b.at.getTime());
  });

  return historyByApplication;
};

const buildSnapshot = (applications) => {
  const applicationsByStatus = zeroCounts(APPLICATION_STATUSES);
  const applicationsBySource = zeroCounts(APPLICATION_SOURCES);
  const applicationsByMonth = {};
  const interviewStatusCounts = zeroCounts(INTERVIEW_STATUSES);
  const interviewResultCounts = zeroCounts(INTERVIEW_RESULTS);
  const interviewsByType = zeroCounts(INTERVIEW_TYPES);
  const followUpStatusCounts = zeroCounts(FOLLOWUP_STATUSES);
  const followUpsByType = zeroCounts(FOLLOWUP_TYPES);
  const dueSoonAt = new Date(Date.now() + 7 * MS_PER_DAY);

  let totalInterviews = 0;
  let totalRounds = 0;
  let applicationsWithInterviews = 0;
  let waitingOnResult = 0;
  let dueSoonFollowUps = 0;

  applications.forEach((application) => {
    increment(applicationsByStatus, application.status);
    increment(applicationsBySource, application.source);
    increment(applicationsByMonth, getBucketKey(application.appliedAt, "month"));

    if (!TERMINAL_STATUSES.includes(application.status)) {
      const hasPendingInterview = application.interviews.some(
        (interview) =>
          interview.status === "SCHEDULED" &&
          (!interview.result || interview.result === "PENDING"),
      );
      if (hasPendingInterview) waitingOnResult += 1;
    }

    if (application.interviews.length > 0) {
      applicationsWithInterviews += 1;
      totalRounds += application.interviews.filter(
        (interview) => interview.status !== "CANCELLED",
      ).length;
    }

    application.interviews.forEach((interview) => {
      totalInterviews += 1;
      increment(interviewStatusCounts, interview.status);
      increment(interviewsByType, interview.type);
      if (interview.result) increment(interviewResultCounts, interview.result);
    });

    application.followUps.forEach((followUp) => {
      increment(followUpStatusCounts, followUp.status);
      increment(followUpsByType, followUp.type);
      if (
        followUp.status === "PENDING" &&
        !followUp.executedAt &&
        followUp.scheduledAt <= dueSoonAt
      ) {
        dueSoonFollowUps += 1;
      }
    });
  });

  return {
    applicationsByStatus,
    applicationsBySource,
    applicationsOverTime: Object.entries(applicationsByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, count]) => ({ period, count })),
    interviews: {
      total: totalInterviews,
      scheduled: interviewStatusCounts.SCHEDULED,
      completed: interviewStatusCounts.COMPLETED,
      cancelled: interviewStatusCounts.CANCELLED,
      results: interviewResultCounts,
      byType: interviewsByType,
      averageRoundsPerApplication:
        applicationsWithInterviews > 0
          ? round(totalRounds / applicationsWithInterviews)
          : 0,
      applicationsWaitingOnResult: waitingOnResult,
    },
    followUps: {
      pending: followUpStatusCounts.PENDING,
      sent: followUpStatusCounts.SENT,
      failed: followUpStatusCounts.FAILED,
      cancelled: followUpStatusCounts.CANCELLED,
      dueSoon: dueSoonFollowUps,
      byType: followUpsByType,
    },
  };
};

const buildFunnel = (applications, events) => {
  const historyByApplication = buildStatusHistory(applications, events);
  const stageCounts = zeroCounts(STATUS_ORDER);

  applications.forEach((application) => {
    const reached = new Set(
      (historyByApplication.get(application.id) || []).map((item) => item.status),
    );

    STATUS_ORDER.forEach((stage) => {
      if (reached.has(stage) || getCurrentStageReached(application.status, stage)) {
        stageCounts[stage] += 1;
      }
    });
  });

  const steps = STATUS_ORDER.map((stage, index) => {
    const count = stageCounts[stage];
    const previous = index === 0 ? count : stageCounts[STATUS_ORDER[index - 1]];

    return {
      stage,
      count,
      fromPreviousRate: index === 0 ? 100 : percentage(count, previous),
      fromAppliedRate: percentage(count, stageCounts.APPLIED),
    };
  });

  const transitions = [
    ["APPLIED", "SHORTLISTED"],
    ["SHORTLISTED", "INTERVIEWING"],
    ["INTERVIEWING", "OFFERED"],
    ["OFFERED", "ACCEPTED"],
    ["OFFERED", "OFFER_DECLINED"],
  ].map(([from, to]) => {
    const count = events.filter(
      (event) =>
        event.type === "STATUS_UPDATED" &&
        getEventStatus(event, "from") === from &&
        getEventStatus(event, "to") === to,
    ).length;

    return {
      from,
      to,
      count,
      conversionRate: percentage(count, stageCounts[from]),
    };
  });

  const rejected = applications.filter(
    (application) => application.status === "REJECTED" || application.status === "GHOSTED",
  ).length;

  const journeys = applications
    .map((application) => {
      const history = normalizeStatusPath(
        historyByApplication.get(application.id) || [],
        application.status,
      );
      const reachedStages = getReachedJourneyStages(history, application.status);
      const terminalEntry = history.find((entry) =>
        TERMINAL_STATUSES.includes(entry.status),
      );

      return {
        applicationId: application.id,
        company: application.company?.name || null,
        role: application.role,
        currentStatus: application.status,
        outcomeStatus: terminalEntry?.status || null,
        isTerminal: TERMINAL_STATUSES.includes(application.status),
        appliedAt: application.appliedAt,
        lastUpdatedAt: history[history.length - 1]?.at || application.createdAt,
        progressRate: getApplicationProgressRate(reachedStages),
        reachedStages,
        path: history.map((entry) => ({
          status: entry.status,
          at: entry.at,
        })),
      };
    })
    .sort((a, b) => b.lastUpdatedAt.getTime() - a.lastUpdatedAt.getTime());

  return {
    steps,
    transitions,
    conversionRates: {
      appliedToInterviewing: percentage(stageCounts.INTERVIEWING, stageCounts.APPLIED),
      interviewingToOffered: percentage(stageCounts.OFFERED, stageCounts.INTERVIEWING),
      offeredToAccepted: percentage(stageCounts.ACCEPTED, stageCounts.OFFERED),
      rejectionRate: percentage(rejected, applications.length),
    },
    journeys,
  };
};

const buildTimeMetrics = (applications, events) => {
  const historyByApplication = buildStatusHistory(applications, events);
  const firstInterviewDays = [];
  const interviewToOfferDays = [];
  const finalOutcomeDays = [];
  const stageDurations = {
    APPLIED_TO_SHORTLISTED: [],
    SHORTLISTED_TO_INTERVIEWING: [],
    INTERVIEWING_TO_OFFERED: [],
    OFFERED_TO_ACCEPTED: [],
    OFFERED_TO_DECLINED: [],
  };

  applications.forEach((application) => {
    const history = historyByApplication.get(application.id) || [];
    const firstByStatus = new Map();

    history.forEach((entry) => {
      if (!firstByStatus.has(entry.status)) firstByStatus.set(entry.status, entry.at);
    });

    const firstInterview = application.interviews
      .slice()
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0];

    if (firstInterview) {
      firstInterviewDays.push(daysBetween(application.appliedAt, firstInterview.scheduledAt));
    }

    const offeredAt = firstByStatus.get("OFFERED");
    if (firstInterview && offeredAt) {
      interviewToOfferDays.push(daysBetween(firstInterview.scheduledAt, offeredAt));
    }

    const finalEntry = history.find((entry) => TERMINAL_STATUSES.includes(entry.status));
    if (finalEntry) {
      finalOutcomeDays.push(daysBetween(application.appliedAt, finalEntry.at));
    }

    const transitions = [
      ["APPLIED", "SHORTLISTED", "APPLIED_TO_SHORTLISTED"],
      ["SHORTLISTED", "INTERVIEWING", "SHORTLISTED_TO_INTERVIEWING"],
      ["INTERVIEWING", "OFFERED", "INTERVIEWING_TO_OFFERED"],
      ["OFFERED", "ACCEPTED", "OFFERED_TO_ACCEPTED"],
      ["OFFERED", "OFFER_DECLINED", "OFFERED_TO_DECLINED"],
    ];

    transitions.forEach(([from, to, key]) => {
      const fromAt = firstByStatus.get(from);
      const toAt = firstByStatus.get(to);
      if (fromAt && toAt) stageDurations[key].push(daysBetween(fromAt, toAt));
    });
  });

  return {
    averageTimeToFirstInterviewDays: average(firstInterviewDays),
    averageTimeFromInterviewToOfferDays: average(interviewToOfferDays),
    averageTimeToFinalOutcomeDays: average(finalOutcomeDays),
    averageTimeInStageDays: Object.fromEntries(
      Object.entries(stageDurations).map(([key, values]) => [key, average(values)]),
    ),
  };
};

const buildSourcePerformance = (applications) => {
  const sources = zeroCounts(APPLICATION_SOURCES);

  return Object.keys(sources).map((source) => {
    const sourceApplications = applications.filter(
      (application) => application.source === source,
    );
    const offers = sourceApplications.filter((application) =>
      ["OFFERED", "ACCEPTED", "OFFER_DECLINED"].includes(application.status),
    ).length;
    const accepted = sourceApplications.filter(
      (application) => application.status === "ACCEPTED",
    ).length;
    const rejected = sourceApplications.filter(
      (application) => application.status === "REJECTED",
    ).length;

    return {
      source,
      applications: sourceApplications.length,
      offers,
      accepted,
      rejected,
      offerRate: percentage(offers, sourceApplications.length),
      acceptanceRate: percentage(accepted, sourceApplications.length),
      rejectionRate: percentage(rejected, sourceApplications.length),
    };
  });
};

const buildInterviewPerformance = (applications) => {
  const byType = Object.fromEntries(
    INTERVIEW_TYPES.map((type) => [
      type,
      { passed: 0, failed: 0, pending: 0, scheduled: 0, completed: 0, cancelled: 0 },
    ]),
  );
  const roundsBeforeOffer = [];
  let cancelled = 0;

  applications.forEach((application) => {
    application.interviews.forEach((interview) => {
      const bucket = byType[interview.type] || byType.OTHER;
      if (interview.status === "SCHEDULED") bucket.scheduled += 1;
      if (interview.status === "COMPLETED") bucket.completed += 1;
      if (interview.status === "CANCELLED") {
        bucket.cancelled += 1;
        cancelled += 1;
      }
      if (interview.result === "PASSED") bucket.passed += 1;
      if (interview.result === "FAILED") bucket.failed += 1;
      if (interview.result === "PENDING") bucket.pending += 1;
    });

    if (["OFFERED", "ACCEPTED", "OFFER_DECLINED"].includes(application.status)) {
      const rounds = application.interviews.filter(
        (interview) => interview.status !== "CANCELLED",
      ).length;
      if (rounds > 0) roundsBeforeOffer.push(rounds);
    }
  });

  return {
    byType,
    averageRoundsBeforeOffer: average(roundsBeforeOffer),
    cancelledInterviews: cancelled,
  };
};

const buildTimeline = (applications, events, bucket) => {
  const buckets = {};

  const ensureBucket = (date) => {
    const key = getBucketKey(date, bucket);
    if (!buckets[key]) {
      buckets[key] = {
        period: key,
        applicationsAdded: 0,
        statusChanges: 0,
        interviewsScheduled: 0,
        followUpsCompleted: 0,
        events: zeroCounts([
          "APPLICATION_CREATED",
          "STATUS_UPDATED",
          "FOLLOW_UP_SENT",
          "INTERVIEW_SCHEDULED",
          "GHOST_DETECTED",
        ]),
      };
    }
    return buckets[key];
  };

  applications.forEach((application) => {
    ensureBucket(application.appliedAt).applicationsAdded += 1;
  });

  events.forEach((event) => {
    const item = ensureBucket(event.createdAt);
    increment(item.events, event.type);
    if (event.type === "STATUS_UPDATED") item.statusChanges += 1;
    if (event.type === "INTERVIEW_SCHEDULED") item.interviewsScheduled += 1;
    if (event.type === "FOLLOW_UP_SENT") item.followUpsCompleted += 1;
  });

  return Object.values(buckets).sort((a, b) => a.period.localeCompare(b.period));
};

export class AnalyticsService {
  static async getOverview(userId) {
    return getOrSetJson(
      cacheKeys.analyticsOverview(userId),
      CACHE_TTL_SECONDS.ANALYTICS,
      async () => {
        const applications = await getApplicationsForAnalytics(userId);
        const snapshot = buildSnapshot(applications);

        return {
          pipeline: {
            totalApplications: applications.length,
            activeApplications: applications.filter(
              (application) => !TERMINAL_STATUSES.includes(application.status),
            ).length,
            interviews: snapshot.interviews.total,
            offers: applications.filter((application) =>
              ["OFFERED", "ACCEPTED", "OFFER_DECLINED"].includes(
                application.status,
              ),
            ).length,
            accepted: snapshot.applicationsByStatus.ACCEPTED,
            rejected: snapshot.applicationsByStatus.REJECTED,
            ghosted: snapshot.applicationsByStatus.GHOSTED,
          },
          ...snapshot,
        };
      },
    );
  }

  static async getFunnel(userId) {
    return getOrSetJson(
      cacheKeys.analyticsFunnel(userId),
      CACHE_TTL_SECONDS.ANALYTICS,
      async () => {
        const applications = await getApplicationsForAnalytics(userId);
        const events = await getEventLogsForAnalytics(userId);
        return buildFunnel(applications, events);
      },
    );
  }

  static async getTimeline(userId, { range = "90d", bucket = "week" } = {}) {
    const normalizedBucket = bucket === "month" ? "month" : "week";

    return getOrSetJson(
      cacheKeys.analyticsTimeline(userId, {
        range,
        bucket: normalizedBucket,
      }),
      CACHE_TTL_SECONDS.ANALYTICS,
      async () => {
        const from = getRangeStart(range);
        const applications = (await getApplicationsForAnalytics(userId)).filter(
          (application) => application.appliedAt >= from,
        );
        const events = await getEventLogsForAnalytics(userId, from);

        return {
          range,
          bucket: normalizedBucket,
          from,
          data: buildTimeline(applications, events, normalizedBucket),
        };
      },
    );
  }

  static async getSources(userId) {
    return getOrSetJson(
      cacheKeys.analyticsSources(userId),
      CACHE_TTL_SECONDS.ANALYTICS,
      async () => {
        const applications = await getApplicationsForAnalytics(userId);
        return buildSourcePerformance(applications);
      },
    );
  }

  static async getInterviews(userId) {
    return getOrSetJson(
      cacheKeys.analyticsInterviews(userId),
      CACHE_TTL_SECONDS.ANALYTICS,
      async () => {
        const applications = await getApplicationsForAnalytics(userId);
        const snapshot = buildSnapshot(applications);
        const performance = buildInterviewPerformance(applications);

        return {
          ...snapshot.interviews,
          performance,
        };
      },
    );
  }

  static async getTimeMetrics(userId) {
    return getOrSetJson(
      cacheKeys.analyticsTimeMetrics(userId),
      CACHE_TTL_SECONDS.ANALYTICS,
      async () => {
        const applications = await getApplicationsForAnalytics(userId);
        const events = await getEventLogsForAnalytics(userId);
        return buildTimeMetrics(applications, events);
      },
    );
  }
}
