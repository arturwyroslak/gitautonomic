import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { exec as cpExec } from 'child_process';
import { promisify } from 'util';
const exec = promisify(cpExec);

export interface WorkspaceOptions { baseDir?: string; }

export class WorkspaceManager {
  root: string;
  constructor(root?: string) { this.root = root || process.cwd(); }
  async createTempWorkspace(prefix = 'gitauto'): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    return dir;
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
  async readFile(relPath: string, dir = this.root) { return fs.readFile(path.join(dir, relPath), 'utf8'); }
  async writeFile(relPath: string, content: string, dir = this.root) {
    const full = path.join(dir, relPath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, 'utf8');
  }
}

export default { WorkspaceManager };