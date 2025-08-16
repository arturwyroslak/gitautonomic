// Adaptive Strategy Selector - Chooses optimal approaches based on codebase patterns
import pino from 'pino';
import { getInstallationOctokit } from '../octokit.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface StrategyRecommendation {
  strategyId: string;
  name: string;
  description: string;
  confidence: number; // 0-1 scale
  applicability: number; // 0-1 scale
  expectedOutcome: string;
  risks: string[];
  benefits: string[];
  prerequisites: string[];
  estimatedEffort: number; // hours
  complexity: 'low' | 'medium' | 'high';
  reasoning: string[];
}

export interface ProjectAnalysis {
  codebaseCharacteristics: CodebaseCharacteristics;
  developmentPatterns: DevelopmentPatterns;
  teamCapabilities: TeamCapabilities;
  technicalContext: TechnicalContext;
  businessContext: BusinessContext;
}

export interface CodebaseCharacteristics {
  size: 'small' | 'medium' | 'large' | 'enterprise';
  complexity: 'simple' | 'moderate' | 'complex' | 'very-complex';
  architecture: string; // mvc, microservices, monolith, etc.
  primaryLanguages: string[];
  frameworks: string[];
  testCoverage: number;
  technicalDebtRatio: number;
  codeQualityScore: number;
  performanceProfile: string[];
}

export interface DevelopmentPatterns {
  commitFrequency: 'low' | 'medium' | 'high';
  branchingStrategy: string; // git-flow, github-flow, etc.
  releasePattern: 'continuous' | 'weekly' | 'monthly' | 'quarterly';
  reviewProcess: 'none' | 'basic' | 'thorough' | 'strict';
  automationLevel: 'manual' | 'partial' | 'automated' | 'fully-automated';
  incidentRate: number;
  deploymentSuccess: number;
}

export interface TeamCapabilities {
  size: number;
  experienceLevel: 'junior' | 'mixed' | 'senior' | 'expert';
  skillDistribution: Record<string, number>;
  availability: number; // percentage
  timezone: string;
  communicationStyle: 'async' | 'mixed' | 'sync';
}

export interface TechnicalContext {
  infrastructure: 'cloud' | 'on-premise' | 'hybrid';
  cicdMaturity: 'none' | 'basic' | 'intermediate' | 'advanced';
  monitoringLevel: 'basic' | 'good' | 'excellent';
  securityPosture: 'weak' | 'adequate' | 'strong' | 'excellent';
  scalabilityNeeds: 'low' | 'medium' | 'high' | 'extreme';
}

export interface BusinessContext {
  industry: string;
  regulatoryRequirements: string[];
  marketPressure: 'low' | 'medium' | 'high';
  budgetConstraints: 'tight' | 'moderate' | 'flexible';
  timeToMarket: 'critical' | 'important' | 'flexible';
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
}

export interface StrategySelection {
  primaryStrategy: StrategyRecommendation;
  alternativeStrategies: StrategyRecommendation[];
  contextualFactors: string[];
  decisionMatrix: DecisionMatrix;
  adaptationTriggers: AdaptationTrigger[];
}

export interface DecisionMatrix {
  criteria: DecisionCriterion[];
  strategies: StrategyScore[];
  weightedScores: Record<string, number>;
}

export interface DecisionCriterion {
  name: string;
  weight: number;
  description: string;
  measurable: boolean;
}

export interface StrategyScore {
  strategyId: string;
  scores: Record<string, number>; // criterion -> score
  totalScore: number;
}

export interface AdaptationTrigger {
  condition: string;
  threshold: number;
  action: string;
  description: string;
}

export class AdaptiveStrategySelector {
  private strategies = new Map<string, StrategyTemplate>();
  private contextCache = new Map<string, ProjectAnalysis>();

  constructor() {
    this.initializeStrategies();
  }

  async selectOptimalStrategy(
    taskDescription: string,
    installationId: string,
    owner: string,
    repo: string,
    contextOverrides?: Partial<ProjectAnalysis>
  ): Promise<StrategySelection> {
    log.info('Starting adaptive strategy selection');

    const projectAnalysis = await this.analyzeProject(installationId, owner, repo, contextOverrides);
    const relevantStrategies = this.filterRelevantStrategies(taskDescription, projectAnalysis);
    const evaluatedStrategies = this.evaluateStrategies(relevantStrategies, projectAnalysis, taskDescription);
    const decisionMatrix = this.buildDecisionMatrix(evaluatedStrategies, projectAnalysis);
    const selection = this.makeSelection(evaluatedStrategies, decisionMatrix, projectAnalysis);

    return selection;
  }

