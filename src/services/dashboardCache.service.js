import { cacheKeys } from "../constants/cacheKeys.js";
import { delByPattern } from "./cache.service.js";

export const invalidateUserDashboardCache = async (userId) => {
  if (!userId) return { deleted: 0 };

  const results = await Promise.allSettled([
    delByPattern(cacheKeys.userAnalyticsPattern(userId)),
    delByPattern(cacheKeys.userApplicationPattern(userId)),
    delByPattern(cacheKeys.userFollowUpPattern(userId)),
    delByPattern(cacheKeys.userInterviewPattern(userId)),
  ]);

  return {
    deleted: results.reduce(
      (sum, result) =>
        result.status === "fulfilled" ? sum + result.value : sum,
      0,
    ),
  };
};

export const invalidateUserNotificationCache = async (userId) => {
  if (!userId) return { deleted: 0 };

  return {
    deleted: await delByPattern(cacheKeys.userNotificationPattern(userId)),
  };
};
