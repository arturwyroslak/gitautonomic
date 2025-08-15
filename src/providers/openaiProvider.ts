import OpenAI from "openai";
import { cfg } from "../config.js";
import { ProviderPlanContext, ProviderPatchContext, ProviderEvaluationContext, ProviderEvaluationResult, ProviderExplodeContext, ExplodeResult } from "../types.js";
import { BaseProvider } from "./baseProvider.js";

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
    const sys = `You are a senior autonomous implementation planner. Produce a deterministic YAML block of tasks between ${cfg.planMarkers.start} and ${cfg.planMarkers.end}.`;
    const user = `Issue Title: ${ctx.issueTitle}\nIssue Body:\n${ctx.issueBody}\n\nRepo Files (subset):\n${ctx.repoFiles.slice(0,400).join('\n')}\n\nFORMAT STRICT:\n${cfg.planMarkers.start}\ntasks:\n  - id: T1\n    title: ...\n    type: code|test|doc|migration|refactor\n    paths: [file1.ts]\n    acceptance: "objective"\n    riskScore: 0.0-1.0\n    dependsOn: []\n  - ...\ndependencies: []\nmigrations: []\n${cfg.planMarkers.end}\n`;
    const resp = await this.client.chat.completions.create({ model: this.model, temperature: 0.18, max_tokens: cfg.maxPlanTokens, messages: [
      { role: "system", content: sys },
      { role: "user", content: user }
    ] });
    return resp.choices[0].message?.content || this.mockPlan(ctx);
  }

  async generatePatch(ctx: ProviderPatchContext) {
    if (!this.client) return { diff: this.mockPatch(ctx) };
    const tasksStr = ctx.tasks.map(t => `${t.id} (${t.type}) risk=${t.riskScore ?? 0} -> ${t.paths.join(',')} :: ${t.title}`).join('\n');
    const filesList = ctx.repoSnapshotFiles.slice(0,30).map(f => `FILE: ${f.path}\n${truncate(f.content,2000)}\n`).join('\n');
    const user = `Implement tasks. Provide unified diff only.\nTasks:\n${tasksStr}\n\n${filesList}\nReturn unified diff or NO_CHANGES.`;
    const resp = await this.client.chat.completions.create({ model: this.model, temperature: 0.12, max_tokens: cfg.execTokens, messages: [
      { role: "system", content: "You output ONLY unified diff or NO_CHANGES." },
      { role: "user", content: user }
    ] });
    const out = resp.choices[0].message?.content || ''; 
    if (/NO_CHANGES/i.test(out)) return { diff: '', noChanges: true };
    return { diff: out };
  }

  async evaluateAndSuggest(ctx: ProviderEvaluationContext) {
    return { coverageScore: 0.9, rationale: 'Mock evaluation', stopRecommended: true };
  }

  async explodeTask(ctx: ProviderExplodeContext) {
    return { rationale: 'Mock explode', subtasks: [] };
  }

  private mockPlan(ctx: ProviderPlanContext) {
    return `${cfg.planMarkers.start}\ntasks:\n  - id: T1\n    title: Mock Task\n    type: code\n    paths: [src/index.ts]\n    acceptance: "exists"\n    riskScore: 0.2\n${cfg.planMarkers.end}`;
  }

  private mockPatch(ctx: ProviderPatchContext) {
    const file = ctx.tasks[0]?.paths[0] || 'src/mock.ts';
    return `diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n@@\n+export function mock_${Date.now()}(){return 'ok'}\n`;
  }
}
