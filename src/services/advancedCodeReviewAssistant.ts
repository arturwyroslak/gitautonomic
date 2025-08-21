// Advanced Code Review Assistant - AI-Powered Code Analysis and Review
import { getInstallationOctokit } from '../octokit.js';
import { PolicyEngine } from './policyEngine.js';
import { ReasoningEngine, LLMModel } from '../ai/reasoningEngine.js';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface CodeReviewSuggestion {
  type: 'security' | 'performance' | 'maintainability' | 'bug' | 'style';
  severity: 'low' | 'medium' | 'high' | 'critical';
  file: string;
  line: number;
  title: string;
  description: string;
  suggestion: string;
  codeExample?: string;
}

export interface CodeReviewAnalysis {
  overallScore: number;
  suggestions: CodeReviewSuggestion[];
  securityIssues: number;
  performanceIssues: number;
  maintainabilityScore: number;
  testCoverage: number;
  summary: string;
}

export class AdvancedCodeReviewAssistant {
  private policyEngine: PolicyEngine;
  private reasoningEngine?: ReasoningEngine;

  constructor(private llmModel?: LLMModel) {
    this.policyEngine = new PolicyEngine();
    if (llmModel) {
      this.reasoningEngine = new ReasoningEngine(llmModel, {
        diff: {
          parse: async (diffText: string) => ({ parsed: diffText }),
          applyUnified: async (diffText: string) => ({ ok: true })
        }
      });
    }
  }

