// Dead Code Detector - Identifies and safely removes unused code
import pino from 'pino';
import { readFile } from 'fs/promises';
import { parse as parseJS } from '@babel/parser';
import { join } from 'path';
import { glob } from 'glob';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface DeadCodeAnalysis {
  path: string;
  deadCode: DeadCodeItem[];
  unreachableCode: UnreachableCodeItem[];
  unusedExports: UnusedExport[];
  safeDeletions: SafeDeletion[];
  riskAssessment: RiskAssessment;
}

export interface DeadCodeItem {
  type: 'function' | 'variable' | 'class' | 'import' | 'property';
  name: string;
  lineStart: number;
  lineEnd: number;
  confidence: number; // 0-1, how confident we are it's dead
  reason: string;
  dependencies: string[]; // What this code depends on
  dependents: string[]; // What depends on this code
}

export interface UnreachableCodeItem {
  type: 'after-return' | 'in-false-condition' | 'after-throw' | 'in-dead-branch';
  lineStart: number;
  lineEnd: number;
  reason: string;
  codeSnippet: string;
}

export interface UnusedExport {
  name: string;
  type: 'named' | 'default';
  lineNumber: number;
  isUsedInTests: boolean;
  isPublicAPI: boolean;
}

export interface SafeDeletion {
  item: DeadCodeItem;
  impact: 'none' | 'low' | 'medium' | 'high';
  prerequisites: string[];
  estimatedSavings: {
    lines: number;
    bytes: number;
  };
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  factors: string[];
  recommendations: string[];
  safeToAutoDelete: boolean;
}

export interface ProjectDeadCodeReport {
  totalDeadCodeLines: number;
  totalDeadCodeBytes: number;
  fileAnalyses: Map<string, DeadCodeAnalysis>;
  globalUnusedExports: string[];
  safeCleanupCandidates: SafeDeletion[];
  riskySections: DeadCodeItem[];
}

export class DeadCodeDetector {
  private projectRoot: string = '';
  private fileContents = new Map<string, string>();
  private exportUsageMap = new Map<string, Set<string>>(); // file -> used exports
  private importGraph = new Map<string, Set<string>>(); // file -> imported files
  private apiEntryPoints = new Set<string>(); // Known API entry points

  async detectDeadCode(projectRoot: string): Promise<ProjectDeadCodeReport> {
    log.info('Starting dead code detection analysis');
    
    this.projectRoot = projectRoot;
    await this.buildProjectMaps();
    
    const fileAnalyses = new Map<string, DeadCodeAnalysis>();
    const files = await this.getSourceFiles();

    for (const file of files) {
      try {
        const analysis = await this.analyzeFile(file);
        fileAnalyses.set(file, analysis);
      } catch (error) {
        log.warn(`Failed to analyze dead code in ${file}: ${error}`);
      }
    }

    return this.generateProjectReport(fileAnalyses);
  }

  private async buildProjectMaps(): Promise<void> {
    const files = await this.getSourceFiles();
    
    // Build file contents cache and identify entry points
    for (const file of files) {
      try {
        const content = await readFile(file, 'utf-8');
        this.fileContents.set(file, content);
        
        if (this.isEntryPoint(file)) {
          this.apiEntryPoints.add(file);
        }
      } catch (error) {
        log.debug(`Failed to read ${file}: ${error}`);
      }
    }

    // Build export usage map
    await this.buildExportUsageMap();
    
    // Build import graph
    await this.buildImportGraph();
  }

