// Risk-Aware Task Prioritizer - Advanced prioritization based on impact and risk
import pino from 'pino';
import { getInstallationOctokit } from '../octokit.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface TaskPrioritization {
  tasks: PrioritizedTask[];
  executionOrder: string[];
  riskAssessment: GlobalRiskAssessment;
  recommendations: PriorizationRecommendation[];
}

export interface PrioritizedTask {
  id: string;
  title: string;
  description: string;
  priority: number; // 0-100 scale
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  impactScore: number; // 0-100 scale
  urgencyScore: number; // 0-100 scale
  complexityScore: number; // 0-100 scale
  dependencyLevel: number; // 0-100 scale
  businessValue: number; // 0-100 scale
  technicalDebt: number; // 0-100 scale
  estimatedEffort: number; // hours
  dependencies: string[]; // task IDs
  blockers: string[]; // task IDs that block this one
  affectedFiles: string[];
  stakeholders: string[];
  confidence: number; // 0-1 confidence in prioritization
  reasoning: string[];
}

export interface GlobalRiskAssessment {
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  mitigationStrategies: string[];
  parallelExecutionSafety: boolean;
  rollbackComplexity: 'simple' | 'moderate' | 'complex';
}

export interface RiskFactor {
  type: 'technical' | 'business' | 'security' | 'performance' | 'compliance';
  description: string;
  severity: number; // 0-10 scale
  likelihood: number; // 0-1 probability
  impact: string;
  mitigation?: string;
}

export interface PriorizationRecommendation {
  type: 'execution' | 'sequencing' | 'resource' | 'risk';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  actionItems: string[];
}

export interface TaskContext {
  projectInfo: {
    name: string;
    type: string; // web app, library, service, etc.
    stage: string; // development, staging, production
    criticality: string; // low, medium, high, critical
  };
  teamInfo: {
    size: number;
    expertise: Record<string, number>; // skill -> expertise level
    availability: Record<string, number>; // member -> availability percentage
    workload: number; // current workload percentage
  };
  technicalContext: {
    codebaseSize: number;
    testCoverage: number;
    technicalDebtRatio: number;
    deploymentFrequency: number;
    incidentRate: number;
  };
  businessContext: {
    deadlines: Date[];
    stakeholderPriorities: Record<string, number>;
    marketPressure: number; // 0-100 scale
    complianceRequirements: string[];
  };
}

export class RiskAwareTaskPrioritizer {
  private contextCache = new Map<string, TaskContext>();

  async prioritizeTasks(
    tasks: any[],
    installationId: string,
    owner: string,
    repo: string,
    contextOverrides?: Partial<TaskContext>
  ): Promise<TaskPrioritization> {
    log.info(`Starting risk-aware prioritization for ${tasks.length} tasks`);

    const context = await this.buildTaskContext(installationId, owner, repo, contextOverrides);
    const prioritizedTasks = await this.analyzeTasks(tasks, context, installationId, owner, repo);
    const riskAssessment = this.assessGlobalRisk(prioritizedTasks, context);
    const executionOrder = this.calculateExecutionOrder(prioritizedTasks);
    const recommendations = this.generateRecommendations(prioritizedTasks, context, riskAssessment);

    return {
      tasks: prioritizedTasks,
      executionOrder,
      riskAssessment,
      recommendations
    };
  }

