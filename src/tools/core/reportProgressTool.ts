import { exec } from 'child_process';
import { promisify } from 'util';
import pino from 'pino';

const execAsync = promisify(exec);
const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ProgressReportOptions {
  commitMessage: string;
  prDescription: string;
  branch?: string;
  workingDirectory?: string;
}

export interface ProgressReportResult {
  success: boolean;
  commitSha?: string;
  message: string;
  error?: string;
  changesDetected: boolean;
  filesChanged: string[];
}

export class ReportProgressTool {
  private readonly defaultBranch = 'main';

  /**
   * Commit and push changes, update PR descriptions
   */
  async reportProgress(options: ProgressReportOptions): Promise<ProgressReportResult> {
    const workingDir = options.workingDirectory || process.cwd();
    
    try {
      // Check if there are any changes to commit
      const status = await this.getGitStatus(workingDir);
      if (!status.hasChanges) {
        return {
          success: true,
          message: 'No changes detected to commit',
          changesDetected: false,
          filesChanged: []
        };
      }

      // Stage all changes
      await execAsync('git add .', { cwd: workingDir });

      // Commit changes
      const commitResult = await this.commitChanges(options.commitMessage, workingDir);
      if (!commitResult.success) {
        return {
          success: false,
          message: 'Failed to commit changes',
          error: commitResult.error,
          changesDetected: true,
          filesChanged: status.modifiedFiles
        };
      }

      // Push changes
      const pushResult = await this.pushChanges(options.branch, workingDir);
      if (!pushResult.success) {
        return {
          success: false,
          message: 'Failed to push changes',
          error: pushResult.error,
          changesDetected: true,
          filesChanged: status.modifiedFiles
        };
      }

      // Update PR description if needed
      await this.updatePRDescription(options.prDescription, workingDir);

      return {
        success: true,
        commitSha: commitResult.sha,
        message: `Progress reported successfully. Commit: ${commitResult.sha?.substring(0, 8)}`,
        changesDetected: true,
        filesChanged: status.modifiedFiles
      };

    } catch (error) {
      log.error(`Progress report failed: ${error}`);
      return {
        success: false,
        message: 'Progress report failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        changesDetected: false,
        filesChanged: []
      };
    }
  }

  /**
   * Get current git status
   */
  private async getGitStatus(workingDir: string): Promise<{ hasChanges: boolean; modifiedFiles: string[] }> {
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: workingDir });
      const lines = stdout.trim().split('\n').filter(line => line.length > 0);
      
      return {
        hasChanges: lines.length > 0,
        modifiedFiles: lines.map(line => line.substring(3)) // Remove status indicators
      };
    } catch (error) {
      log.warn(`Could not get git status: ${error}`);
      return { hasChanges: false, modifiedFiles: [] };
    }
  }

  /**
   * Commit changes
   */
  private async commitChanges(message: string, workingDir: string): Promise<{ success: boolean; sha?: string; error?: string }> {
    try {
      // Commit with message
      await execAsync(`git commit -m "${this.escapeShellArg(message)}"`, { cwd: workingDir });
      
      // Get the commit SHA
      const { stdout } = await execAsync('git rev-parse HEAD', { cwd: workingDir });
      const sha = stdout.trim();

      return { success: true, sha };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Push changes to remote
   */
  private async pushChanges(branch?: string, workingDir?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current branch if not specified
      const currentBranch = branch || await this.getCurrentBranch(workingDir);
      
      // Push to origin
      await execAsync(`git push origin ${currentBranch}`, { cwd: workingDir });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get current git branch
   */
  private async getCurrentBranch(workingDir?: string): Promise<string> {
    try {
      const { stdout } = await execAsync('git branch --show-current', { cwd: workingDir });
      return stdout.trim() || this.defaultBranch;
    } catch (error) {
      log.warn(`Could not get current branch: ${error}`);
      return this.defaultBranch;
    }
  }

  /**
   * Update PR description (placeholder - would need GitHub API integration)
   */
  private async updatePRDescription(description: string, workingDir?: string): Promise<void> {
    // This would typically integrate with GitHub API to update PR description
    // For now, we'll just log the action
    log.info('PR description update requested', { 
      description: description.substring(0, 100) + '...' 
    } as any);
    
    // Store the description in a local file for reference
    try {
      const fs = await import('fs/promises');
      await fs.writeFile(`${workingDir || process.cwd()}/.pr-description.md`, description, 'utf-8');
    } catch (error) {
      log.warn(`Could not save PR description: ${error}`);
    }
  }

  /**
   * Check if working directory is clean
   */
  async isWorkingDirectoryClean(workingDir?: string): Promise<boolean> {
    const status = await this.getGitStatus(workingDir || process.cwd());
    return !status.hasChanges;
  }

  /**
   * Get commit history
   */
  async getCommitHistory(count: number = 10, workingDir?: string): Promise<Array<{ sha: string; message: string; author: string; date: string }>> {
    try {
      const { stdout } = await execAsync(
        `git log --oneline --format="%H|%s|%an|%ad" --date=short -n ${count}`,
        { cwd: workingDir }
      );

      return stdout.trim().split('\n').map(line => {
        const [sha, message, author, date] = line.split('|');
        return { 
          sha: sha || '', 
          message: message || '', 
          author: author || '', 
          date: date || '' 
        };
      });
    } catch (error) {
      log.warn(`Could not get commit history: ${error}`);
      return [];
    }
  }

  /**
   * Create a backup branch before making changes
   */
  async createBackupBranch(suffix?: string, workingDir?: string): Promise<{ success: boolean; branchName?: string; error?: string }> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const branchName = `backup-${suffix || 'auto'}-${timestamp}`;
      
      await execAsync(`git checkout -b ${branchName}`, { cwd: workingDir });
      await execAsync(`git push origin ${branchName}`, { cwd: workingDir });
      
      // Switch back to original branch
      const originalBranch = await this.getCurrentBranch(workingDir);
      await execAsync(`git checkout ${originalBranch}`, { cwd: workingDir });

      return { success: true, branchName };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Escape shell arguments
   */
  private escapeShellArg(arg: string): string {
    return arg.replace(/'/g, "'\"'\"'");
  }

  /**
   * Generate progress summary
   */
  generateProgressSummary(filesChanged: string[], commitMessage: string): string {
    const summary = [
      `## Progress Summary`,
      ``,
      `**Commit Message:** ${commitMessage}`,
      `**Files Changed:** ${filesChanged.length}`,
      ``
    ];

    if (filesChanged.length > 0) {
      summary.push(`**Modified Files:**`);
      filesChanged.forEach(file => {
        summary.push(`- ${file}`);
      });
      summary.push('');
    }

    summary.push(`**Timestamp:** ${new Date().toISOString()}`);
    
    return summary.join('\n');
  }
}

export const reportProgressTool = new ReportProgressTool();