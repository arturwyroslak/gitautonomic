// Smart Import Optimizer - Automatically optimizes and fixes import statements
import pino from 'pino';
import { readFile, writeFile } from 'fs/promises';
import { parse as parseJS } from '@babel/parser';
import { dirname, join, relative, extname } from 'path';
import { glob } from 'glob';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ImportAnalysis {
  path: string;
  imports: ImportStatement[];
  exports: ExportStatement[];
  unusedImports: string[];
  duplicateImports: string[];
  circularDependencies: string[];
  optimization: ImportOptimization;
}

export interface ImportStatement {
  source: string;
  imports: ImportSpecifier[];
  type: 'named' | 'default' | 'namespace' | 'side-effect';
  isExternal: boolean;
  lineNumber: number;
}

export interface ImportSpecifier {
  name: string;
  alias?: string;
  isUsed: boolean;
  usageCount: number;
  usageLines: number[];
}

export interface ExportStatement {
  type: 'named' | 'default' | 'namespace';
  name?: string;
  source?: string;
  lineNumber: number;
}

export interface ImportOptimization {
  canOptimize: boolean;
  suggestions: OptimizationSuggestion[];
  estimatedSavings: {
    lines: number;
    bundleSize: number; // in bytes
  };
}

export interface OptimizationSuggestion {
  type: 'remove-unused' | 'combine-imports' | 'tree-shake' | 'dynamic-import' | 'resolve-path';
  description: string;
  before: string;
  after: string;
  impact: 'low' | 'medium' | 'high';
}

export class SmartImportOptimizer {
  private projectRoot: string = '';
  private fileContents = new Map<string, string>();
  private exportMap = new Map<string, Set<string>>();
  private importGraph = new Map<string, Set<string>>();

  async optimizeImports(projectRoot: string): Promise<Map<string, ImportAnalysis>> {
    log.info('Starting smart import optimization');
    
    this.projectRoot = projectRoot;
    await this.buildProjectMaps();
    
    const analyses = new Map<string, ImportAnalysis>();
    const files = await this.getJavaScriptFiles();

    for (const file of files) {
      try {
        const analysis = await this.analyzeFile(file);
        analyses.set(file, analysis);
      } catch (error) {
        log.warn(`Failed to analyze imports in ${file}: ${error}`);
      }
    }

    return analyses;
  }

  private async buildProjectMaps(): Promise<void> {
    const files = await this.getJavaScriptFiles();
    
    // Build export map and file contents cache
    for (const file of files) {
      try {
        const content = await readFile(file, 'utf-8');
        this.fileContents.set(file, content);
        
        const exports = await this.extractExports(content, file);
        this.exportMap.set(file, new Set(exports.map(exp => exp.name || 'default')));
      } catch (error) {
        log.debug(`Failed to process ${file}: ${error}`);
      }
    }

    // Build import graph
    for (const file of files) {
      const imports = await this.extractImports(this.fileContents.get(file) || '', file);
      const dependencies = new Set<string>();
      
      for (const imp of imports) {
        const resolvedPath = this.resolveImportPath(imp.source, file);
        if (resolvedPath) {
          dependencies.add(resolvedPath);
        }
      }
      
      this.importGraph.set(file, dependencies);
    }
  }

  private async getJavaScriptFiles(): Promise<string[]> {
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

  private async analyzeFile(filePath: string): Promise<ImportAnalysis> {
    const content = this.fileContents.get(filePath) || '';
    const imports = await this.extractImports(content, filePath);
    const exports = await this.extractExports(content, filePath);
    
    const unusedImports = this.findUnusedImports(imports, content);
    const duplicateImports = this.findDuplicateImports(imports);
    const circularDependencies = this.detectCircularDependencies(filePath);
    const optimization = this.generateOptimization(imports, exports, content, filePath);

    return {
      path: filePath,
      imports,
      exports,
      unusedImports,
      duplicateImports,
      circularDependencies,
      optimization
    };
  }

  private async extractImports(content: string, filePath: string): Promise<ImportStatement[]> {
    const imports: ImportStatement[] = [];
    
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

      this.traverseForImports(ast, imports, content);
    } catch (error) {
      log.debug(`AST parsing failed for ${filePath}, using regex fallback`);
      this.extractImportsWithRegex(content, imports);
    }

    // Analyze usage for each import
    for (const importStmt of imports) {
      for (const specifier of importStmt.imports) {
        const usage = this.analyzeImportUsage(specifier.name, content);
        specifier.isUsed = usage.count > 0;
        specifier.usageCount = usage.count;
        specifier.usageLines = usage.lines;
      }
    }

    return imports;
  }

