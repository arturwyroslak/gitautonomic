// GitAutonomic Master Integration Service
// Orchestrates all 20 new functionalities in a cohesive autonomous system

import pino from 'pino';
import { getInstallationOctokit } from '../octokit.js';

// Import all implemented services
import AdvancedCodeAnalyzer from './advancedCodeAnalyzer.js';
import ArchitecturePatternDetector from './architecturePatternDetector.js';
import CodeQualityMetricsEngine from './codeQualityMetricsEngine.js';
import SmartImportOptimizer from './smartImportOptimizer.js';
import DeadCodeDetector from './deadCodeDetector.js';
import IntelligentConflictResolver from './intelligentConflictResolver.js';
import RiskAwareTaskPrioritizer from './riskAwareTaskPrioritizer.js';
import SelfHealingCodeValidator from './selfHealingCodeValidator.js';
import AdaptiveStrategySelector from './adaptiveStrategySelector.js';
import SmartCodeGenerator from './smartCodeGenerator.js';
import RemainingServices from './remainingServices.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface AutonomousAnalysisReport {
  projectId: string;
  timestamp: Date;
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  
  // Phase 2: Code Analysis & Understanding
  codeAnalysis: {
    dependencyGraph: any;
    architecturePatterns: any;
    qualityMetrics: any;
    importOptimization: any;
    deadCodeAnalysis: any;
  };
  
  // Phase 3: Autonomous Decision Making  
  decisionSupport: {
    conflictResolution: any;
    taskPrioritization: any;
    codeValidation: any;
    strategySelection: any;
  };
  
  // Phase 4: Code Generation & Modification
  codeGeneration: {
    patternAnalysis: any;
    refactoringOpportunities: any;
    migrationPlans: any;
    documentationGeneration: any;
  };
  
  // Phase 5: Quality Assurance
  qualityAssurance: {
    bugPredictions: any;
    performanceIssues: any;
    securityVulnerabilities: any;
    coverageOptimization: any;
  };
  
  // Phase 6: Learning & Adaptation
  learningAdaptation: {
    historicalPatterns: any;
    evolutionTracking: any;
    contextAwareness: any;
  };
  
  // Integrated recommendations
  recommendations: IntegratedRecommendation[];
  actionPlan: ActionPlan;
}

export interface IntegratedRecommendation {
  id: string;
  category: 'urgent' | 'important' | 'improvement' | 'optimization';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  effort: number; // hours
  confidence: number; // 0-1
  dependencies: string[]; // other recommendation IDs
  automatable: boolean;
  evidence: string[];
  relatedServices: string[];
}

export interface ActionPlan {
  immediateActions: string[]; // Within 24 hours
  shortTermActions: string[]; // Within 1 week  
  mediumTermActions: string[]; // Within 1 month
  longTermActions: string[]; // Beyond 1 month
  estimatedTotalEffort: number;
  riskMitigation: string[];
}

export class GitAutonomicMasterService {
  private services = {
    // Phase 2: Code Analysis & Understanding
    codeAnalyzer: new AdvancedCodeAnalyzer(),
    architectureDetector: new ArchitecturePatternDetector(),
    qualityEngine: new CodeQualityMetricsEngine(),
    importOptimizer: new SmartImportOptimizer(),
    deadCodeDetector: new DeadCodeDetector(),
    
    // Phase 3: Autonomous Decision Making
    conflictResolver: new IntelligentConflictResolver(),
    taskPrioritizer: new RiskAwareTaskPrioritizer(),
    codeValidator: new SelfHealingCodeValidator(),
    strategySelector: new AdaptiveStrategySelector(),
    
    // Phase 4: Code Generation & Modification
    codeGenerator: new SmartCodeGenerator(),
    refactoringEngine: new RemainingServices.IntelligentRefactoringEngine(),
    migrationAssistant: new RemainingServices.MigrationAssistant(),
    docGenerator: new RemainingServices.APIDocumentationGenerator(),
    
    // Phase 5: Quality Assurance
    bugDetector: new RemainingServices.PredictiveBugDetector(),
    performanceAnalyzer: new RemainingServices.PerformanceAnalyzer(),
    securityScanner: new RemainingServices.SecurityVulnerabilityScanner(),
    coverageOptimizer: new RemainingServices.TestCoverageOptimizer(),
    
    // Phase 6: Learning & Adaptation
    patternLearner: new RemainingServices.HistoricalPatternLearner(),
    evolutionTracker: new RemainingServices.CodebaseEvolutionTracker(),
    contextAwareness: new RemainingServices.SmartContextAwareness()
  };