  private async buildTaskContext(
    installationId: string,
    owner: string,
    repo: string,
    overrides?: Partial<TaskContext>
  ): Promise<TaskContext> {
    const cacheKey = `${owner}/${repo}`;
    
    if (this.contextCache.has(cacheKey) && !overrides) {
      return this.contextCache.get(cacheKey)!;
    }

    const octokit = await getInstallationOctokit(installationId);
    
    // Get repository information
    const repoInfo = await octokit.rest.repos.get({ owner, repo });
    
    // Get recent activity
    const commits = await octokit.rest.repos.listCommits({ owner, repo, per_page: 100 });
    const issues = await octokit.rest.issues.list({ owner, repo, state: 'all', per_page: 100 });
    const pulls = await octokit.rest.pulls.list({ owner, repo, state: 'all', per_page: 50 });

    // Analyze contributors
    const contributors = await octokit.rest.repos.listContributors({ owner, repo });
    
    const context: TaskContext = {
      projectInfo: {
        name: repoInfo.data.name,
        type: this.determineProjectType(repoInfo.data),
        stage: this.determineProjectStage(repoInfo.data),
        criticality: this.assessProjectCriticality(repoInfo.data, issues.data)
      },
      teamInfo: {
        size: contributors.data.length,
        expertise: await this.analyzeTeamExpertise(contributors.data),
        availability: this.estimateTeamAvailability(contributors.data),
        workload: this.calculateCurrentWorkload(issues.data, pulls.data)
      },
      technicalContext: {
        codebaseSize: await this.estimateCodebaseSize(installationId, owner, repo),
        testCoverage: await this.estimateTestCoverage(installationId, owner, repo),
        technicalDebtRatio: this.estimateTechnicalDebt(commits.data),
        deploymentFrequency: this.calculateDeploymentFrequency(commits.data),
        incidentRate: this.calculateIncidentRate(issues.data)
      },
      businessContext: {
        deadlines: this.extractDeadlines(issues.data),
        stakeholderPriorities: this.analyzeStakeholderPriorities(issues.data),
        marketPressure: this.assessMarketPressure(repoInfo.data, issues.data),
        complianceRequirements: this.identifyComplianceRequirements(issues.data)
      }
    };

    // Apply overrides
    if (overrides) {
      Object.assign(context, overrides);
    }

    this.contextCache.set(cacheKey, context);
    return context;
  }

  private async analyzeTasks(
    tasks: any[],
    context: TaskContext,
    installationId: string,
    owner: string,
    repo: string
  ): Promise<PrioritizedTask[]> {
    const prioritizedTasks: PrioritizedTask[] = [];

    for (const task of tasks) {
      const prioritizedTask = await this.analyzeTask(task, context, installationId, owner, repo);
      prioritizedTasks.push(prioritizedTask);
    }

    return prioritizedTasks.sort((a, b) => b.priority - a.priority);
  }

  private async analyzeTask(
    task: any,
    context: TaskContext,
    installationId: string,
    owner: string,
    repo: string
  ): Promise<PrioritizedTask> {
    
    const impactScore = this.calculateImpactScore(task, context);
    const urgencyScore = this.calculateUrgencyScore(task, context);
    const complexityScore = await this.calculateComplexityScore(task, context, installationId, owner, repo);
    const dependencyLevel = this.calculateDependencyLevel(task, context);
    const businessValue = this.calculateBusinessValue(task, context);
    const technicalDebt = this.calculateTechnicalDebtImpact(task, context);
    const riskLevel = this.assessTaskRisk(task, context, impactScore, complexityScore);
    const estimatedEffort = this.estimateEffort(task, complexityScore, context);
    
    // Calculate priority using weighted formula
    const priority = this.calculatePriority({
      impactScore,
      urgencyScore,
      complexityScore,
      businessValue,
      technicalDebt,
      riskLevel
    });

    const reasoning = this.generatePriorityReasoning({
      impactScore,
      urgencyScore,
      complexityScore,
      businessValue,
      technicalDebt,
      riskLevel,
      task,
      context
    });

    return {
      id: task.id || `task-${Date.now()}`,
      title: task.title || task.summary || 'Untitled Task',
      description: task.description || task.body || '',
      priority,
      riskLevel,
      impactScore,
      urgencyScore,
      complexityScore,
      dependencyLevel,
      businessValue,
      technicalDebt,
      estimatedEffort,
      dependencies: task.dependencies || [],
      blockers: task.blockers || [],
      affectedFiles: task.paths || task.affectedFiles || [],
      stakeholders: task.assignees || [],
      confidence: this.calculateConfidence(task, context),
      reasoning
    };
  }

  private calculateImpactScore(task: any, context: TaskContext): number {
    let score = 50; // Base score

    // File impact
    const affectedFiles = task.paths || task.affectedFiles || [];
    const criticalFileImpact = affectedFiles.filter((file: string) => this.isCriticalFile(file)).length;
    score += criticalFileImpact * 15;

    // User impact
    if (task.labels?.some((label: string) => label.includes('user-facing'))) {
      score += 20;
    }

    // Security impact
    if (task.labels?.some((label: string) => label.includes('security'))) {
      score += 25;
    }

    // Performance impact
    if (task.labels?.some((label: string) => label.includes('performance'))) {
      score += 15;
    }

    // API impact
    if (affectedFiles.some((file: string) => file.includes('api') || file.includes('interface'))) {
      score += 20;
    }

    // Database impact
    if (task.description?.includes('database') || task.description?.includes('migration')) {
      score += 30;
    }

    return Math.min(100, Math.max(0, score));
  }

