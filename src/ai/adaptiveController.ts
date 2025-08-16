import { cfg } from "../config.js";
// import { IssueAgent, Task } from "@prisma/client"; // TODO: Fix after Prisma generation

export function decideBatch(agent: any, pending: any[]): number {
  if (!pending.length) return 0;
  const base = Math.min(pending.length,  cfg.adaptive.maxBatch);
  const successFactor = agent.confidence;
  const dynamic = Math.max(cfg.adaptive.minBatch, Math.round(base * (0.5 + successFactor)));
  return Math.min(dynamic, pending.length);
}

export function updateConfidence(prev: number, success: boolean): number {
  if (success) return Math.min(1, prev + cfg.adaptive.confidenceIncreasePerSuccess);
  return Math.max(0, prev - cfg.adaptive.confidenceDecreaseOnFail);
}

export function terminationReached(agent: any): boolean {
  if (agent.completed) return true;
  if (agent.confidence >= cfg.termination.requiredConfidence && agent.doneTasks > 0 && agent.doneTasks === agent.totalTasks) return true;
  return false;
}
