// Test coverage analysis and reporting service
import { spawn } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import pino from 'pino';
import { cfg } from '../config.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface CoverageResult {
  tool: string;
  overall: CoverageMetrics;
  files: FileCoverageResult[];
  summary: CoverageSummary;
  passed: boolean;
  violations: CoverageViolation[];
}

export interface CoverageMetrics {
  lines: number;
  statements: number;
  branches: number;
  functions: number;
}

export interface FileCoverageResult {
  path: string;
  lines: number;
  statements: number;
  branches: number;
  functions: number;
  uncoveredLines: number[];
  missing: string[];
}

export interface CoverageSummary {
  totalLines: number;
  coveredLines: number;
  percentage: number;
  threshold: number;
  passed: boolean;
  improvements: string[];
}

export interface CoverageViolation {
  type: 'below_threshold' | 'missing_critical' | 'regression';
  message: string;
  file?: string;
  metric: 'lines' | 'statements' | 'branches' | 'functions';
  current: number;
  required: number;
}

export interface CoverageConfig {
  threshold: {
    lines: number;
    statements: number;
    branches: number;
    functions: number;
  };
  exclude: string[];
  critical_paths: string[];
  tools: ('nyc' | 'jest' | 'vitest' | 'c8')[];
  enforce_critical: boolean;
}

