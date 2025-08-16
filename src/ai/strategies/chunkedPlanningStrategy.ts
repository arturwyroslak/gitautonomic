import { ReasoningEngine } from '../reasoningEngine.js';
import { PluginHost } from '../pluginRegistry.js';

export interface ChunkedPlanningStrategy {
  plan(objective: string, ctx: PlanningContext): Promise<any[]>;
}

export interface PlanningContext {
  max: number;
  engine: ReasoningEngine;
  plugins: PluginHost;
}

export function createChunkedPlanningStrategy(options: { chunkSize?: number } = {}): ChunkedPlanningStrategy {
  const chunkSize = options.chunkSize || 3;

  return {
    async plan(objective: string, ctx: PlanningContext) {
      // Ask engine for a decomposition
      let decomposition: { chunk: string; rationale?: string }[] = [];
      try {
        const dec = await ctx.engine.decompose(objective, { limit: ctx.max * 2 });
        decomposition = dec.map((d: any) => ({
          chunk: d.title || d.name || d.task,
          rationale: d.reason || d.rationale
        }));
      } catch {
        decomposition = [
          { chunk: 'Assess current state' },
          { chunk: 'Design changes' },
          { chunk: 'Implement patch' },
          { chunk: 'Validate & refine' }
        ];
      }

      // Group into chunked phases
      const grouped: { title: string; tasks: { chunk: string; rationale?: string }[] }[] = [];
      for (let i = 0; i < decomposition.length; i += chunkSize) {
        const slice = decomposition.slice(i, i + chunkSize);
        grouped.push({
          title: slice.map(s => s.chunk).join(' + ').slice(0, 60),
          tasks: slice
        });
      }

      return grouped.slice(0, ctx.max).map((g, i) => ({
        id: 'chunk-' + (i + 1),
        title: `Phase ${i + 1}: ${g.title}`,
        rationale: g.tasks.map(t => t.rationale || t.chunk).join('; '),
        type: 'phase',
        meta: { tasks: g.tasks }
      }));
    }
  };
}

export default { createChunkedPlanningStrategy };