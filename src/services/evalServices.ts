import { prisma } from "../storage/prisma.js";
import { resolveProvider } from "./providerResolver.js";
import { addMemory } from "../ai/memoryStore.js";
import { cfg } from "../config.js";

export async function evaluateAgent(agentId: string) {
  const agent = await prisma.issueAgent.findUnique({
    where: { id: agentId },
    include: { tasks: true }
  });
  if (!agent) return;

  const provider = await resolveProvider(Number(agent.installationId));
  if (!provider.evaluateAndSuggest) return;

  const completed = agent.tasks.filter(t => t.status === 'done').map(t => t.externalId);
  const currentTasks = agent.tasks.filter(t => t.status !== 'done').map(t => ({
    id: t.externalId,
    title: t.title,
    type: t.type,
    paths: t.paths,
    riskScore: t.riskScore
  }));

  const evalResult = await provider.evaluateAndSuggest({
    issueTitle: agent.issueTitle,
    issueBody: '<hidden>',
    currentTasks,
    completedTaskIds: completed,
    repoFiles: [],
    recentCommitsMeta: [],
    planVersion: agent.planVersion
  });

  await addMemory({
    issueAgentId: agent.id,
    type: 'evaluation',
    content: {
      coverage: evalResult.coverageScore,
      rationale: evalResult.rationale,
      newTasks: evalResult.newTasks?.length || 0
    },
    salience: 0.55 + (evalResult.coverageScore * 0.2)
  });

  if (cfg.eval.autoExpand && evalResult.newTasks?.length) {
    let idxBase = agent.tasks.length;
    for (const nt of evalResult.newTasks.slice(0, cfg.eval.maxNewTasksPerEval)) {
      await prisma.task.create({
        data: {
          id: `${agent.id}_${nt.id}`,
            issueAgentId: agent.id,
            externalId: nt.id,
            parentExternalId: null,
            title: nt.title,
            type: nt.type,
            paths: nt.paths,
            riskScore: nt.riskScore ?? 0.4,
            origin: 'evaluation',
            status: 'pending',
            acceptance: nt.acceptance,
            orderIndex: idxBase++
        }
      });
    }
    await prisma.issueAgent.update({
      where: { id: agent.id },
      data: { totalTasks: agent.totalTasks + evalResult.newTasks.length }
    });
  }

  const confAdj = evalResult.confidenceAdjustment ?? 0;
  await prisma.issueAgent.update({
    where: { id: agent.id },
    data: {
      confidence: Math.min(1, Math.max(0, agent.confidence + confAdj)),
      lastEvalAt: new Date(),
      phase: evalResult.stopRecommended ? 'finalizing' : 'executing'
    }
  });
}
