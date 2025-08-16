export interface PatchAttemptLog {
  id: string;
  ts: number;
  status: 'ok' | 'fail';
  reasons?: string[];
  stats?: any;
  diffHash: string;
}

export class PatchLogService {
  attempts: PatchAttemptLog[] = [];
  add(entry: Omit<PatchAttemptLog, 'id' | 'ts'>) {
    const rec: PatchAttemptLog = { id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, ts: Date.now(), ...entry };
    this.attempts.push(rec);
    return rec;
  }
  last(n = 10) { return this.attempts.slice(-n); }
  stats() {
    const total = this.attempts.length;
    const ok = this.attempts.filter(a=>a.status==='ok').length;
    return { total, ok, fail: total-ok, successRate: total ? ok/total : 0 };
  }
}

// Missing function required by adaptiveLoop.ts
export async function logPatch(params: {
  issueAgentId: string;
  iteration: number;
  tasks: string[];
  diff: string;
  validation: any;
  applied: boolean;
  commitSha?: string;
}): Promise<void> {
  // TODO: implement proper database logging
  console.log(`Logged patch for agent ${params.issueAgentId}, iteration ${params.iteration}`);
}

export default { PatchLogService, logPatch };