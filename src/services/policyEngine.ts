// Policy Engine for enforcing repository policies
import { cfg } from '../config.js';
import { readFileSync, existsSync } from 'fs';
import { parse as parseYaml } from 'yaml';

interface OwnershipRule {
  paths: string[];
  owners: string[];
  operations: string[];
  required_approvals?: number;
}

interface PolicyConfig {
  max_file_size_kb?: number;
  restricted_paths?: string[];
  allowed_file_extensions?: string[];
  forbidden_patterns?: string[];
  ownership_rules?: OwnershipRule[];
}

export class PolicyEngine {
  private policyConfig: PolicyConfig | null = null;
  
  constructor(private workspacePath?: string) {
    this.loadPolicyConfig();
  }
  
  private loadPolicyConfig(): void {
    try {
      const ownershipPath = this.workspacePath ? 
        `${this.workspacePath}/.aiagent-ownership.yml` : 
        '.aiagent-ownership.yml';
        
      if (existsSync(ownershipPath)) {
        const content = readFileSync(ownershipPath, 'utf-8');
        this.policyConfig = parseYaml(content);
      } else {
        // Default policy configuration
        this.policyConfig = {
          max_file_size_kb: 1000,
          restricted_paths: [
            '.env',
            'secrets/*',
            'private-key.pem',
            'node_modules/*'
          ],
          allowed_file_extensions: [
            '.ts', '.js', '.json', '.md', '.yml', '.yaml',
            '.html', '.css', '.tsx', '.jsx'
          ],
          forbidden_patterns: [
            'password',
            'secret',
            'api_key',
            'private_key'
          ]
        };
      }
    } catch (error) {
      console.warn('Failed to load policy config, using defaults:', error);
      this.policyConfig = {};
    }
  }
  
  async validatePatch(patch: string, files: string[]): Promise<{ allowed: boolean; reasons: string[] }> {
    const reasons: string[] = [];
    let allowed = true;
    
    if (!this.policyConfig) {
      return { allowed: true, reasons: ['No policy configuration loaded'] };
    }
    
    // Check file size limits
    if (this.policyConfig.max_file_size_kb) {
      for (const file of files) {
        const patchLines = patch.split('\n').filter(line => 
          line.startsWith('+++') && line.includes(file)
        );
        
        if (patchLines.length > 0) {
          const addedLines = patch.split('\n').filter(line => line.startsWith('+')).length;
          const estimatedSizeKb = addedLines * 0.05; // Rough estimate
          
          if (estimatedSizeKb > this.policyConfig.max_file_size_kb) {
            allowed = false;
            reasons.push(`File ${file} estimated size (${estimatedSizeKb.toFixed(1)}KB) exceeds limit (${this.policyConfig.max_file_size_kb}KB)`);
          }
        }
      }
    }
    
    // Check restricted paths
    if (this.policyConfig.restricted_paths) {
      for (const file of files) {
        for (const restrictedPath of this.policyConfig.restricted_paths) {
          if (this.matchesPattern(file, restrictedPath)) {
            allowed = false;
            reasons.push(`File ${file} matches restricted path pattern: ${restrictedPath}`);
          }
        }
      }
    }
    
    // Check forbidden patterns in patch content
    if (this.policyConfig.forbidden_patterns) {
      const lowerPatch = patch.toLowerCase();
      for (const pattern of this.policyConfig.forbidden_patterns) {
        if (lowerPatch.includes(pattern.toLowerCase())) {
          allowed = false;
          reasons.push(`Patch contains forbidden pattern: ${pattern}`);
        }
      }
    }
    
    // Check file extensions
    if (this.policyConfig.allowed_file_extensions) {
      for (const file of files) {
        const ext = '.' + file.split('.').pop();
        if (!this.policyConfig.allowed_file_extensions.includes(ext)) {
          allowed = false;
          reasons.push(`File extension ${ext} not in allowed list for file: ${file}`);
        }
      }
    }
    
    return { allowed, reasons };
  }
  
