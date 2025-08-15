import { prisma } from "../storage/prisma.js";
import { decideBatch, terminationReached, updateConfidence } from "./adaptiveController.js";
import { reasoningPipeline } from "./reasoningEngine.js";
import { fetchStrategicBundle, compressStrategic, decayMemories } from "./memoryStore.js";
import { ContextWindowManager } from "./contextWindowManager.js";
import { cfg } from "../config.js";
import { resolveProvider } from "../services/providerResolver.js";
import { extractPlanTasks } from "../util/planParser.js";
import { PlanTask } from "../types.js";

interface ExecResult {
  noChanges?: boolean;
  diff?: string;
  reasoningSummary?: string;
}

export async function runAdaptiveIteration(agentId: string) {
  const agent = await prisma.issueAgent.findUnique({
    where: { id: agentId },
    include: { tasks: true }
  });
  if (!agent) return;

  if (terminationReached(agent)) {
    await prisma.issueAgent.update({ where: { id: agent.id }, data: { completed: true } });
    return;
  }

  // Zadania oczekujące
  const pending = agent.tasks.filter(t => t.status === 'pending');
  const batchSize = decideBatch(agent as any, pending as any);
  const selected = pending
    .sort((a,b)=> (a.riskScore ?? 0) - (b.riskScore ?? 0))
    .slice(0, batchSize);

  const strategicBundle = await fetchStrategicBundle(agent.id);
  const reasoningTrace = await reasoningPipeline({
    issueAgentId: agent.id,
    phase: 'execution',
    inputs: {
      iteration: agent.iterations,
      confidence: agent.confidence,
      risks: selected.map(s=> s.riskScore ?? 0)
    }
  });

  const provider = await resolveProvider(Number(agent.installationId));

  // Snapshot plików (placeholder) – w realnym systemie pobranie repo
  const repoSnapshot: { path: string; content: string }[] = []; // do implementacji (git fetch)
  const cwm = new ContextWindowManager(30_000);
  const trimmed = cwm.trimFiles(repoSnapshot, selected as unknown as PlanTask[]);
  const reasoningPacked = cwm.packReasoning([reasoningTrace.summary]);

  const patch = await provider.generatePatch({
    tasks: selected as unknown as PlanTask[],
    repoSnapshotFiles: trimmed,
    guidance: {
      iteration: agent.iterations,
      confidence: agent.confidence,
      maxTasksAllowed: batchSize,
      strategicHints: strategicBundle.slice(0,3)
    },
    reasoningChain: [reasoningPacked]
  });

  const execResult: ExecResult = {
    noChanges: patch.noChanges,
    diff: patch.diff,
    reasoningSummary: reasoningTrace.summary
  };

  // Aktualizacja tasków + confidence (mock success heuristics)
  const success = !execResult.noChanges;
  const newConfidence = updateConfidence(agent.confidence, success);
  await prisma.issueAgent.update({
    where: { id: agent.id },
    data: {
      confidence: newConfidence,
      iterations: agent.iterations + 1,
      lastIterAt: new Date()
    }
  });

  if ((agent.iterations + 1) % cfg.memory.compressionEvery === 0) {
    await compressStrategic(agent.id);
  }
  await decayMemories(agent.id);
}

export async function ensurePlan(agentId: string) {
  const agent = await prisma.issueAgent.findUnique({ where: { id: agentId } });
  if (!agent) return;
  if (agent.planCommitSha) return; // już istnieje plan zapisany

  const provider = await resolveProvider(Number(agent.installationId));
  const strategicBundle = await fetchStrategicBundle(agent.id);
  const planRaw = await provider.generatePlan({
    issueTitle: agent.issueTitle,
    issueBody: '<hidden>', // w realnej implementacji pobierz body
    repoFiles: [],
    historicalSignals: {
      previousPlanExists: !!agent.planCommitSha,
      iterations: agent.iterations,
      doneTasks: agent.doneTasks,
      totalTasks: agent.totalTasks,
      confidence: agent.confidence
    },
    strategicMemories: strategicBundle
  });

  const tasks = extractPlanTasks(planRaw);
  // Zapis tasks
  for (let i=0;i<tasks.length;i++){
    const t = tasks[i];
    await prisma.task.create({
      data: {
        id: `${agent.id}_${t.id}`,
        issueAgentId: agent.id,
        externalId: t.id,
        parentExternalId: null,
        title: t.title,
        type: t.type,
        paths: t.paths,
        riskScore: t.riskScore ?? 0.3,
        origin: 'initial',
        status: 'pending',
        acceptance: t.acceptance,
        orderIndex: i
      }
    });
  }
  await prisma.issueAgent.update({
    where: { id: agent.id },
    data: {
      totalTasks: tasks.length,
      planVersion: agent.planVersion + 1,
      planHash: 'placeholder',
      planCommitSha: 'local-generated'
    }
  });
}