  private initializeStrategies(): void {
    // Development Strategies
    this.strategies.set('incremental-development', {
      id: 'incremental-development',
      name: 'Incremental Development',
      category: 'development',
      description: 'Break down large features into small, iterative improvements',
      applicablePatterns: ['agile', 'iterative'],
      prerequisites: ['good-testing', 'ci-cd'],
      benefits: ['reduced-risk', 'faster-feedback', 'easier-debugging'],
      risks: ['integration-complexity', 'incomplete-features'],
      complexity: 'medium',
      baseEffort: 20,
      evaluation: this.evaluateIncrementalDevelopment.bind(this)
    });

    this.strategies.set('big-bang-development', {
      id: 'big-bang-development',
      name: 'Big Bang Development',
      category: 'development',
      description: 'Implement complete feature in one comprehensive change',
      applicablePatterns: ['waterfall', 'feature-complete'],
      prerequisites: ['thorough-planning', 'experienced-team'],
      benefits: ['complete-integration', 'reduced-coordination'],
      risks: ['high-failure-risk', 'difficult-debugging', 'delayed-feedback'],
      complexity: 'high',
      baseEffort: 50,
      evaluation: this.evaluateBigBangDevelopment.bind(this)
    });

    this.strategies.set('feature-flagging', {
      id: 'feature-flagging',
      name: 'Feature Flag Strategy',
      category: 'deployment',
      description: 'Use feature flags to control feature rollout and reduce deployment risk',
      applicablePatterns: ['continuous-deployment', 'gradual-rollout'],
      prerequisites: ['feature-flag-infrastructure', 'monitoring'],
      benefits: ['zero-downtime', 'easy-rollback', 'gradual-testing'],
      risks: ['technical-debt', 'complexity-overhead'],
      complexity: 'medium',
      baseEffort: 15,
      evaluation: this.evaluateFeatureFlagging.bind(this)
    });

    this.strategies.set('blue-green-deployment', {
      id: 'blue-green-deployment',
      name: 'Blue-Green Deployment',
      category: 'deployment',
      description: 'Maintain two identical production environments for zero-downtime deployments',
      applicablePatterns: ['zero-downtime', 'infrastructure-as-code'],
      prerequisites: ['infrastructure-automation', 'load-balancer'],
      benefits: ['zero-downtime', 'instant-rollback', 'production-testing'],
      risks: ['resource-cost', 'data-synchronization'],
      complexity: 'high',
      baseEffort: 40,
      evaluation: this.evaluateBlueGreenDeployment.bind(this)
    });

    this.strategies.set('test-driven-development', {
      id: 'test-driven-development',
      name: 'Test-Driven Development',
      category: 'quality',
      description: 'Write tests before implementation to drive design and ensure quality',
      applicablePatterns: ['tdd', 'quality-first'],
      prerequisites: ['testing-framework', 'team-buy-in'],
      benefits: ['high-quality', 'good-design', 'regression-protection'],
      risks: ['slower-initial-development', 'learning-curve'],
      complexity: 'medium',
      baseEffort: 30,
      evaluation: this.evaluateTestDrivenDevelopment.bind(this)
    });

    this.strategies.set('behavior-driven-development', {
      id: 'behavior-driven-development',
      name: 'Behavior-Driven Development',
      category: 'quality',
      description: 'Focus on behavior specification through examples and collaboration',
      applicablePatterns: ['bdd', 'collaboration-focused'],
      prerequisites: ['stakeholder-involvement', 'bdd-tools'],
      benefits: ['clear-requirements', 'stakeholder-alignment', 'living-documentation'],
      risks: ['overhead', 'tool-complexity'],
      complexity: 'medium',
      baseEffort: 35,
      evaluation: this.evaluateBehaviorDrivenDevelopment.bind(this)
    });

    this.strategies.set('pair-programming', {
      id: 'pair-programming',
      name: 'Pair Programming',
      category: 'collaboration',
      description: 'Two developers work together on the same code for improved quality and knowledge sharing',
      applicablePatterns: ['extreme-programming', 'knowledge-sharing'],
      prerequisites: ['team-culture', 'development-environment'],
      benefits: ['knowledge-transfer', 'fewer-bugs', 'better-design'],
      risks: ['resource-intensive', 'personality-conflicts'],
      complexity: 'low',
      baseEffort: 25,
      evaluation: this.evaluatePairProgramming.bind(this)
    });

    this.strategies.set('code-review-focused', {
      id: 'code-review-focused',
      name: 'Rigorous Code Review',
      category: 'quality',
      description: 'Implement thorough code review process for quality assurance',
      applicablePatterns: ['quality-gates', 'peer-review'],
      prerequisites: ['review-tools', 'team-discipline'],
      benefits: ['code-quality', 'knowledge-sharing', 'bug-prevention'],
      risks: ['development-slowdown', 'review-bottlenecks'],
      complexity: 'low',
      baseEffort: 10,
      evaluation: this.evaluateCodeReviewFocused.bind(this)
    });

    this.strategies.set('microservices-approach', {
      id: 'microservices-approach',
      name: 'Microservices Architecture',
      category: 'architecture',
      description: 'Break down monolithic applications into independent microservices',
      applicablePatterns: ['distributed-systems', 'service-oriented'],
      prerequisites: ['containerization', 'service-mesh', 'monitoring'],
      benefits: ['scalability', 'team-independence', 'technology-diversity'],
      risks: ['distributed-complexity', 'data-consistency', 'operational-overhead'],
      complexity: 'high',
      baseEffort: 80,
      evaluation: this.evaluateMicroservicesApproach.bind(this)
    });

    this.strategies.set('monolith-first', {
      id: 'monolith-first',
      name: 'Monolith-First Approach',
      category: 'architecture',
      description: 'Start with a well-structured monolith before considering microservices',
      applicablePatterns: ['simple-start', 'gradual-evolution'],
      prerequisites: ['modular-design', 'clear-boundaries'],
      benefits: ['simplicity', 'easier-debugging', 'faster-development'],
      risks: ['scaling-limitations', 'deployment-coupling'],
      complexity: 'low',
      baseEffort: 20,
      evaluation: this.evaluateMonolithFirst.bind(this)
    });

    this.strategies.set('domain-driven-design', {
      id: 'domain-driven-design',
      name: 'Domain-Driven Design',
      category: 'architecture',
      description: 'Focus on business domain modeling to drive software design decisions',
      applicablePatterns: ['business-focused', 'complex-domains'],
      prerequisites: ['domain-expertise', 'stakeholder-collaboration'],
      benefits: ['business-alignment', 'maintainable-design', 'clear-boundaries'],
      risks: ['learning-curve', 'over-engineering'],
      complexity: 'high',
      baseEffort: 60,
      evaluation: this.evaluateDomainDrivenDesign.bind(this)
    });
  }

