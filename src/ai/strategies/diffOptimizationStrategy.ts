import { ReasoningEngine } from '../reasoningEngine.js';
import { PluginHost } from '../pluginRegistry.js';

export interface DiffOptimizationStrategyOptions {
  max?: number;
}

export interface PlanningContext {
  max: number;
  engine: ReasoningEngine;
  plugins: PluginHost;
}

export interface DiffOptimizationStrategy {
  plan(objective: string, ctx: PlanningContext): Promise<any[]>;
}

interface FileTarget {
  path: string;
  reason: string;
}

export function createDiffOptimizationStrategy(): DiffOptimizationStrategy {
  return {
    async plan(objective: string, ctx: PlanningContext) {
      // Ask engine to propose impacted files
      let impacted: FileTarget[] = [];
      try {
        const analysis = await ctx.engine.analyzeObjective(objective, {
          want: 'files',
          limit: 10
        });
        impacted = analysis.files || [];
      } catch {
        // fallback heuristic
        impacted = [
          { path: 'README.md', reason: 'Documentation update likely required' }
        ];
      }

      const steps = impacted.slice(0, ctx.max).map((f, i) => ({
        id: 'diff-' + (i + 1),
        title: `Generate targeted patch for ${f.path}`,
        rationale: f.reason,
        type: 'patch',
        meta: { path: f.path }
      }));

      if (!steps.length) {
        steps.push({
          id: 'diff-1',
          title: 'Produce minimal patch set',
          rationale: 'Fallback when no specific files identified',
          type: 'patch',
          meta: { path: 'general' }
        });
      }

      return steps;
    }
  };
}

export default { createDiffOptimizationStrategy };