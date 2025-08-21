// Semgrep Integration Service for Advanced Security Scanning
import { exec } from 'child_process';
import { promisify } from 'util';
import pino from 'pino';
import { writeFile, readFile, rm } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);
const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface SemgrepFinding {
  ruleId: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  file: string;
  startLine: number;
  endLine: number;
  startCol: number;
  endCol: number;
  code: string;
  category: string;
  confidence: 'high' | 'medium' | 'low';
  cwe?: string[];
  owasp?: string[];
  references?: string[];
  fix?: {
    message: string;
    content: string;
  };
}

export interface SemgrepScanResult {
  findings: SemgrepFinding[];
  stats: {
    totalFiles: number;
    scannedFiles: number;
    rulesRun: number;
    findingsCount: number;
    scanTime: number;
  };
  rulesets: string[];
  errors: string[];
}

export interface SemgrepConfig {
  rulesets: string[];
  customRules?: string[];
  excludePaths?: string[];
  timeout: number;
  autofix: boolean;
  severity: 'error' | 'warning' | 'info';
}

export class SemgrepIntegrationService {
  private config: SemgrepConfig;
  private tempDir: string;

  constructor() {
    this.config = {
      rulesets: [
        'p/security-audit',
        'p/owasp-top-ten',
        'p/cwe-top-25',
        'p/javascript',
        'p/typescript',
        'p/docker',
        'p/github-actions'
      ],
      excludePaths: [
        'node_modules/',
        'dist/',
        'build/',
        '.git/',
        'tests/',
        '*.test.ts',
        '*.spec.ts'
      ],
      timeout: 300, // 5 minutes
      autofix: false,
      severity: 'warning'
    };
    
    this.tempDir = '/tmp/semgrep-scans';
  }

  async scanProject(projectPath: string, customConfig?: Partial<SemgrepConfig>): Promise<SemgrepScanResult> {
    const scanConfig = { ...this.config, ...customConfig };
    const startTime = Date.now();
    
    log.info(`Starting Semgrep security scan for project: ${projectPath}`);
    
    try {
      // Check if Semgrep is installed
      await this.ensureSemgrepInstalled();
      
      // Generate scan configuration
      const configFile = await this.generateScanConfig(scanConfig);
      
      // Run Semgrep scan
      const rawResults = await this.executeSemgrepScan(projectPath, configFile, scanConfig);
      
      // Parse and enhance results
      const findings = await this.parseAndEnhanceFindings(rawResults);
      
      // Generate stats
      const stats = {
        totalFiles: await this.countFiles(projectPath),
        scannedFiles: findings.length > 0 ? new Set(findings.map(f => f.file)).size : 0,
        rulesRun: scanConfig.rulesets.length,
        findingsCount: findings.length,
        scanTime: Date.now() - startTime
      };
      
      // Cleanup
      await rm(configFile, { force: true });
      
      log.info(`Semgrep scan completed: ${findings.length} findings in ${stats.scanTime}ms`);
      
      return {
        findings,
        stats,
        rulesets: scanConfig.rulesets,
        errors: []
      };
      
    } catch (error) {
      log.error(`Semgrep scan failed: ${error}`);
      return {
        findings: [],
        stats: {
          totalFiles: 0,
          scannedFiles: 0,
          rulesRun: 0,
          findingsCount: 0,
          scanTime: Date.now() - startTime
        },
        rulesets: scanConfig.rulesets,
        errors: [String(error)]
      };
    }
  }

