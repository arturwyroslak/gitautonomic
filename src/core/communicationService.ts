// Enhanced Communication and Monitoring with GitHub Checks API
import { getInstallationOctokit } from '../octokit.js';
import { cfg } from '../config.js';
import pino from 'pino';
import { prisma } from '../storage/prisma.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface CheckRunConfig {
  name: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required';
  output?: {
    title: string;
    summary: string;
    text?: string;
    annotations?: CheckAnnotation[];
  };
}

export interface CheckAnnotation {
  path: string;
  start_line: number;
  end_line: number;
  start_column?: number;
  end_column?: number;
  annotation_level: 'notice' | 'warning' | 'failure';
  message: string;
  title?: string;
  raw_details?: string;
}

export interface StructuredComment {
  type: 'progress' | 'plan' | 'evaluation' | 'command_response' | 'error';
  agentId: string;
  data: any;
  metadata?: {
    version?: number;
    timestamp?: Date;
    correlationId?: string;
  };
}

export interface DashboardMetrics {
  activeAgents: number;
  queueSize: number;
  successRate: number;
  averageIterationTime: number;
  errorRate: number;
  memoryUsage: number;
  recentActivity: ActivityLog[];
}

export interface ActivityLog {
  timestamp: Date;
  agentId: string;
  event: string;
  details: any;
  success: boolean;
}

export class GitHubChecksService {
  
  async createCheckRun(installationId: string, owner: string, repo: string, config: CheckRunConfig): Promise<number> {
    try {
      const octokit = await getInstallationOctokit(installationId);
      
      const response = await octokit.rest.checks.create({
        owner,
        repo,
        name: config.name,
        head_sha: config.head_sha,
        status: config.status,
        conclusion: config.conclusion,
        output: config.output
      });

      return response.data.id;
    } catch (error) {
      log.error(`Failed to create check run: ${error}`);
      throw error;
    }
  }

  async updateCheckRun(installationId: string, owner: string, repo: string, checkRunId: number, config: Partial<CheckRunConfig>): Promise<void> {
    try {
      const octokit = await getInstallationOctokit(installationId);
      
      await octokit.rest.checks.update({
        owner,
        repo,
        check_run_id: checkRunId,
        status: config.status,
        conclusion: config.conclusion,
        output: config.output
      });
    } catch (error) {
      log.error(`Failed to update check run ${checkRunId}: ${error}`);
      throw error;
    }
  }

  async createAgentCheckSuite(agentId: string): Promise<{
    planCheckId: number;
    execCheckId: number;
    evalCheckId: number;
    securityCheckId: number;
    performanceCheckId: number;
  }> {
    const agent = await prisma.issueAgent.findUnique({ where: { id: agentId } });
    if (!agent) throw new Error('Agent not found');

    const headSha = agent.branchCommitSha || 'main';
    
    const [planCheck, execCheck, evalCheck, securityCheck, performanceCheck] = await Promise.all([
      this.createCheckRun(agent.installationId, agent.owner, agent.repo, {
        name: 'ai-plan',
        head_sha: headSha,
        status: 'queued',
        output: {
          title: 'AI Planning',
          summary: 'Generating execution plan for issue resolution'
        }
      }),
      this.createCheckRun(agent.installationId, agent.owner, agent.repo, {
        name: 'ai-exec',
        head_sha: headSha,
        status: 'queued',
        output: {
          title: 'AI Execution',
          summary: 'Executing planned tasks'
        }
      }),
      this.createCheckRun(agent.installationId, agent.owner, agent.repo, {
        name: 'ai-eval',
        head_sha: headSha,
        status: 'queued',
        output: {
          title: 'AI Evaluation',
          summary: 'Evaluating implementation completeness'
        }
      }),
      this.createCheckRun(agent.installationId, agent.owner, agent.repo, {
        name: 'ai-security',
        head_sha: headSha,
        status: 'queued',
        output: {
          title: 'AI Security Scan',
          summary: 'Running security analysis on changes'
        }
      }),
      this.createCheckRun(agent.installationId, agent.owner, agent.repo, {
        name: 'ai-performance',
        head_sha: headSha,
        status: 'queued',
        output: {
          title: 'AI Performance Analysis',
          summary: 'Analyzing performance impact of changes'
        }
      })
    ]);

    // Store check run IDs for later updates
    await prisma.agentCheckRuns.create({
      data: {
        agentId,
        planCheckId: planCheck,
        execCheckId: execCheck,
        evalCheckId: evalCheck,
        securityCheckId: securityCheck,
        performanceCheckId: performanceCheck
      }
    });

    return {
      planCheckId: planCheck,
      execCheckId: execCheck,
      evalCheckId: evalCheck,
      securityCheckId: securityCheck,
      performanceCheckId: performanceCheck
    };
  }