  private async analyzeProject(
    installationId: string,
    owner: string,
    repo: string,
    overrides?: Partial<ProjectAnalysis>
  ): Promise<ProjectAnalysis> {
    const cacheKey = `${owner}/${repo}`;
    
    if (this.contextCache.has(cacheKey) && !overrides) {
      return this.contextCache.get(cacheKey)!;
    }

    const octokit = await getInstallationOctokit(installationId);
    
    // Gather repository data
    const [repoInfo, languages, commits, issues, pulls, contributors] = await Promise.all([
      octokit.rest.repos.get({ owner, repo }),
      octokit.rest.repos.listLanguages({ owner, repo }),
      octokit.rest.repos.listCommits({ owner, repo, per_page: 100 }),
      octokit.rest.issues.list({ owner, repo, state: 'all', per_page: 100 }),
      octokit.rest.pulls.list({ owner, repo, state: 'all', per_page: 50 }),
      octokit.rest.repos.listContributors({ owner, repo })
    ]);

    const analysis: ProjectAnalysis = {
      codebaseCharacteristics: this.analyzeCodebaseCharacteristics(repoInfo.data, languages.data),
      developmentPatterns: this.analyzeDevelopmentPatterns(commits.data, issues.data, pulls.data),
      teamCapabilities: this.analyzeTeamCapabilities(contributors.data, commits.data),
      technicalContext: await this.analyzeTechnicalContext(installationId, owner, repo),
      businessContext: this.analyzeBusinessContext(repoInfo.data, issues.data)
    };

    // Apply overrides
    if (overrides) {
      Object.assign(analysis, overrides);
    }

    this.contextCache.set(cacheKey, analysis);
    return analysis;
  }

  private analyzeCodebaseCharacteristics(repoInfo: any, languages: any): CodebaseCharacteristics {
    const totalBytes = Object.values(languages).reduce((sum: number, bytes: any) => sum + bytes, 0);
    const primaryLanguages = Object.keys(languages);
    const frameworks = this.detectFrameworks(languages);

    return {
      size: this.categorizeSize(totalBytes),
      complexity: this.assessComplexity(languages, frameworks),
      architecture: this.detectArchitecture(repoInfo, frameworks),
      primaryLanguages,
      frameworks,
      testCoverage: this.estimateTestCoverage(totalBytes),
      technicalDebtRatio: this.estimateTechnicalDebt(repoInfo),
      codeQualityScore: this.estimateCodeQuality(repoInfo),
      performanceProfile: this.analyzePerformanceProfile(languages, frameworks)
    };
  }

  private analyzeDevelopmentPatterns(commits: any[], issues: any[], pulls: any[]): DevelopmentPatterns {
    const commitFrequency = this.calculateCommitFrequency(commits);
    const branchingStrategy = this.detectBranchingStrategy(commits, pulls);
    const reviewProcess = this.assessReviewProcess(pulls);

    return {
      commitFrequency,
      branchingStrategy,
      releasePattern: this.detectReleasePattern(commits),
      reviewProcess,
      automationLevel: this.assessAutomationLevel(commits, pulls),
      incidentRate: this.calculateIncidentRate(issues),
      deploymentSuccess: this.estimateDeploymentSuccess(commits, issues)
    };
  }

  private analyzeTeamCapabilities(contributors: any[], commits: any[]): TeamCapabilities {
    return {
      size: contributors.length,
      experienceLevel: this.assessExperienceLevel(contributors, commits),
      skillDistribution: this.analyzeSkillDistribution(contributors),
      availability: this.estimateTeamAvailability(commits),
      timezone: this.detectTimezone(commits),
      communicationStyle: this.assessCommunicationStyle(commits)
    };
  }

  private async analyzeTechnicalContext(installationId: string, owner: string, repo: string): Promise<TechnicalContext> {
    // This would involve checking for CI/CD files, monitoring setup, etc.
    const hasCI = await this.hasCI(installationId, owner, repo);
    const hasMonitoring = await this.hasMonitoring(installationId, owner, repo);
    const hasSecurity = await this.hasSecuritySetup(installationId, owner, repo);

    return {
      infrastructure: 'cloud', // Default assumption
      cicdMaturity: hasCI ? 'intermediate' : 'basic',
      monitoringLevel: hasMonitoring ? 'good' : 'basic',
      securityPosture: hasSecurity ? 'strong' : 'adequate',
      scalabilityNeeds: 'medium' // Default assumption
    };
  }

  private analyzeBusinessContext(repoInfo: any, issues: any[]): BusinessContext {
    return {
      industry: this.detectIndustry(repoInfo),
      regulatoryRequirements: this.detectRegulatoryRequirements(issues),
      marketPressure: this.assessMarketPressure(repoInfo, issues),
      budgetConstraints: 'moderate', // Default assumption
      timeToMarket: this.assessTimeToMarket(issues),
      riskTolerance: this.assessRiskTolerance(repoInfo, issues)
    };
  }