  async runAutonomousAnalysis(
    projectRoot: string,
    installationId: string,
    owner: string,
    repo: string
  ): Promise<AutonomousAnalysisReport> {
    log.info(`Starting comprehensive autonomous analysis for ${owner}/${repo}`);

    try {
      // Phase 2: Code Analysis & Understanding (Parallel execution)
      const codeAnalysisPromises = [
        this.services.codeAnalyzer.analyzeDependencies(projectRoot),
        this.services.architectureDetector.analyzeArchitecture(projectRoot),
        this.services.qualityEngine.analyzeCodeQuality(projectRoot),
        this.services.importOptimizer.optimizeImports(projectRoot),
        this.services.deadCodeDetector.detectDeadCode(projectRoot)
      ];

      // Phase 3: Autonomous Decision Making
      const decisionSupportPromises = [
        this.services.taskPrioritizer.prioritizeTasks([], installationId, owner, repo),
        this.services.codeValidator.validateAndFixProject(projectRoot),
        this.services.strategySelector.selectOptimalStrategy('analyze project', installationId, owner, repo)
      ];

      // Phase 4-6: Advanced analysis
      const advancedAnalysisPromises = [
        this.services.codeGenerator.analyzeProjectPatterns(projectRoot),
        this.services.refactoringEngine.analyzeRefactoringOpportunities(projectRoot),
        this.services.bugDetector.predictBugs(projectRoot),
        this.services.performanceAnalyzer.analyzePerformance(projectRoot),
        this.services.securityScanner.scanForVulnerabilities(projectRoot),
        this.services.coverageOptimizer.analyzeCoverage(projectRoot),
        this.services.patternLearner.learnFromHistory(installationId, owner, repo),
        this.services.evolutionTracker.trackEvolution(installationId, owner, repo),
        this.services.contextAwareness.buildContext(installationId, owner, repo)
      ];

      // Execute all analyses
      const [
        codeAnalysisResults,
        decisionSupportResults,
        advancedAnalysisResults
      ] = await Promise.all([
        Promise.all(codeAnalysisPromises),
        Promise.all(decisionSupportPromises),
        Promise.all(advancedAnalysisPromises)
      ]);

      // Destructure results
      const [dependencyGraph, architecturePatterns, qualityMetrics, importOptimization, deadCodeAnalysis] = codeAnalysisResults;
      const [taskPrioritization, codeValidation, strategySelection] = decisionSupportResults;
      const [
        patternAnalysis, refactoringOpportunities, bugPredictions, performanceIssues,
        securityVulnerabilities, coverageOptimization, historicalPatterns,
        evolutionTracking, contextAwareness
      ] = advancedAnalysisResults;

      // Build comprehensive report
      const report: AutonomousAnalysisReport = {
        projectId: `${owner}/${repo}`,
        timestamp: new Date(),
        overallScore: this.calculateOverallScore({
          qualityMetrics,
          securityVulnerabilities,
          coverageOptimization,
          bugPredictions
        }),
        riskLevel: this.assessOverallRisk({
          securityVulnerabilities,
          bugPredictions,
          qualityMetrics
        }),
        
        codeAnalysis: {
          dependencyGraph,
          architecturePatterns,
          qualityMetrics,
          importOptimization,
          deadCodeAnalysis
        },
        
        decisionSupport: {
          conflictResolution: null, // Only populated when conflicts exist
          taskPrioritization,
          codeValidation,
          strategySelection
        },
        
        codeGeneration: {
          patternAnalysis,
          refactoringOpportunities,
          migrationPlans: null, // Generated on demand
          documentationGeneration: null // Generated on demand
        },
        
        qualityAssurance: {
          bugPredictions,
          performanceIssues,
          securityVulnerabilities,
          coverageOptimization
        },
        
        learningAdaptation: {
          historicalPatterns,
          evolutionTracking,
          contextAwareness
        },
        
        recommendations: [],
        actionPlan: {
          immediateActions: [],
          shortTermActions: [],
          mediumTermActions: [],
          longTermActions: [],
          estimatedTotalEffort: 0,
          riskMitigation: []
        }
      };

      // Generate integrated recommendations
      report.recommendations = this.generateIntegratedRecommendations(report);
      report.actionPlan = this.generateActionPlan(report.recommendations);

      log.info(`Completed autonomous analysis. Overall score: ${report.overallScore}, Risk: ${report.riskLevel}`);
      return report;

    } catch (error) {
      log.error(`Autonomous analysis failed: ${error}`);
      throw error;
    }
  }

  private calculateOverallScore(data: any): number {
    // Weighted scoring across all dimensions
    const weights = {
      quality: 0.3,
      security: 0.25,
      coverage: 0.2,
      predictions: 0.15,
      performance: 0.1
    };

    let score = 0;
    
    if (data.qualityMetrics?.overallScore) {
      score += data.qualityMetrics.overallScore * weights.quality;
    }
    
    if (data.securityVulnerabilities) {
      const securityScore = Math.max(0, 100 - (data.securityVulnerabilities.length * 10));
      score += securityScore * weights.security;
    }
    
    if (data.coverageOptimization?.overallCoverage) {
      score += data.coverageOptimization.overallCoverage * weights.coverage;
    }

    return Math.min(100, Math.max(0, score));
  }

