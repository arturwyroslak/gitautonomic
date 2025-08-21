import * as fs from 'fs/promises';
import * as path from 'path';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface RefactoringOpportunity {
  id: string;
  type: 'extract_method' | 'extract_variable' | 'inline_method' | 'rename' | 'move_method' | 'eliminate_duplication' | 'simplify_conditional' | 'decompose_conditional';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: {
    filePath: string;
    startLine: number;
    endLine: number;
    column?: number;
  };
  before: string;
  after: string;
  reason: string;
  impact: {
    readability: number; // -10 to +10
    maintainability: number;
    performance: number;
    testability: number;
  };
  complexity: {
    before: number;
    after: number;
  };
  confidence: number; // 0-1
  prerequisites?: string[];
  risks?: string[];
}

export interface RefactoringPlan {
  id: string;
  opportunities: RefactoringOpportunity[];
  estimatedTime: number; // minutes
  priorityOrder: string[]; // opportunity IDs in order
  dependencies: Array<{
    opportunityId: string;
    dependsOn: string[];
  }>;
  rollbackPlan: string;
}

export interface RefactoringResult {
  success: boolean;
  plan?: RefactoringPlan;
  appliedRefactorings?: Array<{
    opportunityId: string;
    success: boolean;
    error?: string;
  }>;
  summary?: {
    totalOpportunities: number;
    appliedSuccessfully: number;
    complexityReduction: number;
    estimatedTimeSpent: number;
  };
  error?: string;
}

export interface RefactoringOptions {
  targetFiles?: string[];
  includePatterns?: string[];
  excludePatterns?: string[];
  maxComplexity?: number;
  minConfidence?: number;
  autoApply?: boolean;
  createBackup?: boolean;
  includeTypes?: RefactoringOpportunity['type'][];
  excludeTypes?: RefactoringOpportunity['type'][];
}

export class RefactoringAssistantTool {
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB limit

