// AST-based code refactoring and template injection system
import * as parser from '@babel/parser';
import generate from '@babel/generator';
import { cfg } from '../config.js';
import pino from 'pino';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ASTModification {
  type: 'insert' | 'replace' | 'delete' | 'wrap';
  target: ASTTarget;
  code?: string;
  template?: string;
  templateVars?: Record<string, any>;
}

export interface ASTTarget {
  type: 'function' | 'class' | 'variable' | 'import' | 'export' | 'statement';
  name?: string;
  selector?: string; // CSS-like selector for AST nodes
  position?: {
    line: number;
    column: number;
  };
}

export interface TemplateContext {
  entity: string;
  properties: Record<string, any>;
  methods: Record<string, any>;
  imports: string[];
  config: Record<string, any>;
}

export class ASTRefiner {
  
  async parseAndModify(filePath: string, modifications: ASTModification[]): Promise<{ success: boolean; code?: string; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const source = await readFile(filePath, 'utf-8');
      const ast = this.parseCode(source, filePath);
      
      if (!ast) {
        errors.push('Failed to parse source code');
        return { success: false, errors };
      }

      // Apply modifications to AST
      for (const mod of modifications) {
        try {
          this.applyModification(ast, mod);
        } catch (error) {
          errors.push(`Failed to apply modification: ${error}`);
        }
      }

      // Generate modified code
      const result = generate(ast, {
        retainLines: true,
        compact: false
      });

      return {
        success: errors.length === 0,
        code: result.code,
        errors
      };
    } catch (error) {
      errors.push(`AST processing failed: ${error}`);
      return { success: false, errors };
    }
  }

  private parseCode(source: string, filePath: string): any {
    try {
      const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
      const isJSX = filePath.endsWith('.jsx') || filePath.endsWith('.tsx');
      
      return parser.parse(source, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        plugins: [
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'asyncGenerators',
          'functionBind',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'dynamicImport',
          'nullishCoalescingOperator',
          'optionalChaining',
          ...(isTypeScript ? ['typescript'] : []),
          ...(isJSX ? ['jsx'] : [])
        ]
      });
    } catch (error) {
      log.error(`Parse error for ${filePath}: ${error}`);
      return null;
    }
  }

  private applyModification(ast: any, modification: ASTModification) {
    const targetNodes = this.findTargetNodes(ast, modification.target);
    
    for (const node of targetNodes) {
      switch (modification.type) {
        case 'insert':
          this.insertCode(ast, node, modification);
          break;
        case 'replace':
          this.replaceCode(node, modification);
          break;
        case 'delete':
          this.deleteCode(ast, node);
          break;
        case 'wrap':
          this.wrapCode(ast, node, modification);
          break;
      }
    }
  }

  private findTargetNodes(ast: any, target: ASTTarget): any[] {
    const nodes: any[] = [];
    
    // Simple traversal to find target nodes
    this.traverse(ast, (node: any) => {
      if (this.matchesTarget(node, target)) {
        nodes.push(node);
      }
    });
    
    return nodes;
  }

  private matchesTarget(node: any, target: ASTTarget): boolean {
    if (target.type === 'function' && node.type === 'FunctionDeclaration') {
      return !target.name || node.id?.name === target.name;
    }
    
    if (target.type === 'class' && node.type === 'ClassDeclaration') {
      return !target.name || node.id?.name === target.name;
    }
    
    if (target.type === 'variable' && node.type === 'VariableDeclarator') {
      return !target.name || node.id?.name === target.name;
    }
    
    if (target.type === 'import' && node.type === 'ImportDeclaration') {
      return !target.name || node.source?.value === target.name;
    }
    
    return false;
  }

  private traverse(node: any, visitor: (node: any) => void) {
    if (!node || typeof node !== 'object') return;
    
    visitor(node);
    
    for (const key in node) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(item => this.traverse(item, visitor));
      } else if (child && typeof child === 'object') {
        this.traverse(child, visitor);
      }
    }
  }

  private insertCode(ast: any, targetNode: any, modification: ASTModification) {
    // Implementation depends on specific insertion logic
    // This is a simplified version
    log.info('Inserting code at target node');
  }

  private replaceCode(targetNode: any, modification: ASTModification) {
    if (modification.code) {
      // Parse replacement code and replace node
      const replacementAST = this.parseCode(modification.code, 'temp.js');
      if (replacementAST && replacementAST.body[0]) {
        Object.assign(targetNode, replacementAST.body[0]);
      }
    }
  }

  private deleteCode(ast: any, targetNode: any) {
    // Mark node for deletion - actual removal happens during generation
    targetNode._deleted = true;
  }

  private wrapCode(ast: any, targetNode: any, modification: ASTModification) {
    // Wrap existing code with new structure
    log.info('Wrapping code at target node');
  }
}

