// Self-Healing Code Validator - Automatically fixes common coding issues
import pino from 'pino';
import { readFile, writeFile } from 'fs/promises';
import { parse as parseJS } from '@babel/parser';
import generate from '@babel/generator';
import { glob } from 'glob';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ValidationReport {
  filePath: string;
  issues: CodeIssue[];
  fixesApplied: CodeFix[];
  codeQualityScore: number;
  beforeAfterMetrics: QualityMetrics;
  autoFixable: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface CodeIssue {
  id: string;
  type: IssueType;
  severity: 'error' | 'warning' | 'info';
  line: number;
  column?: number;
  message: string;
  rule: string;
  fixable: boolean;
  suggestion?: string;
  codeSnippet: string;
}

export interface CodeFix {
  issueId: string;
  fixType: FixType;
  description: string;
  beforeCode: string;
  afterCode: string;
  confidence: number; // 0-1 scale
  appliedSuccessfully: boolean;
  reasoning: string;
}

export interface QualityMetrics {
  linesOfCode: number;
  cyclomaticComplexity: number;
  maintainabilityIndex: number;
  codeSmells: number;
  duplicatedLines: number;
  cognitiveComplexity: number;
}

export type IssueType = 
  | 'syntax-error'
  | 'type-error' 
  | 'unused-variable'
  | 'unused-import'
  | 'missing-semicolon'
  | 'inconsistent-formatting'
  | 'magic-number'
  | 'long-function'
  | 'complex-condition'
  | 'duplicate-code'
  | 'security-vulnerability'
  | 'performance-issue'
  | 'accessibility-issue'
  | 'best-practice-violation';

export type FixType =
  | 'remove-unused'
  | 'add-semicolon'
  | 'format-code'
  | 'extract-constant'
  | 'extract-function'
  | 'simplify-condition'
  | 'update-syntax'
  | 'add-type-annotation'
  | 'remove-duplicate'
  | 'security-fix'
  | 'performance-optimization';

export interface ProjectValidationReport {
  projectPath: string;
  totalFiles: number;
  filesProcessed: number;
  totalIssues: number;
  issuesFixed: number;
  overallQualityScore: number;
  fileReports: ValidationReport[];
  summary: ValidationSummary;
}

export interface ValidationSummary {
  issuesByType: Record<IssueType, number>;
  fixesByType: Record<FixType, number>;
  qualityTrend: 'improving' | 'stable' | 'declining';
  recommendations: string[];
  topIssues: CodeIssue[];
}

export class SelfHealingCodeValidator {
  private fixRules = new Map<IssueType, FixRule>();
  private qualityThresholds = {
    maintainabilityIndex: 70,
    cyclomaticComplexity: 10,
    functionLength: 50,
    cognitiveComplexity: 15
  };

  constructor() {
    this.initializeFixRules();
  }

  async validateAndFixProject(projectPath: string): Promise<ProjectValidationReport> {
    log.info('Starting self-healing validation for project');

    const files = await this.getSourceFiles(projectPath);
    const fileReports: ValidationReport[] = [];
    let totalIssues = 0;
    let issuesFixed = 0;

    for (const file of files) {
      try {
        const report = await this.validateAndFixFile(file);
        fileReports.push(report);
        totalIssues += report.issues.length;
        issuesFixed += report.fixesApplied.length;
      } catch (error) {
        log.warn(`Failed to process file ${file}: ${error}`);
      }
    }

    const overallQualityScore = this.calculateOverallQualityScore(fileReports);
    const summary = this.generateSummary(fileReports);

    return {
      projectPath,
      totalFiles: files.length,
      filesProcessed: fileReports.length,
      totalIssues,
      issuesFixed,
      overallQualityScore,
      fileReports,
      summary
    };
  }

  async validateAndFixFile(filePath: string): Promise<ValidationReport> {
    log.debug(`Validating file: ${filePath}`);

    const originalContent = await readFile(filePath, 'utf-8');
    const beforeMetrics = await this.calculateMetrics(originalContent, filePath);
    
    const issues = await this.detectIssues(originalContent, filePath);
    const { fixedContent, fixesApplied } = await this.applyFixes(originalContent, issues, filePath);
    
    const afterMetrics = await this.calculateMetrics(fixedContent, filePath);
    const codeQualityScore = this.calculateQualityScore(afterMetrics);
    
    // Write fixed content back to file if fixes were applied
    if (fixesApplied.length > 0 && this.shouldApplyFixes(fixesApplied)) {
      await writeFile(filePath, fixedContent);
    }

    return {
      filePath,
      issues,
      fixesApplied,
      codeQualityScore,
      beforeAfterMetrics: {
        before: beforeMetrics,
        after: afterMetrics
      } as any,
      autoFixable: issues.every(issue => issue.fixable),
      riskLevel: this.assessRiskLevel(issues, fixesApplied)
    };
  }

  private initializeFixRules(): void {
    // Unused variable/import fixes
    this.fixRules.set('unused-variable', {
      canFix: true,
      confidence: 0.9,
      apply: this.fixUnusedVariable.bind(this)
    });

    this.fixRules.set('unused-import', {
      canFix: true,
      confidence: 0.95,
      apply: this.fixUnusedImport.bind(this)
    });

    // Syntax fixes
    this.fixRules.set('missing-semicolon', {
      canFix: true,
      confidence: 0.98,
      apply: this.fixMissingSemicolon.bind(this)
    });

    // Formatting fixes
    this.fixRules.set('inconsistent-formatting', {
      canFix: true,
      confidence: 0.85,
      apply: this.fixFormatting.bind(this)
    });

    // Code quality fixes
    this.fixRules.set('magic-number', {
      canFix: true,
      confidence: 0.7,
      apply: this.fixMagicNumber.bind(this)
    });

    this.fixRules.set('long-function', {
      canFix: true,
      confidence: 0.6,
      apply: this.fixLongFunction.bind(this)
    });

    this.fixRules.set('complex-condition', {
      canFix: true,
      confidence: 0.75,
      apply: this.fixComplexCondition.bind(this)
    });

    // Security fixes
    this.fixRules.set('security-vulnerability', {
      canFix: true,
      confidence: 0.8,
      apply: this.fixSecurityVulnerability.bind(this)
    });

    // Performance fixes
    this.fixRules.set('performance-issue', {
      canFix: true,
      confidence: 0.7,
      apply: this.fixPerformanceIssue.bind(this)
    });
  }

  private async getSourceFiles(projectPath: string): Promise<string[]> {
    const patterns = ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'];
    const files: string[] = [];

    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: projectPath,
        ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**'],
        absolute: true
      });
      files.push(...matches);
    }

    return files;
  }

  private async detectIssues(content: string, filePath: string): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];
    
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

      // AST-based issue detection
      issues.push(...this.detectUnusedVariables(ast, content));
      issues.push(...this.detectUnusedImports(ast, content));
      issues.push(...this.detectLongFunctions(ast));
      issues.push(...this.detectComplexConditions(ast));
      issues.push(...this.detectMagicNumbers(ast));
      issues.push(...this.detectSecurityIssues(ast, content));
      issues.push(...this.detectPerformanceIssues(ast, content));
      
    } catch (error) {
      log.debug(`AST parsing failed for ${filePath}, using regex analysis`);
      // Fallback to regex-based detection
      issues.push(...this.detectIssuesWithRegex(content, filePath));
    }

    // Text-based issue detection
    issues.push(...this.detectFormattingIssues(content));
    issues.push(...this.detectMissingSemicolons(content));
    issues.push(...this.detectDuplicateCode(content));

    return issues;
  }

  private detectUnusedVariables(ast: any, content: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const declaredVariables = new Map<string, any>();
    const usedVariables = new Set<string>();

    // Find all variable declarations
    this.traverseAST(ast, (node: any) => {
      if (node.type === 'VariableDeclarator' && node.id?.name) {
        declaredVariables.set(node.id.name, node);
      }
    });

    // Find all variable usage
    this.traverseAST(ast, (node: any) => {
      if (node.type === 'Identifier' && node.name) {
        usedVariables.add(node.name);
      }
    });

    // Find unused variables
    for (const [varName, node] of declaredVariables) {
      if (!usedVariables.has(varName) && !varName.startsWith('_')) {
        issues.push({
          id: `unused-var-${varName}-${node.loc?.start?.line}`,
          type: 'unused-variable',
          severity: 'warning',
          line: node.loc?.start?.line || 0,
          column: node.loc?.start?.column || 0,
          message: `Variable '${varName}' is declared but never used`,
          rule: 'no-unused-vars',
          fixable: true,
          suggestion: `Remove unused variable '${varName}'`,
          codeSnippet: this.extractCodeSnippet(content, node.loc?.start?.line || 0)
        });
      }
    }

    return issues;
  }

  private detectUnusedImports(ast: any, content: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const importedNames = new Map<string, any>();
    const usedNames = new Set<string>();

    // Find all imports
    this.traverseAST(ast, (node: any) => {
      if (node.type === 'ImportDeclaration') {
        node.specifiers?.forEach((spec: any) => {
          if (spec.local?.name) {
            importedNames.set(spec.local.name, { node, spec });
          }
        });
      }
    });

    // Find usage of imported names
    this.traverseAST(ast, (node: any) => {
      if (node.type === 'Identifier' && node.name) {
        usedNames.add(node.name);
      }
    });

    // Find unused imports
    for (const [importName, info] of importedNames) {
      if (!usedNames.has(importName)) {
        issues.push({
          id: `unused-import-${importName}-${info.node.loc?.start?.line}`,
          type: 'unused-import',
          severity: 'warning',
          line: info.node.loc?.start?.line || 0,
          message: `Import '${importName}' is declared but never used`,
          rule: 'no-unused-imports',
          fixable: true,
          suggestion: `Remove unused import '${importName}'`,
          codeSnippet: this.extractCodeSnippet(content, info.node.loc?.start?.line || 0)
        });
      }
    }

    return issues;
  }

  private detectLongFunctions(ast: any): CodeIssue[] {
    const issues: CodeIssue[] = [];

    this.traverseAST(ast, (node: any) => {
      if ((node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') && node.body) {
        const functionLength = (node.loc?.end?.line || 0) - (node.loc?.start?.line || 0);
        
        if (functionLength > this.qualityThresholds.functionLength) {
          const funcName = node.id?.name || 'anonymous function';
          issues.push({
            id: `long-function-${funcName}-${node.loc?.start?.line}`,
            type: 'long-function',
            severity: 'warning',
            line: node.loc?.start?.line || 0,
            message: `Function '${funcName}' is too long (${functionLength} lines)`,
            rule: 'max-function-length',
            fixable: true,
            suggestion: `Consider breaking down the function into smaller functions`,
            codeSnippet: `function ${funcName}(...) { /* ${functionLength} lines */ }`
          });
        }
      }
    });

    return issues;
  }

  private detectComplexConditions(ast: any): CodeIssue[] {
    const issues: CodeIssue[] = [];

    this.traverseAST(ast, (node: any) => {
      if (node.type === 'IfStatement' || node.type === 'ConditionalExpression') {
        const complexity = this.calculateConditionComplexity(node.test);
        
        if (complexity > 5) {
          issues.push({
            id: `complex-condition-${node.loc?.start?.line}`,
            type: 'complex-condition',
            severity: 'warning',
            line: node.loc?.start?.line || 0,
            message: `Condition is too complex (complexity: ${complexity})`,
            rule: 'max-condition-complexity',
            fixable: true,
            suggestion: `Break down complex condition into simpler conditions`,
            codeSnippet: 'Complex conditional expression'
          });
        }
      }
    });

    return issues;
  }

  private detectMagicNumbers(ast: any): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const allowedNumbers = new Set([0, 1, -1, 2, 10, 100, 1000]);

    this.traverseAST(ast, (node: any) => {
      if (node.type === 'Literal' && typeof node.value === 'number') {
        if (!allowedNumbers.has(node.value) && Math.abs(node.value) > 1) {
          issues.push({
            id: `magic-number-${node.value}-${node.loc?.start?.line}`,
            type: 'magic-number',
            severity: 'info',
            line: node.loc?.start?.line || 0,
            message: `Magic number ${node.value} should be replaced with a named constant`,
            rule: 'no-magic-numbers',
            fixable: true,
            suggestion: `Extract ${node.value} to a named constant`,
            codeSnippet: `${node.value}`
          });
        }
      }
    });

    return issues;
  }

  private detectSecurityIssues(ast: any, content: string): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Detect eval usage
    this.traverseAST(ast, (node: any) => {
      if (node.type === 'CallExpression' && node.callee?.name === 'eval') {
        issues.push({
          id: `security-eval-${node.loc?.start?.line}`,
          type: 'security-vulnerability',
          severity: 'error',
          line: node.loc?.start?.line || 0,
          message: 'Use of eval() is a security risk',
          rule: 'no-eval',
          fixable: true,
          suggestion: 'Replace eval() with safer alternatives',
          codeSnippet: 'eval(...)'
        });
      }
    });

    // Detect potential XSS
    if (content.includes('innerHTML')) {
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('innerHTML') && !line.includes('textContent')) {
          issues.push({
            id: `security-xss-${index + 1}`,
            type: 'security-vulnerability',
            severity: 'warning',
            line: index + 1,
            message: 'Potential XSS vulnerability with innerHTML',
            rule: 'no-unsafe-innerhtml',
            fixable: true,
            suggestion: 'Use textContent or sanitize HTML',
            codeSnippet: line.trim()
          });
        }
      });
    }

    return issues;
  }

  private detectPerformanceIssues(ast: any, content: string): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Detect inefficient loops
    this.traverseAST(ast, (node: any) => {
      if (node.type === 'ForStatement' && node.test?.right?.property?.name === 'length') {
        issues.push({
          id: `performance-loop-${node.loc?.start?.line}`,
          type: 'performance-issue',
          severity: 'info',
          line: node.loc?.start?.line || 0,
          message: 'Loop condition accesses array length on each iteration',
          rule: 'efficient-loops',
          fixable: true,
          suggestion: 'Cache array length in a variable',
          codeSnippet: 'for (...; i < array.length; ...)'
        });
      }
    });

    // Detect synchronous file operations
    if (content.includes('readFileSync') || content.includes('writeFileSync')) {
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('Sync')) {
          issues.push({
            id: `performance-sync-${index + 1}`,
            type: 'performance-issue',
            severity: 'warning',
            line: index + 1,
            message: 'Synchronous file operation blocks the event loop',
            rule: 'no-sync-operations',
            fixable: true,
            suggestion: 'Use asynchronous file operations',
            codeSnippet: line.trim()
          });
        }
      });
    }

    return issues;
  }

  private detectFormattingIssues(content: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Mixed tabs and spaces
      if (line.includes('\t') && line.includes('  ')) {
        issues.push({
          id: `formatting-mixed-${index + 1}`,
          type: 'inconsistent-formatting',
          severity: 'info',
          line: index + 1,
          message: 'Mixed tabs and spaces for indentation',
          rule: 'consistent-indentation',
          fixable: true,
          suggestion: 'Use consistent indentation (spaces or tabs)',
          codeSnippet: line
        });
      }

      // Trailing whitespace
      if (line.endsWith(' ') || line.endsWith('\t')) {
        issues.push({
          id: `formatting-trailing-${index + 1}`,
          type: 'inconsistent-formatting',
          severity: 'info',
          line: index + 1,
          message: 'Trailing whitespace',
          rule: 'no-trailing-spaces',
          fixable: true,
          suggestion: 'Remove trailing whitespace',
          codeSnippet: line
        });
      }
    });

    return issues;
  }

  private detectMissingSemicolons(content: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed && 
          !trimmed.endsWith(';') && 
          !trimmed.endsWith('{') && 
          !trimmed.endsWith('}') &&
          !trimmed.startsWith('//') &&
          !trimmed.startsWith('*') &&
          (trimmed.startsWith('const ') || 
           trimmed.startsWith('let ') || 
           trimmed.startsWith('var ') ||
           trimmed.includes('return '))) {
        
        issues.push({
          id: `semicolon-${index + 1}`,
          type: 'missing-semicolon',
          severity: 'warning',
          line: index + 1,
          message: 'Missing semicolon',
          rule: 'semi',
          fixable: true,
          suggestion: 'Add semicolon at end of statement',
          codeSnippet: trimmed
        });
      }
    });

    return issues;
  }

  private detectDuplicateCode(content: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = content.split('\n');
    const lineGroups = new Map<string, number[]>();

    // Group similar lines
    lines.forEach((line, index) => {
      const normalized = line.trim().replace(/\s+/g, ' ');
      if (normalized.length > 10) { // Only check meaningful lines
        if (!lineGroups.has(normalized)) {
          lineGroups.set(normalized, []);
        }
        lineGroups.get(normalized)!.push(index + 1);
      }
    });

    // Find duplicates
    for (const [line, lineNumbers] of lineGroups) {
      if (lineNumbers.length > 1) {
        lineNumbers.forEach(lineNum => {
          issues.push({
            id: `duplicate-${lineNum}`,
            type: 'duplicate-code',
            severity: 'info',
            line: lineNum,
            message: `Duplicate code found at lines ${lineNumbers.join(', ')}`,
            rule: 'no-duplicate-code',
            fixable: true,
            suggestion: 'Extract duplicate code to a reusable function',
            codeSnippet: line
          });
        });
      }
    }

    return issues;
  }

  private detectIssuesWithRegex(content: string, filePath: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    
    // Basic regex-based checks as fallback
    const patterns = [
      {
        regex: /console\.log\(/g,
        type: 'best-practice-violation' as IssueType,
        message: 'console.log statement found',
        suggestion: 'Remove console.log or use proper logging'
      },
      {
        regex: /debugger;/g,
        type: 'best-practice-violation' as IssueType,
        message: 'debugger statement found',
        suggestion: 'Remove debugger statement'
      }
    ];

    const lines = content.split('\n');
    patterns.forEach(pattern => {
      lines.forEach((line, index) => {
        if (pattern.regex.test(line)) {
          issues.push({
            id: `regex-${pattern.type}-${index + 1}`,
            type: pattern.type,
            severity: 'warning',
            line: index + 1,
            message: pattern.message,
            rule: 'regex-check',
            fixable: false,
            suggestion: pattern.suggestion,
            codeSnippet: line.trim()
          });
        }
      });
    });

    return issues;
  }

  private async applyFixes(
    content: string,
    issues: CodeIssue[],
    filePath: string
  ): Promise<{ fixedContent: string; fixesApplied: CodeFix[] }> {
    let fixedContent = content;
    const fixesApplied: CodeFix[] = [];

    // Sort issues by line number (descending) to avoid line number shifts
    const sortedIssues = [...issues].sort((a, b) => b.line - a.line);

    for (const issue of sortedIssues) {
      if (issue.fixable && this.fixRules.has(issue.type)) {
        const rule = this.fixRules.get(issue.type)!;
        
        try {
          const fixResult = await rule.apply(fixedContent, issue, filePath);
          if (fixResult.success) {
            fixedContent = fixResult.content;
            fixesApplied.push({
              issueId: issue.id,
              fixType: this.getFixType(issue.type),
              description: fixResult.description,
              beforeCode: issue.codeSnippet,
              afterCode: fixResult.afterSnippet || 'Fixed',
              confidence: rule.confidence,
              appliedSuccessfully: true,
              reasoning: fixResult.reasoning || 'Automatic fix applied'
            });
          }
        } catch (error) {
          log.warn(`Failed to apply fix for issue ${issue.id}: ${error}`);
          fixesApplied.push({
            issueId: issue.id,
            fixType: this.getFixType(issue.type),
            description: `Failed to fix: ${error}`,
            beforeCode: issue.codeSnippet,
            afterCode: issue.codeSnippet,
            confidence: 0,
            appliedSuccessfully: false,
            reasoning: `Fix failed: ${error}`
          });
        }
      }
    }

    return { fixedContent, fixesApplied };
  }

  // Fix implementations
  private async fixUnusedVariable(content: string, issue: CodeIssue, filePath: string): Promise<FixResult> {
    const lines = content.split('\n');
    const lineIndex = issue.line - 1;
    const line = lines[lineIndex] || '';
    
    // Remove the entire variable declaration
    const varMatch = line.match(/(const|let|var)\s+(\w+)/);
    if (varMatch) {
      const varName = varMatch[2] || '';
      // Remove the line if it's just a variable declaration
      if (line.trim().startsWith(varMatch[0] || '') && line.includes(varName)) {
        lines.splice(lineIndex, 1);
        return {
          success: true,
          content: lines.join('\n'),
          description: `Removed unused variable '${varName}'`,
          reasoning: 'Variable was declared but never used'
        };
      }
    }

    return { success: false, content, description: 'Could not safely remove variable' };
  }

  private async fixUnusedImport(content: string, issue: CodeIssue, filePath: string): Promise<FixResult> {
    const lines = content.split('\n');
    const lineIndex = issue.line - 1;
    const line = lines[lineIndex] || '';
    
    // Remove the import line
    if (line.trim().startsWith('import ')) {
      lines.splice(lineIndex, 1);
      return {
        success: true,
        content: lines.join('\n'),
        description: 'Removed unused import',
        reasoning: 'Import was not used anywhere in the file'
      };
    }

    return { success: false, content, description: 'Could not remove import' };
  }

  private async fixMissingSemicolon(content: string, issue: CodeIssue, filePath: string): Promise<FixResult> {
    const lines = content.split('\n');
    const lineIndex = issue.line - 1;
    const line = lines[lineIndex] || '';
    
    if (!line.trim().endsWith(';')) {
      lines[lineIndex] = line + ';';
      return {
        success: true,
        content: lines.join('\n'),
        description: 'Added missing semicolon',
        reasoning: 'Semicolon required for statement termination'
      };
    }

    return { success: false, content, description: 'Semicolon already present' };
  }

  private async fixFormatting(content: string, issue: CodeIssue, filePath: string): Promise<FixResult> {
    const lines = content.split('\n');
    const lineIndex = issue.line - 1;
    let line = lines[lineIndex] || '';
    
    // Fix mixed tabs and spaces
    if (line.includes('\t') && line.includes('  ')) {
      line = line.replace(/\t/g, '  '); // Convert tabs to spaces
    }
    
    // Remove trailing whitespace
    line = line.trimEnd();
    
    lines[lineIndex] = line;
    
    return {
      success: true,
      content: lines.join('\n'),
      description: 'Fixed formatting issues',
      reasoning: 'Standardized indentation and removed trailing whitespace'
    };
  }

  private async fixMagicNumber(content: string, issue: CodeIssue, filePath: string): Promise<FixResult> {
    // Extract the magic number from the issue
    const numberMatch = issue.message.match(/Magic number (\d+)/);
    if (!numberMatch) {
      return { success: false, content, description: 'Could not identify magic number' };
    }

    const magicNumber = numberMatch[1];
    const constantName = this.generateConstantName(magicNumber || '0', issue.codeSnippet);
    
    // Add constant declaration at the top of the file
    const lines = content.split('\n');
    const constantDeclaration = `const ${constantName} = ${magicNumber};`;
    
    // Find a good place to insert the constant (after imports)
    let insertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (!(lines[i]?.trim().startsWith('import ')) && !(lines[i]?.trim().startsWith('//'))) {
        insertIndex = i;
        break;
      }
    }
    
    lines.splice(insertIndex, 0, constantDeclaration);
    
    // Replace the magic number with the constant
    const newContent = lines.join('\n').replace(
      new RegExp(`\\b${magicNumber}\\b`, 'g'),
      constantName
    );
    
    return {
      success: true,
      content: newContent,
      description: `Extracted magic number ${magicNumber} to constant ${constantName}`,
      reasoning: 'Magic numbers should be replaced with named constants for better maintainability'
    };
  }

  private async fixLongFunction(content: string, issue: CodeIssue, filePath: string): Promise<FixResult> {
    // This is a complex refactoring that would require more sophisticated analysis
    // For now, return a suggestion rather than an automatic fix
    return {
      success: false,
      content,
      description: 'Function too long - manual refactoring recommended',
      reasoning: 'Automatic function extraction requires semantic analysis'
    };
  }

  private async fixComplexCondition(content: string, issue: CodeIssue, filePath: string): Promise<FixResult> {
    // Extract complex condition to a well-named variable/function
    const lines = content.split('\n');
    const lineIndex = issue.line - 1;
    const line = lines[lineIndex] || '';
    
    // Simple fix: extract condition to a variable
    const conditionMatch = line.match(/if\s*\(([^)]+)\)/);
    if (conditionMatch) {
      const condition = conditionMatch[1];
      const variableName = 'isConditionMet'; // Could be more semantic
      
      lines.splice(lineIndex, 0, `    const ${variableName} = ${condition};`);
      lines[lineIndex + 1] = line.replace(conditionMatch[0], `if (${variableName})`);
      
      return {
        success: true,
        content: lines.join('\n'),
        description: 'Extracted complex condition to variable',
        reasoning: 'Complex conditions are easier to read when extracted to named variables'
      };
    }

    return { success: false, content, description: 'Could not extract condition' };
  }

  private async fixSecurityVulnerability(content: string, issue: CodeIssue, filePath: string): Promise<FixResult> {
    if (issue.message.includes('eval()')) {
      // Replace eval with JSON.parse for simple cases
      const newContent = content.replace(
        /eval\s*\(\s*([^)]+)\s*\)/g,
        'JSON.parse($1)'
      );
      
      return {
        success: true,
        content: newContent,
        description: 'Replaced eval() with JSON.parse()',
        reasoning: 'eval() is a security risk - JSON.parse() is safer for parsing JSON'
      };
    }

    if (issue.message.includes('innerHTML')) {
      const lines = content.split('\n');
      const lineIndex = issue.line - 1;
      const line = lines[lineIndex] || '';
      
      // Replace innerHTML with textContent for simple cases
      const newLine = line.replace(/\.innerHTML\s*=/, '.textContent =');
      lines[lineIndex] = newLine;
      
      return {
        success: true,
        content: lines.join('\n'),
        description: 'Replaced innerHTML with textContent',
        reasoning: 'textContent is safer than innerHTML for text content'
      };
    }

    return { success: false, content, description: 'Manual security review required' };
  }

  private async fixPerformanceIssue(content: string, issue: CodeIssue, filePath: string): Promise<FixResult> {
    if (issue.message.includes('array length')) {
      const lines = content.split('\n');
      const lineIndex = issue.line - 1;
      const line = lines[lineIndex] || '';
      
      // Cache array length
      const forMatch = line.match(/for\s*\([^;]*;\s*([^<]+)<\s*([^.]+)\.length/);
      if (forMatch) {
        const arrayName = forMatch[2];
        const lengthVar = `${arrayName}Length`;
        
        lines.splice(lineIndex, 0, `    const ${lengthVar} = ${arrayName}.length;`);
        lines[lineIndex + 1] = line.replace(`${arrayName}.length`, lengthVar);
        
        return {
          success: true,
          content: lines.join('\n'),
          description: 'Cached array length in loop',
          reasoning: 'Caching array length improves loop performance'
        };
      }
    }

    return { success: false, content, description: 'Manual performance optimization needed' };
  }

  // Utility methods
  private traverseAST(node: any, visitor: (node: any) => void): void {
    if (!node || typeof node !== 'object') return;

    visitor(node);

    for (const key in node) {
      if (key !== 'parent' && node[key]) {
        if (Array.isArray(node[key])) {
          node[key].forEach((child: any) => this.traverseAST(child, visitor));
        } else if (typeof node[key] === 'object') {
          this.traverseAST(node[key], visitor);
        }
      }
    }
  }

  private calculateConditionComplexity(node: any): number {
    if (!node) return 0;
    
    let complexity = 1;
    
    if (node.type === 'LogicalExpression') {
      complexity += this.calculateConditionComplexity(node.left);
      complexity += this.calculateConditionComplexity(node.right);
    }
    
    return complexity;
  }

  private extractCodeSnippet(content: string, lineNumber: number): string {
    const lines = content.split('\n');
    return lines[lineNumber - 1]?.trim() || '';
  }

  private getFixType(issueType: IssueType): FixType {
    const mapping: Record<IssueType, FixType> = {
      'unused-variable': 'remove-unused',
      'unused-import': 'remove-unused',
      'missing-semicolon': 'add-semicolon',
      'inconsistent-formatting': 'format-code',
      'magic-number': 'extract-constant',
      'long-function': 'extract-function',
      'complex-condition': 'simplify-condition',
      'security-vulnerability': 'security-fix',
      'performance-issue': 'performance-optimization',
      'syntax-error': 'update-syntax',
      'type-error': 'add-type-annotation',
      'duplicate-code': 'remove-duplicate',
      'accessibility-issue': 'update-syntax',
      'best-practice-violation': 'update-syntax'
    };
    
    return mapping[issueType] || 'update-syntax';
  }

  private generateConstantName(value: string, context: string): string {
    // Generate a meaningful constant name based on context
    if (context.includes('timeout') || context.includes('delay')) {
      return `TIMEOUT_${value}_MS`;
    }
    if (context.includes('limit') || context.includes('max')) {
      return `MAX_${value}`;
    }
    if (context.includes('min')) {
      return `MIN_${value}`;
    }
    
    return `CONSTANT_${value}`;
  }

  private shouldApplyFixes(fixes: CodeFix[]): boolean {
    // Only apply fixes if they have high confidence and low risk
    return fixes.every(fix => fix.confidence > 0.8) && 
           fixes.length < 10; // Don't apply too many fixes at once
  }

  private assessRiskLevel(issues: CodeIssue[], fixes: CodeFix[]): 'low' | 'medium' | 'high' {
    const securityIssues = issues.filter(i => i.type === 'security-vulnerability').length;
    const errorIssues = issues.filter(i => i.severity === 'error').length;
    const complexFixes = fixes.filter(f => f.confidence < 0.7).length;
    
    if (securityIssues > 0 || errorIssues > 2) return 'high';
    if (complexFixes > 0 || issues.length > 10) return 'medium';
    return 'low';
  }

  private async calculateMetrics(content: string, filePath: string): Promise<QualityMetrics> {
    const lines = content.split('\n');
    const linesOfCode = lines.filter(line => line.trim() && !line.trim().startsWith('//')).length;
    
    try {
      const ast = parseJS(content, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        plugins: ['typescript', 'jsx']
      });
      
      const cyclomaticComplexity = this.calculateCyclomaticComplexity(ast);
      const cognitiveComplexity = this.calculateCognitiveComplexity(ast);
      
      return {
        linesOfCode,
        cyclomaticComplexity,
        maintainabilityIndex: this.calculateMaintainabilityIndex(linesOfCode, cyclomaticComplexity),
        codeSmells: this.countCodeSmells(ast),
        duplicatedLines: this.calculateDuplicatedLines(content),
        cognitiveComplexity
      };
    } catch (error) {
      // Fallback metrics
      return {
        linesOfCode,
        cyclomaticComplexity: 1,
        maintainabilityIndex: 50,
        codeSmells: 0,
        duplicatedLines: 0,
        cognitiveComplexity: 1
      };
    }
  }

  private calculateCyclomaticComplexity(ast: any): number {
    let complexity = 1;
    
    this.traverseAST(ast, (node: any) => {
      const complexityNodes = [
        'IfStatement', 'ConditionalExpression', 'SwitchStatement', 'SwitchCase',
        'WhileStatement', 'DoWhileStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement',
        'TryStatement', 'CatchClause', 'LogicalExpression'
      ];
      
      if (complexityNodes.includes(node.type)) {
        complexity++;
      }
    });
    
    return complexity;
  }

  private calculateCognitiveComplexity(ast: any): number {
    // Simplified cognitive complexity calculation
    let complexity = 0;
    
    this.traverseAST(ast, (node: any) => {
      if (node.type === 'IfStatement') complexity += 1;
      if (node.type === 'SwitchStatement') complexity += 1;
      if (node.type === 'ForStatement') complexity += 1;
      if (node.type === 'WhileStatement') complexity += 1;
    });
    
    return complexity;
  }

  private calculateMaintainabilityIndex(linesOfCode: number, complexity: number): number {
    // Simplified maintainability index
    const halsteadVolume = Math.log2(linesOfCode + 1) * 10;
    let index = 171 - 5.2 * Math.log(halsteadVolume) - 0.23 * complexity - 16.2 * Math.log(linesOfCode + 1);
    return Math.max(0, Math.min(100, index));
  }

  private countCodeSmells(ast: any): number {
    let smells = 0;
    
    this.traverseAST(ast, (node: any) => {
      // Long parameter lists
      if (node.type === 'FunctionDeclaration' && node.params?.length > 5) {
        smells++;
      }
      
      // Deeply nested code
      // This would require tracking nesting depth
    });
    
    return smells;
  }

  private calculateDuplicatedLines(content: string): number {
    const lines = content.split('\n');
    const lineCount = new Map<string, number>();
    
    lines.forEach(line => {
      const normalized = line.trim();
      if (normalized.length > 5) {
        lineCount.set(normalized, (lineCount.get(normalized) || 0) + 1);
      }
    });
    
    let duplicated = 0;
    for (const count of lineCount.values()) {
      if (count > 1) {
        duplicated += count - 1;
      }
    }
    
    return duplicated;
  }

  private calculateQualityScore(metrics: QualityMetrics): number {
    let score = 100;
    
    // Penalize high complexity
    if (metrics.cyclomaticComplexity > this.qualityThresholds.cyclomaticComplexity) {
      score -= (metrics.cyclomaticComplexity - this.qualityThresholds.cyclomaticComplexity) * 2;
    }
    
    // Penalize low maintainability
    if (metrics.maintainabilityIndex < this.qualityThresholds.maintainabilityIndex) {
      score -= (this.qualityThresholds.maintainabilityIndex - metrics.maintainabilityIndex) * 0.5;
    }
    
    // Penalize code smells
    score -= metrics.codeSmells * 5;
    
    // Penalize duplicated code
    score -= metrics.duplicatedLines * 0.5;
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateOverallQualityScore(reports: ValidationReport[]): number {
    if (reports.length === 0) return 0;
    
    const totalScore = reports.reduce((sum, report) => sum + report.codeQualityScore, 0);
    return totalScore / reports.length;
  }

  private generateSummary(reports: ValidationReport[]): ValidationSummary {
    const issuesByType: Record<IssueType, number> = {} as any;
    const fixesByType: Record<FixType, number> = {} as any;
    const allIssues: CodeIssue[] = [];

    reports.forEach(report => {
      report.issues.forEach(issue => {
        issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
        allIssues.push(issue);
      });
      
      report.fixesApplied.forEach(fix => {
        fixesByType[fix.fixType] = (fixesByType[fix.fixType] || 0) + 1;
      });
    });

    const topIssues = allIssues
      .filter(issue => issue.severity === 'error')
      .slice(0, 10);

    const qualityScores = reports.map(r => r.codeQualityScore);
    const avgQuality = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
    
    const recommendations = this.generateQualityRecommendations(issuesByType, avgQuality);

    return {
      issuesByType,
      fixesByType,
      qualityTrend: avgQuality > 70 ? 'improving' : avgQuality > 50 ? 'stable' : 'declining',
      recommendations,
      topIssues
    };
  }

  private generateQualityRecommendations(issuesByType: Record<IssueType, number>, avgQuality: number): string[] {
    const recommendations: string[] = [];

    if (avgQuality < 50) {
      recommendations.push('Code quality is below acceptable standards - consider refactoring');
    }

    if ((issuesByType['security-vulnerability'] || 0) > 0) {
      recommendations.push('Address security vulnerabilities immediately');
    }

    if ((issuesByType['performance-issue'] || 0) > 5) {
      recommendations.push('Multiple performance issues detected - consider optimization');
    }

    if ((issuesByType['long-function'] || 0) > 3) {
      recommendations.push('Break down large functions into smaller, focused functions');
    }

    if ((issuesByType['duplicate-code'] || 0) > 5) {
      recommendations.push('Reduce code duplication by extracting common functionality');
    }

    return recommendations;
  }
}

interface FixRule {
  canFix: boolean;
  confidence: number;
  apply: (content: string, issue: CodeIssue, filePath: string) => Promise<FixResult>;
}

interface FixResult {
  success: boolean;
  content: string;
  description: string;
  reasoning?: string;
  afterSnippet?: string;
}

export default SelfHealingCodeValidator;