import { Queue } from "bullmq";
import redisConnection from "../config/redis.js";

export const createQueue = (queueName) =>
  new Queue(queueName, {
    connection: redisConnection,
  });
