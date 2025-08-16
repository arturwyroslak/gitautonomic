// Enhanced Event Router with fallback and dead letter queue support
import { Queue, Job } from 'bullmq';
import { cfg } from '../config.js';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface EventRoutingRule {
  type: string;
  priority: number;
  batchEnabled: boolean;
  rateLimit?: {
    maxPerMinute: number;
    windowMs: number;
  };
  fallbackQueue?: string;
}

export class EventRouter {
  private rules: Map<string, EventRoutingRule> = new Map();
  private queues: Map<string, Queue> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private deadLetterQueue: Queue;

  constructor() {
    this.setupDefaultRules();
    this.deadLetterQueue = new Queue('dead-letter', { connection: { url: cfg.redisUrl } });
  }

  private setupDefaultRules() {
    // Security fixes get highest priority
    this.addRule({
      type: 'issues:security',
      priority: 100,
      batchEnabled: false,
      rateLimit: { maxPerMinute: 10, windowMs: 60000 }
    });

    // Feature issues medium priority, can be batched
    this.addRule({
      type: 'issues:feature',
      priority: 50,
      batchEnabled: true,
      rateLimit: { maxPerMinute: 20, windowMs: 60000 }
    });

    // Tech debt lower priority
    this.addRule({
      type: 'issues:tech-debt',
      priority: 30,
      batchEnabled: true,
      rateLimit: { maxPerMinute: 15, windowMs: 60000 }
    });

    // PR events
    this.addRule({
      type: 'pull_request',
      priority: 70,
      batchEnabled: false,
      rateLimit: { maxPerMinute: 30, windowMs: 60000 }
    });

    // Push events can be batched for multiple commits
    this.addRule({
      type: 'push',
      priority: 40,
      batchEnabled: true,
      rateLimit: { maxPerMinute: 25, windowMs: 60000 }
    });
  }

  addRule(rule: EventRoutingRule) {
    this.rules.set(rule.type, rule);
    if (rule.rateLimit) {
      this.rateLimiters.set(rule.type, new RateLimiter(rule.rateLimit));
    }
  }

  async routeEvent(event: any): Promise<{ success: boolean; queueName?: string; error?: string }> {
    try {
      const eventType = this.categorizeEvent(event);
      const rule = this.rules.get(eventType);
      
      if (!rule) {
        log.warn(`No routing rule for event type: ${eventType}`);
        return await this.handleFallback(event);
      }

      // Check rate limiting
      const rateLimiter = this.rateLimiters.get(eventType);
      if (rateLimiter && !rateLimiter.allow()) {
        log.warn(`Rate limit exceeded for event type: ${eventType}`);
        return await this.handleFallback(event);
      }

      // Route to appropriate queue
      const queueName = this.selectQueue(rule, event);
      const queue = this.getOrCreateQueue(queueName);
      
      if (rule.batchEnabled) {
        await this.addToBatch(queue, event, rule);
      } else {
        await queue.add(`${eventType}-${Date.now()}`, event, {
          priority: rule.priority,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 }
        });
      }

      return { success: true, queueName };
    } catch (error) {
      log.error(`Failed to route event: ${error}`);
      await this.sendToDeadLetter(event, error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  private categorizeEvent(event: any): string {
    // Analyze event to determine type and priority
    if (event.issue) {
      const labels = event.issue.labels?.map((l: any) => l.name.toLowerCase()) || [];
      if (labels.some((l: any) => l.includes('security') || l.includes('vulnerability'))) {
        return 'issues:security';
      }
      if (labels.some((l: any) => l.includes('enhancement') || l.includes('feature'))) {
        return 'issues:feature';
      }
      if (labels.some((l: any) => l.includes('tech-debt') || l.includes('refactor'))) {
        return 'issues:tech-debt';
      }
      return 'issues:general';
    }
    
    return event.action ? `${event.action}:${event.object_kind || 'unknown'}` : 'unknown';
  }

  private selectQueue(rule: EventRoutingRule, event: any): string {
    // Queue selection based on priority and type
    if (rule.priority >= 90) return 'critical';
    if (rule.priority >= 70) return 'high';
    if (rule.priority >= 50) return 'normal';
    return 'low';
  }

  private getOrCreateQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      this.queues.set(name, new Queue(name, { 
        connection: { url: cfg.redisUrl },
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 20
        }
      }));
    }
    return this.queues.get(name)!;
  }

  private async addToBatch(queue: Queue, event: any, rule: EventRoutingRule) {
    // Simple batching - group similar events within time window
    const batchKey = `${rule.type}-batch-${Math.floor(Date.now() / 30000)}`; // 30 second batches
    const existing = await queue.getJob(batchKey);
    
    if (existing) {
      // Add to existing batch
      const batchData = existing.data;
      batchData.events.push(event);
      batchData.count = batchData.events.length;
      await existing.update(batchData);
    } else {
      // Create new batch
      await queue.add(batchKey, {
        type: 'batch',
        events: [event],
        count: 1,
        batchStartTime: Date.now()
      }, {
        priority: rule.priority,
        delay: 30000 // Process batch after 30 seconds
      });
    }
  }

  private async handleFallback(event: any): Promise<{ success: boolean; queueName?: string; error?: string }> {
    // Fallback to default low-priority queue
    try {
      const fallbackQueue = this.getOrCreateQueue('fallback');
      await fallbackQueue.add(`fallback-${Date.now()}`, event, {
        priority: 10,
        attempts: 2
      });
      return { success: true, queueName: 'fallback' };
    } catch (error) {
      await this.sendToDeadLetter(event, error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  private async sendToDeadLetter(event: any, error: Error) {
    await this.deadLetterQueue.add('failed-event', {
      originalEvent: event,
      error: error.message,
      timestamp: Date.now(),
      stack: error.stack
    });
  }

  async getMetrics() {
    const metrics: any = {};
    for (const [name, queue] of this.queues) {
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();
      
      metrics[name] = {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length
      };
    }
    
    const deadLetter = await this.deadLetterQueue.getWaiting();
    metrics.deadLetter = deadLetter.length;
    
    return metrics;
  }
}

class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(config: { maxPerMinute: number; windowMs: number }) {
    this.maxRequests = config.maxPerMinute;
    this.windowMs = config.windowMs;
  }

  allow(): boolean {
    const now = Date.now();
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      return false;
    }
    
    this.requests.push(now);
    return true;
  }
}

export { RateLimiter };