import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { cfg } from "./config.js";

const connection = new Redis(cfg.redisUrl, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableOfflineQueue: false   // Recommended to avoid command buffering when Redis is down
});

export const planQueue = new Queue('plan', { connection });
export const execQueue = new Queue('exec', { connection });
export const evalQueue = new Queue('eval', { connection });
export const sweepQueue = new Queue('sweep', { connection });

export { connection };