  private traverseForImports(ast: any, imports: ImportStatement[], content: string): void {
    const lines = content.split('\n');

    const traverse = (node: any) => {
      if (!node || typeof node !== 'object') return;

      if (node.type === 'ImportDeclaration') {
        const importStmt: ImportStatement = {
          source: node.source.value,
          imports: [],
          type: this.determineImportType(node),
          isExternal: !node.source.value.startsWith('.'),
          lineNumber: node.loc?.start?.line || 0
        };

        if (node.specifiers) {
          for (const spec of node.specifiers) {
            if (spec.type === 'ImportDefaultSpecifier') {
              importStmt.imports.push({
                name: spec.local.name,
                isUsed: false,
                usageCount: 0,
                usageLines: []
              });
            } else if (spec.type === 'ImportSpecifier') {
              importStmt.imports.push({
                name: spec.imported.name,
                alias: spec.local.name !== spec.imported.name ? spec.local.name : undefined,
                isUsed: false,
                usageCount: 0,
                usageLines: []
              });
            } else if (spec.type === 'ImportNamespaceSpecifier') {
              importStmt.imports.push({
                name: spec.local.name,
                isUsed: false,
                usageCount: 0,
                usageLines: []
              });
            }
          }
        }

        imports.push(importStmt);
      }

      // Handle dynamic imports
      if (node.type === 'CallExpression' && node.callee.type === 'Import') {
        if (node.arguments[0] && node.arguments[0].value) {
          imports.push({
            source: node.arguments[0].value,
            imports: [],
            type: 'side-effect',
            isExternal: !node.arguments[0].value.startsWith('.'),
            lineNumber: node.loc?.start?.line || 0
          });
        }
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
  }

  private extractImportsWithRegex(content: string, imports: ImportStatement[]): void {
    const patterns = [
      // Named imports: import { a, b } from 'module'
      /import\s*\{\s*([^}]+)\s*\}\s*from\s*['"`]([^'"`]+)['"`]/g,
      // Default imports: import a from 'module'
      /import\s+(\w+)\s+from\s*['"`]([^'"`]+)['"`]/g,
      // Namespace imports: import * as a from 'module'
      /import\s*\*\s*as\s+(\w+)\s+from\s*['"`]([^'"`]+)['"`]/g,
      // Side effect imports: import 'module'
      /import\s*['"`]([^'"`]+)['"`]/g
    ];

    const lines = content.split('\n');

    patterns.forEach((pattern, patternIndex) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        
        let importStmt: ImportStatement;
        
        if (patternIndex === 0) { // Named imports
          const namedImports = (match[1] || '').split(',').map(imp => imp.trim());
          importStmt = {
            source: match[2] || '',
            imports: namedImports.map(name => ({
              name: name.includes(' as ') ? (name.split(' as ')[1]?.trim() || name) : name,
              alias: name.includes(' as ') ? (name.split(' as ')[1]?.trim()) : undefined,
              isUsed: false,
              usageCount: 0,
              usageLines: []
            })),
            type: 'named',
            isExternal: !(match[2] || '').startsWith('.'),
            lineNumber
          };
        } else if (patternIndex === 1) { // Default imports
          importStmt = {
            source: match[2] || '',
            imports: [{
              name: match[1] || '',
              isUsed: false,
              usageCount: 0,
              usageLines: []
            }],
            type: 'default',
            isExternal: !(match[2] || '').startsWith('.'),
            lineNumber
          };
        } else if (patternIndex === 2) { // Namespace imports
          importStmt = {
            source: match[2] || '',
            imports: [{
              name: match[1] || '',
              isUsed: false,
              usageCount: 0,
              usageLines: []
            }],
            type: 'namespace',
            isExternal: !(match[2] || '').startsWith('.'),
            lineNumber
          };
        } else { // Side effect imports
          importStmt = {
            source: match[1] || '',
            imports: [],
            type: 'side-effect',
            isExternal: !(match[1] || '').startsWith('.'),
            lineNumber
          };
        }

        imports.push(importStmt);
      }
    });
  }

  private determineImportType(node: any): 'named' | 'default' | 'namespace' | 'side-effect' {
    if (!node.specifiers || node.specifiers.length === 0) return 'side-effect';
    
    const hasDefault = node.specifiers.some((spec: any) => spec.type === 'ImportDefaultSpecifier');
    const hasNamespace = node.specifiers.some((spec: any) => spec.type === 'ImportNamespaceSpecifier');
    const hasNamed = node.specifiers.some((spec: any) => spec.type === 'ImportSpecifier');

    if (hasNamespace) return 'namespace';
    if (hasDefault && !hasNamed) return 'default';
    return 'named';
  }

  private analyzeImportUsage(importName: string, content: string): { count: number; lines: number[] } {
    const lines = content.split('\n');
    const usageLines: number[] = [];
    let count = 0;

    // Create regex to match usage (avoiding import declarations)
    const usageRegex = new RegExp(`\\b${importName}\\b`, 'g');
    const importLineRegex = new RegExp(`^\\s*import\\b.*\\b${importName}\\b`, 'i');

    lines.forEach((line, index) => {
      if (!importLineRegex.test(line)) {
        const matches = line.match(usageRegex);
        if (matches) {
          count += matches.length;
          usageLines.push(index + 1);
        }
      }
    });

    return { count, lines: usageLines };
  }

  private async extractExports(content: string, filePath: string): Promise<ExportStatement[]> {
    const exports: ExportStatement[] = [];
    
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

      this.traverseForExports(ast, exports);
    } catch (error) {
      log.debug(`AST parsing failed for ${filePath}, using regex fallback`);
      this.extractExportsWithRegex(content, exports);
    }

    return exports;
  }

  private traverseForExports(ast: any, exports: ExportStatement[]): void {
    const traverse = (node: any) => {
      if (!node || typeof node !== 'object') return;

      if (node.type === 'ExportDefaultDeclaration') {
        exports.push({
          type: 'default',
          name: 'default',
          lineNumber: node.loc?.start?.line || 0
        });
      } else if (node.type === 'ExportNamedDeclaration') {
        if (node.specifiers) {
          node.specifiers.forEach((spec: any) => {
            exports.push({
              type: 'named',
              name: spec.exported.name,
              source: node.source?.value,
              lineNumber: node.loc?.start?.line || 0
            });
          });
        }
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
  }

  private extractExportsWithRegex(content: string, exports: ExportStatement[]): void {
    const patterns = [
      /export\s+default\s+/g,
      /export\s*\{\s*([^}]+)\s*\}/g,
      /export\s+(?:const|let|var|function|class)\s+(\w+)/g
    ];

    patterns.forEach((pattern, index) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        
        if (index === 0) { // Default export
          exports.push({
            type: 'default',
            name: 'default',
            lineNumber
          });
        } else if (index === 1) { // Named exports in braces
          const names = (match[1] || '').split(',').map(name => name.trim());
          names.forEach(name => {
            exports.push({
              type: 'named',
              name: name.includes(' as ') ? (name.split(' as ')[1]?.trim() || name) : name,
              lineNumber
            });
          });
        } else { // Inline exports
          exports.push({
            type: 'named',
            name: match[1],
            lineNumber
          });
        }
      }
    });
  }

  private findUnusedImports(imports: ImportStatement[], content: string): string[] {
    const unused: string[] = [];

    imports.forEach(importStmt => {
      importStmt.imports.forEach(specifier => {
        if (!specifier.isUsed && importStmt.type !== 'side-effect') {
          unused.push(`${specifier.name} from ${importStmt.source}`);
        }
      });
    });

    return unused;
  }

  private findDuplicateImports(imports: ImportStatement[]): string[] {
    const sourceMap = new Map<string, ImportStatement[]>();
    const duplicates: string[] = [];

    // Group imports by source
    imports.forEach(importStmt => {
      if (!sourceMap.has(importStmt.source)) {
        sourceMap.set(importStmt.source, []);
      }
      sourceMap.get(importStmt.source)!.push(importStmt);
    });

    // Find duplicates
    sourceMap.forEach((importsFromSource, source) => {
      if (importsFromSource.length > 1) {
        duplicates.push(`Multiple imports from ${source}`);
      }
    });

    return duplicates;
  }

  private detectCircularDependencies(filePath: string): string[] {
    const visited = new Set<string>();
    const path: string[] = [];
    const cycles: string[] = [];

    const dfs = (current: string) => {
      if (path.includes(current)) {
        const cycleStart = path.indexOf(current);
        cycles.push(path.slice(cycleStart).concat([current]).join(' -> '));
        return;
      }

      if (visited.has(current)) return;

      visited.add(current);
      path.push(current);

      const dependencies = this.importGraph.get(current) || new Set();
      dependencies.forEach(dep => dfs(dep));

      path.pop();
    };

    dfs(filePath);
    return cycles;
  }

  private generateOptimization(
    imports: ImportStatement[], 
    exports: ExportStatement[], 
    content: string, 
    filePath: string
  ): ImportOptimization {
    const suggestions: OptimizationSuggestion[] = [];
    let linesSaved = 0;
    let bundleSizeSaved = 0;

    // Remove unused imports
    const unusedImports = imports.filter(imp => 
      imp.imports.every(spec => !spec.isUsed) && imp.type !== 'side-effect'
    );

    unusedImports.forEach(imp => {
      suggestions.push({
        type: 'remove-unused',
        description: `Remove unused import from ${imp.source}`,
        before: this.reconstructImportStatement(imp),
        after: '// Removed unused import',
        impact: 'medium'
      });
      linesSaved += 1;
      bundleSizeSaved += 100; // Estimated bytes
    });

    // Combine duplicate imports
    const duplicateGroups = this.groupDuplicateImports(imports);
    duplicateGroups.forEach(group => {
      if (group.length > 1) {
        const combined = this.combineImports(group);
        suggestions.push({
          type: 'combine-imports',
          description: `Combine multiple imports from ${group[0]?.source || 'unknown'}`,
          before: group.map(imp => this.reconstructImportStatement(imp)).join('\n'),
          after: this.reconstructImportStatement(combined),
          impact: 'low'
        });
        linesSaved += group.length - 1;
      }
    });

    // Suggest dynamic imports for large modules
    const largeImports = imports.filter(imp => 
      imp.isExternal && this.isLargeModule(imp.source)
    );

    largeImports.forEach(imp => {
      suggestions.push({
        type: 'dynamic-import',
        description: `Consider dynamic import for large module ${imp.source}`,
        before: this.reconstructImportStatement(imp),
        after: `const ${imp.imports[0]?.name} = await import('${imp.source}');`,
        impact: 'high'
      });
      bundleSizeSaved += 5000; // Estimated bytes for code splitting
    });

    // Resolve relative paths
    const longPaths = imports.filter(imp => 
      imp.source.startsWith('.') && imp.source.split('/').length > 3
    );

    longPaths.forEach(imp => {
      const optimizedPath = this.optimizePath(imp.source, filePath);
      if (optimizedPath !== imp.source) {
        suggestions.push({
          type: 'resolve-path',
          description: `Optimize import path for ${imp.source}`,
          before: this.reconstructImportStatement(imp),
          after: this.reconstructImportStatement({ ...imp, source: optimizedPath }),
          impact: 'low'
        });
      }
    });

    return {
      canOptimize: suggestions.length > 0,
      suggestions,
      estimatedSavings: {
        lines: linesSaved,
        bundleSize: bundleSizeSaved
      }
    };
  }

  private reconstructImportStatement(importStmt: ImportStatement): string {
    const { source, imports: specs, type } = importStmt;

    if (type === 'side-effect') {
      return `import '${source}';`;
    }

    if (type === 'default') {
      return `import ${specs[0]?.name} from '${source}';`;
    }

    if (type === 'namespace') {
      return `import * as ${specs[0]?.name} from '${source}';`;
    }

    // Named imports
    const namedImports = specs.map(spec => 
      spec.alias ? `${spec.name} as ${spec.alias}` : spec.name
    ).join(', ');

    return `import { ${namedImports} } from '${source}';`;
  }

  private groupDuplicateImports(imports: ImportStatement[]): ImportStatement[][] {
    const groups = new Map<string, ImportStatement[]>();

    imports.forEach(importStmt => {
      if (!groups.has(importStmt.source)) {
        groups.set(importStmt.source, []);
      }
      groups.get(importStmt.source)!.push(importStmt);
    });

    return Array.from(groups.values()).filter(group => group.length > 1);
  }

  private combineImports(imports: ImportStatement[]): ImportStatement {
    const firstImport = imports[0];
    if (!firstImport) {
      // Return a default import statement if array is empty
      return {
        source: '',
        imports: [],
        type: 'named',
        isExternal: false,
        lineNumber: 0
      };
    }

    const combined: ImportStatement = {
      source: firstImport.source,
      imports: [],
      type: 'named',
      isExternal: firstImport.isExternal,
      lineNumber: firstImport.lineNumber
    };

    imports.forEach(imp => {
      combined.imports.push(...imp.imports);
    });

    // Remove duplicates
    const seen = new Set<string>();
    combined.imports = combined.imports.filter(spec => {
      const key = `${spec.name}:${spec.alias || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return combined;
  }

  private isLargeModule(moduleName: string): boolean {
    // Common large modules that benefit from dynamic importing
    const largeModules = [
      'lodash', 'moment', 'rxjs', 'chart.js', 'd3',
      'three', 'monaco-editor', 'codemirror'
    ];

    return largeModules.some(large => moduleName.includes(large));
  }

  private optimizePath(importPath: string, fromFile: string): string {
    // Simple path optimization - in production would be more sophisticated
    const segments = importPath.split('/');
    const optimized = segments.filter(segment => segment !== '.' && segment !== '');
    
    return optimized.join('/');
  }

  private resolveImportPath(importPath: string, fromFile: string): string | null {
    if (importPath.startsWith('.')) {
      return join(dirname(fromFile), importPath);
    }
    return null; // External module
  }

  // Public API methods
  async applyOptimizations(filePath: string, analysis: ImportAnalysis): Promise<string> {
    const content = this.fileContents.get(filePath) || '';
    let optimizedContent = content;

    // Apply optimizations in order of impact
    const sortedSuggestions = analysis.optimization.suggestions.sort((a, b) => {
      const impactOrder = { high: 3, medium: 2, low: 1 };
      return impactOrder[b.impact] - impactOrder[a.impact];
    });

    for (const suggestion of sortedSuggestions) {
      if (suggestion.type === 'remove-unused') {
        optimizedContent = optimizedContent.replace(suggestion.before, '');
      } else if (suggestion.type === 'combine-imports') {
        optimizedContent = optimizedContent.replace(suggestion.before, suggestion.after);
      }
      // Add other optimization types as needed
    }

    return optimizedContent;
  }

  async optimizeProject(projectRoot: string): Promise<{
    totalOptimizations: number;
    linesSaved: number;
    bundleSizeSaved: number;
    filesModified: string[];
  }> {
    const analyses = await this.optimizeImports(projectRoot);
    let totalOptimizations = 0;
    let linesSaved = 0;
    let bundleSizeSaved = 0;
    const filesModified: string[] = [];

    for (const [filePath, analysis] of analyses) {
      if (analysis.optimization.canOptimize) {
        const optimizedContent = await this.applyOptimizations(filePath, analysis);
        await writeFile(filePath, optimizedContent);
        
        totalOptimizations += analysis.optimization.suggestions.length;
        linesSaved += analysis.optimization.estimatedSavings.lines;
        bundleSizeSaved += analysis.optimization.estimatedSavings.bundleSize;
        filesModified.push(filePath);
      }
    }

    return {
      totalOptimizations,
      linesSaved,
      bundleSizeSaved,
      filesModified
    };
  }
}

export default SmartImportOptimizer;