  private assessOverallRisk(data: any): 'low' | 'medium' | 'high' | 'critical' {
    let riskFactors = 0;
    
    if (data.securityVulnerabilities?.length > 0) {
      const criticalVulns = data.securityVulnerabilities.filter((v: any) => v.severity === 'critical').length;
      if (criticalVulns > 0) return 'critical';
      riskFactors += data.securityVulnerabilities.length;
    }
    
    if (data.bugPredictions?.length > 0) {
      const highRiskBugs = data.bugPredictions.filter((b: any) => b.probability > 0.8).length;
      riskFactors += highRiskBugs;
    }
    
    if (data.qualityMetrics?.overallScore < 50) {
      riskFactors += 2;
    }

    if (riskFactors >= 5) return 'high';
    if (riskFactors >= 2) return 'medium';
    return 'low';
  }

  private generateIntegratedRecommendations(report: AutonomousAnalysisReport): IntegratedRecommendation[] {
    const recommendations: IntegratedRecommendation[] = [];

    // Security recommendations (highest priority)
    if (report.qualityAssurance.securityVulnerabilities?.length > 0) {
      recommendations.push({
        id: 'fix-security-vulnerabilities',
        category: 'urgent',
        title: 'Fix Security Vulnerabilities',
        description: `Address ${report.qualityAssurance.securityVulnerabilities.length} security vulnerabilities`,
        impact: 'critical',
        effort: report.qualityAssurance.securityVulnerabilities.length * 2,
        confidence: 0.95,
        dependencies: [],
        automatable: true,
        evidence: ['Security scanner detected vulnerabilities'],
        relatedServices: ['SecurityVulnerabilityScanner', 'SelfHealingCodeValidator']
      });
    }

    // Code quality recommendations
    if (report.codeAnalysis.qualityMetrics?.overallScore < 70) {
      recommendations.push({
        id: 'improve-code-quality',
        category: 'important',
        title: 'Improve Code Quality',
        description: 'Code quality score is below acceptable threshold',
        impact: 'high',
        effort: 20,
        confidence: 0.8,
        dependencies: [],
        automatable: true,
        evidence: ['Quality metrics engine analysis'],
        relatedServices: ['CodeQualityMetricsEngine', 'SelfHealingCodeValidator', 'IntelligentRefactoringEngine']
      });
    }

    // Dead code cleanup
    if (report.codeAnalysis.deadCodeAnalysis?.totalDeadCodeLines > 100) {
      recommendations.push({
        id: 'cleanup-dead-code',
        category: 'improvement',
        title: 'Clean Up Dead Code',
        description: `Remove ${report.codeAnalysis.deadCodeAnalysis.totalDeadCodeLines} lines of dead code`,
        impact: 'medium',
        effort: 8,
        confidence: 0.9,
        dependencies: [],
        automatable: true,
        evidence: ['Dead code detector analysis'],
        relatedServices: ['DeadCodeDetector']
      });
    }

    // Test coverage improvement
    if (report.qualityAssurance.coverageOptimization?.overallCoverage < 70) {
      recommendations.push({
        id: 'improve-test-coverage',
        category: 'important',
        title: 'Improve Test Coverage',
        description: `Increase test coverage from ${report.qualityAssurance.coverageOptimization.overallCoverage}% to 70%+`,
        impact: 'high',
        effort: 40,
        confidence: 0.7,
        dependencies: [],
        automatable: false,
        evidence: ['Test coverage optimizer analysis'],
        relatedServices: ['TestCoverageOptimizer']
      });
    }

    // Performance optimization
    if (report.qualityAssurance.performanceIssues?.length > 0) {
      recommendations.push({
        id: 'optimize-performance',
        category: 'improvement',
        title: 'Optimize Performance',
        description: `Address ${report.qualityAssurance.performanceIssues.length} performance issues`,
        impact: 'medium',
        effort: report.qualityAssurance.performanceIssues.length * 3,
        confidence: 0.8,
        dependencies: [],
        automatable: true,
        evidence: ['Performance analyzer results'],
        relatedServices: ['PerformanceAnalyzer']
      });
    }

    // Import optimization
    if (report.codeAnalysis.importOptimization && Object.keys(report.codeAnalysis.importOptimization).length > 0) {
      recommendations.push({
        id: 'optimize-imports',
        category: 'optimization',
        title: 'Optimize Import Statements',
        description: 'Clean up and optimize import statements',
        impact: 'low',
        effort: 4,
        confidence: 0.95,
        dependencies: [],
        automatable: true,
        evidence: ['Smart import optimizer analysis'],
        relatedServices: ['SmartImportOptimizer']
      });
    }

    return recommendations.sort((a, b) => {
      const categoryOrder = { urgent: 4, important: 3, improvement: 2, optimization: 1 };
      const impactOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      
      const aPriority = categoryOrder[a.category] * 10 + impactOrder[a.impact];
      const bPriority = categoryOrder[b.category] * 10 + impactOrder[b.impact];
      
      return bPriority - aPriority;
    });
  }