  private calculateUrgencyScore(task: any, context: TaskContext): number {
    let score = 50; // Base score

    // Deadline pressure
    const now = new Date();
    const nearestDeadline = context.businessContext.deadlines
      .filter(deadline => deadline > now)
      .sort((a, b) => a.getTime() - b.getTime())[0];

    if (nearestDeadline) {
      const daysUntilDeadline = (nearestDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysUntilDeadline < 7) score += 30;
      else if (daysUntilDeadline < 30) score += 15;
    }

    // Bug severity
    if (task.labels?.some((label: string) => label.includes('critical'))) {
      score += 40;
    } else if (task.labels?.some((label: string) => label.includes('high'))) {
      score += 25;
    }

    // Blocking other work
    if (task.blockers?.length > 0) {
      score += task.blockers.length * 10;
    }

    // Customer escalation
    if (task.labels?.some((label: string) => label.includes('escalation'))) {
      score += 35;
    }

    // Market pressure
    score += context.businessContext.marketPressure * 0.2;

    return Math.min(100, Math.max(0, score));
  }

  private async calculateComplexityScore(
    task: any,
    context: TaskContext,
    installationId: string,
    owner: string,
    repo: string
  ): Promise<number> {
    let score = 50; // Base score

    // Number of affected files
    const affectedFiles = task.paths || task.affectedFiles || [];
    score += Math.min(affectedFiles.length * 5, 30);

    // File types complexity
    const complexFileTypes = ['.tsx', '.ts', '.vue', '.py', '.java', '.cpp'];
    const complexFiles = affectedFiles.filter((file: string) => 
      complexFileTypes.some(ext => file.endsWith(ext))
    );
    score += complexFiles.length * 3;

    // Code areas
    if (affectedFiles.some((file: string) => file.includes('core') || file.includes('engine'))) {
      score += 20;
    }
    if (affectedFiles.some((file: string) => file.includes('auth') || file.includes('security'))) {
      score += 15;
    }
    if (affectedFiles.some((file: string) => file.includes('api'))) {
      score += 10;
    }

    // Description complexity indicators
    const complexityKeywords = ['refactor', 'architecture', 'migration', 'integration', 'algorithm'];
    const descriptionComplexity = complexityKeywords.filter(keyword => 
      task.description?.toLowerCase().includes(keyword)
    ).length;
    score += descriptionComplexity * 8;

    // Dependencies
    score += (task.dependencies?.length || 0) * 5;

    // Team expertise match
    const requiredSkills = this.extractRequiredSkills(task);
    const teamSkillGap = this.calculateSkillGap(requiredSkills, context.teamInfo.expertise);
    score += teamSkillGap * 20;

    return Math.min(100, Math.max(0, score));
  }

  private calculateDependencyLevel(task: any, context: TaskContext): number {
    const dependencies = task.dependencies || [];
    const blockers = task.blockers || [];
    
    // Direct dependencies impact
    let score = dependencies.length * 10;
    
    // Blocking impact
    score += blockers.length * 15;
    
    // Cross-team dependencies
    const crossTeamDeps = dependencies.filter((dep: string) => 
      !context.teamInfo.expertise[dep] // Assuming team doesn't have expertise in this area
    );
    score += crossTeamDeps.length * 20;
    
    return Math.min(100, Math.max(0, score));
  }

  private calculateBusinessValue(task: any, context: TaskContext): number {
    let score = 50; // Base score

    // Revenue impact
    if (task.labels?.some((label: string) => label.includes('revenue'))) {
      score += 30;
    }

    // Customer satisfaction
    if (task.labels?.some((label: string) => label.includes('customer'))) {
      score += 20;
    }

    // Compliance requirements
    const complianceImpact = context.businessContext.complianceRequirements.filter(req =>
      task.description?.toLowerCase().includes(req.toLowerCase())
    ).length;
    score += complianceImpact * 25;

    // Strategic alignment
    if (task.labels?.some((label: string) => label.includes('strategic'))) {
      score += 25;
    }

    // Technical debt reduction
    if (task.description?.toLowerCase().includes('debt') || 
        task.description?.toLowerCase().includes('refactor')) {
      score += 15;
    }

    return Math.min(100, Math.max(0, score));
  }

