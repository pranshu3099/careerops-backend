import redis from "../config/redis.js";

export const slidingWindowRateLimiter = async ({
  key,
  limit,
  windowSizeInSeconds,
}) => {
  const now = Date.now();
  const currentWindow = Math.floor(now / (windowSizeInSeconds * 1000));
  const previousWindow = currentWindow - 1;

  const currentKey = `${key}:${currentWindow}`;
  const previousKey = `${key}:${previousWindow}`;

  const currentCount = await redis.incr(currentKey);
  if (currentCount === 1) {
    await redis.expire(currentKey, windowSizeInSeconds * 2);
  }

  const previousCount = parseInt((await redis.get(previousKey)) || "0");

  const elapsed = now % (windowSizeInSeconds * 1000);
  const overlapPercentage =
    (windowSizeInSeconds * 1000 - elapsed) /
    (windowSizeInSeconds * 1000);

  const effectiveCount =
    previousCount * overlapPercentage + currentCount;

  return effectiveCount <= limit;
};
