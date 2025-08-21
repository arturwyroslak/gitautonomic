// Enhanced Security and Policy Engine with SAST/DAST integration
import { PolicyEngine } from '../services/policyEngine.js';
import { securityScanService, SecurityScanResult, SecurityFinding } from '../services/securityScanService.js';
import { cfg } from '../config.js';
import pino from 'pino';
import { readFile } from 'fs/promises';
import { parse as parseYAML } from 'yaml';
import { getInstallationOctokit } from '../octokit.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

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

  async scanCodeChanges(
    workspacePath: string,
    diffText?: string,
    config?: any
  ): Promise<{ 
    results: SecurityScanResult[]; 
    passed: boolean; 
    blockers: SecurityFinding[];
    summary: string;
  }> {
    try {
      const scanConfig = {
        tools: config?.security?.tools || ['semgrep', 'eslint-security'],
        rulesets: config?.security?.rulesets || ['owasp-top-10', 'security'],
        severity_threshold: config?.security?.severity_threshold || 'medium',
        timeout: config?.security?.timeout || 300000,
        exclude_paths: config?.security?.exclude_paths || []
      };

      let results: SecurityScanResult[];
      
      if (diffText) {
        // Scan only changed code for faster feedback
        results = await securityScanService.scanDiff(workspacePath, diffText, scanConfig);
      } else {
        // Full workspace scan
        results = await securityScanService.scanWorkspace(workspacePath, scanConfig);
      }

      this.scanResults.set(workspacePath, results);

      const allBlockers = results.flatMap(r => r.blockers);
      const passed = allBlockers.length === 0;
      
      const summary = this.generateSecuritySummary(results);
      
      log.info(`Security scan completed: ${results.length} tools, ${allBlockers.length} blockers, passed: ${passed}`);
      
      return { results, passed, blockers: allBlockers, summary };
      
    } catch (error) {
      log.error(`Security scan failed: ${error}`);
      throw error;
    }
  }

  async validateAgainstPolicies(
    filePaths: string[],
    changeType: 'create' | 'modify' | 'delete',
    author: string
  ): Promise<{
    allowed: boolean;
    violations: string[];
    requiredApprovers: string[];
  }> {
    const violations: string[] = [];
    const requiredApprovers: Set<string> = new Set();

    for (const filePath of filePaths) {
      const applicableRules = this.findApplicableRules(filePath);
      
      for (const rule of applicableRules) {
        // Check if action is restricted
        if (rule.restrictions[changeType] && !rule.owners.includes(`@${author}`)) {
          violations.push(`${changeType} operation on ${filePath} requires owner approval`);
          rule.owners.forEach(owner => requiredApprovers.add(owner));
        }
        
        // Check if approvers are required
        if (rule.required_approvers > 0) {
          rule.owners.forEach(owner => requiredApprovers.add(owner));
        }
      }
    }

    return {
      allowed: violations.length === 0,
      violations,
      requiredApprovers: Array.from(requiredApprovers)
    };
  }

  private generateSecuritySummary(results: SecurityScanResult[]): string {
    const totalFindings = results.reduce((sum, r) => sum + r.findings.length, 0);
    const totalBlockers = results.reduce((sum, r) => sum + r.blockers.length, 0);
    const toolsUsed = results.map(r => r.tool).join(', ');
    
    if (totalBlockers === 0) {
      return `✅ Security scan passed. ${totalFindings} findings detected (none blocking). Tools: ${toolsUsed}`;
    } else {
      return `❌ Security scan failed. ${totalBlockers} blocking issues found out of ${totalFindings} total findings. Tools: ${toolsUsed}`;
    }
  }

  private findApplicableRules(filePath: string): OwnershipRule[] {
    const applicableRules: OwnershipRule[] = [];
    
    for (const [ruleName, rule] of this.ownershipRules) {
      for (const pathPattern of rule.paths) {
        if (this.matchesFilePattern(filePath, pathPattern)) {
          applicableRules.push(rule);
          break;
        }
      }
    }
    
    return applicableRules;
  }

  private matchesFilePattern(filePath: string, pattern: string): boolean {
    // Simple glob pattern matching
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }
}