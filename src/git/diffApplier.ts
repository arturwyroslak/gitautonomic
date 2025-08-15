import { WorkspaceManager } from './workspaceManager.js';

export async function applyUnifiedDiff(patch: string, workspace: WorkspaceManager, opts: { dryRun?: boolean } = {}) {
  if (opts.dryRun) {
    // attempt --check
    const res = await workspace.applyPatch(patch, workspace.root);
    return { ok: res.ok, dryRun: true, stderr: res.stderr };
  }
  return workspace.applyPatch(patch, workspace.root);
}

export default { applyUnifiedDiff };