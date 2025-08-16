// Architecture Pattern Detector - Identifies architectural patterns in codebases
import pino from 'pino';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { glob } from 'glob';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ArchitecturePattern {
  name: string;
  confidence: number;
  evidence: string[];
  description: string;
  benefits: string[];
  recommendations: string[];
}

export interface ProjectStructure {
  directories: string[];
  files: string[];
  packageJson?: any;
  configFiles: string[];
  testFiles: string[];
}

export interface ArchitectureAnalysis {
  detectedPatterns: ArchitecturePattern[];
  projectType: string;
  frameworksUsed: string[];
  recommendedImprovements: string[];
  structureScore: number;
}

export class ArchitecturePatternDetector {
  private patterns: Map<string, any> = new Map();

  constructor() {
    this.initializePatterns();
  }

  async analyzeArchitecture(projectRoot: string): Promise<ArchitectureAnalysis> {
    log.info('Starting architecture pattern analysis');
    
    const structure = await this.analyzeProjectStructure(projectRoot);
    const detectedPatterns = await this.detectPatterns(structure, projectRoot);
    const projectType = this.determineProjectType(structure);
    const frameworksUsed = this.detectFrameworks(structure);
    const recommendedImprovements = this.generateRecommendations(detectedPatterns, structure);
    const structureScore = this.calculateStructureScore(structure, detectedPatterns);

    return {
      detectedPatterns,
      projectType,
      frameworksUsed,
      recommendedImprovements,
      structureScore
    };
  }

  private initializePatterns(): void {
    // Model-View-Controller (MVC)
    this.patterns.set('mvc', {
      name: 'Model-View-Controller (MVC)',
      indicators: {
        directories: ['models', 'views', 'controllers', 'model', 'view', 'controller'],
        files: ['model.js', 'view.js', 'controller.js'],
        patterns: [/.*\/models\/.*/, /.*\/views\/.*/, /.*\/controllers\/.*/]
      },
      description: 'Separates application logic into three interconnected components',
      benefits: ['Clear separation of concerns', 'Testability', 'Maintainability'],
      recommendations: ['Ensure models are database-agnostic', 'Keep controllers thin', 'Views should be logic-free']
    });

    // Microservices
    this.patterns.set('microservices', {
      name: 'Microservices Architecture',
      indicators: {
        directories: ['services', 'service', 'microservices'],
        files: ['docker-compose.yml', 'Dockerfile', 'service.yml'],
        patterns: [/.*service.*/, /.*api.*/, /.*-service$/]
      },
      description: 'Application built as a suite of small, independent services',
      benefits: ['Scalability', 'Technology diversity', 'Team independence'],
      recommendations: ['Implement service discovery', 'Add monitoring and logging', 'Consider API versioning']
    });

    // Layered Architecture
    this.patterns.set('layered', {
      name: 'Layered Architecture',
      indicators: {
        directories: ['presentation', 'business', 'data', 'domain', 'infrastructure', 'application'],
        files: ['layer.js', 'tier.js'],
        patterns: [/.*\/presentation\/.*/, /.*\/business\/.*/, /.*\/data\/.*/]
      },
      description: 'Organizes code into horizontal layers with specific responsibilities',
      benefits: ['Clear abstraction levels', 'Testability', 'Separation of concerns'],
      recommendations: ['Avoid layer bypassing', 'Keep dependencies flowing downward', 'Use dependency injection']
    });

    // Component-Based Architecture
    this.patterns.set('component', {
      name: 'Component-Based Architecture',
      indicators: {
        directories: ['components', 'widgets', 'elements'],
        files: ['component.js', 'component.tsx', 'widget.js'],
        patterns: [/.*Component\.jsx?$/, /.*\.component\./, /.*\/components\/.*/]
      },
      description: 'Application built from reusable, encapsulated components',
      benefits: ['Reusability', 'Encapsulation', 'Composability'],
      recommendations: ['Keep components focused', 'Use prop types/interfaces', 'Implement component testing']
    });

    // Event-Driven Architecture
    this.patterns.set('event-driven', {
      name: 'Event-Driven Architecture',
      indicators: {
        directories: ['events', 'handlers', 'listeners', 'subscribers'],
        files: ['event.js', 'handler.js', 'listener.js', 'subscriber.js'],
        patterns: [/.*Event\.js$/, /.*Handler\.js$/, /.*Listener\.js$/]
      },
      description: 'Components communicate through events and event handlers',
      benefits: ['Loose coupling', 'Scalability', 'Flexibility'],
      recommendations: ['Use event sourcing', 'Implement event versioning', 'Add error handling for events']
    });

    // Plugin Architecture
    this.patterns.set('plugin', {
      name: 'Plugin Architecture',
      indicators: {
        directories: ['plugins', 'extensions', 'addons'],
        files: ['plugin.js', 'extension.js', 'addon.js'],
        patterns: [/.*Plugin\.js$/, /.*Extension\.js$/, /.*\.plugin\./]
      },
      description: 'Core functionality extended through plugins or extensions',
      benefits: ['Extensibility', 'Modularity', 'Third-party integration'],
      recommendations: ['Define clear plugin interfaces', 'Implement plugin lifecycle management', 'Add plugin validation']
    });

    // Repository Pattern
    this.patterns.set('repository', {
      name: 'Repository Pattern',
      indicators: {
        directories: ['repositories', 'repos'],
        files: ['repository.js', 'repo.js'],
        patterns: [/.*Repository\.js$/, /.*Repo\.js$/]
      },
      description: 'Encapsulates data access logic and centralizes data access',
      benefits: ['Testability', 'Centralized data access', 'Abstraction'],
      recommendations: ['Use interfaces for repositories', 'Implement unit of work pattern', 'Add caching strategies']
    });

    // Hexagonal Architecture (Ports and Adapters)
    this.patterns.set('hexagonal', {
      name: 'Hexagonal Architecture',
      indicators: {
        directories: ['ports', 'adapters', 'domain', 'infrastructure'],
        files: ['port.js', 'adapter.js'],
        patterns: [/.*Port\.js$/, /.*Adapter\.js$/]
      },
      description: 'Isolates core business logic from external concerns',
      benefits: ['Testability', 'Technology independence', 'Clear boundaries'],
      recommendations: ['Keep domain logic pure', 'Use dependency inversion', 'Implement integration tests']
    });
  }