export class CoverageAnalysisService {
  private defaultConfig: CoverageConfig = {
    threshold: {
      lines: 80,
      statements: 80,
      branches: 70,
      functions: 80
    },
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '**/*.test.*',
      '**/*.spec.*',
      'coverage/**'
    ],
    critical_paths: [
      'src/core/**',
      'src/services/**',
      'src/security/**'
    ],
    tools: ['vitest', 'nyc'],
    enforce_critical: true
  };

  async analyzeCoverage(
    workspacePath: string,
    config: Partial<CoverageConfig> = {}
  ): Promise<CoverageResult[]> {
    const analysisConfig = { ...this.defaultConfig, ...config };
    const results: CoverageResult[] = [];

    for (const tool of analysisConfig.tools) {
      try {
        const result = await this.runCoverageTool(tool, workspacePath, analysisConfig);
        results.push(result);
      } catch (error) {
        log.error(`Coverage analysis failed for ${tool}: ${error}`);
        results.push(this.createErrorResult(tool, error as Error));
      }
    }

    return results;
  }

  async runTestsWithCoverage(
    workspacePath: string,
    testPattern?: string,
    config: Partial<CoverageConfig> = {}
  ): Promise<CoverageResult> {
    const analysisConfig = { ...this.defaultConfig, ...config };
    
    try {
      // Determine the test runner based on package.json
      const packageJsonPath = join(workspacePath, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
      
      let tool = 'vitest'; // default
      if (packageJson.devDependencies?.jest || packageJson.dependencies?.jest) {
        tool = 'jest';
      } else if (packageJson.devDependencies?.nyc || packageJson.dependencies?.nyc) {
        tool = 'nyc';
      }

      const testCommand = this.buildTestCommand(tool, testPattern, analysisConfig);
      const { stdout, stderr } = await this.executeCommand(testCommand, workspacePath);
      
      return await this.parseCoverageOutput(tool, stdout, stderr, analysisConfig);
      
    } catch (error) {
      log.error(`Test execution with coverage failed: ${error}`);
      throw error;
    }
  }

  async compareCoverage(
    baseline: CoverageResult,
    current: CoverageResult,
    allowedRegression: number = 5
  ): Promise<{
    improved: FileCoverageResult[];
    regressed: FileCoverageResult[];
    summary: string;
    passed: boolean;
  }> {
    const improved: FileCoverageResult[] = [];
    const regressed: FileCoverageResult[] = [];
    
    const baselineFileMap = new Map(baseline.files.map(f => [f.path, f]));
    
    for (const currentFile of current.files) {
      const baselineFile = baselineFileMap.get(currentFile.path);
      
      if (!baselineFile) {
        // New file - consider it improved if it has decent coverage
        if (currentFile.lines >= 70) {
          improved.push(currentFile);
        }
        continue;
      }
      
      const coverageDiff = currentFile.lines - baselineFile.lines;
      
      if (coverageDiff > 1) {
        improved.push(currentFile);
      } else if (coverageDiff < -allowedRegression) {
        regressed.push(currentFile);
      }
    }
    
    const overallRegression = current.overall.lines - baseline.overall.lines;
    const passed = regressed.length === 0 && overallRegression >= -allowedRegression;
    
    const summary = this.generateComparisonSummary(improved, regressed, overallRegression);
    
    return { improved, regressed, summary, passed };
  }

  async generateCoverageReport(
    results: CoverageResult[],
    outputPath: string,
    format: 'html' | 'json' | 'markdown' = 'html'
  ): Promise<string> {
    const reportData = {
      timestamp: new Date().toISOString(),
      results,
      summary: this.generateOverallSummary(results)
    };

    switch (format) {
      case 'html':
        return await this.generateHtmlReport(reportData, outputPath);
      case 'json':
        return await this.generateJsonReport(reportData, outputPath);
      case 'markdown':
        return await this.generateMarkdownReport(reportData, outputPath);
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }
  }

  private async runCoverageTool(
    tool: string,
    workspacePath: string,
    config: CoverageConfig
  ): Promise<CoverageResult> {
    const command = this.buildCoverageCommand(tool, config);
    const { stdout, stderr } = await this.executeCommand(command, workspacePath);
    
    return await this.parseCoverageOutput(tool, stdout, stderr, config);
  }

  private buildCoverageCommand(tool: string, config: CoverageConfig): string {
    const excludePatterns = config.exclude.map(p => `--exclude '${p}'`).join(' ');
    
    switch (tool) {
      case 'vitest':
        return `npx vitest run --coverage ${excludePatterns}`;
      case 'jest':
        return `npx jest --coverage --collectCoverageFrom='src/**/*.{js,ts}' ${excludePatterns}`;
      case 'nyc':
        return `npx nyc --reporter=json --reporter=text npm test`;
      case 'c8':
        return `npx c8 --reporter=json --reporter=text npm test`;
      default:
        throw new Error(`Unsupported coverage tool: ${tool}`);
    }
  }

  private buildTestCommand(tool: string, testPattern?: string, config?: CoverageConfig): string {
    const pattern = testPattern || '**/*.{test,spec}.{js,ts}';
    const excludeArgs = config?.exclude.map(p => `--exclude '${p}'`).join(' ') || '';
    
    switch (tool) {
      case 'vitest':
        return `npx vitest run --coverage ${pattern} ${excludeArgs}`;
      case 'jest':
        return `npx jest --coverage ${pattern} ${excludeArgs}`;
      default:
        return `npm test`;
    }
  }

  private async parseCoverageOutput(
    tool: string,
    stdout: string,
    stderr: string,
    config: CoverageConfig
  ): Promise<CoverageResult> {
    let coverageData: any;
    
    try {
      // Try to find and parse JSON coverage report
      const jsonMatch = stdout.match(/(\{[\s\S]*"total"[\s\S]*\})/);
      if (jsonMatch && jsonMatch[1]) {
        coverageData = JSON.parse(jsonMatch[1]);
      } else {
        // Fallback to parsing text output
        coverageData = this.parseTextCoverageOutput(stdout, tool);
      }
    } catch (error) {
      log.warn(`Failed to parse coverage output: ${error}`);
      return this.createErrorResult(tool, error as Error);
    }

    const overall = this.extractOverallMetrics(coverageData, tool);
    const files = this.extractFileMetrics(coverageData, tool);
    const violations = this.checkViolations(overall, files, config);
    const summary = this.generateSummary(overall, config);

    return {
      tool,
      overall,
      files,
      summary,
      passed: violations.length === 0,
      violations
    };
  }

  private parseTextCoverageOutput(output: string, tool: string): any {
    // Parse text-based coverage output for different tools
    const lines = output.split('\n');
    const result: any = { total: {} };
    
    for (const line of lines) {
      // Look for coverage percentage lines
      if (line.includes('%')) {
        const match = line.match(/(\d+(?:\.\d+)?)%/);
        if (match && match[1]) {
          const percentage = parseFloat(match[1]);
          if (line.toLowerCase().includes('line')) {
            result.total.lines = { pct: percentage };
          } else if (line.toLowerCase().includes('statement')) {
            result.total.statements = { pct: percentage };
          } else if (line.toLowerCase().includes('branch')) {
            result.total.branches = { pct: percentage };
          } else if (line.toLowerCase().includes('function')) {
            result.total.functions = { pct: percentage };
          }
        }
      }
    }
    
    return result;
  }

  private extractOverallMetrics(data: any, tool: string): CoverageMetrics {
    const total = data.total || {};
    
    return {
      lines: total.lines?.pct || 0,
      statements: total.statements?.pct || 0,
      branches: total.branches?.pct || 0,
      functions: total.functions?.pct || 0
    };
  }

  private extractFileMetrics(data: any, tool: string): FileCoverageResult[] {
    const files: FileCoverageResult[] = [];
    
    for (const [path, fileData] of Object.entries(data)) {
      if (path === 'total') continue;
      
      const file = fileData as any;
      files.push({
        path,
        lines: file.lines?.pct || 0,
        statements: file.statements?.pct || 0,
        branches: file.branches?.pct || 0,
        functions: file.functions?.pct || 0,
        uncoveredLines: file.uncoveredLines || [],
        missing: file.missing || []
      });
    }
    
    return files;
  }

  private checkViolations(
    overall: CoverageMetrics,
    files: FileCoverageResult[],
    config: CoverageConfig
  ): CoverageViolation[] {
    const violations: CoverageViolation[] = [];
    
    // Check overall thresholds
    if (overall.lines < config.threshold.lines) {
      violations.push({
        type: 'below_threshold',
        message: `Line coverage ${overall.lines}% below threshold ${config.threshold.lines}%`,
        metric: 'lines',
        current: overall.lines,
        required: config.threshold.lines
      });
    }
    
    if (overall.statements < config.threshold.statements) {
      violations.push({
        type: 'below_threshold',
        message: `Statement coverage ${overall.statements}% below threshold ${config.threshold.statements}%`,
        metric: 'statements',
        current: overall.statements,
        required: config.threshold.statements
      });
    }
    
    if (overall.branches < config.threshold.branches) {
      violations.push({
        type: 'below_threshold',
        message: `Branch coverage ${overall.branches}% below threshold ${config.threshold.branches}%`,
        metric: 'branches',
        current: overall.branches,
        required: config.threshold.branches
      });
    }
    
    if (overall.functions < config.threshold.functions) {
      violations.push({
        type: 'below_threshold',
        message: `Function coverage ${overall.functions}% below threshold ${config.threshold.functions}%`,
        metric: 'functions',
        current: overall.functions,
        required: config.threshold.functions
      });
    }
    
    // Check critical paths
    if (config.enforce_critical) {
      for (const file of files) {
        const isCritical = config.critical_paths.some(pattern => 
          this.matchesPattern(file.path, pattern)
        );
        
        if (isCritical && file.lines < 90) {
          violations.push({
            type: 'missing_critical',
            message: `Critical file ${file.path} has insufficient coverage: ${file.lines}%`,
            file: file.path,
            metric: 'lines',
            current: file.lines,
            required: 90
          });
        }
      }
    }
    
    return violations;
  }

  private generateSummary(overall: CoverageMetrics, config: CoverageConfig): CoverageSummary {
    const totalLines = 100; // Normalized percentage
    const coveredLines = overall.lines;
    const percentage = overall.lines;
    const threshold = config.threshold.lines;
    const passed = percentage >= threshold;
    
    const improvements: string[] = [];
    if (!passed) {
      improvements.push(`Increase line coverage by ${(threshold - percentage).toFixed(1)}%`);
    }
    if (overall.branches < config.threshold.branches) {
      improvements.push(`Add more branch coverage tests`);
    }
    if (overall.functions < config.threshold.functions) {
      improvements.push(`Improve function coverage with unit tests`);
    }
    
    return {
      totalLines,
      coveredLines,
      percentage,
      threshold,
      passed,
      improvements
    };
  }

  private generateComparisonSummary(
    improved: FileCoverageResult[],
    regressed: FileCoverageResult[],
    overallChange: number
  ): string {
    if (regressed.length === 0 && overallChange >= 0) {
      return `✅ Coverage improved or maintained. ${improved.length} files improved, overall change: +${overallChange.toFixed(1)}%`;
    } else {
      return `❌ Coverage regression detected. ${regressed.length} files regressed, overall change: ${overallChange.toFixed(1)}%`;
    }
  }

  private generateOverallSummary(results: CoverageResult[]): any {
    const latestResult = results[results.length - 1];
    if (!latestResult) return {};
    
    return {
      overall: latestResult.overall,
      passed: latestResult.passed,
      violations: latestResult.violations.length,
      toolsUsed: results.map(r => r.tool).join(', ')
    };
  }

  private async generateHtmlReport(data: any, outputPath: string): Promise<string> {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Coverage Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
        .metric { background: white; border: 1px solid #ddd; padding: 15px; text-align: center; border-radius: 5px; }
        .pass { border-left: 5px solid #4caf50; }
        .fail { border-left: 5px solid #f44336; }
        .files { margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Coverage Report</h1>
        <p>Generated: ${data.timestamp}</p>
        <p>Overall Status: ${data.summary.passed ? '✅ PASSED' : '❌ FAILED'}</p>
    </div>
    
    <div class="metrics">
        <div class="metric ${data.summary.overall?.lines >= 80 ? 'pass' : 'fail'}">
            <h3>Lines</h3>
            <div>${data.summary.overall?.lines?.toFixed(1) || 0}%</div>
        </div>
        <div class="metric ${data.summary.overall?.statements >= 80 ? 'pass' : 'fail'}">
            <h3>Statements</h3>
            <div>${data.summary.overall?.statements?.toFixed(1) || 0}%</div>
        </div>
        <div class="metric ${data.summary.overall?.branches >= 70 ? 'pass' : 'fail'}">
            <h3>Branches</h3>
            <div>${data.summary.overall?.branches?.toFixed(1) || 0}%</div>
        </div>
        <div class="metric ${data.summary.overall?.functions >= 80 ? 'pass' : 'fail'}">
            <h3>Functions</h3>
            <div>${data.summary.overall?.functions?.toFixed(1) || 0}%</div>
        </div>
    </div>
    
    <div class="files">
        <h2>File Coverage</h2>
        <table>
            <tr>
                <th>File</th>
                <th>Lines</th>
                <th>Statements</th>
                <th>Branches</th>
                <th>Functions</th>
            </tr>
            ${data.results[0]?.files?.map((file: FileCoverageResult) => `
            <tr>
                <td>${file.path}</td>
                <td>${file.lines.toFixed(1)}%</td>
                <td>${file.statements.toFixed(1)}%</td>
                <td>${file.branches.toFixed(1)}%</td>
                <td>${file.functions.toFixed(1)}%</td>
            </tr>
            `).join('') || ''}
        </table>
    </div>
</body>
</html>`;
    
    await writeFile(outputPath, html);
    return outputPath;
  }

  private async generateJsonReport(data: any, outputPath: string): Promise<string> {
    await writeFile(outputPath, JSON.stringify(data, null, 2));
    return outputPath;
  }

  private async generateMarkdownReport(data: any, outputPath: string): Promise<string> {
    const markdown = `# Coverage Report

Generated: ${data.timestamp}

## Summary

Overall Status: ${data.summary.passed ? '✅ PASSED' : '❌ FAILED'}

| Metric | Coverage | Status |
|--------|----------|---------|
| Lines | ${data.summary.overall?.lines?.toFixed(1) || 0}% | ${data.summary.overall?.lines >= 80 ? '✅' : '❌'} |
| Statements | ${data.summary.overall?.statements?.toFixed(1) || 0}% | ${data.summary.overall?.statements >= 80 ? '✅' : '❌'} |
| Branches | ${data.summary.overall?.branches?.toFixed(1) || 0}% | ${data.summary.overall?.branches >= 70 ? '✅' : '❌'} |
| Functions | ${data.summary.overall?.functions?.toFixed(1) || 0}% | ${data.summary.overall?.functions >= 80 ? '✅' : '❌'} |

## File Coverage

| File | Lines | Statements | Branches | Functions |
|------|-------|------------|----------|-----------|
${data.results[0]?.files?.map((file: FileCoverageResult) => 
  `| ${file.path} | ${file.lines.toFixed(1)}% | ${file.statements.toFixed(1)}% | ${file.branches.toFixed(1)}% | ${file.functions.toFixed(1)}% |`
).join('\n') || ''}

${data.summary.violations > 0 ? `
## Violations

${data.results[0]?.violations?.map((v: CoverageViolation) => `- ${v.message}`).join('\n') || ''}
` : ''}
`;
    
    await writeFile(outputPath, markdown);
    return outputPath;
  }

  private createErrorResult(tool: string, error: Error): CoverageResult {
    return {
      tool,
      overall: { lines: 0, statements: 0, branches: 0, functions: 0 },
      files: [],
      summary: {
        totalLines: 0,
        coveredLines: 0,
        percentage: 0,
        threshold: 80,
        passed: false,
        improvements: [`Fix coverage tool error: ${error.message}`]
      },
      passed: false,
      violations: [{
        type: 'below_threshold',
        message: `Coverage analysis failed: ${error.message}`,
        metric: 'lines',
        current: 0,
        required: 80
      }]
    };
  }

  private async executeCommand(command: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn('bash', ['-c', command], { cwd });
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }
}

export const coverageAnalysisService = new CoverageAnalysisService();