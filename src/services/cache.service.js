const CACHE_DISABLED =
  process.env.NODE_ENV === "test" || process.env.CACHE_ENABLED === "false";

let redisPromise;

const getRedis = async () => {
  if (CACHE_DISABLED) return null;
  if (!redisPromise) {
    redisPromise = import("../config/redis.js").then((module) => module.default);
  }
  return redisPromise;
};

export const getJson = async (key) => {
  try {
    const redis = await getRedis();
    if (!redis) return null;

    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.error(`Cache get failed for ${key}: ${err.message}`);
    return null;
  }
};

export const setJson = async (key, value, ttlSeconds) => {
  try {
    const redis = await getRedis();
    if (!redis) return false;

    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    return true;
  } catch (err) {
    console.error(`Cache set failed for ${key}: ${err.message}`);
    return false;
  }
};

export const getOrSetJson = async (key, ttlSeconds, fetcher) => {
  const cached = await getJson(key);
  if (cached !== null) return cached;

  const fresh = await fetcher();
  await setJson(key, fresh, ttlSeconds);
  return fresh;
};

export const del = async (...keys) => {
  const filteredKeys = keys.filter(Boolean);
  if (!filteredKeys.length) return 0;

  try {
    const redis = await getRedis();
    if (!redis) return 0;

    return await redis.del(...filteredKeys);
  } catch (err) {
    console.error(`Cache delete failed: ${err.message}`);
    return 0;
  }
};

export const delByPattern = async (pattern) => {
  try {
    const redis = await getRedis();
    if (!redis) return 0;

    let cursor = "0";
    let deleted = 0;

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        deleted += await redis.del(...keys);
      }
    } while (cursor !== "0");

    return deleted;
  } catch (err) {
    console.error(`Cache pattern delete failed for ${pattern}: ${err.message}`);
    return 0;
  }
};



// This is Redis SCAN syntax:

// redis.scan(cursor, "MATCH", pattern, "COUNT", 100)
// It means:

// Search Redis keys gradually, in small batches, instead of scanning everything at once.

// cursor
// cursor tells Redis where to continue scanning from.

// First call starts with:

// cursor = "0"
// Redis returns:

// [nextCursor, keys]
// Example:

// ["42", ["user:1:analytics:overview", "user:1:analytics:funnel"]]
// Now nextCursor = "42", so the next scan continues from there.

// When Redis returns:

// nextCursor = "0"
// it means scanning is finished.

// "MATCH", pattern
// This filters keys by pattern.

// Example:

// MATCH user:user_123:analytics:*
// Only returns keys that match that pattern.

// "COUNT", 100
// This is a hint to Redis:

// Try to check around 100 keys in this scan batch.

// It does not guarantee exactly 100 results.

// Redis may return:

// 0 keys
// 10 keys
// 100 keys
// more than 100 keys sometimes
// The point is to avoid blocking Redis by scanning the entire keyspace at once.

// Why not use KEYS user:user_123:*?
// Because KEYS scans everything immediately and can block Redis if there are many keys.

// SCAN is safer for production because it works in batches.