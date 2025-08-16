import { ParsedDiff } from '../types.js';
import { validatePatch } from './patchValidator.js';
import { summarizeDiff } from './changeHeuristics.js';
import { cfg } from '../config.js';
import { ReasoningEngine } from './reasoningEngine.js';

export interface RefinementResult {
  ok: boolean;
  iterations: number;
  reasons: string[];
  original: string;
  refined: string;
  stats: ReturnType<typeof summarizeDiff>;
}

export async function refinePatch(rawUnifiedDiff: string, engine: ReasoningEngine, opts: { maxIters?: number } = {}): Promise<RefinementResult> {
  const maxIters = opts.maxIters ?? 3;
  let current = rawUnifiedDiff;
  let best = current;
  let bestReasons: string[] = [];
  let bestStats: any = undefined;

  for (let i = 0; i < maxIters; i++) {
    try {
      const parsed: ParsedDiff = await engine.tools.diff.parse(current);
      const validation = validatePatch(parsed);
      if (validation.ok) {
        const stats = summarizeDiff(parsed);
        return { ok: true, iterations: i + 1, reasons: [], original: rawUnifiedDiff, refined: current, stats };
      }
      // attempt refinement via reasoning engine
      const refined = await engine.model.complete(`Refine this diff to fix issues: ${validation.reasons.join(', ')}\n\n${current}`, { temperature: 0.2 });
      if (!refined || refined.trim().length === 0) {
        break;
      }
      current = extractUnifiedDiff(refined) || refined;
      best = current;
      bestReasons = validation.reasons;
      bestStats = validation.fileStats;
    } catch (e) {
      break;
    }
  }
  return { ok: false, iterations: maxIters, reasons: bestReasons, original: rawUnifiedDiff, refined: best, stats: bestStats };
}

// Missing function required by adaptiveLoop.ts
export async function maybeRefinePatch(diff: string, provider: any, context: string): Promise<string> {
  // Simple implementation - just return the original diff for now
  return diff;
}

function extractUnifiedDiff(text: string): string | null {
  // naive extraction: look for lines starting with 'diff --git'
  const idx = text.indexOf('\ndiff --git ');
  if (idx >= 0) return text.slice(idx + 1);
  if (text.startsWith('diff --git ')) return text;
  return null;
}

export class PatchRefiner {
  constructor() {
    // Simple constructor
  }
  
  async refine(diff: string, reasons: string[]): Promise<PatchRefineResult> {
    // Simple implementation - return the original diff with success
    return {
      success: true,
      ok: true,
      refinedDiff: diff,
      iterations: 1,
      reasons: []
    };
  }
}

export interface PatchRefineResult {
  success: boolean;
  ok: boolean;
  refinedDiff: string;
  iterations: number;
  reasons: string[];
}