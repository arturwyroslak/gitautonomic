import * as fs from 'fs/promises';
import * as path from 'path';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface CodeReviewIssue {
  id: string;
  type: 'security' | 'performance' | 'maintainability' | 'bug' | 'style' | 'documentation' | 'testing' | 'architecture';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  location: {
    filePath: string;
    startLine: number;
    endLine: number;
    column?: number;
  };
  codeSnippet: string;
  suggestion: string;
  reasoning: string;
  confidence: number; // 0-1
  effort: 'low' | 'medium' | 'high'; // Effort to fix
  tags: string[];
  references?: string[]; // Links to documentation, standards, etc.
  autoFixAvailable?: boolean;
  autoFix?: string;
}

export interface QualityMetrics {
  overall: number; // 0-100
  maintainability: number;
  reliability: number;
  security: number;
  performance: number;
  testability: number;
  documentation: number;
  codeStyle: number;
  complexity: {
    average: number;
    highest: number;
    distribution: Record<string, number>; // complexity range -> count
  };
  duplication: {
    percentage: number;
    blocks: number;
  };
  coverage: {
    statements: number;
    branches: number;
    functions: number;
  };
  dependencies: {
    outdated: number;
    vulnerable: number;
    unused: number;
  };
}

export interface ReviewAnalysisResult {
  success: boolean;
  issues: CodeReviewIssue[];
  metrics: QualityMetrics;
  summary: {
    totalIssues: number;
    criticalIssues: number;
    autoFixableIssues: number;
    estimatedFixTime: number; // minutes
    recommendations: string[];
    qualityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  };
  trends?: {
    previousScore?: number;
    improvement: number;
    newIssues: number;
    fixedIssues: number;
  };
  error?: string;
}

export interface ReviewOptions {
  targetFiles?: string[];
  includePatterns?: string[];
  excludePatterns?: string[];
  ruleSets?: ('security' | 'performance' | 'style' | 'maintainability' | 'testing')[];
  severity?: ('critical' | 'high' | 'medium' | 'low' | 'info')[];
  autoFix?: boolean;
  includeMetrics?: boolean;
  compareToPrevious?: boolean;
  outputFormat?: 'json' | 'markdown' | 'html';
}

export class CodeReviewAnalyzerTool {
  private readonly rules = new Map<string, (code: string, filePath: string) => CodeReviewIssue[]>();
  
  constructor() {
    this.initializeRules();
  }

