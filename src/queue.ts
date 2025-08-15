import { Queue, QueueScheduler } from "bullmq";
import Redis from "ioredis";
import { cfg } from "./config.js";

const connection = new Redis(cfg.redisUrl);

export const planQueue = new Queue('plan', { connection });
export const execQueue = new Queue('exec', { connection });
export const evalQueue = new Queue('eval', { connection });
export const sweepQueue = new Queue('sweep', { connection });

new QueueScheduler('plan', { connection });
new QueueScheduler('exec', { connection });
new QueueScheduler('eval', { connection });
new QueueScheduler('sweep', { connection });

export { connection };
