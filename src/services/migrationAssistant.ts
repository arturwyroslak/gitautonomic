// Migration Assistant Service
// Automated migration between languages, frameworks, and library versions

import pino from 'pino';
import { readFile, readdir } from 'fs/promises';
import { join, extname } from 'path';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface MigrationPlan {
  sourceLanguage: string;
  targetLanguage: string;
  sourceFramework?: string;
  targetFramework?: string;
  steps: MigrationStep[];
  estimatedEffort: number; // hours
  complexity: 'low' | 'medium' | 'high';
  risks: string[];
  benefits: string[];
}

export interface MigrationStep {
  id: string;
  title: string;
  description: string;
  type: 'transform' | 'manual' | 'verify' | 'test';
  automatable: boolean;
  estimatedTime: number; // minutes
  dependencies: string[];
  files: string[];
}

export interface MigrationResult {
  success: boolean;
  completedSteps: string[];
  failedSteps: string[];
  generatedFiles: string[];
  manualSteps: string[];
  notes: string[];
}

export interface LanguageMapping {
  sourcePattern: string;
  targetPattern: string;
  complexity: number;
  notes: string;
}

export interface LibraryMapping {
  sourceLibrary: string;
  targetLibrary: string;
  mapping: Record<string, string>;
  migrationNotes: string[];
}

export class MigrationAssistant {
  private languageMappings: Map<string, LanguageMapping[]> = new Map();
  private libraryMappings: Map<string, LibraryMapping[]> = new Map();

  constructor() {
    this.initializeMappings();
  }

  async createMigrationPlan(
    projectRoot: string,
    targetLanguage: string,
    targetFramework?: string
  ): Promise<MigrationPlan> {
    log.info({ targetLanguage, targetFramework }, 'Creating migration plan');

    try {
      const sourceAnalysis = await this.analyzeSourceProject(projectRoot);
      const steps = await this.generateMigrationSteps(sourceAnalysis, targetLanguage, targetFramework);
      
      return {
        sourceLanguage: sourceAnalysis.language,
        targetLanguage,
        sourceFramework: sourceAnalysis.framework,
        targetFramework,
        steps,
        estimatedEffort: steps.reduce((total, step) => total + step.estimatedTime / 60, 0),
        complexity: this.assessComplexity(steps),
        risks: this.identifyRisks(sourceAnalysis, targetLanguage),
        benefits: this.identifyBenefits(sourceAnalysis.language, targetLanguage)
      };
    } catch (error) {
      log.error({ error: String(error) }, 'Failed to create migration plan');
      throw error;
    }
  }

  async executeMigration(plan: MigrationPlan, projectRoot: string): Promise<MigrationResult> {
    log.info({ source: plan.sourceLanguage, target: plan.targetLanguage }, 'Executing migration');

    const completedSteps: string[] = [];
    const failedSteps: string[] = [];
    const generatedFiles: string[] = [];
    const manualSteps: string[] = [];
    const notes: string[] = [];

    for (const step of plan.steps) {
      try {
        if (step.automatable) {
          const result = await this.executeAutomaticStep(step, projectRoot);
          if (result.success) {
            completedSteps.push(step.id);
            generatedFiles.push(...result.files);
            notes.push(...result.notes);
          } else {
            failedSteps.push(step.id);
            notes.push(`Failed: ${step.title} - ${result.error}`);
          }
        } else {
          manualSteps.push(step.id);
          notes.push(`Manual step required: ${step.title}`);
        }
      } catch (error) {
        failedSteps.push(step.id);
        notes.push(`Error in ${step.title}: ${String(error)}`);
      }
    }

    return {
      success: failedSteps.length === 0,
      completedSteps,
      failedSteps,
      generatedFiles,
      manualSteps,
      notes
    };
  }

