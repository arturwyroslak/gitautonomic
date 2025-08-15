import { prisma } from "../storage/prisma.js";
import { PlanTask } from "../types.js";

export async function prioritizeTasks(agentId: string): Promise<PlanTask[]> {
  const tasks = await prisma.task.findMany({ where: { issueAgentId: agentId, status: 'pending' } });
  const scored = tasks.map(t => {
    const base = 1 - (t.riskScore ?? 0.3);
    const recencyBoost = 0.05;
    const priority = base + recencyBoost;
    return {
      id: t.externalId,
      title: t.title,
      type: t.type,
      paths: t.paths,
      riskScore: t.riskScore ?? 0.3,
      dependsOn: [],
      priorityScore: priority
    };
  });
  return scored.sort((a,b)=> (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
}
