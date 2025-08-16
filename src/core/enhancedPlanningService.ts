// Enhanced Planning Service with dynamic updates and conflict detection
import { prisma } from '../storage/prisma.js';
import { cfg } from '../config.js';
import pino from 'pino';
import { sha256 } from '../util/hash.js';
import { getInstallationOctokit } from '../octokit.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface PlanConflict {
  type: 'file_overlap' | 'dependency_conflict' | 'resource_contention';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedFiles: string[];
  conflictingAgentIds: string[];
  resolutionOptions: string[];
}

export interface StakeholderReview {
  agentId: string;
  planVersion: number;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  reviewerId?: string;
  comments?: string;
  requiredApprovers: string[];
  approvedBy: string[];
  timestamp: Date;
}

export class EnhancedPlanningService {
  
  async generateDynamicPlan(agentId: string, context: any): Promise<any> {
    const agent = await prisma.issueAgent.findUnique({ where: { id: agentId } });
    if (!agent) throw new Error('Agent not found');

    // Analyze repository state and conflicts
    const conflicts = await this.detectConflicts(agentId);
    const repoState = await this.analyzeRepositoryState(agent.installationId, agent.owner, agent.repo);
    
    // Generate adaptive plan based on current state
    const plan = await this.generateAdaptivePlan({
      agent,
      conflicts,
      repoState,
      context
    });

    // Create plan version with metadata
    const planVersion = await this.createPlanVersion(agentId, plan, conflicts);
    
    // Check if stakeholder review is required
    const reviewRequired = await this.checkStakeholderReviewRequired(agentId, plan);
    if (reviewRequired) {
      await this.initiateStakeholderReview(agentId, planVersion);
    }

    return {
      plan,
      version: planVersion,
      conflicts,
      reviewRequired,
      estimatedDuration: this.estimatePlanDuration(plan),
      riskLevel: this.assessPlanRisk(plan, conflicts)
    };
  }

  async detectConflicts(agentId: string): Promise<PlanConflict[]> {
    const agent = await prisma.issueAgent.findUnique({ 
      where: { id: agentId },
      include: { tasks: true }
    });
    if (!agent) return [];

    const conflicts: PlanConflict[] = [];
    
    // Find other active agents in the same repository
    const otherAgents = await prisma.issueAgent.findMany({
      where: {
        owner: agent.owner,
        repo: agent.repo,
        id: { not: agentId },
        completed: false
      },
      include: { tasks: true }
    });

    // Check for file overlaps
    const agentFiles = this.extractFilePaths(agent.tasks);
    for (const otherAgent of otherAgents) {
      const otherFiles = this.extractFilePaths(otherAgent.tasks);
      const overlapping = agentFiles.filter(file => otherFiles.includes(file));
      
      if (overlapping.length > 0) {
        conflicts.push({
          type: 'file_overlap',
          severity: overlapping.length > 3 ? 'high' : 'medium',
          description: `File overlap detected with agent ${otherAgent.id}`,
          affectedFiles: overlapping,
          conflictingAgentIds: [otherAgent.id],
          resolutionOptions: [
            'Coordinate changes sequentially',
            'Split overlapping files into separate tasks',
            'Merge agents into single workflow'
          ]
        });
      }
    }

    // Check for dependency conflicts
    await this.checkDependencyConflicts(agent, otherAgents, conflicts);
    
    return conflicts;
  }

  private async checkDependencyConflicts(agent: any, otherAgents: any[], conflicts: PlanConflict[]) {
    // Analyze package.json, requirements.txt, etc. for dependency conflicts
    const agentDeps = await this.extractDependencies(agent);
    
    for (const otherAgent of otherAgents) {
      const otherDeps = await this.extractDependencies(otherAgent);
      const conflictingDeps = this.findConflictingDependencies(agentDeps, otherDeps);
      
      if (conflictingDeps.length > 0) {
        conflicts.push({
          type: 'dependency_conflict',
          severity: 'high',
          description: `Dependency version conflicts with agent ${otherAgent.id}`,
          affectedFiles: ['package.json', 'requirements.txt', 'Cargo.toml'],
          conflictingAgentIds: [otherAgent.id],
          resolutionOptions: [
            'Use compatible dependency versions',
            'Implement feature flags for different versions',
            'Coordinate dependency updates'
          ]
        });
      }
    }
  }

  private extractFilePaths(tasks: any[]): string[] {
    return tasks.flatMap(task => {
      try {
        return Array.isArray(task.paths) ? task.paths : 
               typeof task.paths === 'string' ? JSON.parse(task.paths) : [];
      } catch {
        return [];
      }
    });
  }

