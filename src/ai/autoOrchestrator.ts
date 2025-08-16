import { ReasoningEngine } from './reasoningEngine.js';
import { PluginHost } from './pluginRegistry.js';
import { PatchRefiner, PatchRefineResult } from './patchRefiner.js';

export interface AutoOrchestratorOptions {
  maxPlans?: number;
  refineIters?: number;
  dryRun?: boolean;
  onEvent?: (e: OrchestratorEvent) => void;
  strategyNames?: string[]; // optional explicit strategy order
}

export type OrchestratorEvent =
  | { type: 'plan.generated'; steps: PlannedStep[] }
  | { type: 'step.start'; step: PlannedStep }
  | { type: 'step.result'; step: PlannedStep; result: StepExecutionResult }
  | { type: 'patch.refined'; ok: boolean; reasons: string[]; iterations: number }
  | { type: 'strategy.selected'; name: string }
  | { type: 'error'; error: string; step?: PlannedStep }
  | { type: 'done'; summary: OrchestratorSummary };

export interface OrchestratorSummary {
  steps: number;
  refined: boolean;
  success: boolean;
  failedSteps: number;
}

export interface PlannedStep {
  id: string;
  title: string;
  rationale?: string;
  type?: string;
  meta?: Record<string, any>;
}

export interface StepExecutionResult {
  ok: boolean;
  message?: string;
  candidatePatch?: string;
  artifacts?: Record<string, any>;
  error?: string;
}

export interface StepHandler {
  (step: PlannedStep, engine: ReasoningEngine, plugins: PluginHost): Promise<StepExecutionResult>;
}

export class AutoOrchestrator {
  readonly engine: ReasoningEngine;
  readonly plugins: PluginHost;
  readonly opts: AutoOrchestratorOptions;
  private refiner: PatchRefiner;

  constructor(engine: ReasoningEngine, plugins: PluginHost, opts: AutoOrchestratorOptions = {}) {
    this.engine = engine;
    this.plugins = plugins;
    this.opts = opts;
    this.refiner = plugins.context().get<PatchRefiner>('patch:refiner') || new PatchRefiner();
  }

  private emit(e: OrchestratorEvent) {
    try {
      this.opts.onEvent?.(e);
    } catch {
      /* ignore listener errors */
    }
  }

  private selectStrategies(): string[] {
    const ctx = this.plugins.context();
    if (this.opts.strategyNames?.length) return this.opts.strategyNames;
    const all = ctx.list().filter(n => n.startsWith('strategy:'));
    // naive priority sort: built‑ins first, rest alphabetical
    return all.sort((a, b) => {
      const ai = a.includes('chunked') ? -1 : 0;
      const bi = b.includes('chunked') ? -1 : 0;
      if (ai !== bi) return ai - bi;
      return a.localeCompare(b);
    });
  }

  async plan(objective: string): Promise<PlannedStep[]> {
    const strategyOrder = this.selectStrategies();
    for (const strategyName of strategyOrder) {
      const strat = this.plugins.context().get<any>(strategyName);
      if (!strat?.plan) continue;
      this.emit({ type: 'strategy.selected', name: strategyName });
      const steps: PlannedStep[] = await strat.plan(objective, {
        max: this.opts.maxPlans || 8,
        engine: this.engine,
        plugins: this.plugins
      });
      if (steps?.length) return steps;
    }
    // fallback: ask engine directly
    const raw = await this.engine.plan(objective, this.opts.maxPlans || 6);
    return raw.map((r: any, i: number) => ({
      id: r.id || String(i + 1),
      title: r.title || r.name || `Step ${i + 1}`,
      rationale: r.reason || r.rationale,
      type: r.type
    }));
  }

  async runObjective(objective: string): Promise<OrchestratorSummary> {
    const steps = await this.plan(objective);
    this.emit({ type: 'plan.generated', steps });

    let refined = false;
    let failed = 0;

    for (const step of steps) {
      this.emit({ type: 'step.start', step });
      let result: StepExecutionResult;
      try {
        result = await this.executeStep(step);
      } catch (e: any) {
        failed++;
        const errMsg = e?.message || String(e);
        this.emit({ type: 'error', error: errMsg, step });
        continue;
      }
      this.emit({ type: 'step.result', step, result });

      if (result.ok && result.candidatePatch && !this.opts.dryRun) {
        let ref: PatchRefineResult | undefined;
        try {
          ref = await this.refiner.refine(result.candidatePatch, []);
          this.emit({
            type: 'patch.refined',
            ok: ref.ok,
            reasons: ref.reasons,
            iterations: ref.iterations
          });
          refined = refined || ref.ok;
        } catch (e: any) {
          this.emit({
            type: 'error',
            error: e?.message || String(e),
            step
          });
        }
      } else if (!result.ok) {
        failed++;
      }
    }

    const summary: OrchestratorSummary = {
      steps: steps.length,
      refined,
      success: refined && failed === 0,
      failedSteps: failed
    };
    this.emit({ type: 'done', summary });
    return summary;
  }

  async executeStep(step: PlannedStep): Promise<StepExecutionResult> {
    // Specific registration precedence
    const ctx = this.plugins.context();
    const direct = ctx.get<StepHandler>('step:' + step.id);
    const typeHandler = step.type ? ctx.get<StepHandler>('stepType:' + step.type) : undefined;
    const titleKey = 'step:' + step.title.toLowerCase();
    const titleHandler = ctx.get<StepHandler>(titleKey);

    const handler = direct || typeHandler || titleHandler;
    if (handler) return handler(step, this.engine, this.plugins);

    // Fallback heuristic for patch producing steps
    if (/patch|diff|modify|change/i.test(step.title)) {
      const candidatePatch = this.syntheticPatch(step);
      return { ok: true, candidatePatch, message: 'Generated synthetic patch (fallback)' };
    }
    return { ok: true, message: 'No-op step (no handler)' };
  }

  private syntheticPatch(step: PlannedStep): string {
    return `diff --git a/README.md b/README.md
index 0000000..1111111 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,6 @@
 # Project
 Initial content
+## Automated Addition
+This section added by AutoOrchestrator step: ${step.id}
+Title: ${step.title}
+${step.rationale ? 'Rationale: ' + step.rationale : ''}`.trimEnd();
  }
}

export default { AutoOrchestrator };