  private async getSourceFiles(): Promise<string[]> {
    const patterns = ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'];
    const files: string[] = [];

    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: this.projectRoot,
        ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**'],
        absolute: true
      });
      files.push(...matches);
    }

    return files;
  }

  private isEntryPoint(filePath: string): boolean {
    const entryPointPatterns = [
      /index\.(js|ts|jsx|tsx)$/,
      /main\.(js|ts)$/,
      /app\.(js|ts|jsx|tsx)$/,
      /server\.(js|ts)$/,
      /\/bin\//,
      /\.bin$/
    ];

    return entryPointPatterns.some(pattern => pattern.test(filePath));
  }

  private async buildExportUsageMap(): Promise<void> {
    for (const [filePath, content] of this.fileContents) {
      const usedExports = new Set<string>();
      
      // Find all imports in this file and track what's being used
      const importMatches = content.matchAll(/import\s*(?:\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))\s*from\s*['"`]([^'"`]+)['"`]/g);
      
      for (const match of importMatches) {
        const source = match[4];
        const resolvedSource = this.resolveImportPath(source || '', filePath);
        
        if (resolvedSource && this.fileContents.has(resolvedSource)) {
          if (match[1]) { // Named imports
            const namedImports = match[1].split(',').map(imp => imp.trim().split(' as ')[0]);
            namedImports.forEach(imp => usedExports.add(`${resolvedSource}:${imp}`));
          } else if (match[2]) { // Namespace import
            usedExports.add(`${resolvedSource}:*`);
          } else if (match[3]) { // Default import
            usedExports.add(`${resolvedSource}:default`);
          }
        }
      }
      
      this.exportUsageMap.set(filePath, usedExports);
    }
  }

  private async buildImportGraph(): Promise<void> {
    for (const [filePath, content] of this.fileContents) {
      const dependencies = new Set<string>();
      
      const importMatches = content.matchAll(/import\s*.*?from\s*['"`]([^'"`]+)['"`]/g);
      
      for (const match of importMatches) {
        const resolvedPath = this.resolveImportPath(match[1] || '', filePath);
        if (resolvedPath) {
          dependencies.add(resolvedPath);
        }
      }
      
      this.importGraph.set(filePath, dependencies);
    }
  }

  private resolveImportPath(importPath: string, fromFile: string): string | null {
    if (importPath.startsWith('.')) {
      // Resolve relative imports
      const resolved = join(fromFile, '..', importPath);
      
      // Try different extensions
      const extensions = ['.js', '.ts', '.jsx', '.tsx', '/index.js', '/index.ts'];
      for (const ext of extensions) {
        const candidate = resolved + ext;
        if (this.fileContents.has(candidate)) {
          return candidate;
        }
      }
    }
    return null; // External module or not found
  }

  private async analyzeFile(filePath: string): Promise<DeadCodeAnalysis> {
    const content = this.fileContents.get(filePath) || '';
    
    const deadCode = await this.findDeadCode(content, filePath);
    const unreachableCode = this.findUnreachableCode(content);
    const unusedExports = this.findUnusedExports(content, filePath);
    const safeDeletions = this.assessSafeDeletions(deadCode, filePath);
    const riskAssessment = this.assessRisk(deadCode, unusedExports, filePath);

    return {
      path: filePath,
      deadCode,
      unreachableCode,
      unusedExports,
      safeDeletions,
      riskAssessment
    };
  }

  private async findDeadCode(content: string, filePath: string): Promise<DeadCodeItem[]> {
    const deadCode: DeadCodeItem[] = [];
    
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

      deadCode.push(...this.findDeadFunctions(ast, content));
      deadCode.push(...this.findDeadVariables(ast, content));
      deadCode.push(...this.findDeadClasses(ast, content));
      deadCode.push(...this.findDeadImports(ast, content, filePath));
    } catch (error) {
      log.debug(`AST parsing failed for ${filePath}, using regex analysis`);
      deadCode.push(...this.findDeadCodeWithRegex(content, filePath));
    }

    return deadCode;
  }

  private findDeadFunctions(ast: any, content: string): DeadCodeItem[] {
    const deadFunctions: DeadCodeItem[] = [];
    const definedFunctions = new Set<string>();
    const calledFunctions = new Set<string>();

    // Find all function definitions
    this.traverse(ast, (node: any) => {
      if (node.type === 'FunctionDeclaration' && node.id?.name) {
        definedFunctions.add(node.id.name);
      }
      if (node.type === 'VariableDeclarator' && 
          (node.init?.type === 'FunctionExpression' || node.init?.type === 'ArrowFunctionExpression')) {
        if (node.id?.name) {
          definedFunctions.add(node.id.name);
        }
      }
    });

    // Find all function calls
    this.traverse(ast, (node: any) => {
      if (node.type === 'CallExpression') {
        if (node.callee?.name) {
          calledFunctions.add(node.callee.name);
        }
        if (node.callee?.property?.name) {
          calledFunctions.add(node.callee.property.name);
        }
      }
    });

    // Find unused functions
    for (const funcName of definedFunctions) {
      if (!calledFunctions.has(funcName) && !this.isExported(funcName, content)) {
        const functionNode = this.findFunctionNode(ast, funcName);
        if (functionNode) {
          deadFunctions.push({
            type: 'function',
            name: funcName,
            lineStart: functionNode.loc?.start?.line || 0,
            lineEnd: functionNode.loc?.end?.line || 0,
            confidence: 0.8,
            reason: 'Function is defined but never called',
            dependencies: [],
            dependents: []
          });
        }
      }
    }

    return deadFunctions;
  }

  private findDeadVariables(ast: any, content: string): DeadCodeItem[] {
    const deadVariables: DeadCodeItem[] = [];
    const definedVariables = new Map<string, any>();
    const usedVariables = new Set<string>();

    // Find all variable declarations
    this.traverse(ast, (node: any) => {
      if (node.type === 'VariableDeclarator' && node.id?.name) {
        definedVariables.set(node.id.name, node);
      }
    });

    // Find all variable usage
    this.traverse(ast, (node: any) => {
      if (node.type === 'Identifier' && node.name) {
        usedVariables.add(node.name);
      }
    });

    // Find unused variables
    for (const [varName, varNode] of definedVariables) {
      if (!usedVariables.has(varName) && !this.isExported(varName, content)) {
        deadVariables.push({
          type: 'variable',
          name: varName,
          lineStart: varNode.loc?.start?.line || 0,
          lineEnd: varNode.loc?.end?.line || 0,
          confidence: 0.9,
          reason: 'Variable is declared but never used',
          dependencies: [],
          dependents: []
        });
      }
    }

    return deadVariables;
  }

  private findDeadClasses(ast: any, content: string): DeadCodeItem[] {
    const deadClasses: DeadCodeItem[] = [];
    const definedClasses = new Set<string>();
    const usedClasses = new Set<string>();

    // Find all class definitions
    this.traverse(ast, (node: any) => {
      if (node.type === 'ClassDeclaration' && node.id?.name) {
        definedClasses.add(node.id.name);
      }
    });

    // Find class usage (instantiation, extension, etc.)
    this.traverse(ast, (node: any) => {
      if (node.type === 'NewExpression' && node.callee?.name) {
        usedClasses.add(node.callee.name);
      }
      if (node.type === 'ClassExpression' && node.superClass?.name) {
        usedClasses.add(node.superClass.name);
      }
    });

    // Find unused classes
    for (const className of definedClasses) {
      if (!usedClasses.has(className) && !this.isExported(className, content)) {
        const classNode = this.findClassNode(ast, className);
        if (classNode) {
          deadClasses.push({
            type: 'class',
            name: className,
            lineStart: classNode.loc?.start?.line || 0,
            lineEnd: classNode.loc?.end?.line || 0,
            confidence: 0.7,
            reason: 'Class is defined but never instantiated or extended',
            dependencies: [],
            dependents: []
          });
        }
      }
    }

    return deadClasses;
  }

  private findDeadImports(ast: any, content: string, filePath: string): DeadCodeItem[] {
    const deadImports: DeadCodeItem[] = [];
    const importedNames = new Map<string, any>();
    const usedNames = new Set<string>();

    // Find all imports
    this.traverse(ast, (node: any) => {
      if (node.type === 'ImportDeclaration') {
        node.specifiers?.forEach((spec: any) => {
          if (spec.type === 'ImportDefaultSpecifier' || spec.type === 'ImportSpecifier') {
            importedNames.set(spec.local.name, node);
          }
        });
      }
    });

    // Find usage of imported names
    this.traverse(ast, (node: any) => {
      if (node.type === 'Identifier' && node.name) {
        usedNames.add(node.name);
      }
    });

    // Find unused imports
    for (const [importName, importNode] of importedNames) {
      if (!usedNames.has(importName)) {
        deadImports.push({
          type: 'import',
          name: importName,
          lineStart: importNode.loc?.start?.line || 0,
          lineEnd: importNode.loc?.end?.line || 0,
          confidence: 0.95,
          reason: 'Import is declared but never used',
          dependencies: [],
          dependents: []
        });
      }
    }

    return deadImports;
  }

  private findDeadCodeWithRegex(content: string, filePath: string): DeadCodeItem[] {
    const deadCode: DeadCodeItem[] = [];
    const lines = content.split('\n');

    // Find unused imports with regex
    const importPattern = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"`]([^'"`]+)['"`]/g;
    let match;

    while ((match = importPattern.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const importedName = match[1] || match[2];
      
      if (importedName) {
        const usage = new RegExp(`\\b${importedName}\\b`, 'g');
        const usageMatches = content.match(usage);
        
        if (!usageMatches || usageMatches.length <= 1) { // Only the import declaration
          deadCode.push({
            type: 'import',
            name: importedName,
            lineStart: lineNumber,
            lineEnd: lineNumber,
            confidence: 0.8,
            reason: 'Import appears to be unused',
            dependencies: [],
            dependents: []
          });
        }
      }
    }

    return deadCode;
  }

  private findUnreachableCode(content: string): UnreachableCodeItem[] {
    const unreachable: UnreachableCodeItem[] = [];
    const lines = content.split('\n');

    // Find code after return statements
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() || '';
      if (line.includes('return') && !line.startsWith('//') && !line.startsWith('*')) {
        // Check if there's non-comment code after return in the same block
        let j = i + 1;
        while (j < lines.length && (lines[j]?.trim() || '') && !(lines[j]?.includes('}') || false)) {
          const nextLine = lines[j]?.trim() || '';
          if (nextLine && !nextLine.startsWith('//') && !nextLine.startsWith('*')) {
            unreachable.push({
              type: 'after-return',
              lineStart: j + 1,
              lineEnd: j + 1,
              reason: 'Code after return statement',
              codeSnippet: nextLine
            });
          }
          j++;
        }
      }
    }

    // Find code after throw statements
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() || '';
      if (line.includes('throw') && !line.startsWith('//')) {
        let j = i + 1;
        while (j < lines.length && (lines[j]?.trim() || '') && !(lines[j]?.includes('}') || false)) {
          const nextLine = lines[j]?.trim() || '';
          if (nextLine && !nextLine.startsWith('//') && !nextLine.startsWith('*')) {
            unreachable.push({
              type: 'after-throw',
              lineStart: j + 1,
              lineEnd: j + 1,
              reason: 'Code after throw statement',
              codeSnippet: nextLine
            });
          }
          j++;
        }
      }
    }

    return unreachable;
  }

  private findUnusedExports(content: string, filePath: string): UnusedExport[] {
    const unusedExports: UnusedExport[] = [];
    const exportPattern = /export\s+(?:default\s+)?(?:const|let|var|function|class)\s+(\w+)|export\s*\{\s*([^}]+)\s*\}/g;
    
    let match;
    while ((match = exportPattern.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const exportName = match[1] || match[2];
      
      if (exportName && !this.isExportUsedExternally(exportName, filePath)) {
        unusedExports.push({
          name: exportName.trim(),
          type: match[0].includes('default') ? 'default' : 'named',
          lineNumber,
          isUsedInTests: this.isUsedInTests(exportName, filePath),
          isPublicAPI: this.isPublicAPI(exportName, filePath)
        });
      }
    }

    return unusedExports;
  }

  private assessSafeDeletions(deadCode: DeadCodeItem[], filePath: string): SafeDeletion[] {
    return deadCode.map(item => ({
      item,
      impact: this.assessDeletionImpact(item, filePath),
      prerequisites: this.getDeletionPrerequisites(item),
      estimatedSavings: {
        lines: item.lineEnd - item.lineStart + 1,
        bytes: (item.lineEnd - item.lineStart + 1) * 50 // Estimated bytes per line
      }
    }));
  }

  private assessRisk(deadCode: DeadCodeItem[], unusedExports: UnusedExport[], filePath: string): RiskAssessment {
    const factors: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    if (this.apiEntryPoints.has(filePath)) {
      factors.push('File is an API entry point');
      riskLevel = 'high';
    }

    if (unusedExports.some(exp => exp.isPublicAPI)) {
      factors.push('Contains public API exports');
      riskLevel = 'medium';
    }

    if (deadCode.some(item => item.confidence < 0.7)) {
      factors.push('Low confidence in some dead code detection');
      riskLevel = 'medium';
    }

    const safeToAutoDelete = riskLevel === 'low' && 
                           deadCode.every(item => item.confidence > 0.8) &&
                           !unusedExports.some(exp => exp.isPublicAPI);

    return {
      overallRisk: riskLevel,
      factors,
      recommendations: this.generateRiskRecommendations(riskLevel, factors),
      safeToAutoDelete
    };
  }

  private generateProjectReport(fileAnalyses: Map<string, DeadCodeAnalysis>): ProjectDeadCodeReport {
    let totalDeadCodeLines = 0;
    let totalDeadCodeBytes = 0;
    const globalUnusedExports: string[] = [];
    const safeCleanupCandidates: SafeDeletion[] = [];
    const riskySections: DeadCodeItem[] = [];

    for (const [filePath, analysis] of fileAnalyses) {
      totalDeadCodeLines += analysis.deadCode.reduce((sum, item) => sum + (item.lineEnd - item.lineStart + 1), 0);
      totalDeadCodeBytes += analysis.safeDeletions.reduce((sum, deletion) => sum + deletion.estimatedSavings.bytes, 0);

      // Collect global unused exports
      analysis.unusedExports.forEach(exp => {
        if (!exp.isUsedInTests && !exp.isPublicAPI) {
          globalUnusedExports.push(`${filePath}:${exp.name}`);
        }
      });

      // Collect safe cleanup candidates
      safeCleanupCandidates.push(...analysis.safeDeletions.filter(deletion => 
        deletion.impact === 'none' || deletion.impact === 'low'
      ));

      // Collect risky sections
      riskySections.push(...analysis.deadCode.filter(item => item.confidence < 0.7));
    }

    return {
      totalDeadCodeLines,
      totalDeadCodeBytes,
      fileAnalyses,
      globalUnusedExports,
      safeCleanupCandidates,
      riskySections
    };
  }

  // Utility methods
  private traverse(node: any, visitor: (node: any) => void): void {
    if (!node || typeof node !== 'object') return;

    visitor(node);

    for (const key in node) {
      if (key !== 'parent' && node[key]) {
        if (Array.isArray(node[key])) {
          node[key].forEach((child: any) => this.traverse(child, visitor));
        } else if (typeof node[key] === 'object') {
          this.traverse(node[key], visitor);
        }
      }
    }
  }

  private isExported(name: string, content: string): boolean {
    const exportPatterns = [
      new RegExp(`export\\s+(?:default\\s+)?(?:const|let|var|function|class)\\s+${name}\\b`),
      new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`),
      new RegExp(`export\\s+default\\s+${name}\\b`)
    ];

    return exportPatterns.some(pattern => pattern.test(content));
  }

  private findFunctionNode(ast: any, funcName: string): any {
    let foundNode = null;
    
    this.traverse(ast, (node: any) => {
      if (node.type === 'FunctionDeclaration' && node.id?.name === funcName) {
        foundNode = node;
      }
    });

    return foundNode;
  }

  private findClassNode(ast: any, className: string): any {
    let foundNode = null;
    
    this.traverse(ast, (node: any) => {
      if (node.type === 'ClassDeclaration' && node.id?.name === className) {
        foundNode = node;
      }
    });

    return foundNode;
  }

  private isExportUsedExternally(exportName: string, filePath: string): boolean {
    for (const [_, usedExports] of this.exportUsageMap) {
      if (usedExports.has(`${filePath}:${exportName}`)) {
        return true;
      }
    }
    return false;
  }

  private isUsedInTests(exportName: string, filePath: string): boolean {
    // Check if any test files import this export
    const testFiles = Array.from(this.fileContents.keys()).filter(file => 
      file.includes('.test.') || file.includes('.spec.') || file.includes('/__tests__/')
    );

    return testFiles.some(testFile => {
      const usedExports = this.exportUsageMap.get(testFile) || new Set();
      return usedExports.has(`${filePath}:${exportName}`);
    });
  }

  private isPublicAPI(exportName: string, filePath: string): boolean {
    // Heuristic: consider exports from index files or files in public directories as public API
    return filePath.includes('index.') || 
           filePath.includes('/public/') || 
           filePath.includes('/api/') ||
           this.apiEntryPoints.has(filePath);
  }

  private assessDeletionImpact(item: DeadCodeItem, filePath: string): 'none' | 'low' | 'medium' | 'high' {
    if (item.type === 'import' && item.confidence > 0.9) return 'none';
    if (item.type === 'variable' && item.confidence > 0.8) return 'low';
    if (item.type === 'function' && !this.isPublicAPI(item.name, filePath)) return 'low';
    if (item.type === 'class') return 'medium';
    return 'high';
  }

  private getDeletionPrerequisites(item: DeadCodeItem): string[] {
    const prerequisites: string[] = [];
    
    if (item.confidence < 0.8) {
      prerequisites.push('Manual verification required due to low confidence');
    }
    
    if (item.dependents.length > 0) {
      prerequisites.push('Remove dependent code first');
    }

    return prerequisites;
  }

  private generateRiskRecommendations(riskLevel: 'low' | 'medium' | 'high', factors: string[]): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'high') {
      recommendations.push('Manual review required before any deletions');
      recommendations.push('Consider gradual removal with feature flags');
    }

    if (riskLevel === 'medium') {
      recommendations.push('Review public API impact before deletion');
      recommendations.push('Run comprehensive tests after cleanup');
    }

    if (factors.includes('Low confidence in some dead code detection')) {
      recommendations.push('Use static analysis tools for verification');
    }

    return recommendations;
  }

  // Public API methods
  async getSafeCleanupPlan(projectRoot: string): Promise<{
    plan: SafeDeletion[];
    estimatedSavings: { lines: number; bytes: number };
    executionOrder: string[];
  }> {
    const report = await this.detectDeadCode(projectRoot);
    
    const plan = report.safeCleanupCandidates.sort((a, b) => {
      // Sort by impact (lower impact first) and confidence (higher confidence first)
      const impactOrder = { none: 0, low: 1, medium: 2, high: 3 };
      if (impactOrder[a.impact] !== impactOrder[b.impact]) {
        return impactOrder[a.impact] - impactOrder[b.impact];
      }
      return b.item.confidence - a.item.confidence;
    });

    const estimatedSavings = plan.reduce((acc, deletion) => ({
      lines: acc.lines + deletion.estimatedSavings.lines,
      bytes: acc.bytes + deletion.estimatedSavings.bytes
    }), { lines: 0, bytes: 0 });

    const executionOrder = ['import', 'variable', 'function', 'class'];

    return { plan, estimatedSavings, executionOrder };
  }
}

export default DeadCodeDetector;