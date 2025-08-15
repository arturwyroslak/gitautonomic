import { prisma } from "../storage/prisma.js";
import { execQueue } from "../queue.js";

export async function scheduleActiveAgents() {
  const active = await prisma.issueAgent.findMany({ where: { blocked:false, completed:false }, take: 50, orderBy: { updatedAt:'desc' } });
  for (const a of active) {
    if (a.phase === 'evaluating') continue;
    if (a.lastIterAt && Date.now() - a.lastIterAt.getTime() < 60_000) continue;
    await execQueue.add(`auto-${a.id}-${Date.now()}`, { installationId: Number(a.installationId), owner: a.owner, repo: a.repo, issueNumber: a.issueNumber, trigger: 'loop' }, { delay: 5000 });
  }
}
