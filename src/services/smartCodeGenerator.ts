// Smart Code Generator - Generates boilerplate based on patterns in codebase
import pino from 'pino';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { parse as parseJS } from '@babel/parser';
import generate from '@babel/generator';
import { glob } from 'glob';
import { join, dirname } from 'path';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  category: 'component' | 'service' | 'model' | 'test' | 'utility' | 'config';
  framework?: string;
  pattern: string; // Regex pattern to match
  template: string;
  variables: TemplateVariable[];
  dependencies: string[];
  examples: string[];
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: any;
  options?: string[]; // For enum-like variables
}

export interface GenerationRequest {
  templateId: string;
  outputPath: string;
  variables: Record<string, any>;
  overwrite?: boolean;
}

export interface GenerationResult {
  success: boolean;
  generatedFiles: string[];
  errors: string[];
  suggestions: string[];
}

export interface PatternAnalysis {
  detectedPatterns: DetectedPattern[];
  suggestions: CodeTemplate[];
  projectCharacteristics: ProjectCharacteristics;
}

export interface DetectedPattern {
  pattern: string;
  confidence: number;
  examples: string[];
  frequency: number;
  category: string;
}

export interface ProjectCharacteristics {
  primaryFramework: string;
  architecturePattern: string;
  commonNamingConventions: string[];
  typicalFileStructure: string[];
  testingFramework?: string;
  styleGuide: string;
}

export class SmartCodeGenerator {
  private templates = new Map<string, CodeTemplate>();
  private patternCache = new Map<string, PatternAnalysis>();

  constructor() {
    this.initializeDefaultTemplates();
  }

  async analyzeProjectPatterns(projectRoot: string): Promise<PatternAnalysis> {
    log.info('Analyzing project patterns for code generation');

    if (this.patternCache.has(projectRoot)) {
      return this.patternCache.get(projectRoot)!;
    }

    const files = await this.getSourceFiles(projectRoot);
    const detectedPatterns = await this.detectPatterns(files);
    const projectCharacteristics = await this.analyzeProjectCharacteristics(files);
    const suggestions = this.generateTemplateSuggestions(detectedPatterns, projectCharacteristics);

    const analysis: PatternAnalysis = {
      detectedPatterns,
      suggestions,
      projectCharacteristics
    };

    this.patternCache.set(projectRoot, analysis);
    return analysis;
  }

  async generateCode(request: GenerationRequest): Promise<GenerationResult> {
    log.info(`Generating code from template: ${request.templateId}`);

    const template = this.templates.get(request.templateId);
    if (!template) {
      return {
        success: false,
        generatedFiles: [],
        errors: [`Template ${request.templateId} not found`],
        suggestions: []
      };
    }

    try {
      const validationErrors = this.validateRequest(request, template);
      if (validationErrors.length > 0) {
        return {
          success: false,
          generatedFiles: [],
          errors: validationErrors,
          suggestions: []
        };
      }

      const generatedCode = this.processTemplate(template.template, request.variables);
      const outputPath = request.outputPath;

      // Create directory if it doesn't exist
      await mkdir(dirname(outputPath), { recursive: true });

      // Check if file exists and overwrite flag
      if (!request.overwrite) {
        try {
          await readFile(outputPath);
          return {
            success: false,
            generatedFiles: [],
            errors: [`File ${outputPath} already exists. Set overwrite: true to replace it.`],
            suggestions: ['Use overwrite: true option', 'Choose a different output path']
          };
        } catch {
          // File doesn't exist, continue
        }
      }

      await writeFile(outputPath, generatedCode);

      return {
        success: true,
        generatedFiles: [outputPath],
        errors: [],
        suggestions: this.generatePostGenerationSuggestions(template, request)
      };

    } catch (error) {
      return {
        success: false,
        generatedFiles: [],
        errors: [`Generation failed: ${error}`],
        suggestions: []
      };
    }
  }