  async scanFiles(files: string[], customConfig?: Partial<SemgrepConfig>): Promise<SemgrepScanResult> {
    const scanConfig = { ...this.config, ...customConfig };
    const startTime = Date.now();
    
    log.info(`Starting Semgrep scan for ${files.length} files`);
    
    try {
      await this.ensureSemgrepInstalled();
      
      const configFile = await this.generateScanConfig(scanConfig);
      const findings: SemgrepFinding[] = [];
      
      // Scan files in batches to avoid command line length limits
      const batchSize = 10;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const batchResults = await this.executeSemgrepScanFiles(batch, configFile, scanConfig);
        const batchFindings = await this.parseAndEnhanceFindings(batchResults);
        findings.push(...batchFindings);
      }
      
      const stats = {
        totalFiles: files.length,
        scannedFiles: new Set(findings.map(f => f.file)).size,
        rulesRun: scanConfig.rulesets.length,
        findingsCount: findings.length,
        scanTime: Date.now() - startTime
      };
      
      await rm(configFile, { force: true });
      
      return {
        findings,
        stats,
        rulesets: scanConfig.rulesets,
        errors: []
      };
      
    } catch (error) {
      log.error(`Semgrep file scan failed: ${error}`);
      return {
        findings: [],
        stats: {
          totalFiles: files.length,
          scannedFiles: 0,
          rulesRun: 0,
          findingsCount: 0,
          scanTime: Date.now() - startTime
        },
        rulesets: scanConfig.rulesets,
        errors: [String(error)]
      };
    }
  }

  private async ensureSemgrepInstalled(): Promise<void> {
    try {
      await execAsync('semgrep --version');
    } catch (error) {
      log.info('Semgrep not found, attempting to install...');
      try {
        // Try to install Semgrep via pip
        await execAsync('pip install semgrep');
        log.info('Semgrep installed successfully');
      } catch (installError) {
        throw new Error('Semgrep is not installed and could not be installed automatically. Please install Semgrep manually.');
      }
    }
  }

  private async generateScanConfig(config: SemgrepConfig): Promise<string> {
    const configPath = join(this.tempDir, `semgrep-config-${Date.now()}.yml`);
    
    const yamlConfig = {
      rules: config.rulesets.map(ruleset => ({ 'extends': ruleset })),
      paths: {
        exclude: config.excludePaths || []
      }
    };
    
    // Ensure temp directory exists
    await execAsync(`mkdir -p ${this.tempDir}`);
    
    // Write config file
    const yamlContent = this.objectToYaml(yamlConfig);
    await writeFile(configPath, yamlContent);
    
    return configPath;
  }

  private async executeSemgrepScan(projectPath: string, configFile: string, config: SemgrepConfig): Promise<string> {
    const command = [
      'semgrep',
      '--config', configFile,
      '--json',
      '--timeout', config.timeout.toString(),
      '--no-git-ignore',
      projectPath
    ].join(' ');
    
    try {
      const { stdout } = await execAsync(command);
      return stdout;
    } catch (error: any) {
      // Semgrep returns non-zero exit code when findings are detected
      if (error.stdout) {
        return error.stdout;
      }
      throw error;
    }
  }

  private async executeSemgrepScanFiles(files: string[], configFile: string, config: SemgrepConfig): Promise<string> {
    const filesArg = files.join(' ');
    const command = [
      'semgrep',
      '--config', configFile,
      '--json',
      '--timeout', config.timeout.toString(),
      filesArg
    ].join(' ');
    
    try {
      const { stdout } = await execAsync(command);
      return stdout;
    } catch (error: any) {
      if (error.stdout) {
        return error.stdout;
      }
      throw error;
    }
  }

  private async parseAndEnhanceFindings(rawResults: string): Promise<SemgrepFinding[]> {
    try {
      const results = JSON.parse(rawResults);
      const findings: SemgrepFinding[] = [];
      
      if (results.results) {
        for (const result of results.results) {
          const finding: SemgrepFinding = {
            ruleId: result.check_id,
            severity: this.mapSeverity(result.extra?.severity || 'INFO'),
            message: result.extra?.message || result.message,
            file: result.path,
            startLine: result.start?.line || 1,
            endLine: result.end?.line || 1,
            startCol: result.start?.col || 1,
            endCol: result.end?.col || 1,
            code: result.extra?.lines || '',
            category: this.extractCategory(result.check_id),
            confidence: this.mapConfidence(result.extra?.confidence || 'MEDIUM'),
            cwe: result.extra?.metadata?.cwe || [],
            owasp: result.extra?.metadata?.owasp || [],
            references: result.extra?.metadata?.references || []
          };
          
          // Add autofix if available
          if (result.extra?.fix) {
            finding.fix = {
              message: result.extra.fix.message || 'Auto-fix available',
              content: result.extra.fix.fix || ''
            };
          }
          
          findings.push(finding);
        }
      }
      
      return findings;
    } catch (error) {
      log.error(`Failed to parse Semgrep results: ${error}`);
      return [];
    }
  }

  private mapSeverity(semgrepSeverity: string): 'critical' | 'high' | 'medium' | 'low' | 'info' {
    switch (semgrepSeverity.toUpperCase()) {
      case 'ERROR':
        return 'critical';
      case 'WARNING':
        return 'high';
      case 'INFO':
        return 'medium';
      default:
        return 'low';
    }
  }

  private mapConfidence(semgrepConfidence: string): 'high' | 'medium' | 'low' {
    switch (semgrepConfidence.toUpperCase()) {
      case 'HIGH':
        return 'high';
      case 'MEDIUM':
        return 'medium';
      case 'LOW':
        return 'low';
      default:
        return 'medium';
    }
  }

  private extractCategory(ruleId: string): string {
    if (ruleId.includes('security')) return 'security';
    if (ruleId.includes('performance')) return 'performance';
    if (ruleId.includes('correctness')) return 'correctness';
    if (ruleId.includes('best-practice')) return 'best-practice';
    return 'misc';
  }

  private async countFiles(projectPath: string): Promise<number> {
    try {
      const { stdout } = await execAsync(`find "${projectPath}" -type f -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" | wc -l`);
      return parseInt(stdout.trim()) || 0;
    } catch {
      return 0;
    }
  }

  private objectToYaml(obj: any): string {
    // Simple YAML generation - in production, use a proper YAML library
    const lines: string[] = [];
    
    const processObject = (obj: any, indent = 0): void => {
      const prefix = ' '.repeat(indent);
      
      for (const [key, value] of Object.entries(obj)) {
        if (Array.isArray(value)) {
          lines.push(`${prefix}${key}:`);
          for (const item of value) {
            if (typeof item === 'object') {
              lines.push(`${prefix}  -`);
              processObject(item, indent + 4);
            } else {
              lines.push(`${prefix}  - ${item}`);
            }
          }
        } else if (typeof value === 'object' && value !== null) {
          lines.push(`${prefix}${key}:`);
          processObject(value, indent + 2);
        } else {
          lines.push(`${prefix}${key}: ${value}`);
        }
      }
    };
    
    processObject(obj);
    return lines.join('\n');
  }

  async generateSecurityReport(findings: SemgrepFinding[]): Promise<{
    summary: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      total: number;
    };
    categories: Record<string, number>;
    topIssues: SemgrepFinding[];
    recommendations: string[];
  }> {
    const summary = {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
      total: findings.length
    };
    
    const categories: Record<string, number> = {};
    findings.forEach(f => {
      categories[f.category] = (categories[f.category] || 0) + 1;
    });
    
    const topIssues = findings
      .filter(f => f.severity === 'critical' || f.severity === 'high')
      .slice(0, 10);
    
    const recommendations: string[] = [];
    
    if (summary.critical > 0) {
      recommendations.push(`🚨 Address ${summary.critical} critical security issues immediately`);
    }
    
    if (summary.high > 0) {
      recommendations.push(`⚠️ Review and fix ${summary.high} high-severity security issues`);
    }
    
    if ((categories.security || 0) > 5) {
      recommendations.push('Consider implementing security-focused code review process');
    }
    
    if (findings.some(f => f.cwe?.includes('CWE-79'))) {
      recommendations.push('Implement XSS protection measures');
    }
    
    if (findings.some(f => f.cwe?.includes('CWE-89'))) {
      recommendations.push('Review SQL injection vulnerabilities and use parameterized queries');
    }
    
    return {
      summary,
      categories,
      topIssues,
      recommendations
    };
  }
}

export const semgrepService = new SemgrepIntegrationService();