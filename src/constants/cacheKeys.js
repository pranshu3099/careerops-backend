export const CACHE_TTL_SECONDS = {
  APPLICATION_STATS: 60,
  APPLICATION_LIST: 60,
  ANALYTICS: 60,
  UPCOMING_FOLLOWUPS: 30,
  INTERVIEW_LIST: 60,
  NOTIFICATION_UNREAD_COUNT: 15,
};

export const cacheKeys = {
  applications: (userId) => `user:${userId}:applications:list`,
  applicationStats: (userId) => `user:${userId}:applications:stats`,
  upcomingFollowUps: (userId) => `user:${userId}:followups:upcoming`,
  interviews: (userId) => `user:${userId}:interviews:list`,
  notificationUnreadCount: (userId) =>
    `user:${userId}:notifications:unread-count`,
  analyticsOverview: (userId) => `user:${userId}:analytics:overview`,
  analyticsFunnel: (userId) => `user:${userId}:analytics:funnel`,
  analyticsTimeline: (userId, { range, bucket }) =>
    `user:${userId}:analytics:timeline:range=${range}:bucket=${bucket}`,
  analyticsSources: (userId) => `user:${userId}:analytics:sources`,
  analyticsInterviews: (userId) => `user:${userId}:analytics:interviews`,
  analyticsTimeMetrics: (userId) => `user:${userId}:analytics:time-metrics`,
  userAnalyticsPattern: (userId) => `user:${userId}:analytics:*`,
  userApplicationPattern: (userId) => `user:${userId}:applications:*`,
  userFollowUpPattern: (userId) => `user:${userId}:followups:*`,
  userInterviewPattern: (userId) => `user:${userId}:interviews:*`,
  userNotificationPattern: (userId) => `user:${userId}:notifications:*`,
};

//The * means: Match anything after this prefix.
// Short version: * is a wildcard that lets us clear all related cached dashboard data for a specific user after something changes.