  private async analyzeProjectStructure(projectRoot: string): Promise<ProjectStructure> {
    const directories = await this.getDirectories(projectRoot);
    const files = await this.getFiles(projectRoot);
    const configFiles = files.filter(file => this.isConfigFile(file));
    const testFiles = files.filter(file => this.isTestFile(file));
    
    let packageJson;
    try {
      const packageJsonPath = join(projectRoot, 'package.json');
      const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
      packageJson = JSON.parse(packageJsonContent);
    } catch (error) {
      log.debug('No package.json found or invalid JSON');
    }

    return {
      directories,
      files,
      packageJson,
      configFiles,
      testFiles
    };
  }

  private async getDirectories(projectRoot: string): Promise<string[]> {
    try {
      const dirs = await glob('*/', {
        cwd: projectRoot,
        ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**']
      });
      return dirs.map(dir => dir.replace('/', ''));
    } catch (error) {
      log.warn(`Failed to get directories: ${error}`);
      return [];
    }
  }

  private async getFiles(projectRoot: string): Promise<string[]> {
    try {
      return await glob('**/*', {
        cwd: projectRoot,
        ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
        nodir: true
      });
    } catch (error) {
      log.warn(`Failed to get files: ${error}`);
      return [];
    }
  }

  private isConfigFile(file: string): boolean {
    const configPatterns = [
      /webpack\.config\.js$/,
      /babel\.config\.js$/,
      /\.eslintrc/,
      /jest\.config\.js$/,
      /tsconfig\.json$/,
      /\.env$/,
      /docker-compose\.yml$/,
      /Dockerfile$/
    ];
    return configPatterns.some(pattern => pattern.test(file));
  }

  private isTestFile(file: string): boolean {
    const testPatterns = [
      /\.test\.js$/,
      /\.spec\.js$/,
      /\.test\.ts$/,
      /\.spec\.ts$/,
      /\/tests?\//,
      /\/__tests__\//
    ];
    return testPatterns.some(pattern => pattern.test(file));
  }

  private async detectPatterns(structure: ProjectStructure, projectRoot: string): Promise<ArchitecturePattern[]> {
    const detectedPatterns: ArchitecturePattern[] = [];

    for (const [patternName, patternDef] of this.patterns) {
      const confidence = await this.calculatePatternConfidence(patternDef, structure, projectRoot);
      
      if (confidence > 0.3) { // 30% confidence threshold
        const evidence = this.collectEvidence(patternDef, structure);
        
        detectedPatterns.push({
          name: patternDef.name,
          confidence,
          evidence,
          description: patternDef.description,
          benefits: patternDef.benefits,
          recommendations: patternDef.recommendations
        });
      }
    }

    return detectedPatterns.sort((a, b) => b.confidence - a.confidence);
  }