  private async extractDependencies(agent: any): Promise<any[]> {
    // Simplified dependency extraction - in real implementation would parse package files
    return [];
  }

  private findConflictingDependencies(deps1: any[], deps2: any[]): any[] {
    // Simplified conflict detection
    return [];
  }

  async updatePlanDynamically(agentId: string, updates: any): Promise<any> {
    const agent = await prisma.issueAgent.findUnique({ 
      where: { id: agentId },
      include: { tasks: true }
    });
    if (!agent) throw new Error('Agent not found');

    // Validate updates don't introduce new conflicts
    const conflicts = await this.detectConflicts(agentId);
    const highSeverityConflicts = conflicts.filter(c => c.severity === 'high');
    
    if (highSeverityConflicts.length > 0) {
      log.warn(`Plan update blocked due to high severity conflicts for agent ${agentId}`);
      return {
        success: false,
        conflicts: highSeverityConflicts,
        reason: 'High severity conflicts detected'
      };
    }

    // Apply updates
    const newPlanVersion = agent.planVersion + 1;
    const updatedTasks = this.applyTaskUpdates(agent.tasks, updates);
    
    // Update database
    await prisma.issueAgent.update({
      where: { id: agentId },
      data: {
        planVersion: newPlanVersion,
        totalTasks: updatedTasks.length,
        planHash: sha256(JSON.stringify(updatedTasks))
      }
    });

    // Update tasks
    for (const task of updatedTasks) {
      await prisma.task.upsert({
        where: { id: task.id },
        create: task,
        update: task
      });
    }

    // Log plan update
    await this.logPlanUpdate(agentId, newPlanVersion, updates);

    return {
      success: true,
      newVersion: newPlanVersion,
      conflicts,
      updatedTasks: updatedTasks.length
    };
  }

  private applyTaskUpdates(currentTasks: any[], updates: any): any[] {
    // Apply updates to tasks - add, modify, remove tasks as needed
    let tasks = [...currentTasks];
    
    if (updates.addTasks) {
      tasks = tasks.concat(updates.addTasks);
    }
    
    if (updates.modifyTasks) {
      for (const update of updates.modifyTasks) {
        const index = tasks.findIndex(t => t.id === update.id);
        if (index >= 0) {
          tasks[index] = { ...tasks[index], ...update };
        }
      }
    }
    
    if (updates.removeTasks) {
      tasks = tasks.filter(t => !updates.removeTasks.includes(t.id));
    }
    
    return tasks;
  }

  async initiateStakeholderReview(agentId: string, planVersion: number): Promise<StakeholderReview> {
    const requiredApprovers = await this.getRequiredApprovers(agentId);
    
    const review: StakeholderReview = {
      agentId,
      planVersion,
      status: 'pending',
      requiredApprovers,
      approvedBy: [],
      timestamp: new Date()
    };

    // Store review request
    await prisma.stakeholderReview.create({
      data: {
        id: `${agentId}-v${planVersion}`,
        agentId,
        planVersion,
        status: review.status,
        requiredApprovers: JSON.stringify(requiredApprovers),
        approvedBy: JSON.stringify([]),
        createdAt: review.timestamp
      }
    });

    // Notify stakeholders (GitHub comments, webhooks, etc.)
    await this.notifyStakeholders(agentId, review);
    
    return review;
  }

  private async getRequiredApprovers(agentId: string): Promise<string[]> {
    const agent = await prisma.issueAgent.findUnique({ where: { id: agentId } });
    if (!agent) return [];

    // Load ownership rules from .aiagent-ownership.yml
    const ownershipRules = await this.loadOwnershipRules(agent.installationId, agent.owner, agent.repo);
    return this.extractRequiredApprovers(ownershipRules, agent);
  }

  private async loadOwnershipRules(installationId: string, owner: string, repo: string): Promise<any> {
    try {
      const octokit = await getInstallationOctokit(installationId);
      const response = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: '.aiagent-ownership.yml'
      });
      
