// Advanced Code Dependency Analyzer - Full dependency graph with circular dependency detection
import pino from 'pino';
import { readFile } from 'fs/promises';
import { parse as parseJS } from '@babel/parser';
import { join, dirname, extname } from 'path';
import { glob } from 'glob';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface DependencyNode {
  path: string;
  type: 'import' | 'require' | 'dynamic';
  dependencies: string[];
  dependents: string[];
  isExternal: boolean;
  size: number;
  lastModified: Date;
}

export interface CircularDependency {
  cycle: string[];
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
}

export interface DependencyAnalysis {
  graph: Map<string, DependencyNode>;
  circularDependencies: CircularDependency[];
  orphanedFiles: string[];
  heaviestDependencies: string[];
  criticalPaths: string[][];
}

export class AdvancedCodeAnalyzer {
  private graph = new Map<string, DependencyNode>();
  private visitedForCycles = new Set<string>();
  private pathStack: string[] = [];

  async analyzeDependencies(projectRoot: string): Promise<DependencyAnalysis> {
    log.info('Starting advanced dependency analysis');
    
    await this.buildDependencyGraph(projectRoot);
    const circularDependencies = this.detectCircularDependencies();
    const orphanedFiles = this.findOrphanedFiles();
    const heaviestDependencies = this.findHeaviestDependencies();
    const criticalPaths = this.findCriticalPaths();

    return {
      graph: this.graph,
      circularDependencies,
      orphanedFiles,
      heaviestDependencies,
      criticalPaths
    };
  }

