import OpenAI from "openai";
import { cfg } from "../config.js";
import {
  ProviderPlanContext,
  ProviderPatchContext,
  ProviderEvaluationContext,
  ProviderEvaluationResult,
  ProviderExplodeContext,
  ExplodeResult,
  ReasoningTrace
} from "../types.js";
import { BaseProvider } from "./baseProvider.js";
import { systemTemplate, planUserTemplate, patchSystem, patchUser } from "../ai/promptTemplates.js";

function truncate(s: string, n: number) { return s.length <= n ? s : s.slice(0,n) + '...'; }

export class OpenAIProvider extends BaseProvider {
  private client?: OpenAI;

  constructor(apiKey?: string, private model: string = cfg.defaultModel) {
    super();
    if (apiKey) this.client = new OpenAI({ apiKey });
  }

  name() { return 'openai'; }

  async generatePlan(ctx: ProviderPlanContext) {
    if (!this.client) return this.mockPlan(ctx);
    const sys = systemTemplate('planning');
    const user = planUserTemplate({
      issueTitle: ctx.issueTitle,
      issueBody: ctx.issueBody,
      repoFiles: ctx.repoFiles,
      historical: ctx.historicalSignals,
      strategic: ctx.strategicMemories || []
    });
    const resp = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.15,
      max_tokens: cfg.maxPlanTokens,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ]
    });
    return resp.choices?.[0]?.message?.content || this.mockPlan(ctx);
  }

  async generatePatch(ctx: ProviderPatchContext) {
    if (!this.client) return { diff: this.mockPatch(ctx) };
    const sys = patchSystem();
    const reasoning = ctx.reasoningChain?.join('\n\n') || '';
    const user = patchUser({
      tasks: ctx.tasks,
      trimmedFiles: ctx.repoSnapshotFiles,
      reasoning,
      iteration: ctx.guidance.iteration,
      confidence: ctx.guidance.confidence
    });
    const resp = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.12,
      max_tokens: cfg.execTokens,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ]
    });
    const out = resp.choices?.[0]?.message?.content || '';
    if (/NO_CHANGES/i.test(out)) return { diff: '', noChanges: true };
    const trace: ReasoningTrace = {
      phase: 'execution',
      steps: [{ thought: 'LLM patch generation', evidence: '', decision: 'apply-diff' }],
      summary: 'Patch generated'
    };
    return { diff: out, trace };
  }

  async evaluateAndSuggest(ctx: ProviderEvaluationContext) {
    if (!this.client) {
      return {
        coverageScore: 0.9,
        rationale: 'Mock evaluation',
        stopRecommended: true
      };
    }
    const sys = systemTemplate('evaluation');
    const user = [
      'CURRENT TASKS:',
      ...ctx.currentTasks.map(t => `${t.id} ${t.type} risk=${t.riskScore} :: ${t.title}`),
      'COMPLETED:',
      ctx.completedTaskIds.join(',') || '(none)',
      'PLAN VERSION: ' + ctx.planVersion,
      'REQUEST: Provide JSON with {coverageScore, confidenceAdjustment?, newTasks?, rationale, stopRecommended, riskAlerts?}'
    ].join('\n');

    const resp = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.1,
      max_tokens: 600,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ]
    });

    const raw = resp.choices?.[0]?.message?.content?.trim() || '';
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { coverageScore: 0.8, rationale: raw.slice(0,400), stopRecommended: false };
    }
    const result: ProviderEvaluationResult = {
      coverageScore: parsed.coverageScore ?? 0.75,
      confidenceAdjustment: parsed.confidenceAdjustment,
      newTasks: parsed.newTasks,
      rationale: parsed.rationale || 'No rationale',
      stopRecommended: parsed.stopRecommended ?? false,
      riskAlerts: parsed.riskAlerts
    };
    return result;
  }

  async explodeTask(ctx: ProviderExplodeContext) {
    if (!this.client) {
      return { rationale: 'Mock explode', subtasks: [] };
    }
    const sys = systemTemplate('explode');
    const user = [
      'TASK:',
      JSON.stringify(ctx.task),
      'SNIPPET:',
      ctx.repoSnippet.slice(0, 2000),
      'FORMAT: JSON {subtasks:[{id,title,type,paths,acceptance,riskScore,dependsOn?}], rationale}'
    ].join('\n');

    const resp = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.25,
      max_tokens: 800,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ]
    });
    const raw = resp.choices?.[0]?.message?.content || '';
    try {
      const parsed = JSON.parse(raw);
      return parsed;
    } catch {
      return { rationale: raw.slice(0,300), subtasks: [] };
    }
  }

  async metaRefinePrompt(rawPrompt: string, phase: string) {
    if (!this.client) return rawPrompt;
    const sys = 'You rewrite prompts for higher determinism, clarity, constraint adherence.';
    const user = `PHASE=${phase}\nPROMPT:\n${rawPrompt}\nReturn improved prompt only.`;
    const resp = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.05,
      max_tokens: Math.min(400, Math.round(rawPrompt.length / 3)),
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ]
    });
    return resp.choices?.[0]?.message?.content || rawPrompt;
  }

  private mockPlan(ctx: ProviderPlanContext) {
    return `${cfg.planMarkers.start}
tasks:
  - id: T1
    title: Mock Task
    type: code
    paths: [src/index.ts]
    acceptance: "exists"
    riskScore: 0.2
${cfg.planMarkers.end}`;
  }

  private mockPatch(ctx: ProviderPatchContext) {
    const file = ctx.tasks[0]?.paths[0] || 'src/mock.ts';
    return `diff --git a/${file} b/${file}
new file mode 100644
--- /dev/null
+++ b/${file}
@@
+export function mock_${Date.now()}(){return 'ok'}
`;
  }
}
