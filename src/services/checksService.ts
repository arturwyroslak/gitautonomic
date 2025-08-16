// Checks Service for GitHub status checks
import { getInstallationOctokit } from '../octokit.js';

export interface CheckContext {
  installationId: number;
  owner: string;
  repo: string;
  sha: string;
}

export class ChecksService {
  async createCheck(context: CheckContext, name: string, status: 'queued' | 'in_progress' | 'completed'): Promise<number> {
    const octo = await getInstallationOctokit(context.installationId.toString());
    
    try {
      const { data } = await octo.rest.checks.create({
        owner: context.owner,
        repo: context.repo,
        name,
        head_sha: context.sha,
        status
      });
      
      return data.id;
    } catch (e) {
      console.error('Failed to create check:', e);
      return 0;
    }
  }
  
  async updateCheck(context: CheckContext, checkId: number, conclusion?: 'success' | 'failure' | 'neutral'): Promise<void> {
    const octo = await getInstallationOctokit(context.installationId.toString());
    
    try {
      await octo.rest.checks.update({
        owner: context.owner,
        repo: context.repo,
        check_run_id: checkId,
        status: 'completed',
        conclusion
      });
    } catch (e) {
      console.error('Failed to update check:', e);
    }
  }
  
  async createPlanCheck(context: CheckContext): Promise<number> {
    return this.createCheck(context, 'ai-plan', 'queued');
  }
  
  async createExecCheck(context: CheckContext): Promise<number> {
    return this.createCheck(context, 'ai-exec', 'in_progress');
  }
  
  async createEvalCheck(context: CheckContext): Promise<number> {
    return this.createCheck(context, 'ai-eval', 'queued');
  }
  
  async createSecurityCheck(context: CheckContext): Promise<number> {
    return this.createCheck(context, 'ai-security', 'queued');
  }
  
  async createCompleteCheck(context: CheckContext): Promise<number> {
    return this.createCheck(context, 'ai-complete', 'queued');
  }
}

export default { ChecksService };