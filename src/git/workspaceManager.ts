import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { exec as cpExec } from 'child_process';
import { promisify } from 'util';
const exec = promisify(cpExec);

export interface WorkspaceOptions { 
  owner: string;
  repo: string;
  branch: string;
  cloneUrl: string;
  installationToken: string;
}

export class WorkspaceManager {
  root: string;
  constructor(root?: string) { this.root = root || process.cwd(); }
  
  async createTempWorkspace(prefix = 'gitauto'): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    return dir;
  }
  
  async ensureWorkspace(options: WorkspaceOptions): Promise<WorkspaceManager> {
    // TODO: implement proper git workspace setup with cloning
    const workspaceDir = await this.createTempWorkspace(`${options.owner}-${options.repo}-`);
    return new WorkspaceManager(workspaceDir);
  }
  
  async stageAll(workspace: WorkspaceManager): Promise<void> {
    try {
      await exec('git add .', { cwd: workspace.root });
    } catch (e) {
      // ignore for now
    }
  }
  
  async commit(workspace: WorkspaceManager, message: string): Promise<string> {
    try {
      const { stdout } = await exec(`git commit -m "${message}"`, { cwd: workspace.root });
      // Extract commit SHA from output
      const match = stdout.match(/\[.*?\s([a-f0-9]+)\]/);
      return match?.[1] || 'mock-commit-sha';
    } catch (e) {
      return 'fatal: no changes to commit';
    }
  }
  
  async push(workspace: WorkspaceManager, branch: string): Promise<void> {
    try {
      await exec(`git push origin ${branch}`, { cwd: workspace.root });
    } catch (e) {
      // ignore for now
    }
  }
  
  async applyPatch(patch: string, dir = this.root): Promise<{ ok: boolean; stderr?: string }> {
    try {
      await exec('git apply -', { cwd: dir, input: patch as any });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, stderr: e.stderr || e.message };
    }
  }
  
  async restoreFile(relPath: string, dir = this.root) {
    await exec(`git checkout -- ${relPath}`, { cwd: dir });
  }
  
  async readFile(relPath: string, dir = this.root) { 
    return fs.readFile(path.join(dir, relPath), 'utf8'); 
  }
  
  async writeFile(relPath: string, content: string, dir = this.root) {
    const full = path.join(dir, relPath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, 'utf8');
  }
}

export default { WorkspaceManager };