  /**
   * Advanced code review analysis with quality metrics
   */
  async analyzeCodeReview(
    workingDirectory: string,
    options: ReviewOptions = {}
  ): Promise<ReviewAnalysisResult> {
    try {
      log.info('Starting code review analysis', { 
        workingDirectory, 
        options 
      } as any);

      // Discover target files
      const targetFiles = await this.discoverTargetFiles(workingDirectory, options);
      if (targetFiles.length === 0) {
        return {
          success: false,
          issues: [],
          metrics: this.createEmptyMetrics(),
          summary: this.createEmptySummary(),
          error: 'No target files found for analysis'
        };
      }

      // Analyze each file
      const allIssues: CodeReviewIssue[] = [];
      for (const filePath of targetFiles) {
        const fileIssues = await this.analyzeFile(filePath, options);
        allIssues.push(...fileIssues);
      }

      // Filter issues based on options
      const filteredIssues = this.filterIssues(allIssues, options);

      // Calculate quality metrics
      const metrics = options.includeMetrics !== false 
        ? await this.calculateQualityMetrics(targetFiles, filteredIssues)
        : this.createEmptyMetrics();

      // Generate summary
      const summary = this.generateSummary(filteredIssues, metrics);

      // Get trends if requested
      const trends = options.compareToPrevious 
        ? await this.calculateTrends(filteredIssues, metrics)
        : undefined;

      log.info(`Code review analysis completed. Found ${filteredIssues.length} issues`);

      return {
        success: true,
        issues: filteredIssues,
        metrics,
        summary,
        trends
      };

    } catch (error) {
      log.error(`Code review analysis failed: ${error}`);
      return {
        success: false,
        issues: [],
        metrics: this.createEmptyMetrics(),
        summary: this.createEmptySummary(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate detailed code review report
   */
  async generateReport(
    analysis: ReviewAnalysisResult,
    format: 'json' | 'markdown' | 'html' = 'markdown'
  ): Promise<string> {
    switch (format) {
      case 'json':
        return JSON.stringify(analysis, null, 2);
      case 'html':
        return this.generateHTMLReport(analysis);
      case 'markdown':
      default:
        return this.generateMarkdownReport(analysis);
    }
  }

  /**
   * Apply auto-fixes for fixable issues
   */
  async applyAutoFixes(
    issues: CodeReviewIssue[],
    options: { dryRun?: boolean; createBackup?: boolean } = {}
  ): Promise<{ applied: number; failed: number; errors: string[] }> {
    const fixableIssues = issues.filter(issue => issue.autoFixAvailable && issue.autoFix);
    let applied = 0;
    const failed = 0;
    const errors: string[] = [];

    if (options.createBackup) {
      await this.createBackup(fixableIssues);
    }

    for (const issue of fixableIssues) {
      try {
        if (!options.dryRun) {
          await this.applyAutoFix(issue);
        }
        applied++;
      } catch (error) {
        errors.push(`Failed to fix ${issue.id}: ${error}`);
      }
    }

    return { applied, failed, errors };
  }

  /**
   * Get code review insights and trends
   */
  async getInsights(
    analyses: ReviewAnalysisResult[]
  ): Promise<{
    trends: { metric: string; trend: 'improving' | 'declining' | 'stable'; change: number }[];
    patterns: { pattern: string; frequency: number; files: string[] }[];
    recommendations: string[];
  }> {
    const trends = this.analyzeTrends(analyses);
    const patterns = this.identifyPatterns(analyses);
    const recommendations = this.generateRecommendations(analyses);

    return { trends, patterns, recommendations };
  }

  private initializeRules(): void {
    // Security rules
    this.rules.set('security', (code, filePath) => [
      ...this.checkSQLInjection(code, filePath),
      ...this.checkXSS(code, filePath),
      ...this.checkInsecureRandomness(code, filePath),
      ...this.checkHardcodedSecrets(code, filePath),
      ...this.checkUnsafeEval(code, filePath)
    ]);

    // Performance rules
    this.rules.set('performance', (code, filePath) => [
      ...this.checkInefficiientLoops(code, filePath),
      ...this.checkMemoryLeaks(code, filePath),
      ...this.checkLargeObjects(code, filePath),
      ...this.checkUnoptimizedRegex(code, filePath)
    ]);

    // Maintainability rules
    this.rules.set('maintainability', (code, filePath) => [
      ...this.checkComplexity(code, filePath),
      ...this.checkLongMethods(code, filePath),
      ...this.checkDuplication(code, filePath),
      ...this.checkNaming(code, filePath)
    ]);

    // Style rules
    this.rules.set('style', (code, filePath) => [
      ...this.checkFormatting(code, filePath),
      ...this.checkConsistency(code, filePath)
    ]);

    // Testing rules
    this.rules.set('testing', (code, filePath) => [
      ...this.checkTestCoverage(code, filePath),
      ...this.checkTestQuality(code, filePath)
    ]);
  }

  private async discoverTargetFiles(
    workingDirectory: string,
    options: ReviewOptions
  ): Promise<string[]> {
    if (options.targetFiles) {
      return options.targetFiles.map(file => path.resolve(workingDirectory, file));
    }

    const defaultPatterns = ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'];
    const includePatterns = options.includePatterns || defaultPatterns;
    const excludePatterns = options.excludePatterns || ['node_modules/**', 'dist/**'];

    try {
      const { glob } = await import('glob');
      const files: string[] = [];

      for (const pattern of includePatterns) {
        const matchedFiles = await glob(pattern, {
          cwd: workingDirectory,
          ignore: excludePatterns,
          absolute: true
        });
        files.push(...matchedFiles);
      }

      return [...new Set(files)];
    } catch (error) {
      log.warn(`Could not discover files: ${error}`);
      return [];
    }
  }

  private async analyzeFile(filePath: string, options: ReviewOptions): Promise<CodeReviewIssue[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const issues: CodeReviewIssue[] = [];

      const ruleSets = options.ruleSets || ['security', 'performance', 'maintainability', 'style', 'testing'];

      for (const ruleSet of ruleSets) {
        const rule = this.rules.get(ruleSet);
        if (rule) {
          issues.push(...rule(content, filePath));
        }
      }

      return issues;
    } catch (error) {
      log.warn(`Could not analyze file ${filePath}: ${error}`);
      return [];
    }
  }

  private filterIssues(issues: CodeReviewIssue[], options: ReviewOptions): CodeReviewIssue[] {
    let filtered = issues;

    if (options.severity) {
      filtered = filtered.filter(issue => options.severity!.includes(issue.severity));
    }

    return filtered.sort((a, b) => {
      const severityOrder = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      
      return b.confidence - a.confidence;
    });
  }

  // Security rule implementations
  private checkSQLInjection(code: string, filePath: string): CodeReviewIssue[] {
    const issues: CodeReviewIssue[] = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      if (line.includes('SELECT') && line.includes('+') && !line.includes('?')) {
        issues.push({
          id: `sql_injection_${index}`,
          type: 'security',
          severity: 'critical',
          title: 'Potential SQL Injection',
          description: 'SQL query appears to use string concatenation which can lead to SQL injection',
          location: { filePath, startLine: index + 1, endLine: index + 1 },
          codeSnippet: line.trim(),
          suggestion: 'Use parameterized queries or prepared statements',
          reasoning: 'String concatenation in SQL queries allows attackers to inject malicious SQL code',
          confidence: 0.8,
          effort: 'medium',
          tags: ['security', 'sql', 'injection'],
          references: ['https://owasp.org/www-community/attacks/SQL_Injection'],
          autoFixAvailable: false
        });
      }
    });

    return issues;
  }

  private checkXSS(code: string, filePath: string): CodeReviewIssue[] {
    const issues: CodeReviewIssue[] = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      if (line.includes('innerHTML') && !line.includes('sanitize')) {
        issues.push({
          id: `xss_${index}`,
          type: 'security',
          severity: 'high',
          title: 'Potential XSS Vulnerability',
          description: 'Direct assignment to innerHTML without sanitization',
          location: { filePath, startLine: index + 1, endLine: index + 1 },
          codeSnippet: line.trim(),
          suggestion: 'Use textContent or sanitize HTML content before assignment',
          reasoning: 'Unsanitized HTML can execute malicious scripts',
          confidence: 0.7,
          effort: 'low',
          tags: ['security', 'xss', 'html'],
          autoFixAvailable: true,
          autoFix: line.replace('innerHTML', 'textContent')
        });
      }
    });