  private async calculatePatternConfidence(patternDef: any, structure: ProjectStructure, projectRoot: string): Promise<number> {
    let score = 0;
    let maxScore = 0;

    // Check directory indicators
    if (patternDef.indicators.directories) {
      maxScore += 3;
      const foundDirs = patternDef.indicators.directories.filter((dir: string) =>
        structure.directories.some(d => d.toLowerCase().includes(dir.toLowerCase()))
      );
      score += (foundDirs.length / patternDef.indicators.directories.length) * 3;
    }

    // Check file indicators
    if (patternDef.indicators.files) {
      maxScore += 2;
      const foundFiles = patternDef.indicators.files.filter((file: string) =>
        structure.files.some(f => f.toLowerCase().includes(file.toLowerCase()))
      );
      score += (foundFiles.length / patternDef.indicators.files.length) * 2;
    }

    // Check pattern indicators
    if (patternDef.indicators.patterns) {
      maxScore += 2;
      const matchingFiles = structure.files.filter(file =>
        patternDef.indicators.patterns.some((pattern: RegExp) => pattern.test(file))
      );
      score += Math.min(matchingFiles.length / 5, 1) * 2; // Up to 5 matching files gives full score
    }

    // Check package.json dependencies for framework-specific patterns
    if (structure.packageJson && patternDef.indicators.dependencies) {
      maxScore += 1;
      const deps = { ...structure.packageJson.dependencies, ...structure.packageJson.devDependencies };
      const foundDeps = patternDef.indicators.dependencies.filter((dep: string) => deps[dep]);
      score += (foundDeps.length / patternDef.indicators.dependencies.length) * 1;
    }

    return maxScore > 0 ? score / maxScore : 0;
  }

  private collectEvidence(patternDef: any, structure: ProjectStructure): string[] {
    const evidence: string[] = [];

    // Collect directory evidence
    if (patternDef.indicators.directories) {
      const foundDirs = patternDef.indicators.directories.filter((dir: string) =>
        structure.directories.some(d => d.toLowerCase().includes(dir.toLowerCase()))
      );
      foundDirs.forEach((dir: string) => evidence.push(`Found ${dir} directory`));
    }

    // Collect file evidence
    if (patternDef.indicators.files) {
      const foundFiles = patternDef.indicators.files.filter((file: string) =>
        structure.files.some(f => f.toLowerCase().includes(file.toLowerCase()))
      );
      foundFiles.forEach((file: string) => evidence.push(`Found ${file} pattern`));
    }

    // Collect pattern evidence
    if (patternDef.indicators.patterns) {
      const matchingFiles = structure.files.filter(file =>
        patternDef.indicators.patterns.some((pattern: RegExp) => pattern.test(file))
      );
      if (matchingFiles.length > 0) {
        evidence.push(`Found ${matchingFiles.length} files matching naming patterns`);
      }
    }

    return evidence;
  }

  private determineProjectType(structure: ProjectStructure): string {
    if (structure.packageJson) {
      const deps = { ...structure.packageJson.dependencies, ...structure.packageJson.devDependencies };
      
      if (deps.react || deps['@types/react']) return 'React Application';
      if (deps.vue) return 'Vue.js Application';
      if (deps.angular || deps['@angular/core']) return 'Angular Application';
      if (deps.express) return 'Express.js Server';
      if (deps.fastify) return 'Fastify Server';
      if (deps.next) return 'Next.js Application';
      if (deps.nuxt) return 'Nuxt.js Application';
      if (deps.typescript) return 'TypeScript Project';
    }

    if (structure.files.some(f => f.endsWith('.py'))) return 'Python Project';
    if (structure.files.some(f => f.endsWith('.java'))) return 'Java Project';
    if (structure.files.some(f => f.endsWith('.cs'))) return 'C# Project';
    if (structure.files.some(f => f.endsWith('.go'))) return 'Go Project';
    if (structure.files.some(f => f.endsWith('.rs'))) return 'Rust Project';

    return 'Generic Project';
  }