  async translateCode(code: string, sourceLanguage: string, targetLanguage: string): Promise<{
    translatedCode: string;
    idiomaticAdaptations: Array<{ original: string; adapted: string; reason: string }>;
    migrationNotes: string[];
  }> {
    log.info({ sourceLanguage, targetLanguage }, 'Translating code');

    const mappings = this.languageMappings.get(`${sourceLanguage}-${targetLanguage}`) || [];
    let translatedCode = code;
    const idiomaticAdaptations: Array<{ original: string; adapted: string; reason: string }> = [];
    const migrationNotes: string[] = [];

    // Apply language mappings
    for (const mapping of mappings) {
      const regex = new RegExp(mapping.sourcePattern, 'g');
      const matches = code.match(regex);
      if (matches) {
        translatedCode = translatedCode.replace(regex, mapping.targetPattern);
        idiomaticAdaptations.push({
          original: mapping.sourcePattern,
          adapted: mapping.targetPattern,
          reason: mapping.notes
        });
      }
    }

    // Add language-specific adaptations
    const adaptations = await this.applyLanguageSpecificAdaptations(
      translatedCode, 
      sourceLanguage, 
      targetLanguage
    );
    
    return {
      translatedCode: adaptations.code,
      idiomaticAdaptations: [...idiomaticAdaptations, ...adaptations.adaptations],
      migrationNotes: adaptations.notes
    };
  }

  private async analyzeSourceProject(projectRoot: string): Promise<{
    language: string;
    framework?: string;
    files: string[];
    dependencies: string[];
    patterns: string[];
  }> {
    const files = await this.getAllFiles(projectRoot);
    const language = this.detectPrimaryLanguage(files);
    const framework = await this.detectFramework(projectRoot, language);
    const dependencies = await this.extractDependencies(projectRoot, language);
    const patterns = await this.detectPatterns(files);

    return { language, framework, files, dependencies, patterns };
  }

  private async generateMigrationSteps(
    analysis: any,
    targetLanguage: string,
    targetFramework?: string
  ): Promise<MigrationStep[]> {
    const steps: MigrationStep[] = [];

    // Setup steps
    steps.push({
      id: 'setup',
      title: 'Setup target environment',
      description: `Initialize ${targetLanguage} project structure`,
      type: 'transform',
      automatable: true,
      estimatedTime: 30,
      dependencies: [],
      files: []
    });

    // Core translation
    steps.push({
      id: 'translate-core',
      title: 'Translate core files',
      description: `Convert ${analysis.language} files to ${targetLanguage}`,
      type: 'transform',
      automatable: true,
      estimatedTime: analysis.files.length * 15,
      dependencies: ['setup'],
      files: analysis.files
    });

    // Dependencies migration
    if (analysis.dependencies.length > 0) {
      steps.push({
        id: 'migrate-deps',
        title: 'Migrate dependencies',
        description: `Map dependencies to ${targetLanguage} equivalents`,
        type: 'transform',
        automatable: false,
        estimatedTime: analysis.dependencies.length * 20,
        dependencies: ['translate-core'],
        files: []
      });
    }

    // Testing
    steps.push({
      id: 'test-migration',
      title: 'Test migrated code',
      description: 'Verify functionality after migration',
      type: 'test',
      automatable: false,
      estimatedTime: 120,
      dependencies: ['translate-core'],
      files: []
    });

    return steps;
  }

  private async executeAutomaticStep(step: MigrationStep, projectRoot: string): Promise<{
    success: boolean;
    files: string[];
    notes: string[];
    error?: string;
  }> {
    // Simplified automatic step execution
    return {
      success: true,
      files: [`${step.id}_output.${step.type}`],
      notes: [`Completed ${step.title}`]
    };
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      const files: string[] = [];
      
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.getAllFiles(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
      
      return files;
    } catch (error) {
      return [];
    }
  }

  private detectPrimaryLanguage(files: string[]): string {
    const extensionCounts: Record<string, number> = {};
    
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
    }
    
