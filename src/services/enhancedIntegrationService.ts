// Integration service demonstrating continued project development
import { AdvancedCodeReviewAssistant } from './advancedCodeReviewAssistant.js';
import { EnhancedMemoryStore } from './enhancedMemoryStore.js';
import { PolicyEngine } from './policyEngine.js';
import { reasoningPipeline } from '../ai/reasoningEngine.js';
import { getInstallationOctokit } from '../octokit.js';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface IntegratedAnalysisResult {
  codeReview: any;
  policyValidation: any;
  reasoningTrace: any;
  memorySummary: any;
  recommendations: string[];
  overallScore: number;
}

/**
 * Enhanced Integration Service - Demonstrates continued development
 * by combining all the new AI capabilities into a unified analysis system
 */
export class EnhancedIntegrationService {
  private codeReviewAssistant: AdvancedCodeReviewAssistant;
  private policyEngine: PolicyEngine;
  
  constructor() {
    this.codeReviewAssistant = new AdvancedCodeReviewAssistant();
    this.policyEngine = new PolicyEngine();
  }

  /**
   * Perform comprehensive analysis combining all enhanced capabilities
   */
  async performIntegratedAnalysis(
    installationId: string,
    owner: string,
    repo: string,
    pullNumber: number,
    agentId: string
  ): Promise<IntegratedAnalysisResult> {
    try {
      log.info(`Starting integrated analysis for PR ${pullNumber} in ${owner}/${repo}`);
      
      // Initialize memory store for this analysis
      const memoryStore = new EnhancedMemoryStore(agentId);
      
      // Step 1: Perform AI-powered code review
      const codeReview = await this.codeReviewAssistant.reviewPullRequest(
        installationId, 
        owner, 
        repo, 
        pullNumber
      );
      
      // Step 2: Store findings in memory for future reference
      await this.storeAnalysisInMemory(memoryStore, codeReview, pullNumber);
      
      // Step 3: Get PR details for policy validation
      const octokit = await getInstallationOctokit(installationId);
      const { data: prData } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pullNumber
      });
      