  async updatePlanCheck(agentId: string, status: 'in_progress' | 'completed', result?: any): Promise<void> {
    const checkRuns = await prisma.agentCheckRuns.findUnique({ where: { agentId } });
    if (!checkRuns) return;

    const agent = await prisma.issueAgent.findUnique({ where: { id: agentId } });
    if (!agent) return;

    const annotations: CheckAnnotation[] = [];
    let conclusion: CheckRunConfig['conclusion'] = 'success';
    let summary = 'Plan generation completed successfully';

    if (result?.conflicts?.length > 0) {
      conclusion = 'action_required';
      summary = `Plan generated with ${result.conflicts.length} conflicts requiring resolution`;
      
      result.conflicts.forEach((conflict: any) => {
        annotations.push({
          path: 'plan.md',
          start_line: 1,
          end_line: 1,
          annotation_level: 'warning',
          message: conflict.description,
          title: `${conflict.type} conflict`
        });
      });
    }

    await this.updateCheckRun(agent.installationId, agent.owner, agent.repo, checkRuns.planCheckId, {
      status,
      conclusion: status === 'completed' ? conclusion : undefined,
      output: {
        title: 'AI Planning',
        summary,
        text: result ? `Generated ${result.tasks?.length || 0} tasks with estimated duration: ${result.estimatedDuration || 0}h` : undefined,
        annotations
      }
    });
  }

  async updateSecurityCheck(agentId: string, scanResults: any[]): Promise<void> {
    const checkRuns = await prisma.agentCheckRuns.findUnique({ where: { agentId } });
    if (!checkRuns) return;

    const agent = await prisma.issueAgent.findUnique({ where: { id: agentId } });
    if (!agent) return;

    const allFindings = scanResults.flatMap(r => r.findings || []);
    const criticalFindings = allFindings.filter(f => f.severity === 'critical');
    const highFindings = allFindings.filter(f => f.severity === 'high');

    const annotations: CheckAnnotation[] = allFindings.slice(0, 50).map(finding => ({
      path: finding.file,
      start_line: finding.line || 1,
      end_line: finding.line || 1,
      start_column: finding.column,
      annotation_level: finding.severity === 'critical' ? 'failure' : 
                      finding.severity === 'high' ? 'warning' : 'notice',
      message: finding.description,
      title: finding.title,
      raw_details: `Rule: ${finding.rule}\nCategory: ${finding.category}\nRecommendation: ${finding.recommendation}`
    }));

    const conclusion = criticalFindings.length > 0 ? 'failure' : 
                      highFindings.length > cfg.security.maxHighSeverityIssues ? 'action_required' : 
                      'success';

    await this.updateCheckRun(agent.installationId, agent.owner, agent.repo, checkRuns.securityCheckId, {
      status: 'completed',
      conclusion,
      output: {
        title: 'AI Security Scan',
        summary: `Found ${allFindings.length} security findings (${criticalFindings.length} critical, ${highFindings.length} high)`,
        text: this.formatSecurityReport(scanResults),
        annotations
      }
    });
  }

