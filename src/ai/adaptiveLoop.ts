import { prisma } from "../storage/prisma.js";
import { decideBatch, terminationReached, updateConfidence } from "./adaptiveController.js";
import { reasoningPipeline } from "./reasoningEngine.js";
import { fetchStrategicBundle, compressStrategic, decayMemories } from "./memoryStore.js";
import { ContextWindowManager } from "./contextWindowManager.js";
import { cfg } from "../config.js";
import { resolveProvider } from "../services/providerResolver.js";
import { extractPlanTasks } from "../util/planParser.js";
import { PlanTask } from "../types.js";
import { WorkspaceManager } from "../git/workspaceManager.js";
import { parseUnifiedDiff } from "../git/diffParser.js";
import { applyParsedDiff, stageCommitPush } from "../git/diffApplier.js";
import { validatePatch } from "./patchValidator.js";
import { maybeRefinePatch } from "./patchRefiner.js";
import { logPatch } from "../services/patchLogService.js";
import { ensurePullRequest } from "../services/prService.js";
import { createHash } from 'node:crypto';
import { getInstallationOctokit } from "../octokit.js";

interface ExecResult {
  noChanges?: boolean;
  diff?: string;
  reasoningSummary?: string;
}

async function ensureAgentBranch(agentId: string) {
  const agent = await prisma.issueAgent.findUnique({ where: { id: agentId } });
  if (!agent) return;
  if (!agent.branchName) {
    await prisma.issueAgent.update({
      where: { id: agent.id },
      data: { branchName: `ai/issue-${agent.issueNumber}-agent` }
    });
  }
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

  await ensureAgentBranch(agent.id);

  const pending = agent.tasks.filter((t: any) => t.status === 'pending');
  if (!pending.length) return;

  const batchSize = decideBatch(agent as any, pending as any);
  const selected = pending
    .sort((a: any, b: any)=> (a.riskScore ?? 0) - (b.riskScore ?? 0))
    .slice(0, batchSize);

  const strategicBundle = await fetchStrategicBundle(agent.id);
  const reasoningTrace = await reasoningPipeline({
    issueAgentId: agent.id,
    phase: 'execution',
    inputs: {
      iteration: agent.iterations,
      confidence: agent.confidence,
      risks: selected.map((s: any)=> s.riskScore ?? 0)
    }
  });

  const provider = await resolveProvider(Number(agent.installationId));

  const octo = await getInstallationOctokit(agent.installationId.toString());
  // Pobierz subset plików (na razie minimalnie – listing repo root)
  const repoFiles: { path: string; content: string }[] = [];
  // TODO: implement real fetch (git ls-tree + get contents) lub workspace snapshot

  const cwm = new ContextWindowManager(30_000);
  const trimmed = cwm.trimFiles(repoFiles, selected as unknown as PlanTask[]);
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

  if (patch.diff && patch.diff.length > cfg.diff.maxBytes) {
    // Truncate or mark invalid
    patch.diff = patch.diff.slice(0, cfg.diff.maxBytes);
  }

  if (patch.diff) {
    patch.diff = await maybeRefinePatch(patch.diff, provider, 'execution');
  }

  const execResult: ExecResult = {
    noChanges: patch.noChanges,
    diff: patch.diff,
    reasoningSummary: reasoningTrace.summary
  };

  let applied = false;
  let commitSha: string | undefined;
  let validation = { ok: true, reasons: [] as string[], fileStats: { added:0,deleted:0,modified:0,created:0,deletedFiles:0,renamed:0,largeFileTouches:[] as string[] } };

  if (execResult.diff && execResult.diff.trim()) {
    const parsed = parseUnifiedDiff(execResult.diff);
    validation = validatePatch(parsed);
    if (validation.ok) {
      // workspace flow
      const wm = new WorkspaceManager();
      const cloneUrl = `https://x-access-token:${(octo as any).auth.token}@github.com/${agent.owner}/${agent.repo}.git`;
      const ws = await wm.ensureWorkspace({
        owner: agent.owner,
        repo: agent.repo,
        branch: agent.branchName,
        cloneUrl,
        installationToken: (octo as any).auth.token
      });
      const { failed } = await applyParsedDiff(ws, parsed);
      if (!failed.length) {
        await wm.stageAll(ws);
        commitSha = await wm.commit(ws, `agent: tasks ${selected.map((t: any)=>t.externalId).join(', ')}`);
        if (commitSha && !commitSha.startsWith('fatal')) {
          await wm.push(ws, agent.branchName);
          applied = true;
          if (cfg.git.autoPRCreate) {
            await ensurePullRequest({
              installationId: Number(agent.installationId),
              owner: agent.owner,
              repo: agent.repo,
              agentId: agent.id
            });
          }
        }
      } else {
        validation.reasons.push('apply_failed:' + failed.join(','));
        validation.ok = false;
      }
    }
  }

  await logPatch({
    issueAgentId: agent.id,
    iteration: agent.iterations,
    tasks: selected.map((t: any) => t.externalId),
    diff: execResult.diff || '',
    validation,
    applied,
    commitSha
  });

  const success = applied && !execResult.noChanges;
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
  if (agent.planCommitSha) return;

  const provider = await resolveProvider(Number(agent.installationId));
  const strategicBundle = await fetchStrategicBundle(agent.id);
  const planRaw = await provider.generatePlan({
    issueTitle: agent.issueTitle,
    issueBody: '<hidden>',
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
  for (let i=0;i<tasks.length;i++){
    const t = tasks[i];
    if (!t) continue;
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
      planHash: createHash('sha256').update(planRaw).digest('hex'),
      planCommitSha: 'local-generated'
    }
  });
}