    return issues;
  }

  private checkInsecureRandomness(code: string, filePath: string): CodeReviewIssue[] {
    const issues: CodeReviewIssue[] = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      if (line.includes('Math.random()') && (line.includes('password') || line.includes('token') || line.includes('secret'))) {
        issues.push({
          id: `weak_random_${index}`,
          type: 'security',
          severity: 'high',
          title: 'Cryptographically Weak Random Number Generation',
          description: 'Math.random() should not be used for security-sensitive operations',
          location: { filePath, startLine: index + 1, endLine: index + 1 },
          codeSnippet: line.trim(),
          suggestion: 'Use crypto.randomBytes() or crypto.getRandomValues() for cryptographic operations',
          reasoning: 'Math.random() is not cryptographically secure and predictable',
          confidence: 0.9,
          effort: 'low',
          tags: ['security', 'crypto', 'random'],
          autoFixAvailable: false
        });
      }
    });

    return issues;
  }

  private checkHardcodedSecrets(code: string, filePath: string): CodeReviewIssue[] {
    const issues: CodeReviewIssue[] = [];
    const lines = code.split('\n');
    const secretPatterns = [
      /password\s*[:=]\s*['"'][^'"]+['"]/i,
      /api[_-]?key\s*[:=]\s*['"'][^'"]+['"]/i,
      /secret\s*[:=]\s*['"'][^'"]+['"]/i,
      /token\s*[:=]\s*['"'][^'"]+['"]/i
    ];

    lines.forEach((line, index) => {
      secretPatterns.forEach(pattern => {
        if (pattern.test(line)) {
          issues.push({
            id: `hardcoded_secret_${index}`,
            type: 'security',
            severity: 'critical',
            title: 'Hardcoded Secret Detected',
            description: 'Sensitive information appears to be hardcoded',
            location: { filePath, startLine: index + 1, endLine: index + 1 },
            codeSnippet: line.trim(),
            suggestion: 'Move secrets to environment variables or secure configuration',
            reasoning: 'Hardcoded secrets in source code can be exposed in version control',
            confidence: 0.8,
            effort: 'medium',
            tags: ['security', 'secrets', 'credentials'],
            autoFixAvailable: false
          });
        }
      });
    });

    return issues;
  }

  private checkUnsafeEval(code: string, filePath: string): CodeReviewIssue[] {
    const issues: CodeReviewIssue[] = [];
    const lines = code.split('\n');
    const dangerousFunctions = ['eval(', 'Function(', 'setTimeout(', 'setInterval('];

    lines.forEach((line, index) => {
      dangerousFunctions.forEach(func => {
        if (line.includes(func) && line.includes('"') || line.includes("'")) {
          issues.push({
            id: `unsafe_eval_${index}`,
            type: 'security',
            severity: 'high',
            title: 'Unsafe Dynamic Code Execution',
            description: `Use of ${func} with string parameters can lead to code injection`,
            location: { filePath, startLine: index + 1, endLine: index + 1 },
            codeSnippet: line.trim(),
            suggestion: 'Avoid dynamic code execution or use safer alternatives',
            reasoning: 'Dynamic code execution can be exploited for code injection attacks',
            confidence: 0.7,
            effort: 'high',
            tags: ['security', 'eval', 'injection'],
            autoFixAvailable: false
          });
        }
      });
    });

    return issues;
  }

  // Performance rule implementations
  private checkInefficiientLoops(code: string, filePath: string): CodeReviewIssue[] {
    const issues: CodeReviewIssue[] = [];
    const lines = code.split('\n');

    // Check for nested loops
    let loopDepth = 0;
    lines.forEach((line, index) => {
      if (line.includes('for (') || line.includes('while (')) {
        loopDepth++;
        if (loopDepth > 2) {
          issues.push({
            id: `nested_loops_${index}`,
            type: 'performance',
            severity: 'medium',
            title: 'Deeply Nested Loops',
            description: 'Multiple nested loops can cause performance issues',
            location: { filePath, startLine: index + 1, endLine: index + 1 },
            codeSnippet: line.trim(),
            suggestion: 'Consider algorithm optimization or breaking into separate functions',
            reasoning: 'Nested loops have exponential time complexity',
            confidence: 0.8,
            effort: 'high',
            tags: ['performance', 'algorithm', 'complexity'],
            autoFixAvailable: false
          });
        }
      }
      if (line.includes('}')) {
        loopDepth = Math.max(0, loopDepth - 1);
      }
    });

    return issues;
  }

  private checkMemoryLeaks(code: string, filePath: string): CodeReviewIssue[] {
    const issues: CodeReviewIssue[] = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      // Check for missing cleanup in event listeners
      if (line.includes('addEventListener') && !code.includes('removeEventListener')) {
        issues.push({
          id: `memory_leak_listener_${index}`,
          type: 'performance',
          severity: 'medium',
          title: 'Potential Memory Leak',
          description: 'Event listener added without corresponding removal',
          location: { filePath, startLine: index + 1, endLine: index + 1 },
          codeSnippet: line.trim(),
          suggestion: 'Add removeEventListener in cleanup/unmount logic',
          reasoning: 'Unremoved event listeners can cause memory leaks',
          confidence: 0.6,
          effort: 'low',
          tags: ['performance', 'memory', 'events'],
          autoFixAvailable: false
        });
      }

      // Check for missing cleanup in intervals/timeouts
      if (line.includes('setInterval') && !line.includes('clearInterval')) {
        issues.push({
          id: `memory_leak_interval_${index}`,
          type: 'performance',
          severity: 'medium',
          title: 'Potential Memory Leak',
          description: 'setInterval without corresponding clearInterval',
          location: { filePath, startLine: index + 1, endLine: index + 1 },
          codeSnippet: line.trim(),
          suggestion: 'Store interval ID and clear it when component unmounts',
          reasoning: 'Uncleared intervals continue running and consuming memory',
          confidence: 0.7,
          effort: 'low',
          tags: ['performance', 'memory', 'intervals'],
          autoFixAvailable: false
        });
      }
    });

    return issues;
  }

  private checkLargeObjects(code: string, filePath: string): CodeReviewIssue[] {
    const issues: CodeReviewIssue[] = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      // Simple heuristic for large object literals
      if (line.includes('{') && line.length > 200) {
        issues.push({
          id: `large_object_${index}`,
          type: 'performance',
          severity: 'low',
          title: 'Large Object Declaration',
          description: 'Large object literal may impact performance',
          location: { filePath, startLine: index + 1, endLine: index + 1 },
          codeSnippet: line.trim().substring(0, 100) + '...',
          suggestion: 'Consider breaking into smaller objects or lazy loading',
          reasoning: 'Large objects can impact memory usage and parsing time',
          confidence: 0.5,
          effort: 'medium',
          tags: ['performance', 'memory', 'objects'],
          autoFixAvailable: false
        });
      }
    });

    return issues;
  }

  private checkUnoptimizedRegex(code: string, filePath: string): CodeReviewIssue[] {
    const issues: CodeReviewIssue[] = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      // Check for potentially inefficient regex patterns
      const regexPatterns = line.match(/\/.*\//g) || [];
      regexPatterns.forEach(pattern => {
        if (pattern.includes('.*.*') || pattern.includes('(.*)+')) {
          issues.push({
            id: `inefficient_regex_${index}`,
            type: 'performance',
            severity: 'medium',
            title: 'Potentially Inefficient Regex',
            description: 'Regex pattern may cause exponential backtracking',
            location: { filePath, startLine: index + 1, endLine: index + 1 },
            codeSnippet: line.trim(),
            suggestion: 'Optimize regex pattern to avoid catastrophic backtracking',
            reasoning: 'Inefficient regex can cause severe performance degradation',
            confidence: 0.6,
            effort: 'medium',
            tags: ['performance', 'regex', 'backtracking'],
            autoFixAvailable: false
          });
        }
      });
    });

    return issues;
  }

  // Maintainability rule implementations
  private checkComplexity(code: string, filePath: string): CodeReviewIssue[] {
    const issues: CodeReviewIssue[] = [];
    const functions = this.extractFunctions(code);

    functions.forEach(func => {
      const complexity = this.calculateCyclomaticComplexity(func.body);
      if (complexity > 10) {
        issues.push({
          id: `high_complexity_${func.name}_${func.line}`,
          type: 'maintainability',
          severity: complexity > 15 ? 'high' : 'medium',
          title: `High Cyclomatic Complexity (${complexity})`,
          description: `Function '${func.name}' has high cyclomatic complexity`,
          location: { filePath, startLine: func.line, endLine: func.line + func.body.split('\n').length },
          codeSnippet: func.body.substring(0, 200) + '...',
          suggestion: 'Break down into smaller functions or simplify logic',
          reasoning: 'High complexity makes code hard to understand and maintain',
          confidence: 0.9,
          effort: 'high',
          tags: ['maintainability', 'complexity', 'refactoring'],
          autoFixAvailable: false
        });
      }
    });

    return issues;
  }

  private checkLongMethods(code: string, filePath: string): CodeReviewIssue[] {
    const issues: CodeReviewIssue[] = [];
    const functions = this.extractFunctions(code);

    functions.forEach(func => {
      const lineCount = func.body.split('\n').length;
      if (lineCount > 50) {
        issues.push({
          id: `long_method_${func.name}_${func.line}`,
          type: 'maintainability',
          severity: lineCount > 100 ? 'high' : 'medium',
          title: `Long Method (${lineCount} lines)`,
          description: `Function '${func.name}' is too long`,
          location: { filePath, startLine: func.line, endLine: func.line + lineCount },
          codeSnippet: func.body.substring(0, 200) + '...',
          suggestion: 'Extract smaller functions from this method',
          reasoning: 'Long methods are hard to understand and maintain',
          confidence: 0.8,
          effort: 'medium',
          tags: ['maintainability', 'method-length', 'refactoring'],
          autoFixAvailable: false
        });
      }
    });

    return issues;
  }

  private checkDuplication(code: string, filePath: string): CodeReviewIssue[] {
    const issues: CodeReviewIssue[] = [];
    const lines = code.split('\n');
    const minLineCount = 5;

    for (let i = 0; i < lines.length - minLineCount; i++) {
      const segment = lines.slice(i, i + minLineCount).join('\n').trim();
      if (segment.length < 50) continue;

      for (let j = i + minLineCount; j < lines.length - minLineCount; j++) {
        const compareSegment = lines.slice(j, j + minLineCount).join('\n').trim();
        
        if (this.calculateSimilarity(segment, compareSegment) > 0.8) {
          issues.push({
            id: `duplication_${i}_${j}`,
            type: 'maintainability',
            severity: 'medium',
            title: 'Code Duplication Detected',
            description: 'Similar code blocks found',
            location: { filePath, startLine: i + 1, endLine: i + minLineCount },
            codeSnippet: segment.substring(0, 200) + '...',
            suggestion: 'Extract common functionality into a shared function',
            reasoning: 'Code duplication increases maintenance burden',
            confidence: 0.7,
            effort: 'medium',
            tags: ['maintainability', 'duplication', 'refactoring'],
            autoFixAvailable: false
          });
          break; // Only report first occurrence
        }
      }
    }

    return issues;
  }

  private checkNaming(code: string, filePath: string): CodeReviewIssue[] {
    const issues: CodeReviewIssue[] = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      // Check for single letter variables (except i, j, k in loops)
      const singleLetterVars = line.match(/\b[a-h,l-z]\b(?!\s*[=:])/g);
      if (singleLetterVars && !line.includes('for (')) {
        issues.push({
          id: `poor_naming_${index}`,
          type: 'maintainability',
          severity: 'low',
          title: 'Poor Variable Naming',
          description: 'Single letter variable names make code hard to understand',
          location: { filePath, startLine: index + 1, endLine: index + 1 },
          codeSnippet: line.trim(),
          suggestion: 'Use descriptive variable names',
          reasoning: 'Meaningful names improve code readability',
          confidence: 0.6,
          effort: 'low',
          tags: ['maintainability', 'naming', 'readability'],
          autoFixAvailable: false
        });
      }
    });

    return issues;
  }

  // Style rule implementations
  private checkFormatting(code: string, filePath: string): CodeReviewIssue[] {
    const issues: CodeReviewIssue[] = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      // Check for inconsistent indentation
      if (line.match(/^\s*\t\s+/) || line.match(/^\s+ \t/)) {
        issues.push({
          id: `mixed_indentation_${index}`,
          type: 'style',
          severity: 'low',
          title: 'Mixed Indentation',
          description: 'Inconsistent use of tabs and spaces',
          location: { filePath, startLine: index + 1, endLine: index + 1 },
          codeSnippet: line,
          suggestion: 'Use consistent indentation (either tabs or spaces)',
          reasoning: 'Consistent formatting improves code readability',
          confidence: 0.9,
          effort: 'low',
          tags: ['style', 'formatting', 'indentation'],
          autoFixAvailable: true,
          autoFix: line.replace(/\t/g, '  ') // Convert tabs to spaces
        });
      }

      // Check for trailing whitespace
      if (line.endsWith(' ') || line.endsWith('\t')) {
        issues.push({
          id: `trailing_whitespace_${index}`,
          type: 'style',
          severity: 'info',
          title: 'Trailing Whitespace',
          description: 'Line has trailing whitespace',
          location: { filePath, startLine: index + 1, endLine: index + 1 },
          codeSnippet: line,
          suggestion: 'Remove trailing whitespace',
          reasoning: 'Trailing whitespace clutters diffs and version control',
          confidence: 1.0,
          effort: 'low',
          tags: ['style', 'formatting', 'whitespace'],
          autoFixAvailable: true,
          autoFix: line.trimEnd()
        });
      }
    });

    return issues;
  }

  private checkConsistency(code: string, filePath: string): CodeReviewIssue[] {
    const issues: CodeReviewIssue[] = [];
    
    // Check quote consistency
    const singleQuotes = (code.match(/'/g) || []).length;
    const doubleQuotes = (code.match(/"/g) || []).length;
    
    if (singleQuotes > 0 && doubleQuotes > 0 && Math.abs(singleQuotes - doubleQuotes) > 10) {
      issues.push({
        id: 'quote_consistency',
        type: 'style',
        severity: 'info',
        title: 'Inconsistent Quote Usage',
        description: 'Mixed use of single and double quotes',
        location: { filePath, startLine: 1, endLine: 1 },
        codeSnippet: 'File uses both single and double quotes',
        suggestion: 'Use consistent quote style throughout the file',
        reasoning: 'Consistent quote usage improves code consistency',
        confidence: 0.8,
        effort: 'low',
        tags: ['style', 'quotes', 'consistency'],
        autoFixAvailable: false
      });
    }

    return issues;
  }

  // Testing rule implementations
  private checkTestCoverage(code: string, filePath: string): CodeReviewIssue[] {
    const issues: CodeReviewIssue[] = [];
    
    // Simple heuristic: if it's not a test file and has no corresponding test file
    if (!filePath.includes('.test.') && !filePath.includes('.spec.')) {
      const testFile = filePath.replace(/\.(ts|js)$/, '.test.$1');
      // In a real implementation, you'd check if the test file exists
      issues.push({
        id: `missing_tests_${path.basename(filePath)}`,
        type: 'testing',
        severity: 'medium',
        title: 'Missing Test Coverage',
        description: 'No corresponding test file found',
        location: { filePath, startLine: 1, endLine: 1 },
        codeSnippet: 'Entire file lacks test coverage',
        suggestion: `Create test file: ${testFile}`,
        reasoning: 'Tests ensure code reliability and catch regressions',
        confidence: 0.7,
        effort: 'high',
        tags: ['testing', 'coverage', 'quality'],
        autoFixAvailable: false
      });
    }

    return issues;
  }

  private checkTestQuality(code: string, filePath: string): CodeReviewIssue[] {
    const issues: CodeReviewIssue[] = [];
    
    if (filePath.includes('.test.') || filePath.includes('.spec.')) {
      const lines = code.split('\n');
      
      // Check for meaningful test descriptions
      lines.forEach((line, index) => {
        if (line.includes('it(') || line.includes('test(')) {
          if (line.includes('"test"') || line.includes("'test'") || line.includes('should work')) {
            issues.push({
              id: `poor_test_description_${index}`,
              type: 'testing',
              severity: 'low',
              title: 'Poor Test Description',
              description: 'Test has generic or unclear description',
              location: { filePath, startLine: index + 1, endLine: index + 1 },
              codeSnippet: line.trim(),
              suggestion: 'Use descriptive test names that explain what is being tested',
              reasoning: 'Clear test descriptions help with debugging and understanding',
              confidence: 0.8,
              effort: 'low',
              tags: ['testing', 'description', 'clarity'],
              autoFixAvailable: false
            });
          }
        }
      });
    }

    return issues;
  }

  // Utility methods
  private async calculateQualityMetrics(
    files: string[],
    issues: CodeReviewIssue[]
  ): Promise<QualityMetrics> {
    // This is a simplified implementation
    // In a real scenario, this would integrate with actual analysis tools
    
    const totalIssues = issues.length;
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;
    
    const overall = Math.max(0, 100 - (criticalIssues * 20 + highIssues * 10 + totalIssues * 2));
    
    return {
      overall,
      maintainability: Math.max(0, 100 - issues.filter(i => i.type === 'maintainability').length * 5),
      reliability: Math.max(0, 100 - issues.filter(i => i.type === 'bug').length * 15),
      security: Math.max(0, 100 - issues.filter(i => i.type === 'security').length * 25),
      performance: Math.max(0, 100 - issues.filter(i => i.type === 'performance').length * 10),
      testability: Math.max(0, 100 - issues.filter(i => i.type === 'testing').length * 8),
      documentation: 80, // Placeholder
      codeStyle: Math.max(0, 100 - issues.filter(i => i.type === 'style').length * 2),
      complexity: {
        average: 5.2, // Placeholder
        highest: 12,
        distribution: { '1-5': 60, '6-10': 30, '11-15': 8, '16+': 2 }
      },
      duplication: {
        percentage: 5.2,
        blocks: issues.filter(i => i.title.includes('Duplication')).length
      },
      coverage: {
        statements: 75,
        branches: 68,
        functions: 82
      },
      dependencies: {
        outdated: 3,
        vulnerable: 1,
        unused: 2
      }
    };
  }

  private generateSummary(
    issues: CodeReviewIssue[],
    metrics: QualityMetrics
  ): ReviewAnalysisResult['summary'] {
    const totalIssues = issues.length;
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const autoFixableIssues = issues.filter(i => i.autoFixAvailable).length;
    
    const estimatedFixTime = issues.reduce((total, issue) => {
      const timeMap = { low: 15, medium: 45, high: 120 };
      return total + timeMap[issue.effort];
    }, 0);

    const qualityGrade = this.calculateQualityGrade(metrics.overall);
    
    const recommendations = this.generateRecommendationsFromIssues(issues, metrics);

    return {
      totalIssues,
      criticalIssues,
      autoFixableIssues,
      estimatedFixTime,
      recommendations,
      qualityGrade
    };
  }

  private calculateQualityGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private generateRecommendationsFromIssues(
    issues: CodeReviewIssue[],
    metrics: QualityMetrics
  ): string[] {
    const recommendations: string[] = [];
    
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    if (criticalCount > 0) {
      recommendations.push(`🔴 Address ${criticalCount} critical security/reliability issues immediately`);
    }
    
    const securityCount = issues.filter(i => i.type === 'security').length;
    if (securityCount > 0) {
      recommendations.push(`🔒 Review ${securityCount} security vulnerabilities`);
    }
    
    const performanceCount = issues.filter(i => i.type === 'performance').length;
    if (performanceCount > 3) {
      recommendations.push(`⚡ Optimize performance - ${performanceCount} issues found`);
    }
    
    if (metrics.complexity.average > 8) {
      recommendations.push(`📊 Reduce code complexity (current average: ${metrics.complexity.average})`);
    }
    
    const testingCount = issues.filter(i => i.type === 'testing').length;
    if (testingCount > 0) {
      recommendations.push(`🧪 Improve test coverage - ${testingCount} areas need attention`);
    }
    
    const autoFixCount = issues.filter(i => i.autoFixAvailable).length;
    if (autoFixCount > 0) {
      recommendations.push(`🔧 ${autoFixCount} issues can be auto-fixed`);
    }

    return recommendations;
  }

  // Helper methods
  private extractFunctions(code: string): Array<{ name: string; line: number; body: string }> {
    const functions: Array<{ name: string; line: number; body: string }> = [];
    const lines = code.split('\n');
    const functionRegex = /(?:function\s+(\w+)|(\w+)\s*[:=]\s*(?:async\s+)?function)/g;
    
    lines.forEach((line, index) => {
      let match;
      while ((match = functionRegex.exec(line)) !== null) {
        const functionName = match[1] || match[2];
        if (functionName) {
          const body = this.extractFunctionBody(lines, index);
          functions.push({
            name: functionName,
            line: index + 1,
            body
          });
        }
      }
    });

    return functions;
  }

  private extractFunctionBody(lines: string[], startLine: number): string {
    let braceCount = 0;
    let started = false;
    const bodyLines: string[] = [];

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      
      if (!started && line.includes('{')) {
        started = true;
      }
      
      if (started) {
        bodyLines.push(line);
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;
        
        if (braceCount === 0) {
          break;
        }
      }
    }

    return bodyLines.join('\n');
  }

  private calculateCyclomaticComplexity(code: string): number {
    const keywords = ['if', 'else', 'while', 'for', 'switch', 'case', 'catch', 'try'];
    return keywords.reduce((count, keyword) => {
      return count + (code.match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
    }, 1);
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(word => set2.has(word)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private async calculateTrends(
    issues: CodeReviewIssue[],
    metrics: QualityMetrics
  ): Promise<ReviewAnalysisResult['trends']> {
    // This would compare with previous analysis results
    // For now, return placeholder data
    return {
      previousScore: 82,
      improvement: metrics.overall - 82,
      newIssues: issues.filter(i => i.severity === 'high' || i.severity === 'critical').length,
      fixedIssues: 3
    };
  }

  private analyzeTrends(analyses: ReviewAnalysisResult[]): any[] {
    // Analyze trends across multiple analyses
    return [];
  }

  private identifyPatterns(analyses: ReviewAnalysisResult[]): any[] {
    // Identify common patterns across analyses
    return [];
  }

  private generateRecommendations(analyses: ReviewAnalysisResult[]): string[] {
    // Generate high-level recommendations
    return [];
  }

  private async applyAutoFix(issue: CodeReviewIssue): Promise<void> {
    if (!issue.autoFix) return;

    const content = await fs.readFile(issue.location.filePath, 'utf-8');
    const lines = content.split('\n');
    
    const lineIndex = issue.location.startLine - 1;
    lines[lineIndex] = issue.autoFix;
    
    await fs.writeFile(issue.location.filePath, lines.join('\n'), 'utf-8');
  }

  private async createBackup(issues: CodeReviewIssue[]): Promise<void> {
    const backupDir = `.review_backup_${Date.now()}`;
    await fs.mkdir(backupDir, { recursive: true });

    const uniqueFiles = [...new Set(issues.map(issue => issue.location.filePath))];
    
    for (const filePath of uniqueFiles) {
      const relativePath = path.relative(process.cwd(), filePath);
      const backupPath = path.join(backupDir, relativePath);
      
      await fs.mkdir(path.dirname(backupPath), { recursive: true });
      await fs.copyFile(filePath, backupPath);
    }
  }

  private generateMarkdownReport(analysis: ReviewAnalysisResult): string {
    let report = `# Code Review Analysis Report\n\n`;
    
    // Summary
    report += `## Summary\n\n`;
    report += `- **Overall Quality Score:** ${analysis.metrics.overall}/100 (Grade: ${analysis.summary.qualityGrade})\n`;
    report += `- **Total Issues:** ${analysis.summary.totalIssues}\n`;
    report += `- **Critical Issues:** ${analysis.summary.criticalIssues}\n`;
    report += `- **Auto-fixable Issues:** ${analysis.summary.autoFixableIssues}\n`;
    report += `- **Estimated Fix Time:** ${analysis.summary.estimatedFixTime} minutes\n\n`;

    // Quality Metrics
    report += `## Quality Metrics\n\n`;
    report += `| Metric | Score |\n`;
    report += `|--------|-------|\n`;
    report += `| Maintainability | ${analysis.metrics.maintainability}/100 |\n`;
    report += `| Reliability | ${analysis.metrics.reliability}/100 |\n`;
    report += `| Security | ${analysis.metrics.security}/100 |\n`;
    report += `| Performance | ${analysis.metrics.performance}/100 |\n`;
    report += `| Testability | ${analysis.metrics.testability}/100 |\n`;
    report += `| Code Style | ${analysis.metrics.codeStyle}/100 |\n\n`;

    // Recommendations
    if (analysis.summary.recommendations.length > 0) {
      report += `## Recommendations\n\n`;
      analysis.summary.recommendations.forEach(rec => {
        report += `- ${rec}\n`;
      });
      report += '\n';
    }

    // Issues by severity
    const issuesBySeverity = analysis.issues.reduce((acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    report += `## Issues by Severity\n\n`;
    Object.entries(issuesBySeverity).forEach(([severity, count]) => {
      const emoji = severity === 'critical' ? '🔴' : severity === 'high' ? '🟡' : severity === 'medium' ? '🟠' : '🟢';
      report += `- ${emoji} **${severity.toUpperCase()}**: ${count}\n`;
    });
    report += '\n';

    // Top issues
    const topIssues = analysis.issues.slice(0, 10);
    if (topIssues.length > 0) {
      report += `## Top Issues\n\n`;
      topIssues.forEach((issue, index) => {
        const emoji = issue.severity === 'critical' ? '🔴' : issue.severity === 'high' ? '🟡' : '🟠';
        report += `### ${index + 1}. ${emoji} ${issue.title}\n\n`;
        report += `**File:** ${path.basename(issue.location.filePath)}:${issue.location.startLine}\n`;
        report += `**Type:** ${issue.type}\n`;
        report += `**Severity:** ${issue.severity}\n\n`;
        report += `**Description:** ${issue.description}\n\n`;
        report += `**Suggestion:** ${issue.suggestion}\n\n`;
        if (issue.autoFixAvailable) {
          report += `✅ **Auto-fix available**\n\n`;
        }
        report += '---\n\n';
      });
    }

    return report;
  }

  private generateHTMLReport(analysis: ReviewAnalysisResult): string {
    // HTML report implementation
    return `<!DOCTYPE html><html><head><title>Code Review Report</title></head><body><h1>Code Review Analysis Report</h1><p>Total Issues: ${analysis.summary.totalIssues}</p></body></html>`;
  }

  private createEmptyMetrics(): QualityMetrics {
    return {
      overall: 0,
      maintainability: 0,
      reliability: 0,
      security: 0,
      performance: 0,
      testability: 0,
      documentation: 0,
      codeStyle: 0,
      complexity: { average: 0, highest: 0, distribution: {} },
      duplication: { percentage: 0, blocks: 0 },
      coverage: { statements: 0, branches: 0, functions: 0 },
      dependencies: { outdated: 0, vulnerable: 0, unused: 0 }
    };
  }

  private createEmptySummary(): ReviewAnalysisResult['summary'] {
    return {
      totalIssues: 0,
      criticalIssues: 0,
      autoFixableIssues: 0,
      estimatedFixTime: 0,
      recommendations: [],
      qualityGrade: 'F'
    };
  }
}

export const codeReviewAnalyzerTool = new CodeReviewAnalyzerTool();