  private calculateTechnicalDebtImpact(task: any, context: TaskContext): number {
    let debtScore = 0;

    // Adding debt
    if (task.description?.toLowerCase().includes('quick fix') ||
        task.description?.toLowerCase().includes('workaround')) {
      debtScore += 30;
    }

    // Reducing debt
    if (task.description?.toLowerCase().includes('refactor') ||
        task.description?.toLowerCase().includes('cleanup') ||
        task.description?.toLowerCase().includes('modernize')) {
      debtScore -= 25;
    }

    // Test coverage impact
    if (task.description?.toLowerCase().includes('test')) {
      debtScore -= 15;
    }

    // Documentation impact
    if (task.description?.toLowerCase().includes('document')) {
      debtScore -= 10;
    }

    // Current technical debt context
    debtScore += context.technicalContext.technicalDebtRatio * 0.3;

    return Math.min(100, Math.max(-50, debtScore));
  }

  private assessTaskRisk(
    task: any,
    context: TaskContext,
    impactScore: number,
    complexityScore: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    
    // High impact + high complexity = high risk
    if (impactScore > 80 && complexityScore > 80) return 'critical';
    if (impactScore > 70 && complexityScore > 70) return 'high';
    if (impactScore > 60 || complexityScore > 60) return 'medium';
    
    // Security tasks are inherently risky
    if (task.labels?.some((label: string) => label.includes('security'))) {
      return complexityScore > 50 ? 'high' : 'medium';
    }
    
    // Database changes are risky
    if (task.description?.includes('database') || task.description?.includes('migration')) {
      return 'medium';
    }
    
    // Critical files
    const affectedFiles = task.paths || task.affectedFiles || [];
    if (affectedFiles.some((file: string) => this.isCriticalFile(file))) {
      return complexityScore > 60 ? 'high' : 'medium';
    }
    
    return 'low';
  }

  private calculatePriority(factors: {
    impactScore: number;
    urgencyScore: number;
    complexityScore: number;
    businessValue: number;
    technicalDebt: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }): number {
    
    // Weights for different factors
    const weights = {
      impact: 0.25,
      urgency: 0.25,
      businessValue: 0.20,
      complexity: -0.15, // Higher complexity reduces priority
      technicalDebt: -0.10, // Higher debt reduces priority
      risk: -0.05 // Higher risk slightly reduces priority
    };
    
    const riskPenalty = {
      'low': 0,
      'medium': 5,
      'high': 15,
      'critical': 30
    };
    
    const rawScore = 
      factors.impactScore * weights.impact +
      factors.urgencyScore * weights.urgency +
      factors.businessValue * weights.businessValue +
      factors.complexityScore * weights.complexity +
      factors.technicalDebt * weights.technicalDebt -
      riskPenalty[factors.riskLevel];
    
    return Math.min(100, Math.max(0, rawScore));
  }

  private estimateEffort(task: any, complexityScore: number, context: TaskContext): number {
    // Base effort from complexity
    let hours = (complexityScore / 100) * 40; // 0-40 hours based on complexity
    
    // Adjust for team expertise
    const requiredSkills = this.extractRequiredSkills(task);
    const skillGap = this.calculateSkillGap(requiredSkills, context.teamInfo.expertise);
    hours *= (1 + skillGap); // Increase effort if skill gap exists
    
    // Adjust for dependencies
    const dependencies = task.dependencies || [];
    hours += dependencies.length * 2; // 2 hours per dependency
    
    // Adjust for affected files
    const affectedFiles = task.paths || task.affectedFiles || [];
    hours += affectedFiles.length * 0.5;
    
    return Math.round(hours * 10) / 10; // Round to 1 decimal place
  }

  private calculateConfidence(task: any, context: TaskContext): number {
    let confidence = 0.7; // Base confidence
    
    // More details = higher confidence
    if (task.description?.length > 100) confidence += 0.1;
    if (task.paths?.length > 0) confidence += 0.1;
    
    // Team expertise match increases confidence
    const requiredSkills = this.extractRequiredSkills(task);
    const skillMatch = this.calculateSkillMatch(requiredSkills, context.teamInfo.expertise);
    confidence += skillMatch * 0.2;
    
    return Math.min(1, Math.max(0.3, confidence));
  }