  private filterRelevantStrategies(taskDescription: string, analysis: ProjectAnalysis): StrategyTemplate[] {
    const relevantStrategies: StrategyTemplate[] = [];

    for (const strategy of this.strategies.values()) {
      if (this.isStrategyRelevant(strategy, taskDescription, analysis)) {
        relevantStrategies.push(strategy);
      }
    }

    return relevantStrategies;
  }

  private isStrategyRelevant(strategy: StrategyTemplate, task: string, analysis: ProjectAnalysis): boolean {
    // Check if strategy matches task type
    const taskLower = task.toLowerCase();
    
    if (strategy.category === 'development') {
      return taskLower.includes('implement') || taskLower.includes('develop') || taskLower.includes('build');
    }
    
    if (strategy.category === 'deployment') {
      return taskLower.includes('deploy') || taskLower.includes('release') || taskLower.includes('rollout');
    }
    
    if (strategy.category === 'quality') {
      return taskLower.includes('test') || taskLower.includes('quality') || taskLower.includes('bug');
    }
    
    if (strategy.category === 'architecture') {
      return taskLower.includes('architect') || taskLower.includes('design') || taskLower.includes('structure');
    }

    // Check prerequisites
    return this.hasPrerequisites(strategy, analysis);
  }

  private hasPrerequisites(strategy: StrategyTemplate, analysis: ProjectAnalysis): boolean {
    // Simplified prerequisite checking
    for (const prereq of strategy.prerequisites) {
      if (!this.checkPrerequisite(prereq, analysis)) {
        return false;
      }
    }
    return true;
  }

  private checkPrerequisite(prerequisite: string, analysis: ProjectAnalysis): boolean {
    switch (prerequisite) {
      case 'good-testing':
        return analysis.codebaseCharacteristics.testCoverage > 60;
      case 'ci-cd':
        return analysis.technicalContext.cicdMaturity !== 'none';
      case 'experienced-team':
        return analysis.teamCapabilities.experienceLevel === 'senior' || analysis.teamCapabilities.experienceLevel === 'expert';
      case 'feature-flag-infrastructure':
        return analysis.technicalContext.cicdMaturity === 'advanced';
      case 'containerization':
        return analysis.technicalContext.infrastructure === 'cloud';
      default:
        return true; // Assume prerequisite is met if not recognized
    }
  }

  private evaluateStrategies(
    strategies: StrategyTemplate[],
    analysis: ProjectAnalysis,
    task: string
  ): StrategyRecommendation[] {
    return strategies.map(strategy => {
      const evaluation = strategy.evaluation(analysis, task);
      
      return {
        strategyId: strategy.id,
        name: strategy.name,
        description: strategy.description,
        confidence: evaluation.confidence,
        applicability: evaluation.applicability,
        expectedOutcome: evaluation.expectedOutcome,
        risks: strategy.risks,
        benefits: strategy.benefits,
        prerequisites: strategy.prerequisites,
        estimatedEffort: strategy.baseEffort * evaluation.effortMultiplier,
        complexity: strategy.complexity,
        reasoning: evaluation.reasoning
      };
    });
  }

  private buildDecisionMatrix(strategies: StrategyRecommendation[], analysis: ProjectAnalysis): DecisionMatrix {
    const criteria: DecisionCriterion[] = [
      { name: 'Confidence', weight: 0.25, description: 'How confident we are in the strategy', measurable: true },
      { name: 'Applicability', weight: 0.20, description: 'How well the strategy fits the context', measurable: true },
      { name: 'Risk Level', weight: 0.15, description: 'Risk associated with the strategy', measurable: true },
      { name: 'Effort Required', weight: 0.15, description: 'Effort needed to implement', measurable: true },
      { name: 'Team Fit', weight: 0.15, description: 'How well strategy matches team capabilities', measurable: true },
      { name: 'Business Value', weight: 0.10, description: 'Expected business value', measurable: false }
    ];

    const strategyScores: StrategyScore[] = strategies.map(strategy => {
      const scores = {
        'Confidence': strategy.confidence * 100,
        'Applicability': strategy.applicability * 100,
        'Risk Level': this.calculateRiskScore(strategy),
        'Effort Required': this.calculateEffortScore(strategy, analysis),
        'Team Fit': this.calculateTeamFitScore(strategy, analysis),
        'Business Value': this.calculateBusinessValueScore(strategy, analysis)
      };

      const totalScore = criteria.reduce((sum, criterion) => {
        const score = scores[criterion.name as keyof typeof scores];
        return sum + (score * criterion.weight);
      }, 0);

      return {
        strategyId: strategy.strategyId,
        scores,
        totalScore
      };
    });

    const weightedScores: Record<string, number> = {};
    strategyScores.forEach(score => {
      weightedScores[score.strategyId] = score.totalScore;
    });

    return {
      criteria,
      strategies: strategyScores,
      weightedScores
    };
  }

  private makeSelection(
    strategies: StrategyRecommendation[],
    decisionMatrix: DecisionMatrix,
    analysis: ProjectAnalysis
  ): StrategySelection {
    // Sort strategies by weighted score
    const sortedStrategies = strategies.sort((a, b) => {
      const scoreA = decisionMatrix.weightedScores[a.strategyId] || 0;
      const scoreB = decisionMatrix.weightedScores[b.strategyId] || 0;
      return scoreB - scoreA;
    });

    const primaryStrategy = sortedStrategies[0];
    if (!primaryStrategy) {
      throw new Error('No strategies available for selection');
    }
    
    const alternativeStrategies = sortedStrategies.slice(1, 4); // Top 3 alternatives

    const contextualFactors = this.identifyContextualFactors(analysis);
    const adaptationTriggers = this.defineAdaptationTriggers(primaryStrategy, analysis);

    return {
      primaryStrategy,
      alternativeStrategies,
      contextualFactors,
      decisionMatrix,
      adaptationTriggers
    };
  }

