// Code Quality Metrics Engine - Comprehensive code quality scoring with trends
import pino from 'pino';
import { readFile } from 'fs/promises';
import { parse as parseJS } from '@babel/parser';
import { join } from 'path';
import { glob } from 'glob';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface FileMetrics {
  path: string;
  linesOfCode: number;
  complexity: number;
  maintainabilityIndex: number;
  technicalDebt: number;
  duplicatedLines: number;
  testCoverage: number;
  issues: QualityIssue[];
}

export interface QualityIssue {
  type: 'error' | 'warning' | 'info';
  category: 'complexity' | 'duplication' | 'maintainability' | 'security' | 'performance';
  message: string;
  line?: number;
  severity: number; // 1-10 scale
  suggestion?: string;
}

export interface QualityTrend {
  date: Date;
  overallScore: number;
  metrics: {
    complexity: number;
    maintainability: number;
    technicalDebt: number;
    testCoverage: number;
  };
}

export interface CodeQualityReport {
  overallScore: number;
  fileMetrics: FileMetrics[];
  projectMetrics: {
    totalLines: number;
    averageComplexity: number;
    technicalDebtHours: number;
    maintainabilityIndex: number;
    testCoveragePercentage: number;
    duplicatedCodePercentage: number;
  };
  trends: QualityTrend[];
  recommendations: string[];
  criticalIssues: QualityIssue[];
}

export class CodeQualityMetricsEngine {
  private duplicateDetector = new Map<string, string[]>();
  private complexityThresholds = {
    low: 10,
    medium: 20,
    high: 30
  };

  async analyzeCodeQuality(projectRoot: string): Promise<CodeQualityReport> {
    log.info('Starting comprehensive code quality analysis');
    
    const fileMetrics = await this.analyzeAllFiles(projectRoot);
    const projectMetrics = this.calculateProjectMetrics(fileMetrics);
    const trends = await this.analyzeTrends(projectRoot);
    const recommendations = this.generateRecommendations(fileMetrics, projectMetrics);
    const criticalIssues = this.extractCriticalIssues(fileMetrics);
    const overallScore = this.calculateOverallScore(projectMetrics);

    return {
      overallScore,
      fileMetrics,
      projectMetrics,
      trends,
      recommendations,
      criticalIssues
    };
  }