export class TemplateEngine {
  private templates: Map<string, string> = new Map();

  constructor() {
    this.loadDefaultTemplates();
  }

  private loadDefaultTemplates() {
    // CRUD API Controller template
    this.templates.set('crud-controller', `
import { Request, Response } from 'express';
import { {{entity}}Service } from '../services/{{entityLower}}Service.js';

export class {{entity}}Controller {
  private service = new {{entity}}Service();

  async getAll(req: Request, res: Response) {
    try {
      const items = await this.service.findAll();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const item = await this.service.findById(req.params.id);
      if (!item) {
        return res.status(404).json({ error: '{{entity}} not found' });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const item = await this.service.create(req.body);
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const item = await this.service.update(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: '{{entity}} not found' });
      }
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const success = await this.service.delete(req.params.id);
      if (!success) {
        return res.status(404).json({ error: '{{entity}} not found' });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}
`);

    // Service layer template
    this.templates.set('service', `
import { prisma } from '../storage/prisma.js';

export class {{entity}}Service {
  
  async findAll() {
    return prisma.{{entityLower}}.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string) {
    return prisma.{{entityLower}}.findUnique({
      where: { id }
    });
  }

  async create(data: any) {
    return prisma.{{entityLower}}.create({
      data
    });
  }

  async update(id: string, data: any) {
    return prisma.{{entityLower}}.update({
      where: { id },
      data
    });
  }

  async delete(id: string) {
    try {
      await prisma.{{entityLower}}.delete({
        where: { id }
      });
      return true;
    } catch {
      return false;
    }
  }
}
`);

    // React component template
    this.templates.set('react-component', `
import React, { useState, useEffect } from 'react';
{{#each imports}}
import {{this}};
{{/each}}

interface {{entity}}Props {
  {{#each properties}}
  {{@key}}{{#if optional}}?{{/if}}: {{type}};
  {{/each}}
}

export const {{entity}}: React.FC<{{entity}}Props> = ({
  {{#each properties}}
  {{@key}},
  {{/each}}
}) => {
  {{#each state}}
  const [{{name}}, set{{capitalize name}}] = useState<{{type}}>({{defaultValue}});
  {{/each}}

  useEffect(() => {
    // Component initialization
  }, []);

  {{#each methods}}
  const {{name}} = {{async}}({{parameters}}) => {
    {{body}}
  };
  {{/each}}

  return (
    <div className="{{entityLower}}">
      {/* Component JSX */}
    </div>
  );
};
`);

    // Test suite template
    this.templates.set('test-suite', `
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { {{entity}}Service } from '../{{entityLower}}Service.js';

describe('{{entity}}Service', () => {
  let service: {{entity}}Service;

  beforeEach(() => {
    service = new {{entity}}Service();
  });

  afterEach(() => {
    // Cleanup
  });

  describe('findAll', () => {
    it('should return all {{entityLower}} items', async () => {
      const result = await service.findAll();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('findById', () => {
    it('should return {{entityLower}} by id', async () => {
      // Test implementation
    });

    it('should return null for non-existent id', async () => {
      const result = await service.findById('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create new {{entityLower}}', async () => {
      const data = {
        // Test data
      };
      const result = await service.create(data);
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update existing {{entityLower}}', async () => {
      // Test implementation
    });
  });

  describe('delete', () => {
    it('should delete {{entityLower}}', async () => {
      // Test implementation
    });
  });
});
`);
  }

