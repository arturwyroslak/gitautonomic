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

// Enhanced function with database logging
export async function logPatch(params: {
  issueAgentId: string;
  iteration: number;
  tasks: string[];
  diff: string;
  validation: any;
  applied: boolean;
  commitSha?: string;
}): Promise<void> {
  try {
    // Import prisma client for database logging
    const { prisma } = await import('../storage/prisma.js');
    const { sha256 } = await import('../util/hash.js');
    
    // Calculate diff statistics
    const diffLines = params.diff.split('\n');
    const addedLines = diffLines.filter(line => line.startsWith('+')).length;
    const removedLines = diffLines.filter(line => line.startsWith('-')).length;
    const modifiedFiles = (params.diff.match(/^\+\+\+ /gm) || []).length;
    
    // Generate diff hash and preview
    const diffHash = sha256(params.diff);
    const diffPreview = params.diff.length > 500 ? 
      params.diff.substring(0, 500) + '...' : 
      params.diff;
    
    // Create patch log entry in database
    await prisma.patchLog.create({
      data: {
        id: `patch-${params.issueAgentId}-${params.iteration}-${Date.now()}`,
        issueAgentId: params.issueAgentId,
        iteration: params.iteration,
        tasks: params.tasks,
        diffHash,
        diffPreview,
        applied: params.applied,
        commitSha: params.commitSha || null,
        fileStats: {
          addedLines,
          removedLines,
          modifiedFiles,
          ...params.validation.fileStats
        },
        validation: {
          ok: params.validation.ok,
          reasons: params.validation.reasons || []
        }
      }
    });
    
    console.log(`✅ Logged patch for agent ${params.issueAgentId}, iteration ${params.iteration}: ${params.applied ? 'applied' : 'not applied'}`);
    
  } catch (error) {
    // Fallback to console logging if database fails
    console.warn('Failed to log to database, using console fallback:', error);
    console.log(`📝 Patch Log - Agent: ${params.issueAgentId}, Iteration: ${params.iteration}`);
    console.log(`   Tasks: ${params.tasks.join(', ')}`);
    console.log(`   Applied: ${params.applied}`);
    console.log(`   Validation: ${params.validation.ok ? 'PASS' : 'FAIL'}`);
    if (!params.validation.ok) {
      console.log(`   Reasons: ${params.validation.reasons?.join('; ')}`);
    }
    if (params.commitSha) {
      console.log(`   Commit: ${params.commitSha}`);
    }
  }
}

export default { PatchLogService, logPatch };