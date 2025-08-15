import { ParsedDiff } from '../types.js';
import { summarizeDiff } from './changeHeuristics.js';
import { cfg } from '../config.js';

export function validatePatch(parsed: ParsedDiff): { ok: boolean; reasons: string[]; fileStats: any } {
  const reasons: string[] = [];
  const stats = summarizeDiff(parsed);

  if (parsed.totalAdded + parsed.totalDeleted > cfg.diff.maxBytes / 4) {
    reasons.push('diff.lines.too_large_estimate');
  }

  if (parsed.totalDeleted > parsed.totalAdded * 4 && (parsed.totalDeleted + parsed.totalAdded) > 50) {
    reasons.push('diff.deletion_ratio_suspicious');
  }

  if (stats.created + stats.deletedFiles > 20) reasons.push('too_many_file_creations_or_deletions');

  if (stats.largeFileTouches.length > 5) reasons.push('too_many_large_file_touches');

  return {
    ok: reasons.length === 0,
    reasons,
    fileStats: stats
  };
}