  async checkOwnership(path: string, operation: 'read' | 'write' | 'create' | 'delete'): Promise<boolean> {
    if (!this.policyConfig?.ownership_rules) {
      return true; // No ownership rules defined
    }
    
    for (const rule of this.policyConfig.ownership_rules) {
      // Check if path matches any rule
      const pathMatches = rule.paths.some(rulePath => this.matchesPattern(path, rulePath));
      
      if (pathMatches) {
        // Check if operation is allowed
        const operationAllowed = rule.operations && (rule.operations.includes(operation) || rule.operations.includes('*'));
        
        if (!operationAllowed) {
          return false;
        }
        
        // For now, assume AI agent has appropriate ownership
        // In a real implementation, this would check against actual user/team ownership
        return true;
      }
    }
    
    return true; // No specific rules found, allow by default
  }
  
  async enforceRestrictions(changes: any[]): Promise<{ blocked: string[]; allowed: string[] }> {
    const blocked: string[] = [];
    const allowed: string[] = [];
    
    for (const change of changes) {
      const path = change.path || change.file || 'unknown';
      const operation = change.type || 'write';
      
      // Check ownership
      const ownershipAllowed = await this.checkOwnership(path, operation);
      
      if (!ownershipAllowed) {
        blocked.push(path);
        continue;
      }
      
      // Check if file is in restricted paths
      if (this.policyConfig?.restricted_paths) {
        const isRestricted = this.policyConfig.restricted_paths.some(restrictedPath => 
          this.matchesPattern(path, restrictedPath)
        );
        
        if (isRestricted) {
          blocked.push(path);
          continue;
        }
      }
      
      allowed.push(path);
    }
    
    return { blocked, allowed };
  }
  
  private matchesPattern(path: string, pattern: string): boolean {
    // Simple pattern matching with * wildcard support
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*');
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(path);
    }
    
    return path === pattern || path.startsWith(pattern);
  }
  
  // Additional policy validation methods
  async validateCommitMessage(message: string): Promise<{ valid: boolean; suggestions: string[] }> {
    const suggestions: string[] = [];
    let valid = true;
    
    // Check minimum length
    if (message.length < 10) {
      valid = false;
      suggestions.push('Commit message should be at least 10 characters long');
    }
    
    // Check for conventional commit format
    const conventionalCommitPattern = /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+/;
    if (!conventionalCommitPattern.test(message)) {
      suggestions.push('Consider using conventional commit format: type(scope): description');
    }
    
    return { valid, suggestions };
  }
  
  async getRiskAssessment(files: string[], patch: string): Promise<{ riskLevel: 'low' | 'medium' | 'high'; factors: string[] }> {
    const factors: string[] = [];
    let riskScore = 0;
    
    // Count modified files
    if (files.length > 10) {
      riskScore += 2;
      factors.push(`High number of modified files (${files.length})`);
    } else if (files.length > 5) {
      riskScore += 1;
      factors.push(`Moderate number of modified files (${files.length})`);
    }
    
    // Check for critical file modifications
    const criticalPaths = ['package.json', 'tsconfig.json', 'Dockerfile', '.env'];
    const criticalModifications = files.filter(file => 
      criticalPaths.some(critical => file.includes(critical))
    );
    
    if (criticalModifications.length > 0) {
      riskScore += 2;
      factors.push(`Critical files modified: ${criticalModifications.join(', ')}`);
    }
    
    // Check patch size
    const patchLines = patch.split('\n').length;
    if (patchLines > 500) {
      riskScore += 2;
      factors.push(`Large patch size (${patchLines} lines)`);
    } else if (patchLines > 100) {
      riskScore += 1;
      factors.push(`Medium patch size (${patchLines} lines)`);
    }
    
    const riskLevel = riskScore >= 4 ? 'high' : riskScore >= 2 ? 'medium' : 'low';
    
    return { riskLevel, factors };
  }
}

export default { PolicyEngine };