      const { data: files } = await octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: pullNumber
      });
      
      // Step 4: Enhanced policy validation
      const policyValidation = await this.performEnhancedPolicyValidation(
        files.map(f => f.filename),
        prData.body || '',
        codeReview
      );
      
      // Step 5: AI reasoning about the overall analysis
      const reasoningTrace = await reasoningPipeline({
        phase: 'evaluation',
        context: `PR analysis for ${owner}/${repo}#${pullNumber}`,
        tasks: [{
          id: 'code-review',
          complexity: codeReview.overallScore < 70 ? 'high' : 'medium',
          estimatedEffort: Math.max(1, Math.floor(codeReview.suggestions.length / 5))
        }],
        metadata: {
          securityIssues: codeReview.securityIssues,
          performanceIssues: codeReview.performanceIssues,
          testCoverage: codeReview.testCoverage
        }
      });
      
      // Step 6: Query memory for related patterns and solutions
      const memorySummary = await this.queryRelevantMemories(
        memoryStore,
        codeReview,
        policyValidation
      );
      
      // Step 7: Generate integrated recommendations
      const recommendations = this.generateIntegratedRecommendations(
        codeReview,
        policyValidation,
        reasoningTrace,
        memorySummary
      );
      
      // Step 8: Calculate overall analysis score
      const overallScore = this.calculateOverallScore(
        codeReview,
        policyValidation,
        reasoningTrace
      );
      
      log.info(`Completed integrated analysis with score: ${overallScore}/100`);
      
      return {
        codeReview,
        policyValidation,
        reasoningTrace,
        memorySummary,
        recommendations,
        overallScore
      };
      
    } catch (error: any) {
      log.error('Failed to perform integrated analysis:', error);
      throw error;
    }
  }

  private async storeAnalysisInMemory(
    memoryStore: EnhancedMemoryStore,
    codeReview: any,
    pullNumber: number
  ): Promise<void> {
    // Store security patterns found
    for (const suggestion of codeReview.suggestions.filter((s: any) => s.type === 'security')) {
      await memoryStore.storeErrorResolution(
        suggestion.description,
        suggestion.suggestion,
        [suggestion.file]
      );
    }
    
    // Store performance patterns
    for (const suggestion of codeReview.suggestions.filter((s: any) => s.type === 'performance')) {
      await memoryStore.storeBestPractice(
        suggestion.suggestion,
        'performance',
        suggestion.description
      );
    }
    
    // Store overall solution pattern
    if (codeReview.overallScore > 80) {
      await memoryStore.storeSolution(
        `High-quality code review for PR ${pullNumber}`,
        `Achieved ${codeReview.overallScore}/100 score with minimal issues`,
        {
          testCoverage: codeReview.testCoverage,
          securityIssues: codeReview.securityIssues,
          performanceIssues: codeReview.performanceIssues
        }
      );
    }
  }

  private async performEnhancedPolicyValidation(
    files: string[],
    prDescription: string,
    codeReview: any
  ): Promise<any> {
    // Validate files against policy
    const fileValidation = await this.policyEngine.enforceRestrictions(
      files.map(file => ({ path: file, type: 'write' }))
    );
    
    // Validate PR description
    const commitValidation = await this.policyEngine.validateCommitMessage(prDescription);
    
    // Risk assessment based on code review findings
    const riskAssessment = await this.policyEngine.getRiskAssessment(
      files,
      `Code review found ${codeReview.suggestions.length} issues`
    );
    
    return {
      fileValidation,
      commitValidation,
      riskAssessment,
      complianceScore: this.calculateComplianceScore(fileValidation, commitValidation, riskAssessment)
    };
  }

  private async queryRelevantMemories(
    memoryStore: EnhancedMemoryStore,
    codeReview: any,
    policyValidation: any
  ): Promise<any> {
    const queries = [];
    
    // Query for similar security issues
    if (codeReview.securityIssues > 0) {
      queries.push(memoryStore.query('security vulnerability', 'error_resolution', 5));
    }
    
    // Query for performance patterns
    if (codeReview.performanceIssues > 0) {
      queries.push(memoryStore.query('performance optimization', 'best_practice', 5));
    }
    
    // Query for similar risk levels
    if (policyValidation.riskAssessment.riskLevel === 'high') {
      queries.push(memoryStore.query('high risk change', 'solution', 3));
    }
    
    const results = await Promise.all(queries);
    
    return {
      securityMemories: results[0] || [],
      performanceMemories: results[1] || [],
      riskMemories: results[2] || [],
      totalRelevantMemories: results.reduce((sum, r) => sum + (r?.length || 0), 0)
    };
  }

  private generateIntegratedRecommendations(
    codeReview: any,
    policyValidation: any,
    reasoningTrace: any,
    memorySummary: any
  ): string[] {
    const recommendations: string[] = [];
    
    // Code quality recommendations
    if (codeReview.overallScore < 70) {
      recommendations.push(`🔧 Code quality improvement needed (Score: ${codeReview.overallScore}/100)`);
    }
    
    // Security recommendations
    if (codeReview.securityIssues > 0) {
      recommendations.push(`🔒 Address ${codeReview.securityIssues} security issue(s) before merging`);
      
      if (memorySummary.securityMemories.length > 0) {
        recommendations.push(`💡 Found ${memorySummary.securityMemories.length} similar security patterns in memory - consider applying previous solutions`);
      }
    }
    
    // Performance recommendations
    if (codeReview.performanceIssues > 0) {
      recommendations.push(`⚡ Optimize ${codeReview.performanceIssues} performance issue(s)`);
    }
    
    // Test coverage recommendations
    if (codeReview.testCoverage < 70) {
      recommendations.push(`🧪 Improve test coverage (Current: ${codeReview.testCoverage}%)`);
    }
    
    // Policy compliance recommendations
    if (policyValidation.complianceScore < 80) {
      recommendations.push(`📋 Policy compliance issues detected (Score: ${policyValidation.complianceScore}/100)`);
    }
    
    // Risk-based recommendations
    if (policyValidation.riskAssessment.riskLevel === 'high') {
      recommendations.push(`⚠️ High-risk change - consider breaking into smaller PRs`);
    }
    
    // AI reasoning recommendations
    if (reasoningTrace.recommendations) {
      recommendations.push(...reasoningTrace.recommendations.map((r: string) => `🤖 AI: ${r}`));
    }
    
    // Memory-based learning recommendations
    if (memorySummary.totalRelevantMemories > 0) {
      recommendations.push(`🧠 Leveraging ${memorySummary.totalRelevantMemories} relevant memories from past analyses`);
    }
    
    return recommendations;
  }

  private calculateOverallScore(
    codeReview: any,
    policyValidation: any,
    reasoningTrace: any
  ): number {
    const codeWeight = 0.5;
    const policyWeight = 0.3;
    const reasoningWeight = 0.2;
    
    const codeScore = Math.max(0, codeReview.overallScore);
    const policyScore = Math.max(0, policyValidation.complianceScore);
    const reasoningScore = Math.max(0, reasoningTrace.confidence * 100);
    
    return Math.round(
      codeScore * codeWeight +
      policyScore * policyWeight +
      reasoningScore * reasoningWeight
    );
  }

  private calculateComplianceScore(
    fileValidation: any,
    commitValidation: any,
    riskAssessment: any
  ): number {
    let score = 100;
    
    // Deduct for blocked files
    score -= fileValidation.blocked.length * 20;
    
    // Deduct for invalid commit message
    if (!commitValidation.valid) {
      score -= 15;
    }
    
    // Deduct for high risk
    switch (riskAssessment.riskLevel) {
      case 'high':
        score -= 30;
        break;
      case 'medium':
        score -= 15;
        break;
      case 'low':
        score -= 0;
        break;
    }
    
    return Math.max(0, score);
  }

  /**
   * Generate a comprehensive analysis report
   */
  async generateAnalysisReport(analysisResult: IntegratedAnalysisResult): Promise<string> {
    const report = `
# 🤖 GitAutonomic Integrated Analysis Report

## 📊 Overall Assessment
**Score: ${analysisResult.overallScore}/100**

${analysisResult.overallScore >= 80 ? '✅ **Excellent quality** - Ready for merge' :
  analysisResult.overallScore >= 60 ? '⚠️ **Good quality** - Minor improvements needed' :
  '❌ **Needs improvement** - Significant changes required'}

## 🔍 Code Review Summary
- **Overall Score:** ${analysisResult.codeReview.overallScore}/100
- **Security Issues:** ${analysisResult.codeReview.securityIssues}
- **Performance Issues:** ${analysisResult.codeReview.performanceIssues}
- **Test Coverage:** ${analysisResult.codeReview.testCoverage}%
- **Total Suggestions:** ${analysisResult.codeReview.suggestions.length}

## 🛡️ Policy Compliance
- **Compliance Score:** ${analysisResult.policyValidation.complianceScore}/100
- **Risk Level:** ${analysisResult.policyValidation.riskAssessment.riskLevel.toUpperCase()}
- **Blocked Files:** ${analysisResult.policyValidation.fileValidation.blocked.length}
- **Allowed Files:** ${analysisResult.policyValidation.fileValidation.allowed.length}

## 🧠 AI Reasoning Analysis
- **Confidence:** ${(analysisResult.reasoningTrace.confidence * 100).toFixed(1)}%
- **Processing Steps:** ${analysisResult.reasoningTrace.trace.steps.length}
- **Phase:** ${analysisResult.reasoningTrace.trace.phase}

## 💡 Integrated Recommendations

${analysisResult.recommendations.map(rec => `- ${rec}`).join('\n')}

## 🧠 Memory Insights
- **Relevant Past Experiences:** ${analysisResult.memorySummary.totalRelevantMemories}
- **Security Patterns:** ${analysisResult.memorySummary.securityMemories.length}
- **Performance Patterns:** ${analysisResult.memorySummary.performanceMemories.length}

---
*Generated by GitAutonomic Enhanced Integration Service v2.0*
*Analysis completed at ${new Date().toISOString()}*
`;

    return report;
  }
}

export default { EnhancedIntegrationService };