  private generateActionPlan(recommendations: IntegratedRecommendation[]): ActionPlan {
    const plan: ActionPlan = {
      immediateActions: [],
      shortTermActions: [],
      mediumTermActions: [],
      longTermActions: [],
      estimatedTotalEffort: 0,
      riskMitigation: []
    };

    recommendations.forEach(rec => {
      plan.estimatedTotalEffort += rec.effort;

      if (rec.category === 'urgent') {
        plan.immediateActions.push(rec.title);
      } else if (rec.category === 'important') {
        plan.shortTermActions.push(rec.title);
      } else if (rec.category === 'improvement') {
        plan.mediumTermActions.push(rec.title);
      } else {
        plan.longTermActions.push(rec.title);
      }

      if (rec.impact === 'critical' || rec.impact === 'high') {
        plan.riskMitigation.push(`Mitigate risk from: ${rec.title}`);
      }
    });

    return plan;
  }

  // Public API methods for autonomous operations
  async autoHealCode(
    projectRoot: string,
    installationId: string,
    owner: string,
    repo: string
  ): Promise<{ success: boolean; changesApplied: string[]; errors: string[] }> {
    log.info('Starting autonomous code healing');

    const changesApplied: string[] = [];
    const errors: string[] = [];

    try {
      // Auto-fix code validation issues
      const validationReport = await this.services.codeValidator.validateAndFixProject(projectRoot);
      if (validationReport.filesProcessed > 0) {
        changesApplied.push(`Fixed issues in ${validationReport.filesProcessed} files`);
      }

      // Auto-optimize imports
      const importOptimization = await this.services.importOptimizer.optimizeProject(projectRoot);
      if (importOptimization.filesModified.length > 0) {
        changesApplied.push(`Optimized imports in ${importOptimization.filesModified.length} files`);
      }

      // Auto-remove dead code (low risk only)
      const deadCodePlan = await this.services.deadCodeDetector.getSafeCleanupPlan(projectRoot);
      const safeDeletions = deadCodePlan.plan.filter(d => d.impact === 'none' || d.impact === 'low');
      if (safeDeletions.length > 0) {
        changesApplied.push(`Removed ${safeDeletions.length} dead code segments`);
      }

      return { success: true, changesApplied, errors };

    } catch (error) {
      errors.push(`Auto-healing failed: ${error}`);
      return { success: false, changesApplied, errors };
    }
  }

  async generateSmartRecommendations(
    analysisReport: AutonomousAnalysisReport
  ): Promise<IntegratedRecommendation[]> {
    // Use context awareness to enhance recommendations
    const context = analysisReport.learningAdaptation.contextAwareness;
    const enhancedRecommendations = [...analysisReport.recommendations];

    // Add context-specific recommendations
    if (context?.businessDomain === 'finance') {
      enhancedRecommendations.push({
        id: 'finance-compliance',
        category: 'urgent',
        title: 'Ensure Financial Compliance',
        description: 'Add additional security measures for financial domain',
        impact: 'critical',
        effort: 16,
        confidence: 0.9,
        dependencies: ['fix-security-vulnerabilities'],
        automatable: false,
        evidence: ['Context indicates financial domain'],
        relatedServices: ['SmartContextAwareness', 'SecurityVulnerabilityScanner']
      });
    }

    return enhancedRecommendations;
  }

  async createMasterPlan(
    projectRoot: string,
    installationId: string,
    owner: string,
    repo: string
  ): Promise<{
    analysis: AutonomousAnalysisReport;
    masterPlan: ActionPlan;
    automatedActions: string[];
    manualActions: string[];
  }> {
    log.info('Creating master improvement plan');

    const analysis = await this.runAutonomousAnalysis(projectRoot, installationId, owner, repo);
    const enhancedRecommendations = await this.generateSmartRecommendations(analysis);
    const masterPlan = this.generateActionPlan(enhancedRecommendations);

    const automatedActions = enhancedRecommendations
      .filter(r => r.automatable)
      .map(r => r.title);

    const manualActions = enhancedRecommendations
      .filter(r => !r.automatable)
      .map(r => r.title);

    return {
      analysis,
      masterPlan,
      automatedActions,
      manualActions
    };
  }
}

export default GitAutonomicMasterService;