  // Strategy evaluation methods
  private evaluateIncrementalDevelopment(analysis: ProjectAnalysis, task: string): StrategyEvaluation {
    let confidence = 0.7;
    let applicability = 0.6;
    let effortMultiplier = 1.0;

    // Higher confidence with good testing and CI/CD
    if (analysis.codebaseCharacteristics.testCoverage > 70) confidence += 0.2;
    if (analysis.technicalContext.cicdMaturity === 'advanced') confidence += 0.15;

    // More applicable for complex codebases
    if (analysis.codebaseCharacteristics.complexity === 'complex') applicability += 0.2;
    
    // Less effort with experienced teams
    if (analysis.teamCapabilities.experienceLevel === 'senior') effortMultiplier *= 0.8;

    const reasoning = [
      'Incremental development reduces risk through smaller changes',
      'Good fit for teams with strong testing practices',
      'Enables faster feedback and easier debugging'
    ];

    return {
      confidence: Math.min(1, confidence),
      applicability: Math.min(1, applicability),
      effortMultiplier,
      expectedOutcome: 'Gradual, low-risk implementation with frequent feedback',
      reasoning
    };
  }

  private evaluateBigBangDevelopment(analysis: ProjectAnalysis, task: string): StrategyEvaluation {
    let confidence = 0.4;
    let applicability = 0.3;
    let effortMultiplier = 1.5;

    // Higher confidence with experienced teams
    if (analysis.teamCapabilities.experienceLevel === 'expert') confidence += 0.3;
    
    // More applicable for simple codebases
    if (analysis.codebaseCharacteristics.complexity === 'simple') applicability += 0.4;
    
    // Less applicable if tight deadlines
    if (analysis.businessContext.timeToMarket === 'critical') applicability -= 0.2;

    const reasoning = [
      'Big bang approach suitable for experienced teams',
      'Works well for simple, well-understood requirements',
      'Higher risk but potentially faster for complete features'
    ];

    return {
      confidence: Math.min(1, confidence),
      applicability: Math.min(1, applicability),
      effortMultiplier,
      expectedOutcome: 'Complete feature implementation in single release',
      reasoning
    };
  }

  private evaluateFeatureFlagging(analysis: ProjectAnalysis, task: string): StrategyEvaluation {
    let confidence = 0.8;
    let applicability = 0.7;
    let effortMultiplier = 1.2;

    // Higher confidence with good infrastructure
    if (analysis.technicalContext.cicdMaturity === 'advanced') confidence += 0.15;
    
    // More applicable for high-risk deployments
    if (analysis.businessContext.riskTolerance === 'conservative') applicability += 0.2;

    const reasoning = [
      'Feature flags enable safe rollouts and easy rollbacks',
      'Excellent for gradual feature adoption',
      'Requires feature flag infrastructure'
    ];

    return {
      confidence: Math.min(1, confidence),
      applicability: Math.min(1, applicability),
      effortMultiplier,
      expectedOutcome: 'Controlled feature rollout with minimal deployment risk',
      reasoning
    };
  }

  private evaluateBlueGreenDeployment(analysis: ProjectAnalysis, task: string): StrategyEvaluation {
    let confidence = 0.6;
    let applicability = 0.4;
    let effortMultiplier = 2.0;

    // Higher confidence with cloud infrastructure
    if (analysis.technicalContext.infrastructure === 'cloud') confidence += 0.2;
    
    // More applicable for critical systems
    if (analysis.businessContext.riskTolerance === 'conservative') applicability += 0.3;

    const reasoning = [
      'Blue-green deployment provides zero downtime',
      'Requires significant infrastructure investment',
      'Best for critical production systems'
    ];

    return {
      confidence: Math.min(1, confidence),
      applicability: Math.min(1, applicability),
      effortMultiplier,
      expectedOutcome: 'Zero-downtime deployments with instant rollback capability',
      reasoning
    };
  }

  private evaluateTestDrivenDevelopment(analysis: ProjectAnalysis, task: string): StrategyEvaluation {
    let confidence = 0.7;
    let applicability = 0.6;
    let effortMultiplier = 1.3;

    // Higher confidence with good existing test coverage
    if (analysis.codebaseCharacteristics.testCoverage > 80) confidence += 0.2;
    
    // More applicable for quality-focused organizations
    if (analysis.businessContext.riskTolerance === 'conservative') applicability += 0.2;

    const reasoning = [
      'TDD improves code quality and design',
      'Provides excellent regression protection',
      'Requires team discipline and training'
    ];

    return {
      confidence: Math.min(1, confidence),
      applicability: Math.min(1, applicability),
      effortMultiplier,
      expectedOutcome: 'High-quality code with comprehensive test coverage',
      reasoning
    };
  }

  private evaluateBehaviorDrivenDevelopment(analysis: ProjectAnalysis, task: string): StrategyEvaluation {
    let confidence = 0.6;
    let applicability = 0.5;
    let effortMultiplier = 1.4;

    // More applicable for business-facing features
    if (task.toLowerCase().includes('user') || task.toLowerCase().includes('business')) {
      applicability += 0.3;
    }

    const reasoning = [
      'BDD ensures clear business requirements',
      'Improves stakeholder communication',
      'Requires significant collaboration overhead'
    ];

    return {
      confidence: Math.min(1, confidence),
      applicability: Math.min(1, applicability),
      effortMultiplier,
      expectedOutcome: 'Clear requirements with stakeholder alignment',
      reasoning
    };
  }