    const extensions: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'c'
    };
    
    const primaryExt = Object.entries(extensionCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0];
    
    return primaryExt ? (extensions[primaryExt] || 'unknown') : 'unknown';
  }

  private async detectFramework(projectRoot: string, language: string): Promise<string | undefined> {
    try {
      if (language === 'javascript' || language === 'typescript') {
        const packageJson = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if (deps.react) return 'react';
        if (deps.vue) return 'vue';
        if (deps.angular) return 'angular';
        if (deps.express) return 'express';
        if (deps.next) return 'nextjs';
      }
    } catch (error) {
      // Ignore
    }
    
    return undefined;
  }

  private async extractDependencies(projectRoot: string, language: string): Promise<string[]> {
    try {
      if (language === 'javascript' || language === 'typescript') {
        const packageJson = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'));
        return Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies });
      }
    } catch (error) {
      // Ignore
    }
    
    return [];
  }

  private async detectPatterns(files: string[]): Promise<string[]> {
    // Simplified pattern detection
    return ['mvc', 'service-layer', 'repository'];
  }

  private assessComplexity(steps: MigrationStep[]): 'low' | 'medium' | 'high' {
    const totalTime = steps.reduce((sum, step) => sum + step.estimatedTime, 0);
    const manualSteps = steps.filter(step => !step.automatable).length;
    
    if (totalTime > 600 || manualSteps > 5) return 'high';
    if (totalTime > 300 || manualSteps > 2) return 'medium';
    return 'low';
  }

  private identifyRisks(analysis: any, targetLanguage: string): string[] {
    const risks = [
      'Potential loss of functionality during translation',
      'Library compatibility issues',
      'Performance differences between languages'
    ];
    
    if (analysis.dependencies.length > 10) {
      risks.push('Complex dependency migration required');
    }
    
    return risks;
  }

  private identifyBenefits(sourceLanguage: string, targetLanguage: string): string[] {
    const benefits = [
      'Modernized codebase',
      'Improved maintainability',
      'Access to latest language features'
    ];
    
    const languageBenefits: Record<string, string[]> = {
      typescript: ['Better type safety', 'Enhanced IDE support'],
      python: ['Simplified syntax', 'Rich ecosystem'],
      rust: ['Memory safety', 'High performance'],
      go: ['Excellent concurrency', 'Fast compilation']
    };
    
    return [...benefits, ...(languageBenefits[targetLanguage] || [])];
  }

  private async applyLanguageSpecificAdaptations(
    code: string,
    sourceLanguage: string,
    targetLanguage: string
  ): Promise<{
    code: string;
    adaptations: Array<{ original: string; adapted: string; reason: string }>;
    notes: string[];
  }> {
    // Simplified language-specific adaptations
    const adaptations: Array<{ original: string; adapted: string; reason: string }> = [];
    const notes: string[] = [];
    
    if (sourceLanguage === 'javascript' && targetLanguage === 'typescript') {
      // Add type annotations
      const typedCode = code.replace(/function (\w+)\(/g, 'function $1(');
      adaptations.push({
        original: 'function name(',
        adapted: 'function name(',
        reason: 'Consider adding type annotations'
      });
      notes.push('Add proper TypeScript type annotations for better type safety');
      return { code: typedCode, adaptations, notes };
    }
    
    return { code, adaptations, notes };
  }

  private initializeMappings(): void {
    // JavaScript to TypeScript mappings
    this.languageMappings.set('javascript-typescript', [
      {
        sourcePattern: 'var\\s+(\\w+)',
        targetPattern: 'let $1',
        complexity: 1,
        notes: 'Use let instead of var for block scoping'
      },
      {
        sourcePattern: 'function\\s+(\\w+)\\(',
        targetPattern: 'function $1(',
        complexity: 2,
        notes: 'Consider adding type annotations'
      }
    ]);

    // Library mappings example
    this.libraryMappings.set('javascript-typescript', [
      {
        sourceLibrary: 'lodash',
        targetLibrary: 'lodash',
        mapping: { '_': 'import * as _ from "lodash"' },
        migrationNotes: ['Install @types/lodash for TypeScript support']
      }
    ]);
  }
}

export default MigrationAssistant;