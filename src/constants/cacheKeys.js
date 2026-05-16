export const CACHE_TTL_SECONDS = {
  APPLICATION_STATS: 60,
  APPLICATION_LIST: 60,
  ANALYTICS: 60,
  UPCOMING_FOLLOWUPS: 30,
  DUE_SOON_FOLLOWUPS: 30,
  INTERVIEW_LIST: 60,
  NOTIFICATION_UNREAD_COUNT: 15,
};

export const cacheKeys = {
  applications: (userId) => `user:${userId}:applications:list`,
  applicationStats: (userId) => `user:${userId}:applications:stats`,
  upcomingFollowUps: (userId) => `user:${userId}:followups:upcoming`,
  dueSoonFollowUps: (userId) => `user:${userId}:followups:due-soon`,
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

// That is fail-open: cache failure does not break the request.

// For the NOTIFICATION_UNREAD_COUNT = 15 TTL:

// Yes, the reason is freshness.

// Unread count is a small but user-visible value. If a user clicks “mark as read”, they expect the bell count to update quickly. So we use a short TTL:

// NOTIFICATION_UNREAD_COUNT: 15
// That means even if invalidation somehow misses, the stale unread count expires after at most 15 seconds.

// Why not 60 seconds?

// Because a stale notification badge for 1 minute feels annoying.

// Why not 1 second?

// Because then caching barely helps; it would hit DB too often.

// So 15s is a practical balance:

// reduces repeated navbar unread-count DB hits
// keeps the badge reasonably fresh
// acts as a safety net if invalidation misses
// Also, we invalidate immediately on notification create/read/delete, so in normal cases the user sees fresh data on the next request. TTL is just the backup.