  private evaluatePairProgramming(analysis: ProjectAnalysis, task: string): StrategyEvaluation {
    let confidence = 0.8;
    let applicability = 0.6;
    let effortMultiplier = 1.8;

    // More applicable for knowledge transfer
    if (analysis.teamCapabilities.experienceLevel === 'mixed') applicability += 0.2;
    
    // Less applicable for large teams
    if (analysis.teamCapabilities.size > 10) applicability -= 0.2;

    const reasoning = [
      'Pair programming improves code quality',
      'Excellent for knowledge transfer',
      'Resource intensive but reduces bugs'
    ];

    return {
      confidence: Math.min(1, confidence),
      applicability: Math.min(1, applicability),
      effortMultiplier,
      expectedOutcome: 'Higher quality code with improved team knowledge',
      reasoning
    };
  }

  private evaluateCodeReviewFocused(analysis: ProjectAnalysis, task: string): StrategyEvaluation {
    let confidence = 0.9;
    let applicability = 0.8;
    let effortMultiplier = 0.8;

    // Always applicable with minimal overhead
    if (analysis.developmentPatterns.reviewProcess === 'none') {
      applicability = 1.0;
      effortMultiplier = 1.2; // Higher effort to establish process
    }

    const reasoning = [
      'Code reviews are universally beneficial',
      'Minimal overhead with high quality impact',
      'Improves team knowledge sharing'
    ];

    return {
      confidence: Math.min(1, confidence),
      applicability: Math.min(1, applicability),
      effortMultiplier,
      expectedOutcome: 'Improved code quality through peer review',
      reasoning
    };
  }

  private evaluateMicroservicesApproach(analysis: ProjectAnalysis, task: string): StrategyEvaluation {
    let confidence = 0.5;
    let applicability = 0.3;
    let effortMultiplier = 3.0;

    // Higher confidence for large, complex systems
    if (analysis.codebaseCharacteristics.size === 'enterprise') {
      confidence += 0.3;
      applicability += 0.4;
    }

    // Higher confidence with experienced teams
    if (analysis.teamCapabilities.experienceLevel === 'expert') confidence += 0.2;

    const reasoning = [
      'Microservices enable team independence',
      'Significant complexity and operational overhead',
      'Best for large, complex applications'
    ];

    return {
      confidence: Math.min(1, confidence),
      applicability: Math.min(1, applicability),
      effortMultiplier,
      expectedOutcome: 'Scalable, independent services with operational complexity',
      reasoning
    };
  }

  private evaluateMonolithFirst(analysis: ProjectAnalysis, task: string): StrategyEvaluation {
    let confidence = 0.8;
    let applicability = 0.7;
    let effortMultiplier = 0.6;

    // Higher applicability for smaller teams/projects
    if (analysis.teamCapabilities.size <= 5) applicability += 0.2;
    if (analysis.codebaseCharacteristics.size === 'small') applicability += 0.3;

    const reasoning = [
      'Monolith-first approach reduces initial complexity',
      'Enables faster initial development',
      'Can evolve to microservices later'
    ];

    return {
      confidence: Math.min(1, confidence),
      applicability: Math.min(1, applicability),
      effortMultiplier,
      expectedOutcome: 'Simple, fast development with evolution path',
      reasoning
    };
  }

  private evaluateDomainDrivenDesign(analysis: ProjectAnalysis, task: string): StrategyEvaluation {
    let confidence = 0.6;
    let applicability = 0.4;
    let effortMultiplier = 2.5;

    // More applicable for complex business domains
    if (analysis.codebaseCharacteristics.complexity === 'very-complex') {
      applicability += 0.4;
    }

    // Higher confidence with experienced teams
    if (analysis.teamCapabilities.experienceLevel === 'expert') confidence += 0.3;

    const reasoning = [
      'DDD aligns software with business domain',
      'Excellent for complex business logic',
      'Requires significant domain expertise'
    ];

    return {
      confidence: Math.min(1, confidence),
      applicability: Math.min(1, applicability),
      effortMultiplier,
      expectedOutcome: 'Well-modeled domain with clear business alignment',
      reasoning
    };
  }

  // Utility methods for analysis
  private categorizeSize(totalBytes: number): 'small' | 'medium' | 'large' | 'enterprise' {
    if (totalBytes < 100000) return 'small';      // < 100KB
    if (totalBytes < 1000000) return 'medium';    // < 1MB
    if (totalBytes < 10000000) return 'large';    // < 10MB
    return 'enterprise';                          // > 10MB
  }

  private assessComplexity(languages: any, frameworks: string[]): 'simple' | 'moderate' | 'complex' | 'very-complex' {
    const languageCount = Object.keys(languages).length;
    const frameworkCount = frameworks.length;
    
    if (languageCount <= 2 && frameworkCount <= 2) return 'simple';
    if (languageCount <= 3 && frameworkCount <= 4) return 'moderate';
    if (languageCount <= 5 && frameworkCount <= 6) return 'complex';
    return 'very-complex';
  }

  private detectFrameworks(languages: any): string[] {
    const frameworks: string[] = [];
    
    if (languages.JavaScript || languages.TypeScript) {
      frameworks.push('Node.js'); // Assumption
    }
    if (languages.Python) {
      frameworks.push('Flask/Django'); // Assumption
    }
    if (languages.Java) {
      frameworks.push('Spring'); // Assumption
    }
    
    return frameworks;
  }

