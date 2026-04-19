import IORedis from "ioredis";
const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
  // password: process.env.REDIS_PASSWORD || undefined,
  // BullMQ requires this to be null for blocking commands
  maxRetriesPerRequest: null,
});

export default redisConnection;