  private assessGlobalRisk(tasks: PrioritizedTask[], context: TaskContext): GlobalRiskAssessment {
    const riskFactors: RiskFactor[] = [];
    
    // High-risk task concentration
    const highRiskTasks = tasks.filter(t => t.riskLevel === 'high' || t.riskLevel === 'critical').length;
    if (highRiskTasks > tasks.length * 0.3) {
      riskFactors.push({
        type: 'technical',
        description: 'High concentration of risky tasks',
        severity: 7,
        likelihood: 0.8,
        impact: 'May cause delays and quality issues',
        mitigation: 'Distribute high-risk tasks across sprints'
      });
    }
    
    // Resource constraints
    if (context.teamInfo.workload > 90) {
      riskFactors.push({
        type: 'business',
        description: 'Team at maximum capacity',
        severity: 8,
        likelihood: 0.9,
        impact: 'Increased risk of burnout and errors',
        mitigation: 'Consider reducing scope or adding resources'
      });
    }
    
    // Technical debt impact
    if (context.technicalContext.technicalDebtRatio > 60) {
      riskFactors.push({
        type: 'technical',
        description: 'High technical debt ratio',
        severity: 6,
        likelihood: 0.7,
        impact: 'Slower development and increased bug rate',
        mitigation: 'Prioritize debt reduction tasks'
      });
    }
    
    // Dependencies risk
    const complexDependencies = tasks.filter(t => t.dependencyLevel > 70).length;
    if (complexDependencies > 0) {
      riskFactors.push({
        type: 'technical',
        description: 'Complex task dependencies',
        severity: 5,
        likelihood: 0.6,
        impact: 'Potential for cascading delays',
        mitigation: 'Plan dependency resolution carefully'
      });
    }
    
    const overallRiskLevel = this.calculateOverallRiskLevel(riskFactors);
    
    return {
      overallRiskLevel,
      riskFactors,
      mitigationStrategies: riskFactors.map(f => f.mitigation || 'No mitigation identified'),
      parallelExecutionSafety: this.assessParallelExecutionSafety(tasks),
      rollbackComplexity: this.assessRollbackComplexity(tasks)
    };
  }

  private calculateExecutionOrder(tasks: PrioritizedTask[]): string[] {
    // Topological sort considering dependencies and priorities
    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const visit = (taskId: string) => {
      if (visiting.has(taskId)) {
        // Circular dependency detected - skip
        return;
      }
      if (visited.has(taskId)) return;
      
      visiting.add(taskId);
      
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        // Visit dependencies first
        for (const dep of task.dependencies) {
          visit(dep);
        }
      }
      
      visiting.delete(taskId);
      visited.add(taskId);
      sorted.push(taskId);
    };
    
    // Sort by priority first, then apply topological sort
    const prioritySorted = [...tasks].sort((a, b) => b.priority - a.priority);
    
    for (const task of prioritySorted) {
      visit(task.id);
    }
    