  private detectFrameworks(structure: ProjectStructure): string[] {
    const frameworks: string[] = [];
    
    if (structure.packageJson) {
      const deps = { ...structure.packageJson.dependencies, ...structure.packageJson.devDependencies };
      
      const frameworkMap = {
        'react': 'React',
        'vue': 'Vue.js',
        '@angular/core': 'Angular',
        'express': 'Express.js',
        'fastify': 'Fastify',
        'next': 'Next.js',
        'nuxt': 'Nuxt.js',
        'gatsby': 'Gatsby',
        'svelte': 'Svelte',
        'solid-js': 'Solid.js',
        'lit': 'Lit',
        'alpinejs': 'Alpine.js'
      };

      for (const [dep, framework] of Object.entries(frameworkMap)) {
        if (deps[dep]) {
          frameworks.push(framework);
        }
      }
    }

    return frameworks;
  }

  private generateRecommendations(patterns: ArchitecturePattern[], structure: ProjectStructure): string[] {
    const recommendations: string[] = [];

    // General recommendations based on project size
    const fileCount = structure.files.length;
    if (fileCount > 100 && !patterns.some(p => p.name.includes('Microservices'))) {
      recommendations.push('Consider breaking down into smaller services or modules');
    }

    if (structure.testFiles.length / structure.files.length < 0.3) {
      recommendations.push('Increase test coverage - current test-to-code ratio is low');
    }

    if (!structure.configFiles.some(f => f.includes('eslint'))) {
      recommendations.push('Add ESLint configuration for code quality consistency');
    }

    if (!structure.configFiles.some(f => f.includes('prettier'))) {
      recommendations.push('Add Prettier configuration for code formatting');
    }

    // Pattern-specific recommendations
    patterns.forEach(pattern => {
      recommendations.push(...pattern.recommendations);
    });

    // Detect missing patterns that might be beneficial
    if (!patterns.some(p => p.name.includes('Repository')) && structure.files.some(f => f.includes('database') || f.includes('db'))) {
      recommendations.push('Consider implementing Repository pattern for data access');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  private calculateStructureScore(structure: ProjectStructure, patterns: ArchitecturePattern[]): number {
    let score = 0;
    const maxScore = 100;

    // Pattern detection score (40 points)
    const patternScore = patterns.reduce((sum, pattern) => sum + pattern.confidence, 0) / patterns.length || 0;
    score += patternScore * 40;

    // Test coverage score (20 points)
    const testRatio = structure.testFiles.length / Math.max(structure.files.length, 1);
    score += Math.min(testRatio * 5, 1) * 20; // 20% test ratio gives full score

    // Configuration completeness score (20 points)
    const essentialConfigs = ['package.json', 'tsconfig.json', '.eslintrc', '.gitignore'];
    const foundConfigs = essentialConfigs.filter(config =>
      structure.files.some(f => f.includes(config))
    );
    score += (foundConfigs.length / essentialConfigs.length) * 20;

    // Directory organization score (20 points)
    const organizationKeywords = ['src', 'lib', 'components', 'services', 'utils', 'types'];
    const foundOrganization = organizationKeywords.filter(keyword =>
      structure.directories.some(d => d.toLowerCase().includes(keyword))
    );
    score += (foundOrganization.length / organizationKeywords.length) * 20;

    return Math.min(score, maxScore);
  }

  // Public API methods
  async getArchitectureSummary(projectRoot: string): Promise<{
    overallScore: number;
    mainPattern: string;
    complexityLevel: 'low' | 'medium' | 'high';
    recommendations: string[];
  }> {
    const analysis = await this.analyzeArchitecture(projectRoot);
    
    return {
      overallScore: analysis.structureScore,
      mainPattern: analysis.detectedPatterns[0]?.name || 'No clear pattern detected',
      complexityLevel: this.assessComplexity(analysis),
      recommendations: analysis.recommendedImprovements.slice(0, 5) // Top 5 recommendations
    };
  }

  private assessComplexity(analysis: ArchitectureAnalysis): 'low' | 'medium' | 'high' {
    const patternCount = analysis.detectedPatterns.length;
    const avgConfidence = analysis.detectedPatterns.reduce((sum, p) => sum + p.confidence, 0) / patternCount || 0;

    if (patternCount > 3 && avgConfidence > 0.7) return 'high';
    if (patternCount > 1 && avgConfidence > 0.5) return 'medium';
    return 'low';
  }
}

export default ArchitecturePatternDetector;