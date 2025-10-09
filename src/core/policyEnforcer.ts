// Enhanced Policy Enforcement for .aiagent-ownership.yml
import pino from 'pino';
import * as yaml from 'yaml';
import { readFile } from 'fs/promises';
import { minimatch } from 'minimatch';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface OwnershipRule {
  paths: string[];
  permissions: Permission[];
  restrictions?: Restriction[];
}

export interface GlobalRestrictions {
  max_files_per_commit?: number;
  max_lines_changed_per_file?: number;
  require_tests_for_new_features?: boolean;
  preserve_existing_apis?: boolean;
}

export interface OwnershipPolicy {
  ownership_rules: OwnershipRule[];
  global_restrictions?: GlobalRestrictions;
}

export type Permission = 'read' | 'write' | 'create' | 'delete';

export interface Restriction {
  no_bulk_delete?: boolean;
  preserve_exports?: boolean;
  require_approval?: boolean;
  no_delete?: boolean;
  require_migration?: boolean;
  backup_required?: boolean;
  preserve_structure?: boolean;
  no_modify?: boolean;
}

export interface FileOperation {
  path: string;
  operation: 'create' | 'read' | 'write' | 'delete';
  content?: string;
  linesChanged?: number;
}

export interface PolicyViolation {
  file: string;
  operation: string;
  violation: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

export interface PolicyCheckResult {
  allowed: boolean;
  violations: PolicyViolation[];
  warnings: PolicyViolation[];
  requiredApprovals: string[];
  backupRequired: boolean;
}

export class PolicyEnforcer {
  private policy: OwnershipPolicy | null = null;
  private policyPath: string;

  constructor(policyPath: string = '.aiagent-ownership.yml') {
    this.policyPath = policyPath;
  }

  async loadPolicy(): Promise<void> {
    try {
      const content = await readFile(this.policyPath, 'utf8');
      this.policy = yaml.parse(content) as OwnershipPolicy;
      log.info('Policy loaded successfully from ' + this.policyPath);
    } catch (error) {
      log.warn(`Failed to load policy from ${this.policyPath}: ${error}`);
      this.policy = this.getDefaultPolicy();
    }
  }

  private getDefaultPolicy(): OwnershipPolicy {
    return {
      ownership_rules: [
        {
          paths: ['src/**'],
          permissions: ['read', 'write', 'create'],
          restrictions: [{ preserve_exports: true }]
        },
        {
          paths: ['.git/**', 'node_modules/**'],
          permissions: ['read'],
          restrictions: [{ no_modify: true }]
        }
      ],
      global_restrictions: {
        max_files_per_commit: 20,
        max_lines_changed_per_file: 500
      }
    };
  }

  async checkFileOperations(operations: FileOperation[]): Promise<PolicyCheckResult> {
    if (!this.policy) {
      await this.loadPolicy();
    }

    const result: PolicyCheckResult = {
      allowed: true,
      violations: [],
      warnings: [],
      requiredApprovals: [],
      backupRequired: false
    };

    // Check global restrictions first
    await this.checkGlobalRestrictions(operations, result);

    // Check individual file operations
    for (const operation of operations) {
      await this.checkFileOperation(operation, result);
    }

    // Set overall allowed status
    result.allowed = result.violations.length === 0;

    return result;
  }

  private async checkGlobalRestrictions(
    operations: FileOperation[],
    result: PolicyCheckResult
  ): Promise<void> {
    const global = this.policy?.global_restrictions;
    if (!global) return;

    // Check max files per commit
    if (global.max_files_per_commit && operations.length > global.max_files_per_commit) {
      result.violations.push({
        file: '<global>',
        operation: 'commit',
        violation: `Too many files in commit: ${operations.length} > ${global.max_files_per_commit}`,
        severity: 'error',
        suggestion: 'Split changes into smaller commits'
      });
    }

    // Check max lines changed per file
    if (global.max_lines_changed_per_file) {
      for (const op of operations) {
        if (op.linesChanged && op.linesChanged > global.max_lines_changed_per_file) {
          result.violations.push({
            file: op.path,
            operation: op.operation,
            violation: `Too many lines changed: ${op.linesChanged} > ${global.max_lines_changed_per_file}`,
            severity: 'error',
            suggestion: 'Break changes into smaller, focused modifications'
          });
        }
      }
    }

    // Check for tests when creating new features
    if (global.require_tests_for_new_features) {
      const newFeatureFiles = operations.filter(op => 
        op.operation === 'create' && 
        op.path.includes('src/') && 
        !op.path.includes('.test.') && 
        !op.path.includes('.spec.')
      );

      const testFiles = operations.filter(op => 
        op.path.includes('.test.') || op.path.includes('.spec.')
      );

      if (newFeatureFiles.length > 0 && testFiles.length === 0) {
        result.warnings.push({
          file: '<global>',
          operation: 'create',
          violation: 'New features require corresponding tests',
          severity: 'warning',
          suggestion: 'Add test files for new functionality'
        });
      }
    }
  }

  private async checkFileOperation(
    operation: FileOperation,
    result: PolicyCheckResult
  ): Promise<void> {
    const matchingRules = this.findMatchingRules(operation.path);
    
    if (matchingRules.length === 0) {
      result.violations.push({
        file: operation.path,
        operation: operation.operation,
        violation: 'No ownership rule matches this file path',
        severity: 'error',
        suggestion: 'Add appropriate ownership rule or avoid modifying this file'
      });
      return;
    }

    // Check the most specific rule (last match wins)
    const rule = matchingRules[matchingRules.length - 1];
    if (rule) {
      await this.checkRuleCompliance(operation, rule, result);
    }
  }

