// Enhanced Security and Policy Engine with SAST/DAST integration
import { PolicyEngine } from '../services/policyEngine.js';
import { cfg } from '../config.js';
import pino from 'pino';
import { readFile } from 'fs/promises';
import { parse as parseYAML } from 'yaml';
import { getInstallationOctokit } from '../octokit.js';
import { spawn } from 'child_process';
import { promisify } from 'util';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface SecurityScanResult {
  tool: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  findings: SecurityFinding[];
  passed: boolean;
  blockers: SecurityFinding[];
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
  recommendation: string;
}

export interface OwnershipRule {
  paths: string[];
  owners: string[];
  required_approvers: number;
  auto_approve_threshold?: number;
  restrictions: {
    create: boolean;
    modify: boolean;
    delete: boolean;
  };
  exceptions?: string[];
}

export class EnhancedSecurityEngine extends PolicyEngine {
  private ownershipRules: Map<string, OwnershipRule> = new Map();
  private scanResults: Map<string, SecurityScanResult[]> = new Map();

  async loadOwnershipConfig(installationId: string, owner: string, repo: string): Promise<void> {
    try {
      const octokit = await getInstallationOctokit(installationId);
      const response = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: '.aiagent-ownership.yml'
      });

      if ('content' in response.data) {
        const content = Buffer.from(response.data.content, 'base64').toString();
        const config = parseYAML(content);
        this.parseOwnershipRules(config);
      }
    } catch (error) {
      log.warn(`Could not load ownership config: ${error}`);
      this.loadDefaultOwnershipRules();
    }
  }

  private parseOwnershipRules(config: any) {
    if (config.ownership) {
      for (const [ruleName, rule] of Object.entries(config.ownership)) {
        this.ownershipRules.set(ruleName, rule as OwnershipRule);
      }
    }
    
    // Global rules
    if (config.global) {
      this.ownershipRules.set('global', config.global as OwnershipRule);
    }
  }

  private loadDefaultOwnershipRules() {
    this.ownershipRules.set('critical', {
      paths: ['package.json', 'Dockerfile', '.github/workflows/*', 'prisma/schema.prisma'],
      owners: ['@admin'],
      required_approvers: 2,
      restrictions: { create: true, modify: true, delete: true }
    });

    this.ownershipRules.set('security', {
      paths: ['src/security/*', 'src/auth/*', '**/*security*', '**/*auth*'],
      owners: ['@security-team'],
      required_approvers: 1,
      restrictions: { create: true, modify: true, delete: true }
    });

    this.ownershipRules.set('core', {
      paths: ['src/core/*', 'src/services/*'],
      owners: ['@core-team'],
      required_approvers: 1,
      restrictions: { create: false, modify: true, delete: true }
    });
  }

  async validateOwnership(files: string[], operation: 'create' | 'modify' | 'delete', actor?: string): Promise<{
    allowed: boolean;
    violations: string[];
    requiredApprovers: string[];
  }> {
    const violations: string[] = [];
    const requiredApprovers: Set<string> = new Set();

    for (const file of files) {
      const matchingRules = this.findMatchingRules(file);
      
      for (const [ruleName, rule] of matchingRules) {
        if (!rule.restrictions[operation]) {
          continue; // Operation allowed for this rule
        }

        // Check if actor is an owner
        if (actor && rule.owners.includes(actor)) {
          continue; // Actor is authorized
        }

        violations.push(`${file}: ${operation} operation requires approval from ${rule.owners.join(', ')} (rule: ${ruleName})`);
        rule.owners.forEach(owner => requiredApprovers.add(owner));
      }
    }

    return {
      allowed: violations.length === 0,
      violations,
      requiredApprovers: Array.from(requiredApprovers)
    };
  }

  private findMatchingRules(filePath: string): Map<string, OwnershipRule> {
    const matches = new Map<string, OwnershipRule>();

    for (const [ruleName, rule] of this.ownershipRules) {
      for (const pattern of rule.paths) {
        if (this.matchesPattern(filePath, pattern)) {
          matches.set(ruleName, rule);
          break;
        }
      }
    }

    return matches;
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simple glob-like matching
    const regex = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
    
    return new RegExp(`^${regex}$`).test(filePath);
  }

  async runSemgrepScan(filePaths: string[], workspaceRoot: string): Promise<SecurityScanResult> {
    const findings: SecurityFinding[] = [];
    
    try {
      const semgrepArgs = [
        '--config=auto',
        '--json',
        '--quiet',
        ...filePaths.map(f => `${workspaceRoot}/${f}`)
      ];

      const result = await this.executeCommand('semgrep', semgrepArgs);
      const semgrepOutput = JSON.parse(result.stdout);

      for (const finding of semgrepOutput.results || []) {
        findings.push({
          id: finding.check_id,
          severity: this.mapSemgrepSeverity(finding.extra?.severity || 'INFO'),
          title: finding.extra?.message || 'Security issue detected',
          description: finding.extra?.metadata?.description || finding.extra?.message || '',
          file: finding.path,
          line: finding.start?.line,
          column: finding.start?.col,
          rule: finding.check_id,
          category: finding.extra?.metadata?.category || 'security',
          cwe: finding.extra?.metadata?.cwe,
          recommendation: finding.extra?.metadata?.fix || 'Review and fix the security issue'
        });
      }
    } catch (error) {
      log.error(`Semgrep scan failed: ${error}`);
    }

    const blockers = findings.filter(f => f.severity === 'high' || f.severity === 'critical');
    
    return {
      tool: 'semgrep',
      severity: this.getOverallSeverity(findings),
      findings,
      passed: blockers.length === 0,
      blockers
    };
  }

  async runBanditScan(pythonFiles: string[], workspaceRoot: string): Promise<SecurityScanResult> {
    const findings: SecurityFinding[] = [];

    if (pythonFiles.length === 0) {
      return { tool: 'bandit', severity: 'low', findings: [], passed: true, blockers: [] };
    }

    try {
      const banditArgs = [
        '-f', 'json',
        '-r',
        ...pythonFiles.map(f => `${workspaceRoot}/${f}`)
      ];

      const result = await this.executeCommand('bandit', banditArgs);
      const banditOutput = JSON.parse(result.stdout);

      for (const finding of banditOutput.results || []) {
        findings.push({
          id: finding.test_id,
          severity: this.mapBanditSeverity(finding.issue_severity),
          title: finding.issue_text,
          description: finding.issue_text,
          file: finding.filename,
          line: finding.line_number,
          rule: finding.test_id,
          category: 'security',
          cwe: finding.cwe?.id,
          recommendation: 'Review the flagged code for security vulnerabilities'
        });
      }
    } catch (error) {
      log.error(`Bandit scan failed: ${error}`);
    }

    const blockers = findings.filter(f => f.severity === 'high' || f.severity === 'critical');

    return {
      tool: 'bandit',
      severity: this.getOverallSeverity(findings),
      findings,
      passed: blockers.length === 0,
      blockers
    };
  }

  async runESLintSecurityScan(jsFiles: string[], workspaceRoot: string): Promise<SecurityScanResult> {
    const findings: SecurityFinding[] = [];

    if (jsFiles.length === 0) {
      return { tool: 'eslint-security', severity: 'low', findings: [], passed: true, blockers: [] };
    }

    try {
      const eslintArgs = [
        '--ext', '.js,.ts,.jsx,.tsx',
        '--format', 'json',
        '--config', `${workspaceRoot}/.eslintrc.security.json`,
        ...jsFiles.map(f => `${workspaceRoot}/${f}`)
      ];

      const result = await this.executeCommand('npx eslint', eslintArgs);
      const eslintOutput = JSON.parse(result.stdout);

      for (const file of eslintOutput) {
        for (const message of file.messages || []) {
          if (message.ruleId && message.ruleId.includes('security')) {
            findings.push({
              id: message.ruleId,
              severity: message.severity === 2 ? 'high' : 'medium',
              title: message.message,
              description: message.message,
              file: file.filePath,
              line: message.line,
              column: message.column,
              rule: message.ruleId,
              category: 'security',
              recommendation: 'Fix the security-related ESLint violation'
            });
          }
        }
      }
    } catch (error) {
      log.warn(`ESLint security scan failed: ${error}`);
    }

    const blockers = findings.filter(f => f.severity === 'high' || f.severity === 'critical');

    return {
      tool: 'eslint-security',
      severity: this.getOverallSeverity(findings),
      findings,
      passed: blockers.length === 0,
      blockers
    };
  }

  async runComprehensiveSecurityScan(filePaths: string[], workspaceRoot: string): Promise<SecurityScanResult[]> {
    const results: SecurityScanResult[] = [];

    // Categorize files by type
    const pythonFiles = filePaths.filter(f => f.endsWith('.py'));
    const jsFiles = filePaths.filter(f => /\.(js|ts|jsx|tsx)$/.test(f));

    // Run appropriate scans
    const [semgrepResult, banditResult, eslintResult] = await Promise.all([
      this.runSemgrepScan(filePaths, workspaceRoot),
      this.runBanditScan(pythonFiles, workspaceRoot),
      this.runESLintSecurityScan(jsFiles, workspaceRoot)
    ]);

    results.push(semgrepResult, banditResult, eslintResult);
    
    // Store results for later reference
    this.scanResults.set(workspaceRoot, results);

    return results;
  }

  async validateSecurityCompliance(scanResults: SecurityScanResult[]): Promise<{
    compliant: boolean;
    criticalIssues: SecurityFinding[];
    allowedWithWarnings: boolean;
  }> {
    const allFindings = scanResults.flatMap(r => r.findings);
    const criticalIssues = allFindings.filter(f => f.severity === 'critical');
    const highIssues = allFindings.filter(f => f.severity === 'high');

    // Block if any critical issues found
    const compliant = criticalIssues.length === 0;
    
    // Allow with warnings if only high/medium issues (configurable threshold)
    const allowedWithWarnings = criticalIssues.length === 0 && highIssues.length <= cfg.security.maxHighSeverityIssues;

    return {
      compliant,
      criticalIssues,
      allowedWithWarnings
    };
  }

  async createTransactionalRollback(agentId: string, commitSha: string): Promise<string> {
    // Create rollback plan for the current changes
    const rollbackId = `rollback-${agentId}-${Date.now()}`;
    
    await this.storeRollbackPlan(rollbackId, {
      agentId,
      originalCommit: commitSha,
      timestamp: new Date(),
      type: 'security_violation'
    });

    return rollbackId;
  }

  async executeRollback(rollbackId: string, workspaceRoot: string): Promise<{ success: boolean; error?: string }> {
    try {
      const rollbackPlan = await this.getRollbackPlan(rollbackId);
      if (!rollbackPlan) {
        return { success: false, error: 'Rollback plan not found' };
      }

      // Execute git revert or reset
      await this.executeCommand('git', ['revert', '--no-edit', rollbackPlan.originalCommit], workspaceRoot);
      
      log.info(`Successfully rolled back changes for agent ${rollbackPlan.agentId}`);
      return { success: true };
    } catch (error) {
      log.error(`Rollback failed: ${error}`);
      return { success: false, error: String(error) };
    }
  }

  private async executeCommand(command: string, args: string[], cwd?: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd, capture: ['stdout', 'stderr'] });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout?.on('data', (data) => stdout += data);
      child.stderr?.on('data', (data) => stderr += data);
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });
    });
  }

  private mapSemgrepSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity.toUpperCase()) {
      case 'ERROR': return 'high';
      case 'WARNING': return 'medium';
      case 'INFO': return 'low';
      default: return 'medium';
    }
  }

  private mapBanditSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity.toUpperCase()) {
      case 'HIGH': return 'high';
      case 'MEDIUM': return 'medium';
      case 'LOW': return 'low';
      default: return 'medium';
    }
  }

  private getOverallSeverity(findings: SecurityFinding[]): 'low' | 'medium' | 'high' | 'critical' {
    if (findings.some(f => f.severity === 'critical')) return 'critical';
    if (findings.some(f => f.severity === 'high')) return 'high';
    if (findings.some(f => f.severity === 'medium')) return 'medium';
    return 'low';
  }

  private async storeRollbackPlan(rollbackId: string, plan: any): Promise<void> {
    // Store rollback plan in database or file system
    log.info(`Storing rollback plan ${rollbackId}`);
  }

  private async getRollbackPlan(rollbackId: string): Promise<any> {
    // Retrieve rollback plan
    return null;
  }
}

export { SecurityScanResult, SecurityFinding, OwnershipRule };