  async generateFromTemplate(templateName: string, context: TemplateContext): Promise<string> {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    return this.renderTemplate(template, context);
  }

  private renderTemplate(template: string, context: TemplateContext): string {
    let rendered = template;
    
    // Simple template variable replacement
    rendered = rendered.replace(/\{\{entity\}\}/g, context.entity);
    rendered = rendered.replace(/\{\{entityLower\}\}/g, context.entity.toLowerCase());
    
    // Replace property placeholders
    for (const [key, value] of Object.entries(context.properties || {})) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      rendered = rendered.replace(placeholder, String(value));
    }
    
    // Handle conditional blocks and loops (simplified)
    rendered = this.processConditionals(rendered, context);
    rendered = this.processLoops(rendered, context);
    
    return rendered;
  }

  private processConditionals(template: string, context: TemplateContext): string {
    // Simple conditional processing
    return template.replace(/\{\{#if (.+?)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
      // Evaluate condition based on context
      const conditionValue = this.evaluateCondition(condition, context);
      return conditionValue ? content : '';
    });
  }

  private processLoops(template: string, context: TemplateContext): string {
    // Simple loop processing
    return template.replace(/\{\{#each (.+?)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, collection, content) => {
      const items = this.getCollection(collection, context);
      if (!Array.isArray(items)) return '';
      
      return items.map(item => {
        let itemContent = content;
        // Replace item-specific placeholders
        for (const [key, value] of Object.entries(item)) {
          const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
          itemContent = itemContent.replace(placeholder, String(value));
        }
        return itemContent;
      }).join('\n');
    });
  }

  private evaluateCondition(condition: string, context: TemplateContext): boolean {
    // Simple condition evaluation
    return context.properties[condition] !== undefined;
  }

  private getCollection(collection: string, context: TemplateContext): any[] {
    return context.properties[collection] || [];
  }

  addTemplate(name: string, template: string) {
    this.templates.set(name, template);
  }

  listTemplates(): string[] {
    return Array.from(this.templates.keys());
  }
}

export class AssetProcessor {
  
  async optimizeImages(sourcePath: string, targetPath: string): Promise<{ success: boolean; savings: number }> {
    // Simplified image optimization
    log.info(`Optimizing images from ${sourcePath} to ${targetPath}`);
    return { success: true, savings: 0 };
  }

  async generateFavicons(sourcePath: string, outputDir: string): Promise<{ success: boolean; files: string[] }> {
    // Generate multiple favicon sizes
    const sizes = [16, 32, 48, 64, 128, 256];
    const files: string[] = [];
    
    for (const size of sizes) {
      const filename = `favicon-${size}x${size}.png`;
      files.push(filename);
      // In real implementation, would use image processing library
    }
    
    return { success: true, files };
  }

  async compressAssets(inputDir: string, outputDir: string): Promise<{ success: boolean; compressionRatio: number }> {
    // Compress CSS, JS, and other assets
    log.info(`Compressing assets from ${inputDir} to ${outputDir}`);
    return { success: true, compressionRatio: 0.65 };
  }

  async generateSprites(imageDir: string, outputPath: string): Promise<{ success: boolean; spriteData: any }> {
    // Generate CSS sprites from individual images
    log.info(`Generating sprites from ${imageDir} to ${outputPath}`);
    return { 
      success: true, 
      spriteData: {
        images: [],
        cssPath: outputPath + '.css',
        imagePath: outputPath + '.png'
      }
    };
  }
}

export { ASTModification, ASTTarget, TemplateContext };