  async reviewPullRequest(
    installationId: string,
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<CodeReviewAnalysis> {
    const octokit = await getInstallationOctokit(installationId);
    
    try {
      // Get pull request files
      const { data: files } = await octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: pullNumber
      });

      // Get pull request diff
      const { data: diffResponse } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
        mediaType: { format: 'diff' }
      });
      const diff = diffResponse as unknown as string;

      // Analyze each file
      const suggestions: CodeReviewSuggestion[] = [];
      let overallScore = 100;
      let securityIssues = 0;
      let performanceIssues = 0;

      for (const file of files) {
        if (file.status === 'removed') continue;

        const fileAnalysis = await this.analyzeFile(file.filename, file.patch || '');
        suggestions.push(...fileAnalysis.suggestions);
        
        securityIssues += fileAnalysis.suggestions.filter(s => s.type === 'security').length;
        performanceIssues += fileAnalysis.suggestions.filter(s => s.type === 'performance').length;
        
        overallScore -= fileAnalysis.suggestions.reduce((penalty, suggestion) => {
          switch (suggestion.severity) {
            case 'critical': return penalty + 20;
            case 'high': return penalty + 10;
            case 'medium': return penalty + 5;
            case 'low': return penalty + 1;
            default: return penalty;
          }
        }, 0);
      }

      // Check policy compliance
      const filePaths = files.map(f => f.filename);
      const policyValidation = await this.policyEngine.validatePatch(diff, filePaths);
      
      if (!policyValidation.allowed) {
        suggestions.push({
          type: 'security',
          severity: 'high',
          file: 'Policy',
          line: 0,
          title: 'Policy Violation',
          description: 'Pull request violates repository policies',
          suggestion: `Address the following policy issues: ${policyValidation.reasons.join(', ')}`
        });
        overallScore -= 15;
      }

      // Get risk assessment
      const riskAssessment = await this.policyEngine.getRiskAssessment(filePaths, diff);
      if (riskAssessment.riskLevel === 'high') {
        suggestions.push({
          type: 'maintainability',
          severity: 'medium',
          file: 'General',
          line: 0,
          title: 'High Risk Change',
          description: `This change is classified as high risk: ${riskAssessment.factors.join(', ')}`,
          suggestion: 'Consider breaking this change into smaller, more focused pull requests'
        });
      }

      const maintainabilityScore = Math.max(0, 100 - suggestions.filter(s => s.type === 'maintainability').length * 5);
      const testCoverage = await this.estimateTestCoverage(files);

      return {
        overallScore: Math.max(0, overallScore),
        suggestions: suggestions.sort((a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity)),
        securityIssues,
        performanceIssues,
        maintainabilityScore,
        testCoverage,
        summary: this.generateReviewSummary(overallScore, suggestions, securityIssues, performanceIssues)
      };

    } catch (error: any) {
      log.error(`Failed to review PR ${pullNumber}:`, error);
      throw error;
    }
  }

  private async analyzeFile(filename: string, patch: string): Promise<{ suggestions: CodeReviewSuggestion[] }> {
    const suggestions: CodeReviewSuggestion[] = [];
    const lines = patch.split('\n');

    // Security analysis
    suggestions.push(...this.analyzeFileSecurity(filename, patch));
    
    // Performance analysis
    suggestions.push(...this.analyzeFilePerformance(filename, patch));
    
    // Maintainability analysis
    suggestions.push(...this.analyzeFileMaintainability(filename, patch));
    
    // Style analysis
    suggestions.push(...this.analyzeFileStyle(filename, patch));

    return { suggestions };
  }

  private analyzeFileSecurity(filename: string, patch: string): CodeReviewSuggestion[] {
    const suggestions: CodeReviewSuggestion[] = [];
    const lines = patch.split('\n');

    // Check for security anti-patterns
    const securityPatterns = [
      { pattern: /password\s*=\s*["'][^"']+["']/i, message: 'Hardcoded password detected' },
      { pattern: /api[_-]?key\s*=\s*["'][^"']+["']/i, message: 'Hardcoded API key detected' },
      { pattern: /eval\s*\(/i, message: 'Use of eval() function is dangerous' },
      { pattern: /innerHTML\s*=/i, message: 'Direct innerHTML assignment can lead to XSS' },
      { pattern: /document\.write\s*\(/i, message: 'document.write() can be exploited for XSS' },
      { pattern: /sql\s*=\s*.*\+.*$/i, message: 'Potential SQL injection vulnerability' }
    ];

    lines.forEach((line, index) => {
      if (!line.startsWith('+')) return;

      securityPatterns.forEach(({ pattern, message }) => {
        if (pattern.test(line)) {
          suggestions.push({
            type: 'security',
            severity: 'high',
            file: filename,
            line: index + 1,
            title: 'Security Issue',
            description: message,
            suggestion: 'Use environment variables or secure configuration for sensitive data'
          });
        }
      });
    });

    return suggestions;
  }

  private analyzeFilePerformance(filename: string, patch: string): CodeReviewSuggestion[] {
    const suggestions: CodeReviewSuggestion[] = [];
    const lines = patch.split('\n');

    const performancePatterns = [
      { pattern: /for\s*\([^)]*\)\s*{\s*for\s*\(/i, message: 'Nested loops can impact performance' },
      { pattern: /console\.log\(/i, message: 'Console.log statements should be removed in production' },
      { pattern: /document\.getElementById.*getElementById/i, message: 'Multiple DOM queries should be cached' },
      { pattern: /setTimeout\s*\(\s*.*\s*,\s*0\s*\)/i, message: 'setTimeout with 0 delay is an anti-pattern' }
    ];

    lines.forEach((line, index) => {
      if (!line.startsWith('+')) return;

      performancePatterns.forEach(({ pattern, message }) => {
        if (pattern.test(line)) {
          suggestions.push({
            type: 'performance',
            severity: 'medium',
            file: filename,
            line: index + 1,
            title: 'Performance Issue',
            description: message,
            suggestion: 'Consider optimizing this code for better performance'
          });
        }
      });
    });

    return suggestions;
  }

  private analyzeFileMaintainability(filename: string, patch: string): CodeReviewSuggestion[] {
    const suggestions: CodeReviewSuggestion[] = [];
    const lines = patch.split('\n');

    // Check for maintainability issues
    const addedLines = lines.filter(line => line.startsWith('+')).length;
    if (addedLines > 100) {
      suggestions.push({
        type: 'maintainability',
        severity: 'medium',
        file: filename,
        line: 0,
        title: 'Large File Change',
        description: `This file has ${addedLines} added lines`,
        suggestion: 'Consider breaking large changes into smaller, more focused commits'
      });
    }

    // Check for TODO comments
    lines.forEach((line, index) => {
      if (line.startsWith('+') && /TODO|FIXME|HACK/i.test(line)) {
        suggestions.push({
          type: 'maintainability',
          severity: 'low',
          file: filename,
          line: index + 1,
          title: 'TODO Comment',
          description: 'TODO comment added',
          suggestion: 'Consider creating an issue to track this TODO item'
        });
      }
    });

    return suggestions;
  }

  private analyzeFileStyle(filename: string, patch: string): CodeReviewSuggestion[] {
    const suggestions: CodeReviewSuggestion[] = [];
    const lines = patch.split('\n');

    lines.forEach((line, index) => {
      if (!line.startsWith('+')) return;

      // Check for style issues
      if (line.includes('\t')) {
        suggestions.push({
          type: 'style',
          severity: 'low',
          file: filename,
          line: index + 1,
          title: 'Style Issue',
          description: 'Tab characters found, use spaces for indentation',
          suggestion: 'Configure your editor to use spaces instead of tabs'
        });
      }

      if (line.length > 120) {
        suggestions.push({
          type: 'style',
          severity: 'low',
          file: filename,
          line: index + 1,
          title: 'Line Length',
          description: `Line exceeds 120 characters (${line.length})`,
          suggestion: 'Consider breaking long lines for better readability'
        });
      }
    });

    return suggestions;
  }

  private async estimateTestCoverage(files: any[]): Promise<number> {
    // Simple heuristic: if test files are included, assume good coverage
    const testFiles = files.filter(f => 
      f.filename.includes('test') || 
      f.filename.includes('spec') ||
      f.filename.endsWith('.test.ts') ||
      f.filename.endsWith('.spec.ts')
    );

    const productionFiles = files.filter(f => 
      !f.filename.includes('test') && 
      !f.filename.includes('spec') &&
      (f.filename.endsWith('.ts') || f.filename.endsWith('.js'))
    );

    if (productionFiles.length === 0) return 100;
    
    const coverageRatio = testFiles.length / productionFiles.length;
    return Math.min(100, Math.max(0, coverageRatio * 80));
  }

  private getSeverityWeight(severity: string): number {
    switch (severity) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  private generateReviewSummary(
    overallScore: number, 
    suggestions: CodeReviewSuggestion[], 
    securityIssues: number, 
    performanceIssues: number
  ): string {
    const criticalIssues = suggestions.filter(s => s.severity === 'critical').length;
    const highIssues = suggestions.filter(s => s.severity === 'high').length;

    if (criticalIssues > 0) {
      return `❌ Critical issues found (${criticalIssues}). This pull request requires immediate attention before merging.`;
    } else if (securityIssues > 2) {
      return `🔒 Multiple security issues detected (${securityIssues}). Please review and address security concerns.`;
    } else if (highIssues > 3) {
      return `⚠️ Several high-priority issues found (${highIssues}). Consider addressing these before merging.`;
    } else if (overallScore >= 80) {
      return `✅ Good code quality! Score: ${overallScore}/100. Minor improvements suggested.`;
    } else if (overallScore >= 60) {
      return `📝 Acceptable code quality with room for improvement. Score: ${overallScore}/100.`;
    } else {
      return `🔧 Code quality needs improvement. Score: ${overallScore}/100. Please address the identified issues.`;
    }
  }

  async generateReviewComment(analysis: CodeReviewAnalysis): Promise<string> {
    let comment = `## 🤖 AI Code Review\n\n`;
    comment += `**Overall Score:** ${analysis.overallScore}/100\n`;
    comment += `**Test Coverage:** ${analysis.testCoverage}%\n\n`;
    comment += `${analysis.summary}\n\n`;

    if (analysis.suggestions.length > 0) {
      comment += `### 📋 Issues Found (${analysis.suggestions.length})\n\n`;
      
      const groupedSuggestions = analysis.suggestions.reduce((groups, suggestion) => {
        const key = suggestion.type;
        if (!groups[key]) groups[key] = [];
        groups[key].push(suggestion);
        return groups;
      }, {} as Record<string, CodeReviewSuggestion[]>);

      Object.entries(groupedSuggestions).forEach(([type, suggestions]) => {
        const emoji = this.getTypeEmoji(type);
        comment += `#### ${emoji} ${type.charAt(0).toUpperCase() + type.slice(1)} (${suggestions.length})\n\n`;
        
        suggestions.slice(0, 5).forEach(suggestion => { // Limit to top 5 per category
          comment += `- **${suggestion.title}** (${suggestion.file}:${suggestion.line})\n`;
          comment += `  ${suggestion.description}\n`;
          comment += `  💡 *${suggestion.suggestion}*\n\n`;
        });
      });
    }

    comment += `\n---\n*Generated by GitAutonomic AI at ${new Date().toISOString()}*`;
    return comment;
  }

  private getTypeEmoji(type: string): string {
    switch (type) {
      case 'security': return '🔒';
      case 'performance': return '⚡';
      case 'maintainability': return '🔧';
      case 'bug': return '🐛';
      case 'style': return '🎨';
      default: return '📝';
    }
  }
}

export default { AdvancedCodeReviewAssistant };