  private detectArchitecture(repoInfo: any, frameworks: string[]): string {
    const name = repoInfo.name.toLowerCase();
    const description = repoInfo.description?.toLowerCase() || '';
    
    if (description.includes('microservice') || name.includes('service')) return 'microservices';
    if (description.includes('api')) return 'api-first';
    if (frameworks.some(f => f.includes('React') || f.includes('Vue'))) return 'spa';
    
    return 'monolith'; // Default
  }

  private calculateCommitFrequency(commits: any[]): 'low' | 'medium' | 'high' {
    if (commits.length === 0) return 'low';
    
    const oldestCommit = new Date(commits[commits.length - 1].commit.author.date);
    const newestCommit = new Date(commits[0].commit.author.date);
    const daysDiff = (newestCommit.getTime() - oldestCommit.getTime()) / (1000 * 60 * 60 * 24);
    
    const commitsPerDay = commits.length / daysDiff;
    
    if (commitsPerDay > 2) return 'high';
    if (commitsPerDay > 0.5) return 'medium';
    return 'low';
  }

  private detectBranchingStrategy(commits: any[], pulls: any[]): string {
    // Simplified detection based on branch patterns
    const branches = new Set<string>();
    commits.forEach(commit => {
      if (commit.commit.message.includes('feature/')) branches.add('feature');
      if (commit.commit.message.includes('develop')) branches.add('develop');
      if (commit.commit.message.includes('release/')) branches.add('release');
    });
    
    if (branches.has('feature') && branches.has('develop')) return 'git-flow';
    if (pulls.length > commits.length * 0.8) return 'github-flow';
    return 'simple-flow';
  }

  private assessReviewProcess(pulls: any[]): 'none' | 'basic' | 'thorough' | 'strict' {
    if (pulls.length === 0) return 'none';
    
    const reviewedPulls = pulls.filter(pr => pr.comments > 0 || pr.review_comments > 0);
    const reviewRate = reviewedPulls.length / pulls.length;
    
    if (reviewRate > 0.9) return 'strict';
    if (reviewRate > 0.7) return 'thorough';
    if (reviewRate > 0.3) return 'basic';
    return 'none';
  }

  private assessExperienceLevel(contributors: any[], commits: any[]): 'junior' | 'mixed' | 'senior' | 'expert' {
    const avgContributions = contributors.reduce((sum, c) => sum + c.contributions, 0) / contributors.length;
    
    if (avgContributions > 100) return 'expert';
    if (avgContributions > 50) return 'senior';
    if (avgContributions > 10) return 'mixed';
    return 'junior';
  }

  // Scoring methods
  private calculateRiskScore(strategy: StrategyRecommendation): number {
    const riskMap = { low: 90, medium: 70, high: 40 };
    return riskMap[strategy.complexity] || 70;
  }

  private calculateEffortScore(strategy: StrategyRecommendation, analysis: ProjectAnalysis): number {
    // Inverse score - lower effort = higher score
    const maxEffort = 100;
    return Math.max(0, 100 - (strategy.estimatedEffort / maxEffort) * 100);
  }

  private calculateTeamFitScore(strategy: StrategyRecommendation, analysis: ProjectAnalysis): number {
    let score = 50;
    
    // Adjust based on team size
    if (strategy.strategyId === 'pair-programming' && analysis.teamCapabilities.size < 6) score += 30;
    if (strategy.strategyId === 'microservices-approach' && analysis.teamCapabilities.size > 10) score += 20;
    
    // Adjust based on experience
    if (strategy.complexity === 'high' && analysis.teamCapabilities.experienceLevel === 'expert') score += 30;
    if (strategy.complexity === 'low' && analysis.teamCapabilities.experienceLevel === 'junior') score += 20;
    
    return Math.min(100, score);
  }

  private calculateBusinessValueScore(strategy: StrategyRecommendation, analysis: ProjectAnalysis): number {
    let score = 50;
    
    // Quality strategies have high value for conservative organizations
    if (strategy.strategyId.includes('test') && analysis.businessContext.riskTolerance === 'conservative') {
      score += 30;
    }
    
    // Fast delivery strategies have high value under time pressure
    if (strategy.estimatedEffort < 30 && analysis.businessContext.timeToMarket === 'critical') {
      score += 25;
    }
    
    return Math.min(100, score);
  }

  private identifyContextualFactors(analysis: ProjectAnalysis): string[] {
    const factors: string[] = [];
    
    if (analysis.codebaseCharacteristics.testCoverage < 50) {
      factors.push('Low test coverage increases risk of changes');
    }
    
    if (analysis.teamCapabilities.size < 3) {
      factors.push('Small team size limits parallel development options');
    }
    
    if (analysis.businessContext.timeToMarket === 'critical') {
      factors.push('Critical time-to-market pressure favors faster strategies');
    }
    
    if (analysis.technicalContext.cicdMaturity === 'none') {
      factors.push('Lack of CI/CD infrastructure limits deployment options');
    }
    
    return factors;
  }

