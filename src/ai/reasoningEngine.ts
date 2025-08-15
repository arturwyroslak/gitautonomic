import { addMemory } from "./memoryStore.js";
import { cfg } from "../config.js";
import { ReasoningTrace } from "../types.js";
import { randomUUID } from "crypto";
import { prisma } from "../storage/prisma.js";

interface ReasoningStep {
  thought: string;
  evidence?: string;
  decision?: string;
}

interface PipelineOptions {
  issueAgentId: string;
  phase: string;
  inputs: Record<string, any>;
}

export async function reasoningPipeline(opts: PipelineOptions): Promise<ReasoningTrace> {
  const steps: ReasoningStep[] = [];

  function push(thought: string, evidence?: any, decision?: string) {
    steps.push({ thought, evidence: evidence ? JSON.stringify(evidence).slice(0, 800) : undefined, decision });
  }

  push('Collecting signals', Object.keys(opts.inputs));
  const signals = opts.inputs;

  push('Synthesizing risk weighting');
  const risk = (signals.risks?.reduce?.((a:number,b:number)=> a+b,0) ?? 0) / Math.max(1, signals.risks?.length || 1);
  push('Risk average computed', { risk });

  push('Determining exploitation vs exploration bias');
  const exploitation = cfg.adaptive.exploitationBias * (signals.confidence ?? 0.5);
  const exploration = 1 - exploitation;
  push('Bias resolved', { exploitation, exploration });

  push('Drafting decision skeleton');
  const decision = exploitation > exploration ? 'exploit-patterns' : 'explore-new';
  push('Primary decision', null, decision);

  const summary = `Phase=${opts.phase}; risk=${risk.toFixed(2)}; strategy=${decision}; conf=${(signals.confidence??0).toFixed(2)}`;

  const trace: ReasoningTrace = {
    phase: opts.phase,
    steps,
    summary
  };

  if (cfg.reasoning.traceEnabled) {
    await prisma.reasoningTrace.create({
      data: {
        id: randomUUID(),
        issueAgentId: opts.issueAgentId,
        iteration: signals.iteration ?? 0,
        phase: opts.phase,
        tokens: steps.length * 12,
        score: 0.5 + Math.random() * 0.3,
        content: trace
      }
    });
  }

  await addMemory({
    issueAgentId: opts.issueAgentId,
    type: 'strategic',
    content: { phase: opts.phase, summary, ts: Date.now() },
    salience: 0.6
  });

  return trace;
}