  private findMatchingRules(filePath: string): OwnershipRule[] {
    if (!this.policy) return [];

    return this.policy.ownership_rules.filter(rule =>
      rule.paths.some(pattern => minimatch(filePath, pattern))
    );
  }

  private async checkRuleCompliance(
    operation: FileOperation,
    rule: OwnershipRule,
    result: PolicyCheckResult
  ): Promise<void> {
    // Check permission
    if (!rule.permissions.includes(operation.operation)) {
      result.violations.push({
        file: operation.path,
        operation: operation.operation,
        violation: `Operation '${operation.operation}' not permitted for this file`,
        severity: 'error',
        suggestion: `Allowed operations: ${rule.permissions.join(', ')}`
      });
      return;
    }

    // Check restrictions
    if (rule.restrictions) {
      for (const restriction of rule.restrictions) {
        await this.checkRestriction(operation, restriction, result);
      }
    }
  }

  private async checkRestriction(
    operation: FileOperation,
    restriction: Restriction,
    result: PolicyCheckResult
  ): Promise<void> {
    // No modify restriction
    if (restriction.no_modify && (operation.operation === 'write' || operation.operation === 'delete')) {
      result.violations.push({
        file: operation.path,
        operation: operation.operation,
        violation: 'File is protected from modifications',
        severity: 'error',
        suggestion: 'This file cannot be modified by the AI agent'
      });
    }

    // No delete restriction
    if (restriction.no_delete && operation.operation === 'delete') {
      result.violations.push({
        file: operation.path,
        operation: operation.operation,
        violation: 'File cannot be deleted',
        severity: 'error',
        suggestion: 'Consider modifying instead of deleting'
      });
    }

    // Require approval restriction
    if (restriction.require_approval && operation.operation === 'write') {
      result.requiredApprovals.push(operation.path);
      result.warnings.push({
        file: operation.path,
        operation: operation.operation,
        violation: 'Modification requires human approval',
        severity: 'warning',
        suggestion: 'Submit for review before applying changes'
      });
    }

    // Backup required restriction
    if (restriction.backup_required && operation.operation === 'write') {
      result.backupRequired = true;
      result.warnings.push({
        file: operation.path,
        operation: operation.operation,
        violation: 'Backup required before modification',
        severity: 'info',
        suggestion: 'Create backup before applying changes'
      });
    }

    // Preserve exports restriction (simplified check)
    if (restriction.preserve_exports && operation.operation === 'write' && operation.content) {
      const hasExports = /export\s+(class|function|const|let|var|default|interface|type)/g.test(operation.content);
      if (!hasExports && operation.path.endsWith('.ts')) {
        result.warnings.push({
          file: operation.path,
          operation: operation.operation,
          violation: 'File should preserve existing exports',
          severity: 'warning',
          suggestion: 'Ensure existing exports are maintained'
        });
      }
    }

    // Require migration restriction
    if (restriction.require_migration && operation.operation === 'write') {
      result.warnings.push({
        file: operation.path,
        operation: operation.operation,
        violation: 'Database schema change requires migration',
        severity: 'warning',
        suggestion: 'Generate and run database migration'
      });
    }

    // No bulk delete restriction
    if (restriction.no_bulk_delete && operation.operation === 'delete') {
      // This would need context about other operations to determine if it's bulk
      result.warnings.push({
        file: operation.path,
        operation: operation.operation,
        violation: 'Bulk delete operations should be avoided',
        severity: 'warning',
        suggestion: 'Consider individual file deletions with justification'
      });
    }
  }

  async validateCommit(operations: FileOperation[]): Promise<PolicyCheckResult> {
    log.info(`Validating commit with ${operations.length} file operations`);
    
    const result = await this.checkFileOperations(operations);
    
    // Log results
    if (result.violations.length > 0) {
      log.warn(`Policy violations found: ${result.violations.length}`);
      for (const violation of result.violations) {
        log.warn(`${violation.file}: ${violation.violation}`);
      }
    }

    if (result.warnings.length > 0) {
      log.info(`Policy warnings: ${result.warnings.length}`);
      for (const warning of result.warnings) {
        log.info(`${warning.file}: ${warning.violation}`);
      }
    }

    if (result.requiredApprovals.length > 0) {
      log.info(`Files requiring approval: ${result.requiredApprovals.join(', ')}`);
    }

    return result;
  }

  formatViolationReport(result: PolicyCheckResult): string {
    let report = '## 🛡️ Policy Enforcement Report\n\n';
    
    if (result.allowed) {
      report += '✅ **All operations comply with ownership policies**\n\n';
    } else {
      report += '❌ **Policy violations detected**\n\n';
    }

    if (result.violations.length > 0) {
      report += '### Violations\n';
      for (const violation of result.violations) {
        const icon = violation.severity === 'error' ? '🚫' : '⚠️';
        report += `${icon} **${violation.file}** (${violation.operation}): ${violation.violation}\n`;
        if (violation.suggestion) {
          report += `   💡 *${violation.suggestion}*\n`;
        }
        report += '\n';
      }
    }

    if (result.warnings.length > 0) {
      report += '### Warnings\n';
      for (const warning of result.warnings) {
        report += `⚠️ **${warning.file}** (${warning.operation}): ${warning.violation}\n`;
        if (warning.suggestion) {
          report += `   💡 *${warning.suggestion}*\n`;
        }
        report += '\n';
      }
    }

    if (result.requiredApprovals.length > 0) {
      report += '### Required Approvals\n';
      for (const file of result.requiredApprovals) {
        report += `📋 ${file}\n`;
      }
      report += '\n';
    }

    if (result.backupRequired) {
      report += '### Required Actions\n';
      report += '💾 Backup required before applying changes\n\n';
    }

    return report;
  }

  getPolicy(): OwnershipPolicy | null {
    return this.policy;
  }
}