  /**
   * AI-powered refactoring with intelligent suggestions
   */
  async analyzeRefactoringOpportunities(
    workingDirectory: string,
    options: RefactoringOptions = {}
  ): Promise<RefactoringResult> {
    try {
      log.info('Analyzing refactoring opportunities', { 
        workingDirectory, 
        options 
      } as any);

      // Discover target files
      const targetFiles = await this.discoverTargetFiles(workingDirectory, options);
      if (targetFiles.length === 0) {
        return {
          success: false,
          error: 'No target files found for refactoring analysis'
        };
      }

      // Analyze each file for refactoring opportunities
      const allOpportunities: RefactoringOpportunity[] = [];
      for (const filePath of targetFiles) {
        const opportunities = await this.analyzeFile(filePath, options);
        allOpportunities.push(...opportunities);
      }

      // Filter opportunities based on options
      const filteredOpportunities = this.filterOpportunities(allOpportunities, options);

      // Create refactoring plan
      const plan = this.createRefactoringPlan(filteredOpportunities);

      log.info(`Found ${filteredOpportunities.length} refactoring opportunities`);

      return {
        success: true,
        plan
      };

    } catch (error) {
      log.error(`Refactoring analysis failed: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Apply refactoring suggestions
   */
  async applyRefactorings(
    plan: RefactoringPlan,
    options: { autoApply?: boolean; createBackup?: boolean } = {}
  ): Promise<RefactoringResult> {
    try {
      if (options.createBackup) {
        await this.createBackup(plan);
      }

      const appliedRefactorings: Array<{ opportunityId: string; success: boolean; error?: string }> = [];
      let complexityReduction = 0;

      // Apply refactorings in priority order
      for (const opportunityId of plan.priorityOrder) {
        const opportunity = plan.opportunities.find(op => op.id === opportunityId);
        if (!opportunity) continue;

        try {
          await this.applyRefactoring(opportunity);
          appliedRefactorings.push({ opportunityId, success: true });
          complexityReduction += opportunity.complexity.before - opportunity.complexity.after;
        } catch (error) {
          appliedRefactorings.push({
            opportunityId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const successful = appliedRefactorings.filter(r => r.success).length;

      return {
        success: true,
        appliedRefactorings,
        summary: {
          totalOpportunities: plan.opportunities.length,
          appliedSuccessfully: successful,
          complexityReduction,
          estimatedTimeSpent: plan.estimatedTime * (successful / plan.opportunities.length)
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate refactoring suggestions for specific code
   */
  async suggestRefactorings(code: string, filePath: string): Promise<RefactoringOpportunity[]> {
    const opportunities: RefactoringOpportunity[] = [];

    // Analyze the code for various refactoring opportunities
    opportunities.push(...this.detectLongMethods(code, filePath));
    opportunities.push(...this.detectDuplicatedCode(code, filePath));
    opportunities.push(...this.detectComplexConditionals(code, filePath));
    opportunities.push(...this.detectLargeClasses(code, filePath));
    opportunities.push(...this.detectLongParameterLists(code, filePath));
    opportunities.push(...this.detectDeadCode(code, filePath));

    return opportunities.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Estimate refactoring impact
   */
  estimateRefactoringImpact(opportunity: RefactoringOpportunity): {
    timeEstimate: number;
    riskLevel: 'low' | 'medium' | 'high';
    benefits: string[];
    concerns: string[];
  } {
    const timeEstimate = this.calculateTimeEstimate(opportunity);
    const riskLevel = this.assessRiskLevel(opportunity);
    const benefits = this.identifyBenefits(opportunity);
    const concerns = this.identifyConcerns(opportunity);

    return { timeEstimate, riskLevel, benefits, concerns };
  }

  private async discoverTargetFiles(
    workingDirectory: string,
    options: RefactoringOptions
  ): Promise<string[]> {
    if (options.targetFiles) {
      return options.targetFiles.map(file => path.resolve(workingDirectory, file));
    }

    const defaultPatterns = ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'];
    const includePatterns = options.includePatterns || defaultPatterns;
    const excludePatterns = options.excludePatterns || ['node_modules/**', 'dist/**', '**/*.test.*', '**/*.spec.*'];

    try {
      const { glob } = await import('glob');
      const files: string[] = [];

      for (const pattern of includePatterns) {
        const matchedFiles = await glob(pattern, {
          cwd: workingDirectory,
          ignore: excludePatterns,
          absolute: true
        });
        files.push(...matchedFiles);
      }

      return [...new Set(files)];
    } catch (error) {
      log.warn(`Could not discover files: ${error}`);
      return [];
    }
  }

  private async analyzeFile(
    filePath: string,
    options: RefactoringOptions
  ): Promise<RefactoringOpportunity[]> {
    try {
      const stats = await fs.stat(filePath);
      if (stats.size > this.maxFileSize) {
        log.warn(`File too large for analysis: ${filePath}`);
        return [];
      }

      const content = await fs.readFile(filePath, 'utf-8');
      return await this.suggestRefactorings(content, filePath);
    } catch (error) {
      log.warn(`Could not analyze file ${filePath}: ${error}`);
      return [];
    }
  }

  private detectLongMethods(code: string, filePath: string): RefactoringOpportunity[] {
    const opportunities: RefactoringOpportunity[] = [];
    const lines = code.split('\n');
    const methodRegex = /(?:function\s+(\w+)|(\w+)\s*[:=]\s*(?:async\s+)?function)/g;

    let match;
    while ((match = methodRegex.exec(code)) !== null) {
      const methodName = match[1] || match[2];
      const startIndex = code.indexOf(match[0]);
      const startLine = code.substring(0, startIndex).split('\n').length;

      // Find method body
      const methodBody = this.extractMethodBody(lines, startLine - 1);
      const methodLines = methodBody.split('\n').length;

      if (methodLines > 50) { // Consider methods with >50 lines as long
        opportunities.push({
          id: `extract_method_${methodName}_${startLine}`,
          type: 'extract_method',
          description: `Method '${methodName}' is too long (${methodLines} lines)`,
          severity: methodLines > 100 ? 'high' : 'medium',
          location: {
            filePath,
            startLine,
            endLine: startLine + methodLines - 1
          },
          before: methodBody,
          after: methodName ? this.generateExtractMethodRefactoring(methodName, methodBody) : 'Method refactoring',
          reason: 'Long methods are hard to understand, debug, and maintain',
          impact: {
            readability: 5,
            maintainability: 6,
            performance: 0,
            testability: 4
          },
          complexity: {
            before: this.calculateComplexity(methodBody),
            after: this.calculateComplexity(methodBody) * 0.7 // Estimated reduction
          },
          confidence: 0.8
        });
      }
    }

    return opportunities;
  }

  private detectDuplicatedCode(code: string, filePath: string): RefactoringOpportunity[] {
    const opportunities: RefactoringOpportunity[] = [];
    const lines = code.split('\n');
    const minDuplicationLength = 5;

    // Simple duplication detection
    for (let i = 0; i < lines.length - minDuplicationLength; i++) {
      const segment = lines.slice(i, i + minDuplicationLength).join('\n');
      const segmentTrimmed = segment.trim();

      if (segmentTrimmed.length < 20) continue; // Skip short segments

      let duplicateCount = 0;
      let lastFoundAt = -1;

      for (let j = i + minDuplicationLength; j < lines.length - minDuplicationLength; j++) {
        const compareSegment = lines.slice(j, j + minDuplicationLength).join('\n').trim();
        
        if (this.calculateSimilarity(segmentTrimmed, compareSegment) > 0.8) {
          duplicateCount++;
          lastFoundAt = j;
        }
      }

      if (duplicateCount > 0) {
        opportunities.push({
          id: `eliminate_duplication_${i}_${lastFoundAt}`,
          type: 'eliminate_duplication',
          description: `Duplicated code found (${duplicateCount + 1} occurrences)`,
          severity: duplicateCount > 2 ? 'high' : 'medium',
          location: {
            filePath,
            startLine: i + 1,
            endLine: i + minDuplicationLength
          },
          before: segment,
          after: this.generateExtractMethodForDuplication(segment),
          reason: 'Code duplication increases maintenance burden and introduces bugs',
          impact: {
            readability: 3,
            maintainability: 8,
            performance: 1,
            testability: 2
          },
          complexity: {
            before: 10,
            after: 5
          },
          confidence: 0.7
        });
      }
    }

    return opportunities;
  }

  private detectComplexConditionals(code: string, filePath: string): RefactoringOpportunity[] {
    const opportunities: RefactoringOpportunity[] = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Detect complex if statements
      if (trimmedLine.startsWith('if') || trimmedLine.includes('if (')) {
        const conditionComplexity = this.calculateConditionComplexity(trimmedLine);
        
        if (conditionComplexity > 3) {
          opportunities.push({
            id: `simplify_conditional_${index}`,
            type: 'simplify_conditional',
            description: `Complex conditional statement (complexity: ${conditionComplexity})`,
            severity: conditionComplexity > 5 ? 'high' : 'medium',
            location: {
              filePath,
              startLine: index + 1,
              endLine: index + 1
            },
            before: trimmedLine,
            after: this.generateSimplifiedConditional(trimmedLine),
            reason: 'Complex conditionals are hard to understand and maintain',
            impact: {
              readability: 6,
              maintainability: 5,
              performance: 0,
              testability: 4
            },
            complexity: {
              before: conditionComplexity,
              after: Math.max(1, conditionComplexity * 0.5)
            },
            confidence: 0.6
          });
        }
      }
    });

    return opportunities;
  }

  private detectLargeClasses(code: string, filePath: string): RefactoringOpportunity[] {
    const opportunities: RefactoringOpportunity[] = [];
    const classRegex = /class\s+(\w+)/g;
    
    let match;
    while ((match = classRegex.exec(code)) !== null) {
      const className = match[1];
      const startIndex = match.index;
      const startLine = code.substring(0, startIndex).split('\n').length;

      const classBody = this.extractClassBody(code, startIndex);
      const classLines = classBody.split('\n').length;
      const methodCount = (classBody.match(/(?:function\s+\w+|\w+\s*\()/g) || []).length;

      if (classLines > 200 || methodCount > 20) {
        opportunities.push({
          id: `extract_class_${className}_${startLine}`,
          type: 'move_method',
          description: `Class '${className}' is too large (${classLines} lines, ${methodCount} methods)`,
          severity: classLines > 400 ? 'high' : 'medium',
          location: {
            filePath,
            startLine,
            endLine: startLine + classLines - 1
          },
          before: classBody,
          after: className ? this.generateClassExtractionRefactoring(className, classBody) : 'Class refactoring',
          reason: 'Large classes violate the Single Responsibility Principle',
          impact: {
            readability: 7,
            maintainability: 8,
            performance: 1,
            testability: 6
          },
          complexity: {
            before: methodCount,
            after: methodCount * 0.6
          },
          confidence: 0.7
        });
      }
    }

    return opportunities;
  }

  private detectLongParameterLists(code: string, filePath: string): RefactoringOpportunity[] {
    const opportunities: RefactoringOpportunity[] = [];
    const functionRegex = /(?:function\s+(\w+)\s*\(([^)]*)\)|(\w+)\s*\(\s*([^)]*)\s*\)\s*[={])/g;

    let match;
    while ((match = functionRegex.exec(code)) !== null) {
      const functionName = match[1] || match[3];
      const parameters = match[2] || match[4];
      
      if (parameters) {
        const paramCount = parameters.split(',').filter(p => p.trim().length > 0).length;
        
        if (paramCount > 5) {
          const startIndex = match.index;
          const startLine = code.substring(0, startIndex).split('\n').length;

          opportunities.push({
            id: `introduce_parameter_object_${functionName}_${startLine}`,
            type: 'extract_variable',
            description: `Function '${functionName}' has too many parameters (${paramCount})`,
            severity: paramCount > 8 ? 'high' : 'medium',
            location: {
              filePath,
              startLine,
              endLine: startLine
            },
            before: match[0],
            after: functionName ? this.generateParameterObjectRefactoring(functionName, parameters) : 'Parameter refactoring',
            reason: 'Long parameter lists are hard to understand and maintain',
            impact: {
              readability: 5,
              maintainability: 6,
              performance: 0,
              testability: 3
            },
            complexity: {
              before: paramCount,
              after: 2
            },
            confidence: 0.8
          });
        }
      }
    }

    return opportunities;
  }

  private detectDeadCode(code: string, filePath: string): RefactoringOpportunity[] {
    const opportunities: RefactoringOpportunity[] = [];
    
    // Simple dead code detection (unused variables, unreachable code)
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Detect code after return statements
      if (trimmedLine.startsWith('return') && index < lines.length - 1) {
        const nextLine = lines[index + 1]?.trim();
        if (nextLine && !nextLine.startsWith('}') && !nextLine.startsWith('//')) {
          opportunities.push({
            id: `remove_dead_code_${index}`,
            type: 'inline_method',
            description: 'Unreachable code after return statement',
            severity: 'low',
            location: {
              filePath,
              startLine: index + 2,
              endLine: index + 2
            },
            before: nextLine,
            after: '',
            reason: 'Dead code confuses developers and clutters the codebase',
            impact: {
              readability: 2,
              maintainability: 3,
              performance: 0,
              testability: 1
            },
            complexity: {
              before: 1,
              after: 0
            },
            confidence: 0.9
          });
        }
      }
    });

    return opportunities;
  }

  private filterOpportunities(
    opportunities: RefactoringOpportunity[],
    options: RefactoringOptions
  ): RefactoringOpportunity[] {
    let filtered = opportunities;

    if (options.minConfidence !== undefined) {
      filtered = filtered.filter(op => op.confidence >= options.minConfidence!);
    }

    if (options.includeTypes) {
      filtered = filtered.filter(op => options.includeTypes!.includes(op.type));
    }

    if (options.excludeTypes) {
      filtered = filtered.filter(op => !options.excludeTypes!.includes(op.type));
    }

    return filtered.sort((a, b) => {
      // Sort by severity, then confidence
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      
      return b.confidence - a.confidence;
    });
  }

  private createRefactoringPlan(opportunities: RefactoringOpportunity[]): RefactoringPlan {
    const priorityOrder = opportunities.map(op => op.id);
    const estimatedTime = opportunities.reduce((sum, op) => sum + this.calculateTimeEstimate(op), 0);

    return {
      id: `refactoring_plan_${Date.now()}`,
      opportunities,
      estimatedTime,
      priorityOrder,
      dependencies: [], // Could be enhanced to detect dependencies
      rollbackPlan: 'Create backup before applying changes'
    };
  }

  private async applyRefactoring(opportunity: RefactoringOpportunity): Promise<void> {
    // Read the file
    const content = await fs.readFile(opportunity.location.filePath, 'utf-8');
    const lines = content.split('\n');

    // Apply the refactoring
    const startLine = opportunity.location.startLine - 1;
    const endLine = opportunity.location.endLine - 1;

    // Replace the code
    const newLines = [
      ...lines.slice(0, startLine),
      ...opportunity.after.split('\n'),
      ...lines.slice(endLine + 1)
    ];

    // Write back to file
    await fs.writeFile(opportunity.location.filePath, newLines.join('\n'), 'utf-8');
  }

  private async createBackup(plan: RefactoringPlan): Promise<void> {
    const backupDir = `.refactoring_backup_${Date.now()}`;
    await fs.mkdir(backupDir, { recursive: true });

    const uniqueFiles = [...new Set(plan.opportunities.map(op => op.location.filePath))];
    
    for (const filePath of uniqueFiles) {
      const relativePath = path.relative(process.cwd(), filePath);
      const backupPath = path.join(backupDir, relativePath);
      
      await fs.mkdir(path.dirname(backupPath), { recursive: true });
      await fs.copyFile(filePath, backupPath);
    }

    log.info(`Created backup in ${backupDir}`);
  }

  // Utility methods for generating refactored code
  private extractMethodBody(lines: string[], startLine: number): string {
    let braceCount = 0;
    let started = false;
    const bodyLines: string[] = [];

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      
      if (!started && line.includes('{')) {
        started = true;
      }
      
      if (started) {
        bodyLines.push(line);
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;
        
        if (braceCount === 0) {
          break;
        }
      }
    }

    return bodyLines.join('\n');
  }

  private extractClassBody(code: string, startIndex: number): string {
    const remainingCode = code.substring(startIndex);
    let braceCount = 0;
    let started = false;
    let endIndex = 0;

    for (let i = 0; i < remainingCode.length; i++) {
      const char = remainingCode[i];
      
      if (char === '{') {
        started = true;
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (started && braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }

    return remainingCode.substring(0, endIndex);
  }

  private calculateComplexity(code: string): number {
    // Simple complexity calculation
    const keywords = ['if', 'else', 'while', 'for', 'switch', 'case', 'catch', 'try'];
    return keywords.reduce((count, keyword) => {
      return count + (code.match(new RegExp(`\\b${keyword}\\b`, 'g')) || []).length;
    }, 1);
  }

  private calculateConditionComplexity(condition: string): number {
    // Count logical operators and comparisons
    const operators = ['&&', '||', '==', '!=', '===', '!==', '<', '>', '<=', '>='];
    return operators.reduce((count, op) => {
      return count + (condition.split(op).length - 1);
    }, 1);
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(word => set2.has(word)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private calculateTimeEstimate(opportunity: RefactoringOpportunity): number {
    const baseTime = {
      'extract_method': 15,
      'extract_variable': 5,
      'inline_method': 10,
      'rename': 3,
      'move_method': 20,
      'eliminate_duplication': 25,
      'simplify_conditional': 10,
      'decompose_conditional': 15
    };

    const severityMultiplier = {
      'low': 1,
      'medium': 1.5,
      'high': 2,
      'critical': 3
    };

    return (baseTime[opportunity.type] || 10) * severityMultiplier[opportunity.severity];
  }

  private assessRiskLevel(opportunity: RefactoringOpportunity): 'low' | 'medium' | 'high' {
    if (opportunity.confidence < 0.5) return 'high';
    if (opportunity.confidence < 0.7) return 'medium';
    return 'low';
  }

  private identifyBenefits(opportunity: RefactoringOpportunity): string[] {
    const benefits: string[] = [];
    
    if (opportunity.impact.readability > 3) benefits.push('Improved code readability');
    if (opportunity.impact.maintainability > 3) benefits.push('Easier maintenance');
    if (opportunity.impact.testability > 3) benefits.push('Better testability');
    if (opportunity.impact.performance > 0) benefits.push('Performance improvement');
    
    return benefits;
  }

  private identifyConcerns(opportunity: RefactoringOpportunity): string[] {
    const concerns: string[] = [];
    
    if (opportunity.confidence < 0.7) concerns.push('Lower confidence in suggestion');
    if (opportunity.risks) concerns.push(...opportunity.risks);
    if (opportunity.prerequisites) concerns.push('Prerequisites may be required');
    
    return concerns;
  }

  // Code generation helpers
  private generateExtractMethodRefactoring(methodName: string, methodBody: string): string {
    return `// Extracted method
private extracted${methodName}Part(): ReturnType {
    ${methodBody}
}

// Original method (simplified)
${methodName}() {
    // ... existing code ...
    this.extracted${methodName}Part();
    // ... remaining code ...
}`;
  }

  private generateExtractMethodForDuplication(duplicatedCode: string): string {
    return `// Extracted common functionality
private extractedCommonLogic(): void {
    ${duplicatedCode}
}

// Usage in multiple places:
// this.extractedCommonLogic();`;
  }

  private generateSimplifiedConditional(conditional: string): string {
    return `// Consider extracting to meaningful method names
if (this.isValidCondition()) {
    // Original: ${conditional}
}`;
  }

  private generateClassExtractionRefactoring(className: string, classBody: string): string {
    return `// Consider splitting ${className} into:
// 1. ${className}Core - core functionality
// 2. ${className}Utils - utility methods
// 3. ${className}Validator - validation logic

class ${className}Core {
    // Core functionality here
}

class ${className}Utils {
    // Utility methods here
}`;
  }

  private generateParameterObjectRefactoring(functionName: string, parameters: string): string {
    return `// Parameter object approach
interface ${functionName}Options {
    ${parameters.split(',').map(p => `  ${p.trim()};`).join('\n')}
}

${functionName}(options: ${functionName}Options) {
    // Use options.parameterName instead of individual parameters
}`;
  }
}

export const refactoringAssistantTool = new RefactoringAssistantTool();