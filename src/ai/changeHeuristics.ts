import { ParsedDiff } from '../types.js';
import { cfg } from '../config.js';

export interface FileChangeAggregate {
  added: number;
  deleted: number;
  modified: number;
  created: number;
  deletedFiles: number;
  renamed: number;
  largeFileTouches: string[];
}

export function summarizeDiff(parsed: ParsedDiff): FileChangeAggregate {
  let added = 0, deleted = 0, modified = 0, created = 0, deletedFiles = 0, renamed = 0;
  const largeFileTouches: string[] = [];
  for (const f of parsed.files) {
    if (f.isNew) created++;
    if (f.isDeleted) deletedFiles++;
    if (f.isRename) renamed++;
    if (!f.isNew && !f.isDeleted) modified++;

    added += f.added;
    deleted += f.deleted;

    if (f.added + f.deleted > cfg.diff.largeFileLineThreshold) {
      largeFileTouches.push(f.newPath || f.oldPath || '');
    }
  }
  return { added, deleted, modified, created, deletedFiles, renamed, largeFileTouches };
}

export function fileChangePercentage(added: number, deleted: number, originalApprox: number) {
  if (originalApprox <= 0) return 1;
  return (added + deleted) / originalApprox;
}