  private defineAdaptationTriggers(strategy: StrategyRecommendation, analysis: ProjectAnalysis): AdaptationTrigger[] {
    const triggers: AdaptationTrigger[] = [];
    
    triggers.push({
      condition: 'deployment_failure_rate',
      threshold: 0.1,
      action: 'switch_to_safer_deployment_strategy',
      description: 'Switch to safer deployment if failure rate exceeds 10%'
    });
    
    triggers.push({
      condition: 'development_velocity',
      threshold: 0.5,
      action: 'reassess_strategy_complexity',
      description: 'Reassess if velocity drops below 50% of baseline'
    });
    
    if (strategy.complexity === 'high') {
      triggers.push({
        condition: 'team_confidence',
        threshold: 0.6,
        action: 'provide_additional_support',
        description: 'Provide additional support if team confidence drops below 60%'
      });
    }
    
    return triggers;
  }

  // Simplified analysis methods (would be more sophisticated in production)
  private estimateTestCoverage(totalBytes: number): number {
    return 60 + Math.random() * 30; // Placeholder
  }

  private estimateTechnicalDebt(repoInfo: any): number {
    return 30 + Math.random() * 40; // Placeholder
  }

  private estimateCodeQuality(repoInfo: any): number {
    return 60 + Math.random() * 30; // Placeholder
  }

  private analyzePerformanceProfile(languages: any, frameworks: string[]): string[] {
    return ['cpu-bound', 'io-bound']; // Placeholder
  }

  private detectReleasePattern(commits: any[]): 'continuous' | 'weekly' | 'monthly' | 'quarterly' {
    return 'weekly'; // Placeholder
  }

  private assessAutomationLevel(commits: any[], pulls: any[]): 'manual' | 'partial' | 'automated' | 'fully-automated' {
    return 'partial'; // Placeholder
  }

  private calculateIncidentRate(issues: any[]): number {
    const bugIssues = issues.filter(issue => 
      issue.labels?.some((label: any) => label.name.toLowerCase().includes('bug'))
    );
    return (bugIssues.length / issues.length) * 100;
  }

  private estimateDeploymentSuccess(commits: any[], issues: any[]): number {
    return 85 + Math.random() * 10; // Placeholder
  }

  private analyzeSkillDistribution(contributors: any[]): Record<string, number> {
    return { javascript: 0.8, typescript: 0.6, react: 0.5 }; // Placeholder
  }

  private estimateTeamAvailability(commits: any[]): number {
    return 80 + Math.random() * 15; // Placeholder
  }

  private detectTimezone(commits: any[]): string {
    return 'UTC'; // Placeholder
  }

  private assessCommunicationStyle(commits: any[]): 'async' | 'mixed' | 'sync' {
    return 'mixed'; // Placeholder
  }

  private async hasCI(installationId: string, owner: string, repo: string): Promise<boolean> {
    try {
      const octokit = await getInstallationOctokit(installationId);
      await octokit.rest.repos.getContent({ owner, repo, path: '.github/workflows' });
      return true;
    } catch {
      return false;
    }
  }

  private async hasMonitoring(installationId: string, owner: string, repo: string): Promise<boolean> {
    // Placeholder - would check for monitoring configuration
    return false;
  }

  private async hasSecuritySetup(installationId: string, owner: string, repo: string): Promise<boolean> {
    // Placeholder - would check for security tools configuration
    return false;
  }

  private detectIndustry(repoInfo: any): string {
    return 'technology'; // Placeholder
  }

  private detectRegulatoryRequirements(issues: any[]): string[] {
    return []; // Placeholder
  }

  private assessMarketPressure(repoInfo: any, issues: any[]): 'low' | 'medium' | 'high' {
    return 'medium'; // Placeholder
  }

  private assessTimeToMarket(issues: any[]): 'critical' | 'important' | 'flexible' {
    const urgentIssues = issues.filter(issue =>
      issue.labels?.some((label: any) => label.name.toLowerCase().includes('urgent'))
    );
    
    if (urgentIssues.length > issues.length * 0.3) return 'critical';
    if (urgentIssues.length > issues.length * 0.1) return 'important';
    return 'flexible';
  }

  private assessRiskTolerance(repoInfo: any, issues: any[]): 'conservative' | 'moderate' | 'aggressive' {
    return 'moderate'; // Placeholder
  }

  // Public API methods
  async adaptStrategy(
    currentStrategy: StrategyRecommendation,
    performanceMetrics: Record<string, number>,
    analysis: ProjectAnalysis
  ): Promise<StrategyRecommendation | null> {
    // Check if adaptation is needed based on performance
    const needsAdaptation = this.shouldAdaptStrategy(currentStrategy, performanceMetrics);
    
    if (!needsAdaptation) return null;
    
    // Find alternative strategy
    const alternatives = await this.selectOptimalStrategy(
      'adaptation needed',
      'dummy', 'dummy', 'dummy', // Would need actual values
      analysis
    );
    
    return alternatives.alternativeStrategies[0] || null;
  }

  private shouldAdaptStrategy(
    strategy: StrategyRecommendation,
    metrics: Record<string, number>
  ): boolean {
    // Simple adaptation logic
    return (metrics.success_rate || 1) < 0.7 || (metrics.velocity || 1) < 0.5;
  }
}

interface StrategyTemplate {
  id: string;
  name: string;
  category: 'development' | 'deployment' | 'quality' | 'architecture' | 'collaboration';
  description: string;
  applicablePatterns: string[];
  prerequisites: string[];
  benefits: string[];
  risks: string[];
  complexity: 'low' | 'medium' | 'high';
  baseEffort: number;
  evaluation: (analysis: ProjectAnalysis, task: string) => StrategyEvaluation;
}

interface StrategyEvaluation {
  confidence: number;
  applicability: number;
  effortMultiplier: number;
  expectedOutcome: string;
  reasoning: string[];
}

export default AdaptiveStrategySelector;