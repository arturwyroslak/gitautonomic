import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { cfg } from "./config.js";

const connection = new Redis(cfg.redisUrl);

export const planQueue = new Queue('plan', { connection });
export const execQueue = new Queue('exec', { connection });
export const evalQueue = new Queue('eval', { connection });
export const sweepQueue = new Queue('sweep', { connection });

export { connection };