  private initializeDefaultTemplates(): void {
    // React Component Template
    this.templates.set('react-component', {
      id: 'react-component',
      name: 'React Functional Component',
      description: 'Generate a React functional component with TypeScript',
      category: 'component',
      framework: 'react',
      pattern: 'import React.*from.*react',
      template: `import React from 'react';
{{#if useInterface}}
interface {{componentName}}Props {
{{#each props}}
  {{name}}: {{type}};
{{/each}}
}
{{/if}}

{{#if useStyles}}
import styles from './{{componentName}}.module.css';
{{/if}}

const {{componentName}}: React.FC{{#if useInterface}}<{{componentName}}Props>{{/if}} = ({{#if useInterface}}props{{/if}}) => {
{{#if useInterface}}
  const { {{#each props}}{{name}}{{#unless @last}}, {{/unless}}{{/each}} } = props;
{{/if}}

  return (
    <div{{#if useStyles}} className={styles.{{lowerCase componentName}}}{{/if}}>
      <h1>{{componentName}}</h1>
      {{#if hasChildren}}
      {children}
      {{/if}}
    </div>
  );
};

export default {{componentName}};`,
      variables: [
        { name: 'componentName', type: 'string', description: 'Name of the component', required: true },
        { name: 'useInterface', type: 'boolean', description: 'Whether to generate TypeScript interface', required: false, defaultValue: true },
        { name: 'useStyles', type: 'boolean', description: 'Whether to include CSS modules', required: false, defaultValue: false },
        { name: 'hasChildren', type: 'boolean', description: 'Whether component accepts children', required: false, defaultValue: false },
        { name: 'props', type: 'array', description: 'Component properties', required: false, defaultValue: [] }
      ],
      dependencies: ['react', '@types/react'],
      examples: ['Button', 'Modal', 'Card', 'Header']
    });

    // Express API Route Template  
    this.templates.set('express-route', {
      id: 'express-route',
      name: 'Express API Route',
      description: 'Generate an Express.js API route with error handling',
      category: 'service',
      framework: 'express',
      pattern: 'import.*express.*from.*express',
      template: `import { Router, Request, Response } from 'express';
{{#if useValidation}}
import { body, validationResult } from 'express-validator';
{{/if}}
{{#if useService}}
import { {{serviceName}} } from '../services/{{lowerCase serviceName}}.js';
{{/if}}

const router = Router();

{{#if useValidation}}
const {{lowerCase routeName}}Validation = [
{{#each validationRules}}
  {{rule}},
{{/each}}
];
{{/if}}

{{#each methods}}
router.{{method}}('{{path}}'{{#if useValidation}}, {{lowerCase routeName}}Validation{{/if}}, async (req: Request, res: Response) => {
  try {
{{#if useValidation}}
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
{{/if}}

{{#if useService}}
    const {{lowerCase serviceName}} = new {{serviceName}}();
    const result = await {{lowerCase serviceName}}.{{actionName}}({{#if hasParams}}req.{{paramSource}}{{/if}});
{{else}}
    // Implementation logic here
    const result = { success: true };
{{/if}}

    res.status({{successStatus}}).json(result);
  } catch (error) {
    console.error('{{routeName}} error:', error);
    res.status(500).json({ error: '{{errorMessage}}' });
  }
});

{{/each}}

export default router;`,
      variables: [
        { name: 'routeName', type: 'string', description: 'Name of the route', required: true },
        { name: 'methods', type: 'array', description: 'HTTP methods and paths', required: true },
        { name: 'useValidation', type: 'boolean', description: 'Include request validation', required: false, defaultValue: true },
        { name: 'useService', type: 'boolean', description: 'Use service layer', required: false, defaultValue: true },
        { name: 'serviceName', type: 'string', description: 'Service class name', required: false },
      ],
      dependencies: ['express', '@types/express', 'express-validator'],
      examples: ['UserRoute', 'ProductRoute', 'OrderRoute']
    });

    // Test Template
    this.templates.set('unit-test', {
      id: 'unit-test',
      name: 'Unit Test',
      description: 'Generate unit tests with Jest/Vitest',
      category: 'test',
      pattern: 'describe|test|it\\(',
      template: `import { describe, it, expect{{#if useMocks}}, vi{{/if}} } from 'vitest';
{{#if isReactTest}}
import { render, screen } from '@testing-library/react';
{{/if}}
import { {{moduleName}} } from '../{{modulePath}}';

describe('{{moduleName}}', () => {
{{#each testCases}}
  {{#if async}}it{{else}}it{{/if}}('{{description}}', async () => {
{{#if setup}}
    // Setup
    {{setup}}
{{/if}}

{{#if isReactTest}}
    render(<{{moduleName}} {{props}} />);
    
    expect(screen.getByText('{{expectedText}}')).toBeInTheDocument();
{{else}}
    // Arrange
    {{arrange}}
    
    // Act
    const result = {{#if async}}await {{/if}}{{moduleName}}.{{method}}({{params}});
    
    // Assert
    expect(result).{{assertion}};
{{/if}}
  });

{{/each}}
});`,
      variables: [
        { name: 'moduleName', type: 'string', description: 'Module/component name to test', required: true },
        { name: 'modulePath', type: 'string', description: 'Path to module', required: true },
        { name: 'testCases', type: 'array', description: 'Test cases to generate', required: true },
        { name: 'isReactTest', type: 'boolean', description: 'Is this a React component test', required: false, defaultValue: false },
        { name: 'useMocks', type: 'boolean', description: 'Include mocking utilities', required: false, defaultValue: false },
      ],
      dependencies: ['vitest', '@testing-library/react'],
      examples: ['UserService', 'Calculator', 'ApiClient']
    });

    // TypeScript Service Template
    this.templates.set('typescript-service', {
      id: 'typescript-service',
      name: 'TypeScript Service Class',
      description: 'Generate a service class with CRUD operations',
      category: 'service',
      pattern: 'class.*Service',
      template: `{{#if useInterface}}
export interface {{entityName}} {
{{#each properties}}
  {{name}}: {{type}};
{{/each}}
}

export interface {{serviceName}}Interface {
{{#each operations}}
  {{name}}({{params}}): Promise<{{returnType}}>;
{{/each}}
}
{{/if}}

export class {{serviceName}}{{#if useInterface}} implements {{serviceName}}Interface{{/if}} {
{{#if useLogger}}
  private logger = console; // Replace with your logger
{{/if}}
{{#if useDatabase}}
  private db: any; // Replace with your database client
{{/if}}

  constructor({{#if useDatabase}}db?: any{{/if}}) {
{{#if useDatabase}}
    this.db = db;
{{/if}}
  }

{{#each operations}}
  async {{name}}({{params}}): Promise<{{returnType}}> {
    try {
{{#if useLogger}}
      this.logger.info('{{serviceName}}.{{name}} called');
{{/if}}

{{#if useDatabase}}
      // Database operation
      const result = await this.db.{{dbOperation}}({{dbParams}});
      return result;
{{else}}
      // Implementation logic here
      throw new Error('Not implemented');
{{/if}}
    } catch (error) {
{{#if useLogger}}
      this.logger.error('{{serviceName}}.{{name}} error:', error);
{{/if}}
      throw error;
    }
  }

{{/each}}
}`,
      variables: [
        { name: 'serviceName', type: 'string', description: 'Service class name', required: true },
        { name: 'entityName', type: 'string', description: 'Entity/model name', required: false },
        { name: 'operations', type: 'array', description: 'Service operations', required: true },
        { name: 'useInterface', type: 'boolean', description: 'Generate TypeScript interfaces', required: false, defaultValue: true },
        { name: 'useLogger', type: 'boolean', description: 'Include logging', required: false, defaultValue: true },
        { name: 'useDatabase', type: 'boolean', description: 'Include database operations', required: false, defaultValue: false },
      ],
      dependencies: ['typescript'],
      examples: ['UserService', 'ProductService', 'OrderService']
    });
  }