  private formatSecurityReport(scanResults: any[]): string {
    let report = '## Security Scan Results\n\n';
    
    for (const result of scanResults) {
      report += `### ${result.tool.toUpperCase()}\n`;
      report += `- Status: ${result.passed ? '✅ Passed' : '❌ Failed'}\n`;
      report += `- Findings: ${result.findings.length}\n`;
      report += `- Severity: ${result.severity}\n`;
      
      if (result.blockers.length > 0) {
        report += `- **Blockers**: ${result.blockers.length}\n`;
      }
      report += '\n';
    }
    
    return report;
  }
}

export class StructuredCommentService {
  
  async postStructuredComment(
    installationId: string,
    owner: string, 
    repo: string,
    issueNumber: number,
    comment: StructuredComment
  ): Promise<void> {
    try {
      const octokit = await getInstallationOctokit(installationId);
      
      const formattedComment = this.formatComment(comment);
      
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: formattedComment
      });
    } catch (error) {
      log.error(`Failed to post structured comment: ${error}`);
    }
  }

  private formatComment(comment: StructuredComment): string {
    const timestamp = new Date().toISOString();
    let body = `<!-- AI-AGENT-COMMENT:${comment.type}:${comment.agentId} -->\n\n`;
    
    switch (comment.type) {
      case 'progress':
        body += this.formatProgressComment(comment);
        break;
      case 'plan':
        body += this.formatPlanComment(comment);
        break;
      case 'evaluation':
        body += this.formatEvaluationComment(comment);
        break;
      case 'command_response':
        body += this.formatCommandResponse(comment);
        break;
      case 'error':
        body += this.formatErrorComment(comment);
        break;
    }
    
    body += `\n\n*Updated: ${timestamp}*`;
    return body;
  }

  private formatProgressComment(comment: StructuredComment): string {
    const { data } = comment;
    return `## 🤖 AI Agent Progress Update

**Agent ID**: \`${comment.agentId}\`  
**Iteration**: ${data.iteration || 0}  
**Confidence**: ${Math.round((data.confidence || 0) * 100)}%  

### Tasks Status
- ✅ Completed: ${data.completedTasks || 0}
- 🔄 In Progress: ${data.activeTasks || 0}  
- ⏳ Pending: ${data.pendingTasks || 0}
- ❌ Failed: ${data.failedTasks || 0}

### Recent Activity
${data.recentActivity?.map((activity: string) => `- ${activity}`).join('\n') || 'No recent activity'}

${data.estimatedTimeRemaining ? `**Estimated Time Remaining**: ${data.estimatedTimeRemaining}` : ''}`;
  }

  private formatPlanComment(comment: StructuredComment): string {
    const { data } = comment;
    return `## 📋 AI Agent Plan v${data.version}

**Tasks Generated**: ${data.taskCount || 0}  
**Estimated Duration**: ${data.estimatedHours || 0}h  
**Risk Level**: ${data.riskLevel || 'unknown'}

### Execution Plan
${data.tasks?.map((task: any, i: number) => 
  `${i + 1}. **${task.title}** (${task.type}) - ${task.estimatedHours || 1}h`
).join('\n') || 'No tasks defined'}

${data.conflicts?.length > 0 ? `\n### ⚠️ Conflicts Detected\n${data.conflicts.map((c: any) => `- ${c.description}`).join('\n')}` : ''}

### Commands
- \`@ai-bot approve\` - Approve plan execution
- \`@ai-bot modify <changes>\` - Request plan modifications  
- \`@ai-bot pause\` - Pause execution
- \`@ai-bot resume\` - Resume execution`;
  }

  private formatEvaluationComment(comment: StructuredComment): string {
    const { data } = comment;
    return `## 🎯 AI Agent Evaluation

**Coverage Score**: ${Math.round((data.coverageScore || 0) * 100)}%  
**Requirements Met**: ${data.requirementsMet || 0}/${data.totalRequirements || 0}  

### Assessment
${data.rationale || 'No assessment available'}

### Recommendations
${data.recommendations?.map((rec: string) => `- ${rec}`).join('\n') || 'No recommendations'}

${data.stopRecommended ? '### 🛑 Stop Recommended\nThe agent recommends stopping execution and seeking human review.' : ''}`;
  }

  private formatCommandResponse(comment: StructuredComment): string {
    const { data } = comment;
    return `## 💬 Command Response

**Command**: \`${data.command}\`  
**Status**: ${data.success ? '✅ Success' : '❌ Failed'}  

${data.response || 'No response'}

${data.error ? `**Error**: ${data.error}` : ''}`;
  }

  private formatErrorComment(comment: StructuredComment): string {
    const { data } = comment;
    return `## ❌ AI Agent Error

**Error Type**: ${data.type || 'Unknown'}  
**Message**: ${data.message || 'No message available'}  

### Details
\`\`\`
${data.stack || data.details || 'No details available'}
\`\`\`

### Recovery Actions
${data.recoveryActions?.map((action: string) => `- ${action}`).join('\n') || '- Manual intervention required'}`;
  }

  async parseCommand(commentBody: string): Promise<{ command: string; args: string[]; agentId?: string } | null> {
    const commandRegex = /@ai-bot\s+(\w+)(?:\s+(.+))?/i;
    const match = commentBody.match(commandRegex);
    
    if (!match) return null;
    
    const command = match[1]?.toLowerCase() || '';
    const argsString = match[2] || '';
    const args = argsString.split(/\s+/).filter(arg => arg.length > 0);
    
    // Extract agent ID if specified
    const agentIdMatch = commentBody.match(/agent[:\s]+([a-zA-Z0-9-_]+)/i);
    const agentId = agentIdMatch?.[1];
    
    return { command, args, agentId };
  }
}