  private async buildDependencyGraph(projectRoot: string): Promise<void> {
    const patterns = [
      '**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx',
      '**/*.mjs', '**/*.cjs', '**/*.vue', '**/*.svelte'
    ];

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: projectRoot,
        ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
      });

      for (const file of files) {
        await this.analyzeFile(join(projectRoot, file));
      }
    }
  }

  private async analyzeFile(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const dependencies = await this.extractDependencies(content, filePath);
      
      const node: DependencyNode = {
        path: filePath,
        type: 'import',
        dependencies,
        dependents: [],
        isExternal: this.isExternalDependency(filePath),
        size: content.length,
        lastModified: new Date()
      };

      this.graph.set(filePath, node);

      // Update dependents
      for (const dep of dependencies) {
        const depNode = this.graph.get(dep);
        if (depNode && !depNode.dependents.includes(filePath)) {
          depNode.dependents.push(filePath);
        }
      }
    } catch (error) {
      log.warn(`Failed to analyze file ${filePath}: ${error}`);
    }
  }

  private async extractDependencies(content: string, filePath: string): Promise<string[]> {
    const dependencies: string[] = [];
    const ext = extname(filePath);

    try {
      if (['.js', '.ts', '.jsx', '.tsx', '.mjs'].includes(ext)) {
        // Parse with Babel
        const ast = parseJS(content, {
          sourceType: 'module',
          allowImportExportEverywhere: true,
          plugins: [
            'typescript', 'jsx', 'asyncGenerators', 'functionBind',
            'exportDefaultFrom', 'exportNamespaceFrom', 'dynamicImport',
            'nullishCoalescingOperator', 'optionalChaining'
          ]
        });

        this.traverseAST(ast, dependencies, filePath);
      } else {
        // Fallback to regex parsing for other file types
        this.extractWithRegex(content, dependencies, filePath);
      }
    } catch (error) {
      log.warn(`AST parsing failed for ${filePath}, using regex fallback`);
      this.extractWithRegex(content, dependencies, filePath);
    }

    return dependencies;
  }

  private traverseAST(ast: any, dependencies: string[], filePath: string): void {
    // Simple AST traversal to extract imports
    const traverse = (node: any) => {
      if (!node || typeof node !== 'object') return;

      if (node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration') {
        if (node.source?.value) {
          const resolvedPath = this.resolveDependencyPath(node.source.value, filePath);
          if (resolvedPath && !dependencies.includes(resolvedPath)) {
            dependencies.push(resolvedPath);
          }
        }
      }

      if (node.type === 'CallExpression') {
        if (node.callee?.name === 'require' && node.arguments?.[0]?.value) {
          const resolvedPath = this.resolveDependencyPath(node.arguments[0].value, filePath);
          if (resolvedPath && !dependencies.includes(resolvedPath)) {
            dependencies.push(resolvedPath);
          }
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

  private extractWithRegex(content: string, dependencies: string[], filePath: string): void {
    // Regex patterns for different import styles
    const patterns = [
      /import.*?from\s+['"`]([^'"`]+)['"`]/g,
      /require\(['"`]([^'"`]+)['"`]\)/g,
      /import\(['"`]([^'"`]+)['"`]\)/g,
      /@import\s+['"`]([^'"`]+)['"`]/g // CSS/SCSS imports
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const resolvedPath = this.resolveDependencyPath(match[1] || '', filePath);
        if (resolvedPath && !dependencies.includes(resolvedPath)) {
          dependencies.push(resolvedPath);
        }
      }
    }
  }

  private resolveDependencyPath(importPath: string, fromFile: string): string | null {
    // Simple path resolution - in production would use more sophisticated logic
    if (importPath.startsWith('.')) {
      return join(dirname(fromFile), importPath);
    }
    return importPath; // External dependency
  }

  private isExternalDependency(filePath: string): boolean {
    return !filePath.startsWith('.') && !filePath.startsWith('/');
  }

  private detectCircularDependencies(): CircularDependency[] {
    const cycles: CircularDependency[] = [];
    
    for (const [filePath] of this.graph) {
      if (!this.visitedForCycles.has(filePath)) {
        this.dfsForCycles(filePath, cycles);
      }
    }

    return cycles;
  }

  private dfsForCycles(node: string, cycles: CircularDependency[]): void {
    if (this.pathStack.includes(node)) {
      // Found a cycle
      const cycleStart = this.pathStack.indexOf(node);
      const cycle = this.pathStack.slice(cycleStart).concat([node]);
      
      cycles.push({
        cycle,
        severity: this.calculateCycleSeverity(cycle),
        suggestion: this.generateCycleSuggestion(cycle)
      });
      return;
    }

    this.visitedForCycles.add(node);
    this.pathStack.push(node);

    const nodeData = this.graph.get(node);
    if (nodeData) {
      for (const dep of nodeData.dependencies) {
        if (this.graph.has(dep)) {
          this.dfsForCycles(dep, cycles);
        }
      }
    }

    this.pathStack.pop();
  }

  private calculateCycleSeverity(cycle: string[]): 'low' | 'medium' | 'high' {
    const cycleLength = cycle.length;
    const totalSize = cycle.reduce((sum, path) => {
      const node = this.graph.get(path);
      return sum + (node?.size || 0);
    }, 0);

    if (cycleLength > 5 || totalSize > 50000) return 'high';
    if (cycleLength > 3 || totalSize > 20000) return 'medium';
    return 'low';
  }

  private generateCycleSuggestion(cycle: string[]): string {
    return `Consider breaking this circular dependency by extracting common functionality into a separate module or using dependency injection.`;
  }

  private findOrphanedFiles(): string[] {
    const orphaned: string[] = [];
    
    for (const [filePath, node] of this.graph) {
      if (node.dependents.length === 0 && !this.isEntryPoint(filePath)) {
        orphaned.push(filePath);
      }
    }

    return orphaned;
  }

  private isEntryPoint(filePath: string): boolean {
    const entryPoints = ['main.js', 'index.js', 'app.js', 'server.js', 'main.ts', 'index.ts'];
    return entryPoints.some(entry => filePath.endsWith(entry));
  }

  private findHeaviestDependencies(): string[] {
    const dependencies = Array.from(this.graph.entries())
      .map(([path, node]) => ({ path, weight: node.dependencies.length + node.dependents.length }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10);

    return dependencies.map(d => d.path);
  }

  private findCriticalPaths(): string[][] {
    // Find paths that, if broken, would disconnect large parts of the graph
    const criticalPaths: string[][] = [];
    
    // Implementation would use graph algorithms to find articulation points
    // For now, return paths with highest connectivity
    const highConnectivity = Array.from(this.graph.entries())
      .filter(([_, node]) => node.dependencies.length + node.dependents.length > 5)
      .map(([path]) => [path]);

    return criticalPaths.concat(highConnectivity);
  }

  // Public API methods
  async getDependencyMetrics(projectRoot: string): Promise<{
    totalFiles: number;
    totalDependencies: number;
    averageDependenciesPerFile: number;
    maxDependencyDepth: number;
    circularDependencyCount: number;
  }> {
    const analysis = await this.analyzeDependencies(projectRoot);
    
    return {
      totalFiles: analysis.graph.size,
      totalDependencies: Array.from(analysis.graph.values()).reduce((sum, node) => sum + node.dependencies.length, 0),
      averageDependenciesPerFile: Array.from(analysis.graph.values()).reduce((sum, node) => sum + node.dependencies.length, 0) / analysis.graph.size,
      maxDependencyDepth: this.calculateMaxDepth(),
      circularDependencyCount: analysis.circularDependencies.length
    };
  }

  private calculateMaxDepth(): number {
    let maxDepth = 0;
    
    for (const [filePath] of this.graph) {
      const depth = this.calculateDepth(filePath, new Set());
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  private calculateDepth(node: string, visited: Set<string>): number {
    if (visited.has(node)) return 0;
    visited.add(node);

    const nodeData = this.graph.get(node);
    if (!nodeData || nodeData.dependencies.length === 0) return 1;

    let maxChildDepth = 0;
    for (const dep of nodeData.dependencies) {
      if (this.graph.has(dep)) {
        maxChildDepth = Math.max(maxChildDepth, this.calculateDepth(dep, new Set(visited)));
      }
    }

    return 1 + maxChildDepth;
  }
}

export default AdvancedCodeAnalyzer;