      if ('content' in response.data) {
        const content = Buffer.from(response.data.content, 'base64').toString();
        return JSON.parse(content); // Simplified - should use YAML parser
      }
    } catch (error) {
      log.warn(`Could not load ownership rules: ${error}`);
    }
    return {};
  }

  private extractRequiredApprovers(ownershipRules: any, agent: any): string[] {
    // Extract approvers based on ownership rules and affected paths
    return ownershipRules.defaultApprovers || [];
  }

  private async notifyStakeholders(agentId: string, review: StakeholderReview) {
    // Send notifications to required approvers
    // This could include GitHub comments, Slack messages, emails, etc.
    log.info(`Stakeholder review initiated for agent ${agentId}, version ${review.planVersion}`);
  }

  private async analyzeRepositoryState(installationId: string, owner: string, repo: string): Promise<any> {
    try {
      const octokit = await getInstallationOctokit(installationId);
      
      // Get recent commits, PRs, issues
      const [commits, prs, issues] = await Promise.all([
        octokit.rest.repos.listCommits({ owner, repo, per_page: 10 }),
        octokit.rest.pulls.list({ owner, repo, state: 'open' }),
        octokit.rest.issues.list({ owner, repo, state: 'open' })
      ]);

      return {
        recentActivity: commits.data.length,
        openPRs: prs.data.length,
        openIssues: issues.data.length,
        lastCommit: commits.data[0]?.commit?.committer?.date,
        branches: [], // Could fetch branch list
        tags: [] // Could fetch tag list
      };
    } catch (error) {
      log.error(`Failed to analyze repository state: ${error}`);
      return {};
    }
  }

  private async generateAdaptivePlan(context: any): Promise<any> {
    const { agent, conflicts, repoState } = context;
    
    // Generate plan that adapts to current repository state and conflicts
    const basePlan = await this.generateBasePlan(agent);
    const adaptedPlan = this.adaptPlanForConflicts(basePlan, conflicts);
    const optimizedPlan = this.optimizePlanForRepoState(adaptedPlan, repoState);
    
    return optimizedPlan;
  }

  private async generateBasePlan(agent: any): Promise<any> {
    // Generate initial plan based on issue description
    return {
      tasks: [],
      dependencies: [],
      estimatedHours: 0,
      riskLevel: 'low'
    };
  }

  private adaptPlanForConflicts(plan: any, conflicts: PlanConflict[]): any {
    // Modify plan to avoid or resolve conflicts
    for (const conflict of conflicts) {
      if (conflict.type === 'file_overlap') {
        plan = this.adjustForFileOverlap(plan, conflict);
      }
    }
    return plan;
  }

  private adjustForFileOverlap(plan: any, conflict: PlanConflict): any {
    // Adjust task order or split tasks to avoid file conflicts
    return plan;
  }

  private optimizePlanForRepoState(plan: any, repoState: any): any {
    // Optimize plan based on repository activity and state
    return plan;
  }

  private estimatePlanDuration(plan: any): number {
    // Estimate total duration in hours
    return plan.tasks?.reduce((total: number, task: any) => total + (task.estimatedHours || 1), 0) || 0;
  }

  private assessPlanRisk(plan: any, conflicts: PlanConflict[]): 'low' | 'medium' | 'high' {
    const highSeverityConflicts = conflicts.filter(c => c.severity === 'high').length;
    const complexTasks = plan.tasks?.filter((t: any) => t.complexity === 'high').length || 0;
    
    if (highSeverityConflicts > 0 || complexTasks > 3) return 'high';
    if (conflicts.length > 2 || complexTasks > 1) return 'medium';
    return 'low';
  }

  private async createPlanVersion(agentId: string, plan: any, conflicts: PlanConflict[]): Promise<number> {
    const agent = await prisma.issueAgent.findUnique({ where: { id: agentId } });
    const newVersion = (agent?.planVersion || 0) + 1;
    
    await prisma.planVersion.create({
      data: {
        id: `${agentId}-v${newVersion}`,
        agentId,
        version: newVersion,
        planData: JSON.stringify(plan),
        conflicts: JSON.stringify(conflicts),
        createdAt: new Date()
      }
    });
    
    return newVersion;
  }

  private async logPlanUpdate(agentId: string, version: number, updates: any) {
    await prisma.planUpdateLog.create({
      data: {
        id: `${agentId}-v${version}-${Date.now()}`,
        agentId,
        version,
        updateType: updates.type || 'manual',
        changes: JSON.stringify(updates),
        timestamp: new Date()
      }
    });
  }

  private async checkStakeholderReviewRequired(agentId: string, plan: any): Promise<boolean> {
    // Check if plan requires stakeholder review based on complexity, risk, or ownership rules
    const riskLevel = this.assessPlanRisk(plan, []);
    const taskCount = plan.tasks?.length || 0;
    const affectedFiles = this.extractFilePaths(plan.tasks || []);
    
    // Require review for high-risk plans or plans affecting critical files
    return riskLevel === 'high' || taskCount > 10 || affectedFiles.some(f => f.includes('package.json'));
  }
}

// Types are already exported inline above