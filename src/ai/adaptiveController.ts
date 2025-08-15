import { cfg } from "../config.js";
import { IssueAgent, Task } from "@prisma/client";

export function decideBatch(agent: IssueAgent, pending: Task[]): number {
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

export function terminationReached(agent: IssueAgent): boolean {
  if (agent.completed) return true;
  if (agent.confidence >= cfg.termination.requiredConfidence && agent.doneTasks > 0 && agent.doneTasks === agent.totalTasks) return true;
  return false;
}
