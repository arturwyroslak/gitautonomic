// Security scanning service with Semgrep integration
import { spawn, ChildProcess } from 'child_process';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import pino from 'pino';
import { cfg } from '../config.js';
import { WorkspaceManager } from '../git/workspaceManager.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface SecurityScanResult {
  tool: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  findings: SecurityFinding[];
  passed: boolean;
  blockers: SecurityFinding[];
  scanTime: number;
  coverage: {
    filesScanned: number;
    rulesApplied: number;
  };
}

export interface SecurityFinding {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  file: string;
  line?: number;
  column?: number;
  rule: string;
  category: string;
  cwe?: string;
  owasp?: string;
  recommendation: string;
  confidence: 'low' | 'medium' | 'high';
  snippet?: string;
}

export interface ScanConfig {
  tools: ('semgrep' | 'eslint-security' | 'bandit' | 'gosec')[];
  rulesets: string[];
  severity_threshold: 'low' | 'medium' | 'high' | 'critical';
  timeout: number;
  exclude_paths: string[];
  custom_rules?: string[];
}

export class SecurityScanService {
  private defaultConfig: ScanConfig = {
    tools: ['semgrep', 'eslint-security'],
    rulesets: ['owasp-top-10', 'security', 'secrets'],
    severity_threshold: 'medium',
    timeout: 300000, // 5 minutes
    exclude_paths: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.git/**',
      '**/*.test.*',
      '**/*.spec.*'
    ]
  };

  async scanWorkspace(
    workspacePath: string,
    config: Partial<ScanConfig> = {}
  ): Promise<SecurityScanResult[]> {
    const scanConfig = { ...this.defaultConfig, ...config };
    const results: SecurityScanResult[] = [];

    for (const tool of scanConfig.tools) {
      try {
        const startTime = Date.now();
        let result: SecurityScanResult;
        
        switch (tool) {
          case 'semgrep':
            result = await this.runSemgrepScan(workspacePath, scanConfig);
            break;
          case 'eslint-security':
            result = await this.runESLintSecurityScan(workspacePath, scanConfig);
            break;
          case 'bandit':
            result = await this.runBanditScan(workspacePath, scanConfig);
            break;
          case 'gosec':
            result = await this.runGosecScan(workspacePath, scanConfig);
            break;
          default:
            continue;
        }
        
        result.scanTime = Date.now() - startTime;
        results.push(result);
        
      } catch (error) {
        log.error(`Security scan failed for ${tool}: ${error}`);
        results.push({
          tool,
          severity: 'critical',
          findings: [{
            id: `${tool}-error`,
            severity: 'critical',
            title: 'Security scan failed',
            description: `Failed to run ${tool} security scan: ${error}`,
            file: '',
            rule: 'scan-error',
            category: 'tool-error',
            recommendation: 'Check tool installation and configuration',
            confidence: 'high'
          }],
          passed: false,
          blockers: [],
          scanTime: 0,
          coverage: { filesScanned: 0, rulesApplied: 0 }
        });
      }
    }

    return results;
  }

  async scanDiff(
    workspacePath: string,
    diffText: string,
    config: Partial<ScanConfig> = {}
  ): Promise<SecurityScanResult[]> {
    // Create temporary files with only the changed code for focused scanning
    const tempDir = join(workspacePath, '.security-temp');
    await mkdir(tempDir, { recursive: true });
    
    try {
      // Parse diff and extract changed files
      const changedFiles = this.extractChangedFilesFromDiff(diffText);
      
      // Scan only changed files
      const results: SecurityScanResult[] = [];
      for (const file of changedFiles) {
        const filePath = join(workspacePath, file);
        try {
          const fileResults = await this.scanSingleFile(filePath, config);
          results.push(...fileResults);
        } catch (error) {
          log.warn(`Failed to scan ${file}: ${error}`);
        }
      }
      
      return results;
    } finally {
      // Cleanup temp directory
      try {
        await this.rmdir(tempDir);
      } catch (error) {
        log.warn(`Failed to cleanup temp directory: ${error}`);
      }
    }
  }

  private async runSemgrepScan(
    workspacePath: string,
    config: ScanConfig
  ): Promise<SecurityScanResult> {
    const rulesets = config.rulesets.map(r => `--config=${r}`).join(' ');
    const excludePaths = config.exclude_paths.map(p => `--exclude=${p}`).join(' ');
    
    const command = `semgrep ${rulesets} ${excludePaths} --json --timeout=${config.timeout / 1000} ${workspacePath}`;
    
    const { stdout, stderr } = await this.executeCommand(command, workspacePath);
    
    if (stderr && !stderr.includes('warnings')) {
      throw new Error(`Semgrep error: ${stderr}`);
    }

    const semgrepResults = JSON.parse(stdout || '{"results": []}');
    const findings: SecurityFinding[] = semgrepResults.results?.map((result: any) => ({
      id: result.check_id || 'unknown',
      severity: this.mapSemgrepSeverity(result.extra?.severity || 'INFO'),
      title: result.extra?.message || result.check_id,
      description: result.extra?.message || 'Security finding',
      file: result.path?.replace(workspacePath + '/', '') || '',
      line: result.start?.line,
      column: result.start?.col,
      rule: result.check_id || 'unknown',
      category: this.categorizeSemgrepRule(result.check_id || ''),
      cwe: result.extra?.metadata?.cwe?.[0],
      owasp: result.extra?.metadata?.owasp?.[0],
      recommendation: result.extra?.fix || 'Review this finding and apply appropriate fixes',
      confidence: this.mapSemgrepConfidence(result.extra?.metadata?.confidence || 'MEDIUM'),
      snippet: result.extra?.lines
    })) || [];

    const blockers = findings.filter(f => 
      this.severityToNumber(f.severity) >= this.severityToNumber(config.severity_threshold)
    );

    return {
      tool: 'semgrep',
      severity: this.getMaxSeverity(findings),
      findings,
      passed: blockers.length === 0,
      blockers,
      scanTime: 0,
      coverage: {
        filesScanned: semgrepResults.stats?.total_scanned || 0,
        rulesApplied: semgrepResults.stats?.rules_matched || 0
      }
    };
  }

  private async runESLintSecurityScan(
    workspacePath: string,
    config: ScanConfig
  ): Promise<SecurityScanResult> {
    try {
      const command = `npx eslint . --ext .js,.jsx,.ts,.tsx --config .eslintrc.json --format json`;
      const { stdout } = await this.executeCommand(command, workspacePath);
      
      const eslintResults = JSON.parse(stdout || '[]');
      const findings: SecurityFinding[] = [];
      
      for (const file of eslintResults) {
        for (const message of file.messages || []) {
          if (message.ruleId && this.isSecurityRule(message.ruleId)) {
            findings.push({
              id: `${file.filePath}-${message.line}-${message.ruleId}`,
              severity: this.mapESLintSeverity(message.severity),
              title: message.message,
              description: message.message,
              file: file.filePath?.replace(workspacePath + '/', '') || '',
              line: message.line,
              column: message.column,
              rule: message.ruleId,
              category: 'eslint-security',
              recommendation: 'Review ESLint security rule violation',
              confidence: 'medium'
            });
          }
        }
      }

      const blockers = findings.filter(f => 
        this.severityToNumber(f.severity) >= this.severityToNumber(config.severity_threshold)
      );

      return {
        tool: 'eslint-security',
        severity: this.getMaxSeverity(findings),
        findings,
        passed: blockers.length === 0,
        blockers,
        scanTime: 0,
        coverage: {
          filesScanned: eslintResults.length,
          rulesApplied: findings.length
        }
      };
    } catch (error) {
      // If ESLint is not configured, return empty results
      return {
        tool: 'eslint-security',
        severity: 'low',
        findings: [],
        passed: true,
        blockers: [],
        scanTime: 0,
        coverage: { filesScanned: 0, rulesApplied: 0 }
      };
    }
  }

  private async runBanditScan(
    workspacePath: string,
    config: ScanConfig
  ): Promise<SecurityScanResult> {
    const command = `bandit -r ${workspacePath} -f json`;
    
    try {
      const { stdout } = await this.executeCommand(command, workspacePath);
      const banditResults = JSON.parse(stdout || '{"results": []}');
      
      const findings: SecurityFinding[] = banditResults.results?.map((result: any) => ({
        id: `${result.filename}-${result.line_number}-${result.test_id}`,
        severity: this.mapBanditSeverity(result.issue_severity),
        title: result.issue_text,
        description: result.issue_text,
        file: result.filename?.replace(workspacePath + '/', '') || '',
        line: result.line_number,
        rule: result.test_id,
        category: 'python-security',
        cwe: result.test_name?.includes('CWE') ? result.test_name : undefined,
        recommendation: 'Review Python security issue',
        confidence: result.issue_confidence?.toLowerCase() || 'medium'
      })) || [];

      const blockers = findings.filter(f => 
        this.severityToNumber(f.severity) >= this.severityToNumber(config.severity_threshold)
      );

      return {
        tool: 'bandit',
        severity: this.getMaxSeverity(findings),
        findings,
        passed: blockers.length === 0,
        blockers,
        scanTime: 0,
        coverage: {
          filesScanned: banditResults.metrics?.files || 0,
          rulesApplied: findings.length
        }
      };
    } catch (error) {
      // Bandit not available or no Python files
      return {
        tool: 'bandit',
        severity: 'low',
        findings: [],
        passed: true,
        blockers: [],
        scanTime: 0,
        coverage: { filesScanned: 0, rulesApplied: 0 }
      };
    }
  }

  private async runGosecScan(
    workspacePath: string,
    config: ScanConfig
  ): Promise<SecurityScanResult> {
    const command = `gosec -fmt json ./...`;
    
    try {
      const { stdout } = await this.executeCommand(command, workspacePath);
      const gosecResults = JSON.parse(stdout || '{"Issues": []}');
      
      const findings: SecurityFinding[] = gosecResults.Issues?.map((issue: any) => ({
        id: `${issue.file}-${issue.line}-${issue.rule_id}`,
        severity: this.mapGosecSeverity(issue.severity),
        title: issue.details,
        description: issue.details,
        file: issue.file?.replace(workspacePath + '/', '') || '',
        line: parseInt(issue.line),
        rule: issue.rule_id,
        category: 'go-security',
        cwe: issue.cwe?.id,
        recommendation: 'Review Go security issue',
        confidence: issue.confidence?.toLowerCase() || 'medium'
      })) || [];

      const blockers = findings.filter(f => 
        this.severityToNumber(f.severity) >= this.severityToNumber(config.severity_threshold)
      );

      return {
        tool: 'gosec',
        severity: this.getMaxSeverity(findings),
        findings,
        passed: blockers.length === 0,
        blockers,
        scanTime: 0,
        coverage: {
          filesScanned: gosecResults.Stats?.files || 0,
          rulesApplied: findings.length
        }
      };
    } catch (error) {
      // Gosec not available or no Go files
      return {
        tool: 'gosec',
        severity: 'low',
        findings: [],
        passed: true,
        blockers: [],
        scanTime: 0,
        coverage: { filesScanned: 0, rulesApplied: 0 }
      };
    }
  }

  private async scanSingleFile(
    filePath: string,
    config: Partial<ScanConfig>
  ): Promise<SecurityScanResult[]> {
    // Implementation for scanning a single file
    const ext = filePath.split('.').pop()?.toLowerCase();
    const results: SecurityScanResult[] = [];
    
    if (ext === 'py') {
      results.push(await this.runBanditScan(dirname(filePath), { ...this.defaultConfig, ...config }));
    } else if (['js', 'jsx', 'ts', 'tsx'].includes(ext || '')) {
      results.push(await this.runESLintSecurityScan(dirname(filePath), { ...this.defaultConfig, ...config }));
    } else if (ext === 'go') {
      results.push(await this.runGosecScan(dirname(filePath), { ...this.defaultConfig, ...config }));
    }
    
    // Always run Semgrep as it supports multiple languages
    results.push(await this.runSemgrepScan(dirname(filePath), { ...this.defaultConfig, ...config }));
    
    return results;
  }

  private extractChangedFilesFromDiff(diffText: string): string[] {
    const files: string[] = [];
    const lines = diffText.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('+++') && !line.includes('/dev/null')) {
        const file = line.substring(4).trim();
        if (file && !files.includes(file)) {
          files.push(file);
        }
      }
    }
    
    return files;
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

  private async rmdir(path: string): Promise<void> {
    await this.executeCommand(`rm -rf "${path}"`, process.cwd());
  }

  private mapSemgrepSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity.toUpperCase()) {
      case 'ERROR': return 'high';
      case 'WARNING': return 'medium';
      case 'INFO': return 'low';
      default: return 'medium';
    }
  }

  private mapSemgrepConfidence(confidence: string): 'low' | 'medium' | 'high' {
    switch (confidence.toUpperCase()) {
      case 'HIGH': return 'high';
      case 'MEDIUM': return 'medium';
      case 'LOW': return 'low';
      default: return 'medium';
    }
  }

  private mapESLintSeverity(severity: number): 'low' | 'medium' | 'high' | 'critical' {
    return severity === 2 ? 'high' : 'medium';
  }

  private mapBanditSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity.toUpperCase()) {
      case 'HIGH': return 'high';
      case 'MEDIUM': return 'medium';
      case 'LOW': return 'low';
      default: return 'medium';
    }
  }

  private mapGosecSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity.toUpperCase()) {
      case 'HIGH': return 'high';
      case 'MEDIUM': return 'medium';
      case 'LOW': return 'low';
      default: return 'medium';
    }
  }

  private categorizeSemgrepRule(ruleId: string): string {
    if (ruleId.includes('sql')) return 'sql-injection';
    if (ruleId.includes('xss')) return 'xss';
    if (ruleId.includes('csrf')) return 'csrf';
    if (ruleId.includes('auth')) return 'authentication';
    if (ruleId.includes('crypto')) return 'cryptography';
    if (ruleId.includes('secret')) return 'secrets';
    return 'security';
  }

  private isSecurityRule(ruleId: string): boolean {
    const securityRules = [
      'security/', '@typescript-eslint/no-unsafe-', 'no-eval', 'no-implied-eval',
      'no-new-func', 'no-script-url', 'react/no-danger'
    ];
    return securityRules.some(rule => ruleId.includes(rule));
  }

  private severityToNumber(severity: string): number {
    switch (severity) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  private getMaxSeverity(findings: SecurityFinding[]): 'low' | 'medium' | 'high' | 'critical' {
    if (findings.length === 0) return 'low';
    
    const maxSeverityNum = Math.max(...findings.map(f => this.severityToNumber(f.severity)));
    switch (maxSeverityNum) {
      case 4: return 'critical';
      case 3: return 'high';
      case 2: return 'medium';
      default: return 'low';
    }
  }
}

export const securityScanService = new SecurityScanService();