  private async getSourceFiles(projectRoot: string): Promise<string[]> {
    const patterns = ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx'];
    const files: string[] = [];

    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: projectRoot,
        ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**'],
        absolute: true
      });
      files.push(...matches);
    }

    return files.slice(0, 50); // Limit for performance
  }

  private async detectPatterns(files: string[]): Promise<DetectedPattern[]> {
    const patterns: DetectedPattern[] = [];
    const patternCounts = new Map<string, { count: number; examples: string[] }>();

    for (const file of files) {
      try {
        const content = await readFile(file, 'utf-8');
        
        // Detect various patterns
        this.detectFrameworkPatterns(content, file, patternCounts);
        this.detectArchitecturalPatterns(content, file, patternCounts);
        this.detectNamingPatterns(content, file, patternCounts);
        this.detectStructuralPatterns(content, file, patternCounts);
        
      } catch (error) {
        log.debug(`Failed to analyze file ${file}: ${error}`);
      }
    }

    // Convert counts to patterns
    for (const [pattern, data] of patternCounts) {
      patterns.push({
        pattern,
        confidence: Math.min(data.count / files.length, 1),
        examples: data.examples.slice(0, 3),
        frequency: data.count,
        category: this.categorizePattern(pattern)
      });
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  private detectFrameworkPatterns(content: string, file: string, patterns: Map<string, any>): void {
    const frameworkPatterns = [
      { pattern: 'react', regex: /import.*React.*from.*['"']react['"']/ },
      { pattern: 'vue', regex: /import.*Vue.*from.*['"']vue['"']/ },
      { pattern: 'express', regex: /import.*express.*from.*['"']express['"']/ },
      { pattern: 'fastify', regex: /import.*fastify.*from.*['"']fastify['"']/ },
      { pattern: 'next', regex: /import.*from.*['"']next/ },
      { pattern: 'angular', regex: /@Component|@Injectable|@NgModule/ },
    ];

    frameworkPatterns.forEach(({ pattern, regex }) => {
      if (regex.test(content)) {
        this.addPattern(patterns, pattern, file);
      }
    });
  }

  private detectArchitecturalPatterns(content: string, file: string, patterns: Map<string, any>): void {
    const archPatterns = [
      { pattern: 'service-class', regex: /class\s+\w+Service/ },
      { pattern: 'controller-class', regex: /class\s+\w+Controller/ },
      { pattern: 'model-class', regex: /class\s+\w+Model/ },
      { pattern: 'repository-pattern', regex: /class\s+\w+Repository/ },
      { pattern: 'factory-pattern', regex: /class\s+\w+Factory/ },
      { pattern: 'singleton-pattern', regex: /private\s+static\s+instance/ },
      { pattern: 'observer-pattern', regex: /addEventListener|on\(.*,|subscribe/ },
    ];

    archPatterns.forEach(({ pattern, regex }) => {
      if (regex.test(content)) {
        this.addPattern(patterns, pattern, file);
      }
    });
  }

  private detectNamingPatterns(content: string, file: string, patterns: Map<string, any>): void {
    // Detect naming conventions
    const camelCaseVars = content.match(/\b[a-z][a-zA-Z0-9]*\b/g) || [];
    const PascalCaseClasses = content.match(/\bclass\s+[A-Z][a-zA-Z0-9]*\b/g) || [];
    const kebabCaseFiles = file.match(/[a-z]+-[a-z]+\.[jt]sx?$/) ? [file] : [];

    if (camelCaseVars.length > 5) this.addPattern(patterns, 'camelCase-variables', file);
    if (PascalCaseClasses.length > 0) this.addPattern(patterns, 'PascalCase-classes', file);
    if (kebabCaseFiles.length > 0) this.addPattern(patterns, 'kebab-case-files', file);
  }

  private detectStructuralPatterns(content: string, file: string, patterns: Map<string, any>): void {
    const structuralPatterns = [
      { pattern: 'default-export', regex: /export\s+default/ },
      { pattern: 'named-exports', regex: /export\s+\{/ },
      { pattern: 'async-await', regex: /async\s+\w+|await\s+/ },
      { pattern: 'arrow-functions', regex: /=>\s*\{?/ },
      { pattern: 'destructuring', regex: /const\s+\{.*\}\s*=/ },
      { pattern: 'typescript-interfaces', regex: /interface\s+\w+/ },
      { pattern: 'typescript-types', regex: /type\s+\w+\s*=/ },
    ];

    structuralPatterns.forEach(({ pattern, regex }) => {
      if (regex.test(content)) {
        this.addPattern(patterns, pattern, file);
      }
    });
  }

  private addPattern(patterns: Map<string, any>, pattern: string, file: string): void {
    if (!patterns.has(pattern)) {
      patterns.set(pattern, { count: 0, examples: [] });
    }
    const data = patterns.get(pattern)!;
    data.count++;
    if (data.examples.length < 3) {
      data.examples.push(file);
    }
  }

  private categorizePattern(pattern: string): string {
    if (['react', 'vue', 'angular', 'express'].includes(pattern)) return 'framework';
    if (pattern.includes('class') || pattern.includes('pattern')) return 'architecture';
    if (pattern.includes('Case') || pattern.includes('files')) return 'naming';
    return 'structural';
  }

  private async analyzeProjectCharacteristics(files: string[]): Promise<ProjectCharacteristics> {
    // Analyze package.json if available
    let primaryFramework = 'vanilla';
    let testingFramework = '';
    
    try {
      const packageJsonPath = files.find(f => f.endsWith('package.json'));
      if (packageJsonPath) {
        const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if (deps.react) primaryFramework = 'react';
        else if (deps.vue) primaryFramework = 'vue';
        else if (deps.express) primaryFramework = 'express';
        else if (deps['@angular/core']) primaryFramework = 'angular';
        
        if (deps.jest) testingFramework = 'jest';
        else if (deps.vitest) testingFramework = 'vitest';
        else if (deps.mocha) testingFramework = 'mocha';
      }
    } catch (error) {
      log.debug('Failed to analyze package.json');
    }

    return {
      primaryFramework,
      architecturePattern: 'layered', // Default
      commonNamingConventions: ['camelCase', 'PascalCase'],
      typicalFileStructure: ['src/', 'components/', 'services/', 'utils/'],
      testingFramework,
      styleGuide: 'standard'
    };
  }

  private generateTemplateSuggestions(
    patterns: DetectedPattern[],
    characteristics: ProjectCharacteristics
  ): CodeTemplate[] {
    const suggestions: CodeTemplate[] = [];

    // Suggest templates based on detected patterns
    if (characteristics.primaryFramework === 'react') {
      suggestions.push(this.templates.get('react-component')!);
    }
    
    if (characteristics.primaryFramework === 'express') {
      suggestions.push(this.templates.get('express-route')!);
    }

    if (patterns.some(p => p.pattern === 'service-class')) {
      suggestions.push(this.templates.get('typescript-service')!);
    }

    if (characteristics.testingFramework) {
      suggestions.push(this.templates.get('unit-test')!);
    }

    return suggestions.filter(Boolean);
  }

  private processTemplate(template: string, variables: Record<string, any>): string {
    let processed = template;

    // Simple handlebars-like processing
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, String(value));
    }

    // Process conditionals {{#if condition}}...{{/if}}
    processed = this.processConditionals(processed, variables);
    
    // Process loops {{#each array}}...{{/each}}
    processed = this.processLoops(processed, variables);

    // Process helpers {{lowerCase text}}
    processed = this.processHelpers(processed);

    return processed;
  }

  private processConditionals(template: string, variables: Record<string, any>): string {
    const conditionalRegex = /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g;
    
    return template.replace(conditionalRegex, (match, condition, content) => {
      return variables[condition] ? content : '';
    });
  }

  private processLoops(template: string, variables: Record<string, any>): string {
    const loopRegex = /{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g;
    
    return template.replace(loopRegex, (match, arrayName, content) => {
      const array = variables[arrayName] || [];
      return array.map((item: any) => {
        let itemContent = content;
        
        // Replace item properties
        if (typeof item === 'object') {
          for (const [key, value] of Object.entries(item)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            itemContent = itemContent.replace(regex, String(value));
          }
        }
        
        return itemContent;
      }).join('\n');
    });
  }

  private processHelpers(template: string): string {
    // {{lowerCase text}}
    template = template.replace(/{{lowerCase\s+(\w+)}}/g, (match, text) => {
      return text.toLowerCase();
    });

    // {{upperCase text}}
    template = template.replace(/{{upperCase\s+(\w+)}}/g, (match, text) => {
      return text.toUpperCase();
    });

    // {{camelCase text}}
    template = template.replace(/{{camelCase\s+(\w+)}}/g, (match, text) => {
      return text.charAt(0).toLowerCase() + text.slice(1);
    });

    return template;
  }

  private validateRequest(request: GenerationRequest, template: CodeTemplate): string[] {
    const errors: string[] = [];

    // Check required variables
    for (const variable of template.variables) {
      if (variable.required && !(variable.name in request.variables)) {
        errors.push(`Required variable '${variable.name}' is missing`);
      }
    }

    // Type validation
    for (const [key, value] of Object.entries(request.variables)) {
      const variable = template.variables.find(v => v.name === key);
      if (variable) {
        if (!this.validateVariableType(value, variable.type)) {
          errors.push(`Variable '${key}' has invalid type. Expected ${variable.type}`);
        }
      }
    }

    return errors;
  }

  private validateVariableType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && !Array.isArray(value) && value !== null;
      default:
        return true;
    }
  }

  private generatePostGenerationSuggestions(template: CodeTemplate, request: GenerationRequest): string[] {
    const suggestions: string[] = [];

    suggestions.push(`Generated ${template.name} successfully`);
    
    if (template.dependencies.length > 0) {
      suggestions.push(`Consider installing dependencies: ${template.dependencies.join(', ')}`);
    }

    if (template.category === 'component') {
      suggestions.push('Add corresponding test file');
      suggestions.push('Update index.js to export the new component');
    }

    if (template.category === 'service') {
      suggestions.push('Register service in dependency injection container');
      suggestions.push('Add service to API documentation');
    }

    return suggestions;
  }

  // Public API methods
  async generateFromPattern(
    projectRoot: string,
    patternName: string,
    variables: Record<string, any>
  ): Promise<GenerationResult> {
    const analysis = await this.analyzeProjectPatterns(projectRoot);
    const template = analysis.suggestions.find(t => t.name.toLowerCase().includes(patternName.toLowerCase()));
    
    if (!template) {
      return {
        success: false,
        generatedFiles: [],
        errors: [`No template found for pattern: ${patternName}`],
        suggestions: [`Available patterns: ${analysis.suggestions.map(s => s.name).join(', ')}`]
      };
    }

    return this.generateCode({
      templateId: template.id,
      outputPath: variables.outputPath || `./generated/${patternName}.ts`,
      variables
    });
  }

  addCustomTemplate(template: CodeTemplate): void {
    this.templates.set(template.id, template);
  }

  listAvailableTemplates(): CodeTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplateById(id: string): CodeTemplate | undefined {
    return this.templates.get(id);
  }
}

export default SmartCodeGenerator;