    return sorted;
  }

  private generateRecommendations(
    tasks: PrioritizedTask[],
    context: TaskContext,
    riskAssessment: GlobalRiskAssessment
  ): PriorizationRecommendation[] {
    const recommendations: PriorizationRecommendation[] = [];
    
    // Workload recommendations
    if (context.teamInfo.workload > 85) {
      recommendations.push({
        type: 'resource',
        title: 'Team Overload Warning',
        description: 'Current team workload exceeds recommended capacity',
        priority: 'high',
        actionItems: [
          'Consider reducing sprint scope',
          'Evaluate bringing in additional resources',
          'Defer lower priority tasks'
        ]
      });
    }
    
    // Risk management recommendations
    if (riskAssessment.overallRiskLevel === 'high' || riskAssessment.overallRiskLevel === 'critical') {
      recommendations.push({
        type: 'risk',
        title: 'High Risk Level Detected',
        description: 'Current task portfolio has elevated risk profile',
        priority: 'high',
        actionItems: [
          'Implement additional code review processes',
          'Increase testing coverage',
          'Plan rollback procedures',
          'Consider feature flags for risky deployments'
        ]
      });
    }
    
    // Sequencing recommendations
    const blockedTasks = tasks.filter(t => t.blockers.length > 0);
    if (blockedTasks.length > 0) {
      recommendations.push({
        type: 'sequencing',
        title: 'Dependency Optimization',
        description: `${blockedTasks.length} tasks are blocked by dependencies`,
        priority: 'medium',
        actionItems: [
          'Prioritize unblocking tasks',
          'Parallelize independent work streams',
          'Consider breaking down large blocking tasks'
        ]
      });
    }
    
    // Technical debt recommendations
    const debtTasks = tasks.filter(t => t.technicalDebt < -10);
    if (debtTasks.length > 0 && context.technicalContext.technicalDebtRatio > 50) {
      recommendations.push({
        type: 'execution',
        title: 'Technical Debt Reduction',
        description: 'Opportunity to reduce technical debt',
        priority: 'medium',
        actionItems: [
          'Prioritize debt reduction tasks',
          'Allocate 20% of sprint capacity to debt reduction',
          'Focus on high-impact debt reduction'
        ]
      });
    }
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // Utility methods
  private determineProjectType(repo: any): string {
    const language = repo.language?.toLowerCase();
    const name = repo.name.toLowerCase();
    const description = repo.description?.toLowerCase() || '';
    
    if (language === 'javascript' || language === 'typescript') {
      if (description.includes('api') || description.includes('server')) return 'backend-service';
      if (description.includes('react') || description.includes('vue')) return 'frontend-app';
      return 'web-application';
    }
    
    if (language === 'python') {
      if (description.includes('api') || description.includes('flask') || description.includes('django')) {
        return 'backend-service';
      }
      return 'python-application';
    }
    
    if (language === 'java') return 'java-application';
    if (language === 'go') return 'go-service';
    
    return 'general-application';
  }

  private determineProjectStage(repo: any): string {
    if (repo.stargazers_count > 1000) return 'production';
    if (repo.stargazers_count > 100) return 'staging';
    return 'development';
  }

  private assessProjectCriticality(repo: any, issues: any[]): string {
    const criticalIssues = issues.filter(issue => 
      issue.labels?.some((label: any) => label.name.includes('critical'))
    ).length;
    
    if (repo.stargazers_count > 5000 || criticalIssues > 5) return 'critical';
    if (repo.stargazers_count > 1000 || criticalIssues > 2) return 'high';
    if (repo.stargazers_count > 100) return 'medium';
    return 'low';
  }

  private async analyzeTeamExpertise(contributors: any[]): Promise<Record<string, number>> {
    const expertise: Record<string, number> = {};
    const maxContributions = Math.max(...contributors.map(c => c.contributions));
    
    contributors.forEach(contributor => {
      expertise[contributor.login] = contributor.contributions / maxContributions;
    });
    
    return expertise;
  }

  private estimateTeamAvailability(contributors: any[]): Record<string, number> {
    // Simplified - in production would integrate with calendar/project management tools
    const availability: Record<string, number> = {};
    
    contributors.forEach(contributor => {
      availability[contributor.login] = 0.8 + Math.random() * 0.2; // 80-100% availability
    });
    
    return availability;
  }

  private calculateCurrentWorkload(issues: any[], pulls: any[]): number {
    const openIssues = issues.filter(issue => issue.state === 'open').length;
    const openPRs = pulls.filter(pr => pr.state === 'open').length;
    
    // Heuristic: high workload if many open items
    const totalWork = openIssues + openPRs * 2; // PRs count double
    return Math.min(100, totalWork * 5); // Scale to percentage
  }

  private async estimateCodebaseSize(installationId: string, owner: string, repo: string): Promise<number> {
    try {
      const octokit = await getInstallationOctokit(installationId);
      const languages = await octokit.rest.repos.listLanguages({ owner, repo });
      
      return Object.values(languages.data).reduce((sum: number, bytes: any) => sum + bytes, 0);
    } catch (error) {
      log.debug(`Failed to get codebase size: ${error}`);
      return 100000; // Default estimate
    }
  }

  private async estimateTestCoverage(installationId: string, owner: string, repo: string): Promise<number> {
    // Placeholder - would integrate with coverage tools in production
    return 60 + Math.random() * 30; // 60-90%
  }

  private estimateTechnicalDebt(commits: any[]): number {
    // Analyze commit messages for debt indicators
    const debtKeywords = ['fix', 'hack', 'temp', 'todo', 'workaround'];
    const debtCommits = commits.filter(commit => 
      debtKeywords.some(keyword => 
        commit.commit.message.toLowerCase().includes(keyword)
      )
    ).length;
    
    return Math.min(100, (debtCommits / commits.length) * 100);
  }

  private calculateDeploymentFrequency(commits: any[]): number {
    if (commits.length === 0) return 0;
    
    const oldestCommit = new Date(commits[commits.length - 1].commit.author.date);
    const newestCommit = new Date(commits[0].commit.author.date);
    const daysDiff = (newestCommit.getTime() - oldestCommit.getTime()) / (1000 * 60 * 60 * 24);
    
    return commits.length / daysDiff; // Commits per day
  }

  private calculateIncidentRate(issues: any[]): number {
    const bugIssues = issues.filter(issue => 
      issue.labels?.some((label: any) => label.name.includes('bug'))
    ).length;
    
    return (bugIssues / issues.length) * 100;
  }

  private extractDeadlines(issues: any[]): Date[] {
    const deadlines: Date[] = [];
    
    issues.forEach(issue => {
      const milestone = issue.milestone?.due_on;
      if (milestone) {
        deadlines.push(new Date(milestone));
      }
    });
    
    return deadlines.sort((a, b) => a.getTime() - b.getTime());
  }

  private analyzeStakeholderPriorities(issues: any[]): Record<string, number> {
    const priorities: Record<string, number> = {};
    
    issues.forEach(issue => {
      const assignees = issue.assignees || [];
      assignees.forEach((assignee: any) => {
        priorities[assignee.login] = (priorities[assignee.login] || 0) + 1;
      });
    });
    
    return priorities;
  }

  private assessMarketPressure(repo: any, issues: any[]): number {
    let pressure = 30; // Base pressure
    
    // More watchers = more pressure
    pressure += Math.min(repo.watchers_count / 100, 30);
    
    // Critical issues increase pressure
    const criticalIssues = issues.filter(issue =>
      issue.labels?.some((label: any) => label.name.includes('critical'))
    ).length;
    pressure += criticalIssues * 10;
    
    return Math.min(100, pressure);
  }

  private identifyComplianceRequirements(issues: any[]): string[] {
    const complianceKeywords = ['gdpr', 'hipaa', 'sox', 'compliance', 'audit', 'security'];
    const requirements = new Set<string>();
    
    issues.forEach(issue => {
      const text = (issue.title + ' ' + issue.body).toLowerCase();
      complianceKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
          requirements.add(keyword.toUpperCase());
        }
      });
    });
    
    return Array.from(requirements);
  }

  private isCriticalFile(filePath: string): boolean {
    const criticalPatterns = [
      /\/index\./,
      /\/main\./,
      /\/app\./,
      /\/server\./,
      /\/config\./,
      /package\.json$/,
      /\/core\//,
      /\/auth\//,
      /\/security\//
    ];
    
    return criticalPatterns.some(pattern => pattern.test(filePath));
  }

  private extractRequiredSkills(task: any): string[] {
    const skills: string[] = [];
    const text = (task.title + ' ' + task.description).toLowerCase();
    
    const skillMap = {
      'javascript': ['javascript', 'js', 'node'],
      'typescript': ['typescript', 'ts'],
      'react': ['react', 'jsx'],
      'vue': ['vue'],
      'python': ['python', 'py'],
      'security': ['security', 'auth', 'encryption'],
      'database': ['database', 'sql', 'mongodb'],
      'devops': ['docker', 'kubernetes', 'ci/cd', 'deployment']
    };
    
    Object.entries(skillMap).forEach(([skill, keywords]) => {
      if (keywords.some(keyword => text.includes(keyword))) {
        skills.push(skill);
      }
    });
    
    return skills;
  }

  private calculateSkillGap(requiredSkills: string[], teamExpertise: Record<string, number>): number {
    if (requiredSkills.length === 0) return 0;
    
    const maxExpertise = Math.max(...Object.values(teamExpertise), 1);
    let totalGap = 0;
    
    requiredSkills.forEach(skill => {
      const maxSkillExpertise = Math.max(...Object.keys(teamExpertise)
        .filter(member => skill in teamExpertise)
        .map(member => teamExpertise[member] || 0), 0);
      
      const gap = 1 - (maxSkillExpertise / maxExpertise);
      totalGap += gap;
    });
    
    return totalGap / requiredSkills.length;
  }

  private calculateSkillMatch(requiredSkills: string[], teamExpertise: Record<string, number>): number {
    return 1 - this.calculateSkillGap(requiredSkills, teamExpertise);
  }

  private generatePriorityReasoning(factors: any): string[] {
    const reasoning: string[] = [];
    
    if (factors.impactScore > 80) {
      reasoning.push('High impact on system and users');
    }
    if (factors.urgencyScore > 80) {
      reasoning.push('Time-sensitive with approaching deadlines');
    }
    if (factors.businessValue > 80) {
      reasoning.push('Significant business value and strategic importance');
    }
    if (factors.complexityScore > 80) {
      reasoning.push('High complexity may require additional time and expertise');
    }
    if (factors.riskLevel === 'high' || factors.riskLevel === 'critical') {
      reasoning.push('Elevated risk level requires careful planning');
    }
    if (factors.technicalDebt < -10) {
      reasoning.push('Opportunity to reduce technical debt');
    }
    
    return reasoning;
  }

  private calculateOverallRiskLevel(riskFactors: RiskFactor[]): 'low' | 'medium' | 'high' | 'critical' {
    if (riskFactors.length === 0) return 'low';
    
    const avgSeverity = riskFactors.reduce((sum, factor) => sum + factor.severity, 0) / riskFactors.length;
    const criticalFactors = riskFactors.filter(f => f.severity >= 8).length;
    
    if (criticalFactors > 0 || avgSeverity >= 8) return 'critical';
    if (avgSeverity >= 6) return 'high';
    if (avgSeverity >= 4) return 'medium';
    return 'low';
  }

  private assessParallelExecutionSafety(tasks: PrioritizedTask[]): boolean {
    // Check if tasks can be executed in parallel safely
    const conflictingFiles = new Map<string, string[]>();
    
    tasks.forEach(task => {
      task.affectedFiles.forEach(file => {
        if (!conflictingFiles.has(file)) {
          conflictingFiles.set(file, []);
        }
        conflictingFiles.get(file)!.push(task.id);
      });
    });
    
    // If any file is affected by multiple tasks, parallel execution is risky
    return !Array.from(conflictingFiles.values()).some(taskIds => taskIds.length > 1);
  }

  private assessRollbackComplexity(tasks: PrioritizedTask[]): 'simple' | 'moderate' | 'complex' {
    const dbTasks = tasks.filter(t => 
      t.description.toLowerCase().includes('database') ||
      t.description.toLowerCase().includes('migration')
    ).length;
    
    const highRiskTasks = tasks.filter(t => 
      t.riskLevel === 'high' || t.riskLevel === 'critical'
    ).length;
    
    if (dbTasks > 2 || highRiskTasks > 3) return 'complex';
    if (dbTasks > 0 || highRiskTasks > 1) return 'moderate';
    return 'simple';
  }

  // Public API methods
  async reprioritize(
    currentTasks: PrioritizedTask[],
    contextChanges: Partial<TaskContext>
  ): Promise<PrioritizedTask[]> {
    // Update context and reprioritize existing tasks
    const updatedTasks = currentTasks.map(task => {
      // Recalculate priority with new context
      // Implementation would recalculate all scores
      return { ...task, priority: task.priority }; // Simplified
    });
    
    return updatedTasks.sort((a, b) => b.priority - a.priority);
  }

  async generateSprintPlan(
    tasks: PrioritizedTask[],
    sprintCapacity: number,
    sprintDuration: number
  ): Promise<{
    sprintTasks: PrioritizedTask[];
    capacityUtilization: number;
    riskLevel: string;
    recommendations: string[];
  }> {
    let totalEffort = 0;
    const sprintTasks: PrioritizedTask[] = [];
    
    // Select tasks that fit within sprint capacity
    for (const task of tasks) {
      if (totalEffort + task.estimatedEffort <= sprintCapacity) {
        sprintTasks.push(task);
        totalEffort += task.estimatedEffort;
      }
    }
    
    const capacityUtilization = (totalEffort / sprintCapacity) * 100;
    const highRiskTasks = sprintTasks.filter(t => t.riskLevel === 'high' || t.riskLevel === 'critical').length;
    const riskLevel = highRiskTasks > sprintTasks.length * 0.3 ? 'high' : 'medium';
    
    const recommendations = [];
    if (capacityUtilization > 90) {
      recommendations.push('Sprint capacity is at maximum - consider buffer for unexpected work');
    }
    if (riskLevel === 'high') {
      recommendations.push('High-risk tasks concentration - plan additional testing and reviews');
    }
    
    return {
      sprintTasks,
      capacityUtilization,
      riskLevel,
      recommendations
    };
  }
}

export default RiskAwareTaskPrioritizer;