export class DashboardService {
  
  async getMetrics(): Promise<DashboardMetrics> {
    const [activeAgents, queueMetrics, recentActivity] = await Promise.all([
      this.getActiveAgentsCount(),
      this.getQueueMetrics(),
      this.getRecentActivity()
    ]);

    const successRate = await this.calculateSuccessRate();
    const averageIterationTime = await this.calculateAverageIterationTime();
    const errorRate = await this.calculateErrorRate();

    return {
      activeAgents,
      queueSize: queueMetrics.total,
      successRate,
      averageIterationTime,
      errorRate,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
      recentActivity
    };
  }

  private async getActiveAgentsCount(): Promise<number> {
    return prisma.issueAgent.count({
      where: { completed: false }
    });
  }

  private async getQueueMetrics(): Promise<{ total: number; byQueue: Record<string, number> }> {
    // This would connect to BullMQ to get queue sizes
    return { total: 0, byQueue: {} };
  }

  private async getRecentActivity(): Promise<ActivityLog[]> {
    const logs = await prisma.activityLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50
    });

    return logs.map((log: any) => ({
      timestamp: log.timestamp,
      agentId: log.agentId,
      event: log.event,
      details: log.details ? JSON.parse(log.details) : {},
      success: log.success
    }));
  }

  private async calculateSuccessRate(): Promise<number> {
    const completed = await prisma.issueAgent.count({ where: { completed: true } });
    const failed = await prisma.issueAgent.count({ where: { failed: true } });
    const total = completed + failed;
    
    return total > 0 ? completed / total : 0;
  }

  private async calculateAverageIterationTime(): Promise<number> {
    // Calculate from patch logs or iteration timestamps
    return 120; // seconds
  }

  private async calculateErrorRate(): Promise<number> {
    const totalIterations = await prisma.patchLog.count();
    const failedIterations = await prisma.patchLog.count({
      where: { validation: { path: ['ok'], equals: false } }
    });
    
    return totalIterations > 0 ? failedIterations / totalIterations : 0;
  }
}

// Types are already exported inline above