  private async analyzeAllFiles(projectRoot: string): Promise<FileMetrics[]> {
    const patterns = ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'];
    const fileMetrics: FileMetrics[] = [];

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: projectRoot,
        ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**', '**/*.test.*', '**/*.spec.*']
      });

      for (const file of files) {
        const filePath = join(projectRoot, file);
        try {
          const metrics = await this.analyzeFile(filePath);
          fileMetrics.push(metrics);
        } catch (error) {
          log.warn(`Failed to analyze ${file}: ${error}`);
        }
      }
    }

    // Post-process for duplicate detection
    this.detectDuplicates(fileMetrics);

    return fileMetrics;
  }

  private async analyzeFile(filePath: string): Promise<FileMetrics> {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    const linesOfCode = this.countLinesOfCode(lines);
    const complexity = await this.calculateComplexity(content, filePath);
    const issues = await this.analyzeIssues(content, filePath);
    const maintainabilityIndex = this.calculateMaintainabilityIndex(linesOfCode, complexity, issues);
    const technicalDebt = this.calculateTechnicalDebt(complexity, issues, linesOfCode);

    return {
      path: filePath,
      linesOfCode,
      complexity,
      maintainabilityIndex,
      technicalDebt,
      duplicatedLines: 0, // Will be calculated in detectDuplicates
      testCoverage: await this.estimateTestCoverage(filePath),
      issues
    };
  }

  private countLinesOfCode(lines: string[]): number {
    return lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && 
             !trimmed.startsWith('//') && 
             !trimmed.startsWith('/*') && 
             !trimmed.startsWith('*') && 
             !trimmed.startsWith('*/');
    }).length;
  }

  private async calculateComplexity(content: string, filePath: string): Promise<number> {
    try {
      const ast = parseJS(content, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        plugins: [
          'typescript', 'jsx', 'asyncGenerators', 'functionBind',
          'exportDefaultFrom', 'exportNamespaceFrom', 'dynamicImport',
          'nullishCoalescingOperator', 'optionalChaining'
        ]
      });

      return this.calculateCyclomaticComplexity(ast);
    } catch (error) {
      log.debug(`AST parsing failed for ${filePath}, using regex analysis`);
      return this.calculateComplexityWithRegex(content);
    }
  }

  private calculateCyclomaticComplexity(ast: any): number {
    let complexity = 1; // Base complexity

    const traverse = (node: any) => {
      if (!node || typeof node !== 'object') return;

      // Add complexity for control flow structures
      const complexityNodes = [
        'IfStatement', 'ConditionalExpression', 'SwitchStatement', 'SwitchCase',
        'WhileStatement', 'DoWhileStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement',
        'TryStatement', 'CatchClause', 'LogicalExpression'
      ];

      if (complexityNodes.includes(node.type)) {
        complexity++;
      }

      // Special handling for logical expressions (&&, ||)
      if (node.type === 'LogicalExpression' && (node.operator === '&&' || node.operator === '||')) {
        complexity++;
      }

      // Traverse child nodes
      for (const key in node) {
        if (key !== 'parent' && node[key]) {
          if (Array.isArray(node[key])) {
            node[key].forEach(traverse);
          } else if (typeof node[key] === 'object') {
            traverse(node[key]);
          }
        }
      }
    };

    traverse(ast);
    return complexity;
  }

  private calculateComplexityWithRegex(content: string): number {
    const complexityPatterns = [
      /\bif\s*\(/g,
      /\belse\s+if\b/g,
      /\bswitch\s*\(/g,
      /\bcase\s+/g,
      /\bwhile\s*\(/g,
      /\bfor\s*\(/g,
      /\bcatch\s*\(/g,
      /\b&&\b/g,
      /\b\|\|\b/g,
      /\?\s*.*?\s*:/g // Ternary operator
    ];

    let complexity = 1;
    for (const pattern of complexityPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  private async analyzeIssues(content: string, filePath: string): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    const lines = content.split('\n');

    // Check for various code quality issues
    issues.push(...this.checkComplexityIssues(content));
    issues.push(...this.checkMaintainabilityIssues(content, lines));
    issues.push(...this.checkPerformanceIssues(content));
    issues.push(...this.checkSecurityIssues(content));

    return issues;
  }

  private checkComplexityIssues(content: string): QualityIssue[] {
    const issues: QualityIssue[] = [];
    
    // Function length check
    const functionMatches = content.match(/function\s+\w+\([^)]*\)\s*{[^}]*}/gs);
    if (functionMatches) {
      functionMatches.forEach(func => {
        const lineCount = func.split('\n').length;
        if (lineCount > 50) {
          issues.push({
            type: 'warning',
            category: 'complexity',
            message: `Function is too long (${lineCount} lines). Consider breaking it down.`,
            severity: Math.min(lineCount / 10, 10),
            suggestion: 'Extract smaller functions or use composition patterns'
          });
        }
      });
    }

    // Nested callback detection
    const nestedCallbacks = (content.match(/function\s*\([^)]*\)\s*{\s*[^}]*function\s*\([^)]*\)\s*{/g) || []).length;
    if (nestedCallbacks > 3) {
      issues.push({
        type: 'warning',
        category: 'complexity',
        message: 'High number of nested callbacks detected',
        severity: Math.min(nestedCallbacks / 2, 10),
        suggestion: 'Consider using async/await or Promise chains'
      });
    }

    return issues;
  }

  private checkMaintainabilityIssues(content: string, lines: string[]): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Magic numbers detection
    const magicNumbers = content.match(/(?<![.\w])\d{2,}(?![.\w])/g);
    if (magicNumbers && magicNumbers.length > 5) {
      issues.push({
        type: 'info',
        category: 'maintainability',
        message: 'Multiple magic numbers detected',
        severity: Math.min(magicNumbers.length / 5, 8),
        suggestion: 'Extract magic numbers to named constants'
      });
    }

    // TODO comments detection
    const todoComments = content.match(/\/\/\s*TODO|\/\*\s*TODO|\*\s*TODO/gi);
    if (todoComments && todoComments.length > 10) {
      issues.push({
        type: 'info',
        category: 'maintainability',
        message: `High number of TODO comments (${todoComments.length})`,
        severity: Math.min(todoComments.length / 5, 6),
        suggestion: 'Consider creating issues for TODOs or completing them'
      });
    }

    // Long parameter lists
    const longParameterLists = content.match(/function\s+\w+\([^)]{50,}\)/g);
    if (longParameterLists && longParameterLists.length > 0) {
      issues.push({
        type: 'warning',
        category: 'maintainability',
        message: 'Functions with long parameter lists detected',
        severity: 7,
        suggestion: 'Use parameter objects or builder pattern'
      });
    }

    return issues;
  }

  private checkPerformanceIssues(content: string): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Synchronous file operations
    if (content.includes('readFileSync') || content.includes('writeFileSync')) {
      issues.push({
        type: 'warning',
        category: 'performance',
        message: 'Synchronous file operations detected',
        severity: 8,
        suggestion: 'Use asynchronous file operations for better performance'
      });
    }

    // Inefficient loops
    const inefficientLoops = content.match(/for\s*\([^)]*\.length[^)]*\)/g);
    if (inefficientLoops && inefficientLoops.length > 0) {
      issues.push({
        type: 'info',
        category: 'performance',
        message: 'Potentially inefficient loops detected',
        severity: 5,
        suggestion: 'Cache array length in loop conditions'
      });
    }

    return issues;
  }

  private checkSecurityIssues(content: string): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Eval usage
    if (content.includes('eval(')) {
      issues.push({
        type: 'error',
        category: 'security',
        message: 'Use of eval() detected - security risk',
        severity: 10,
        suggestion: 'Avoid eval() and use safer alternatives'
      });
    }

    // Hardcoded secrets patterns
    const secretPatterns = [
      /password\s*[=:]\s*['"`][^'"`]+['"`]/gi,
      /api[_-]?key\s*[=:]\s*['"`][^'"`]+['"`]/gi,
      /secret\s*[=:]\s*['"`][^'"`]+['"`]/gi
    ];

    secretPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        issues.push({
          type: 'error',
          category: 'security',
          message: 'Potential hardcoded secret detected',
          severity: 9,
          suggestion: 'Use environment variables for secrets'
        });
      }
    });

    return issues;
  }

  private calculateMaintainabilityIndex(linesOfCode: number, complexity: number, issues: QualityIssue[]): number {
    // Microsoft's Maintainability Index formula (simplified)
    const halsteadVolume = Math.log2(linesOfCode + 1) * 10; // Simplified Halstead volume
    const issuesPenalty = issues.reduce((sum, issue) => sum + issue.severity, 0);
    
    let index = 171 - 5.2 * Math.log(halsteadVolume) - 0.23 * complexity - 16.2 * Math.log(linesOfCode + 1);
    index = Math.max(0, index - issuesPenalty);
    
    return Math.max(0, Math.min(100, index));
  }

  private calculateTechnicalDebt(complexity: number, issues: QualityIssue[], linesOfCode: number): number {
    // Calculate technical debt in hours
    const complexityDebt = Math.max(0, (complexity - this.complexityThresholds.low)) * 0.5;
    const issuesDebt = issues.reduce((sum, issue) => sum + (issue.severity * 0.1), 0);
    const sizeDebt = Math.max(0, (linesOfCode - 300)) * 0.01; // Penalty for large files
    
    return complexityDebt + issuesDebt + sizeDebt;
  }

  private async estimateTestCoverage(filePath: string): Promise<number> {
    // Simple heuristic: check if corresponding test file exists
    const testPatterns = [
      filePath.replace(/\.(js|ts|jsx|tsx)$/, '.test.$1'),
      filePath.replace(/\.(js|ts|jsx|tsx)$/, '.spec.$1'),
      filePath.replace(/\/src\//, '/tests/').replace(/\.(js|ts|jsx|tsx)$/, '.test.$1'),
      filePath.replace(/\/src\//, '/__tests__/').replace(/\.(js|ts|jsx|tsx)$/, '.test.$1')
    ];

    // In a real implementation, this would integrate with coverage tools
    // For now, return a heuristic value
    return Math.random() * 100; // Placeholder
  }

  private detectDuplicates(fileMetrics: FileMetrics[]): void {
    // Simple duplicate detection based on content similarity
    for (let i = 0; i < fileMetrics.length; i++) {
      for (let j = i + 1; j < fileMetrics.length; j++) {
        const fileA = fileMetrics[i];
        const fileB = fileMetrics[j];
        if (fileA && fileB) {
          const similarity = this.calculateSimilarity(fileA.path, fileB.path);
          if (similarity > 0.8) {
            const duplicatedLines = Math.min(fileA.linesOfCode, fileB.linesOfCode) * similarity;
            fileA.duplicatedLines += duplicatedLines;
            fileB.duplicatedLines += duplicatedLines;
          }
        }
      }
    }
  }

  private calculateSimilarity(path1: string, path2: string): number {
    // Placeholder implementation - in production would use proper diff algorithms
    return Math.random() * 0.5; // Random value for demonstration
  }

  private calculateProjectMetrics(fileMetrics: FileMetrics[]) {
    const totalLines = fileMetrics.reduce((sum, file) => sum + file.linesOfCode, 0);
    const averageComplexity = fileMetrics.reduce((sum, file) => sum + file.complexity, 0) / fileMetrics.length;
    const technicalDebtHours = fileMetrics.reduce((sum, file) => sum + file.technicalDebt, 0);
    const maintainabilityIndex = fileMetrics.reduce((sum, file) => sum + file.maintainabilityIndex, 0) / fileMetrics.length;
    const testCoveragePercentage = fileMetrics.reduce((sum, file) => sum + file.testCoverage, 0) / fileMetrics.length;
    const duplicatedCodePercentage = (fileMetrics.reduce((sum, file) => sum + file.duplicatedLines, 0) / totalLines) * 100;

    return {
      totalLines,
      averageComplexity,
      technicalDebtHours,
      maintainabilityIndex,
      testCoveragePercentage,
      duplicatedCodePercentage
    };
  }

  private async analyzeTrends(projectRoot: string): Promise<QualityTrend[]> {
    // In a real implementation, this would read historical data
    // For now, return mock trend data
    const trends: QualityTrend[] = [];
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      trends.push({
        date,
        overallScore: 70 + Math.random() * 20,
        metrics: {
          complexity: 15 + Math.random() * 10,
          maintainability: 60 + Math.random() * 30,
          technicalDebt: 20 + Math.random() * 30,
          testCoverage: 50 + Math.random() * 40
        }
      });
    }

    return trends;
  }

  private generateRecommendations(fileMetrics: FileMetrics[], projectMetrics: any): string[] {
    const recommendations: string[] = [];

    if (projectMetrics.averageComplexity > this.complexityThresholds.medium) {
      recommendations.push('Reduce code complexity by breaking down large functions');
    }

    if (projectMetrics.testCoveragePercentage < 70) {
      recommendations.push('Increase test coverage to improve code reliability');
    }

    if (projectMetrics.duplicatedCodePercentage > 10) {
      recommendations.push('Reduce code duplication by extracting common functionality');
    }

    if (projectMetrics.technicalDebtHours > 100) {
      recommendations.push('Address technical debt to improve maintainability');
    }

    if (projectMetrics.maintainabilityIndex < 50) {
      recommendations.push('Improve code maintainability by following coding standards');
    }

    // File-specific recommendations
    const problematicFiles = fileMetrics.filter(file => 
      file.complexity > this.complexityThresholds.high || 
      file.maintainabilityIndex < 30
    );

    if (problematicFiles.length > 0) {
      recommendations.push(`Review ${problematicFiles.length} files with high complexity or low maintainability`);
    }

    return recommendations;
  }

  private extractCriticalIssues(fileMetrics: FileMetrics[]): QualityIssue[] {
    const criticalIssues: QualityIssue[] = [];

    fileMetrics.forEach(file => {
      file.issues.forEach(issue => {
        if (issue.severity >= 8) {
          criticalIssues.push({
            ...issue,
            message: `${file.path}: ${issue.message}`
          });
        }
      });
    });

    return criticalIssues.sort((a, b) => b.severity - a.severity);
  }

  private calculateOverallScore(projectMetrics: any): number {
    const weights = {
      maintainability: 0.3,
      testCoverage: 0.25,
      complexity: 0.2,
      duplication: 0.15,
      technicalDebt: 0.1
    };

    const scores = {
      maintainability: projectMetrics.maintainabilityIndex,
      testCoverage: projectMetrics.testCoveragePercentage,
      complexity: Math.max(0, 100 - (projectMetrics.averageComplexity * 2)),
      duplication: Math.max(0, 100 - (projectMetrics.duplicatedCodePercentage * 5)),
      technicalDebt: Math.max(0, 100 - (projectMetrics.technicalDebtHours / 5))
    };

    return Object.entries(weights).reduce((total, [metric, weight]) => {
      return total + (scores[metric as keyof typeof scores] * weight);
    }, 0);
  }

  // Public API methods
  async getQualityGate(projectRoot: string): Promise<{
    passed: boolean;
    score: number;
    failedCriteria: string[];
    recommendations: string[];
  }> {
    const report = await this.analyzeCodeQuality(projectRoot);
    
    const criteria = {
      'Overall Score': report.overallScore >= 70,
      'Test Coverage': report.projectMetrics.testCoveragePercentage >= 70,
      'Maintainability': report.projectMetrics.maintainabilityIndex >= 50,
      'Complexity': report.projectMetrics.averageComplexity <= 25,
      'Critical Issues': report.criticalIssues.length === 0
    };

    const failedCriteria = Object.entries(criteria)
      .filter(([_, passed]) => !passed)
      .map(([criterion]) => criterion);

    return {
      passed: failedCriteria.length === 0,
      score: report.overallScore,
      failedCriteria,
      recommendations: report.recommendations.slice(0, 3)
    };
  }
}

export default CodeQualityMetricsEngine;