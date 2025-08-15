export interface ParsedFileDiff {
  oldPath?: string;
  newPath?: string;
  isNew?: boolean;
  isDeleted?: boolean;
  isRename?: boolean;
  added: number;
  deleted: number;
  hunks: { header: string; lines: string[] }[];
}

export interface ParsedDiff {
  files: ParsedFileDiff[];
  totalAdded: number;
  totalDeleted: number;
  raw: string;
}

export function parseUnifiedDiff(diff: string): ParsedDiff {
  const lines = diff.split(/\r?\n/);
  const files: ParsedFileDiff[] = [];
  let current: ParsedFileDiff | null = null;

  const fileHeaderRegex = /^diff --git a\/(\S+) b\/(\S+)/;
  const newFileRegex = /^new file mode /;
  const deletedFileRegex = /^deleted file mode /;
  const renameFrom = /^rename from (.+)/;
  const renameTo = /^rename to (.+)/;
  const hunkHeaderRegex = /^@@ .* @@/;

  for (const line of lines) {
    const fh = fileHeaderRegex.exec(line);
    if (fh) {
      if (current) files.push(current);
      current = { oldPath: fh[1], newPath: fh[2], added: 0, deleted: 0, hunks: [] };
      continue;
    }
    if (!current) continue;
    if (newFileRegex.test(line)) current.isNew = true;
    else if (deletedFileRegex.test(line)) current.isDeleted = true;
    else if (renameFrom.test(line)) { current.isRename = true; current.oldPath = renameFrom.exec(line)![1]; }
    else if (renameTo.test(line)) { current.isRename = true; current.newPath = renameTo.exec(line)![1]; }
    else if (hunkHeaderRegex.test(line)) {
      current.hunks.push({ header: line, lines: [] });
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      current.added++;
      current.hunks.at(-1)?.lines.push(line);
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      current.deleted++;
      current.hunks.at(-1)?.lines.push(line);
    } else {
      current.hunks.at(-1)?.lines.push(line);
    }
  }
  if (current) files.push(current);
  return {
    files,
    totalAdded: files.reduce((s,f)=>s+f.added,0),
    totalDeleted: files.reduce((s,f)=>s+f.deleted,0),
    raw: diff
  };
}

export default { parseUnifiedDiff };