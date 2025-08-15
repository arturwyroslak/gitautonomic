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
  const maxIters = opts.maxIters ?? cfg.diff.refineMaxIterations ?? 3;
  let current = rawUnifiedDiff;
  let best = current;
  let bestReasons: string[] = [];
  let bestStats: any = undefined;

  for (let i = 0; i < maxIters; i++) {
    const parsed: ParsedDiff = await engine.tools.diff.parse(current);
    const validation = validatePatch(parsed);
    if (validation.ok) {
      const stats = summarizeDiff(parsed);
      return { ok: true, iterations: i + 1, reasons: [], original: rawUnifiedDiff, refined: current, stats };
    }
    // attempt refinement via reasoning engine
    const refinementPrompt = engine.prompts.build('patch_refine', {
      reasons: validation.reasons.join(', '),
      diff: current
    });
    const refined = await engine.model.complete(refinementPrompt, { temperature: 0.2 });
    if (!refined || refined.trim().length === 0) {
      break;
    }
    current = extractUnifiedDiff(refined) || refined;
    best = current;
    bestReasons = validation.reasons;
    bestStats = validation.fileStats;
  }
  return { ok: false, iterations: maxIters, reasons: bestReasons, original: rawUnifiedDiff, refined: best, stats: bestStats };
}

function extractUnifiedDiff(text: string): string | null {
  // naive extraction: look for lines starting with 'diff --git'
  const idx = text.indexOf('\ndiff --git ');
  if (idx >= 0) return text.slice(idx + 1);
  if (text.startsWith('diff --git ')) return text;
  return null;
}

export default { refinePatch };