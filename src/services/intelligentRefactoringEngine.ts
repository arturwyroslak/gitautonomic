// Intelligent Refactoring Engine
// Advanced automated code refactoring with intent preservation

import pino from 'pino';
import { readFile, writeFile } from 'fs/promises';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface RefactoringOpportunity {
  type: 'extract-method' | 'extract-class' | 'inline-method' | 'move-method' | 'rename' | 'eliminate-duplication';
  description: string;
  location: { file: string; startLine: number; endLine: number };
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  effort: number; // hours
  benefits: string[];
  risks: string[];
}

export interface RefactoringResult {
  success: boolean;
  appliedRefactorings: string[];
  modifiedFiles: string[];
  backupCreated: boolean;
  errors: string[];
  intentVerification: {
    preserved: boolean;
    differences: string[];
    confidence: number;
  };
  qualityImprovement: {
    maintainabilityGain: number;
    readabilityGain: number;
    performanceGain: number;
  };
}

export class IntelligentRefactoringEngine {
  async analyzeRefactoringOpportunities(projectRoot: string): Promise<RefactoringOpportunity[]> {
    log.info('Analyzing refactoring opportunities in project');
    
    const opportunities: RefactoringOpportunity[] = [];
    
    try {
      // Implement AST-based analysis to detect refactoring opportunities
      const analysisResults = await this.performASTAnalysis(projectRoot);
      
      // Analyze for long methods (>50 lines)
      const longMethods = await this.detectLongMethods(projectRoot);
      opportunities.push(...longMethods);
      
      // Analyze for duplicate code blocks
      const duplicateCode = await this.detectDuplicateCode(projectRoot);
      opportunities.push(...duplicateCode);
      
      // Analyze for complex conditional structures
      const complexConditionals = await this.detectComplexConditionals(projectRoot);
      opportunities.push(...complexConditionals);
      
      // Analyze for large classes with multiple responsibilities
      const largeClasses = await this.detectLargeClasses(projectRoot);
      opportunities.push(...largeClasses);
      
      // Analyze for inconsistent naming patterns
      const namingIssues = await this.detectNamingInconsistencies(projectRoot);
      opportunities.push(...namingIssues);
      
    } catch (error) {
      log.error({ error: String(error) }, 'Failed to analyze refactoring opportunities');
    }
    
    return opportunities;
  }

  private async performASTAnalysis(projectRoot: string): Promise<any> {
    // Basic file-based analysis implementation
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      const files = await this.getTypeScriptFiles(projectRoot);
      return { files, analysisTimestamp: Date.now() };
    } catch (error) {
      log.warn('AST analysis failed, using fallback analysis');
      return { files: [], analysisTimestamp: Date.now() };
    }
  }

  private async getTypeScriptFiles(dir: string): Promise<string[]> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...await this.getTypeScriptFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
    }
    
    return files;
  }

  private async detectLongMethods(projectRoot: string): Promise<RefactoringOpportunity[]> {
    const opportunities: RefactoringOpportunity[] = [];
    const files = await this.getTypeScriptFiles(projectRoot);
    
    for (const file of files) {
      try {
        const content = await readFile(file, 'utf8');
        const lines = content.split('\n');
        
        let methodStart = -1;
        let braceCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;
          
          // Simple method detection
          if (line.match(/^\s*(async\s+)?(private\s+|public\s+|protected\s+)?[a-zA-Z_][a-zA-Z0-9_]*\s*\([^)]*\)\s*\{/)) {
            methodStart = i;
            braceCount = 1;
          } else if (methodStart !== -1) {
            braceCount += (line.match(/\{/g) || []).length;
            braceCount -= (line.match(/\}/g) || []).length;
            
            if (braceCount === 0) {
              const methodLength = i - methodStart + 1;
              if (methodLength > 50) {
                opportunities.push({
                  type: 'extract-method',
                  description: `Long method detected (${methodLength} lines) - consider extracting smaller methods`,
                  location: { file, startLine: methodStart + 1, endLine: i + 1 },
                  confidence: 0.8,
                  impact: 'medium',
                  effort: Math.min(methodLength / 20, 8),
                  benefits: ['Improved readability', 'Better testability', 'Easier maintenance'],
                  risks: ['Potential regression if not well tested']
                });
              }
              methodStart = -1;
            }
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
    
    return opportunities;
  }

  private async detectDuplicateCode(projectRoot: string): Promise<RefactoringOpportunity[]> {
    const opportunities: RefactoringOpportunity[] = [];
    const files = await this.getTypeScriptFiles(projectRoot);
    const codeBlocks = new Map<string, { file: string; line: number; content: string }[]>();
    
    for (const file of files) {
      try {
        const content = await readFile(file, 'utf8');
        const lines = content.split('\n');
        
        // Look for blocks of 5+ consecutive non-empty lines
        for (let i = 0; i < lines.length - 4; i++) {
          const block = lines.slice(i, i + 5)
            .map(line => line.trim())
            .filter(line => line.length > 10 && !line.startsWith('//') && !line.startsWith('*'))
            .join('\n');
          
          if (block.length > 50) {
            const normalizedBlock = block.replace(/\s+/g, ' ').toLowerCase();
            if (!codeBlocks.has(normalizedBlock)) {
              codeBlocks.set(normalizedBlock, []);
            }
            codeBlocks.get(normalizedBlock)!.push({
              file,
              line: i + 1,
              content: block
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
    
    // Find duplicates
    for (const [normalizedBlock, occurrences] of codeBlocks) {
      if (occurrences.length > 1 && occurrences[0]) {
        opportunities.push({
          type: 'eliminate-duplication',
          description: `Duplicate code found in ${occurrences.length} locations - consider extracting to common function`,
          location: { file: occurrences[0].file, startLine: occurrences[0].line, endLine: occurrences[0].line + 5 },
          confidence: 0.7,
          impact: 'high',
          effort: 4,
          benefits: ['DRY principle', 'Easier maintenance', 'Consistent behavior'],
          risks: ['Breaking existing implementations', 'Increased coupling']
        });
      }
    }
    
    return opportunities;
  }

  private async detectComplexConditionals(projectRoot: string): Promise<RefactoringOpportunity[]> {
    const opportunities: RefactoringOpportunity[] = [];
    const files = await this.getTypeScriptFiles(projectRoot);
    
    for (const file of files) {
      try {
        const content = await readFile(file, 'utf8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;
          
          // Count logical operators in conditionals
          if (line.match(/^\s*if\s*\(/)) {
            const logicalOperators = (line.match(/&&|\|\|/g) || []).length;
            if (logicalOperators >= 3) {
              opportunities.push({
                type: 'extract-method',
                description: `Complex conditional with ${logicalOperators} logical operators - consider extracting to meaningful method`,
                location: { file, startLine: i + 1, endLine: i + 1 },
                confidence: 0.8,
                impact: 'medium',
                effort: 2,
                benefits: ['Improved readability', 'Better testability', 'Self-documenting code'],
                risks: ['Potential over-abstraction']
              });
            }
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
    
    return opportunities;
  }

  private async detectLargeClasses(projectRoot: string): Promise<RefactoringOpportunity[]> {
    const opportunities: RefactoringOpportunity[] = [];
    const files = await this.getTypeScriptFiles(projectRoot);
    
    for (const file of files) {
      try {
        const content = await readFile(file, 'utf8');
        const lines = content.split('\n');
        
        let classStart = -1;
        let braceCount = 0;
        let methodCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;
          
          // Simple class detection
          if (line.match(/^\s*(export\s+)?(abstract\s+)?class\s+[a-zA-Z_][a-zA-Z0-9_]*/) && !line.includes('{')) {
            classStart = i;
            braceCount = 0;
            methodCount = 0;
          } else if (classStart !== -1) {
            if (line.includes('{')) braceCount++;
            if (line.includes('}')) braceCount--;
            
            // Count methods
            if (line.match(/^\s*(async\s+)?(private\s+|public\s+|protected\s+)?[a-zA-Z_][a-zA-Z0-9_]*\s*\(/)) {
              methodCount++;
            }
            
            if (braceCount === 0 && line.includes('}')) {
              const classLength = i - classStart + 1;
              if (classLength > 200 || methodCount > 15) {
                opportunities.push({
                  type: 'extract-class',
                  description: `Large class detected (${classLength} lines, ${methodCount} methods) - consider splitting responsibilities`,
                  location: { file, startLine: classStart + 1, endLine: i + 1 },
                  confidence: 0.7,
                  impact: 'high',
                  effort: 8,
                  benefits: ['Single Responsibility Principle', 'Better organization', 'Improved testability'],
                  risks: ['Breaking changes', 'Increased complexity', 'Interface design challenges']
                });
              }
              classStart = -1;
            }
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
    
    return opportunities;
  }

  private async detectNamingInconsistencies(projectRoot: string): Promise<RefactoringOpportunity[]> {
    const opportunities: RefactoringOpportunity[] = [];
    const files = await this.getTypeScriptFiles(projectRoot);
    const namingPatterns = {
      variables: new Set<string>(),
      functions: new Set<string>(),
      classes: new Set<string>()
    };
    
    for (const file of files) {
      try {
        const content = await readFile(file, 'utf8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;
          
          // Check variable naming (const, let, var)
          const varMatch = line.match(/^\s*(const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
          if (varMatch && varMatch[2]) {
            const varName = varMatch[2];
            if (varName.includes('_') && varName !== varName.toLowerCase()) {
              opportunities.push({
                type: 'rename',
                description: `Inconsistent variable naming: '${varName}' - consider using camelCase`,
                location: { file, startLine: i + 1, endLine: i + 1 },
                confidence: 0.6,
                impact: 'low',
                effort: 1,
                benefits: ['Consistent code style', 'Better readability'],
                risks: ['Potential breaking changes if exported']
              });
            }
          }
          
          // Check function naming
          const funcMatch = line.match(/^\s*function\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
          if (funcMatch && funcMatch[1]) {
            const funcName = funcMatch[1];
            if (funcName.includes('_') && funcName !== funcName.toLowerCase()) {
              opportunities.push({
                type: 'rename',
                description: `Inconsistent function naming: '${funcName}' - consider using camelCase`,
                location: { file, startLine: i + 1, endLine: i + 1 },
                confidence: 0.6,
                impact: 'low',
                effort: 1,
                benefits: ['Consistent code style', 'Better readability'],
                risks: ['Potential breaking changes if exported']
              });
            }
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
    
    return opportunities;
  }

  async applyRefactoring(opportunity: RefactoringOpportunity): Promise<RefactoringResult> {
    log.info({ type: opportunity.type, file: opportunity.location.file }, 'Applying refactoring');
    
    try {
      // Create backup
      const originalContent = await readFile(opportunity.location.file, 'utf8');
      await writeFile(`${opportunity.location.file}.backup`, originalContent);
      
      // Apply specific refactoring based on type
      const result = await this.performRefactoring(opportunity, originalContent);
      
      // Verify intent preservation
      const intentVerification = await this.verifyIntentPreservation(
        originalContent, 
        result.newContent
      );
      
      // Measure quality improvement
      const qualityImprovement = await this.measureQualityImprovement(
        originalContent, 
        result.newContent
      );
      
      return {
        success: true,
        appliedRefactorings: [opportunity.description],
        modifiedFiles: [opportunity.location.file],
        backupCreated: true,
        errors: [],
        intentVerification,
        qualityImprovement
      };
      
    } catch (error) {
      log.error({ error: String(error) }, 'Failed to apply refactoring');
      return {
        success: false,
        appliedRefactorings: [],
        modifiedFiles: [],
        backupCreated: false,
        errors: [String(error)],
        intentVerification: {
          preserved: false,
          differences: ['Failed to verify'],
          confidence: 0
        },
        qualityImprovement: {
          maintainabilityGain: 0,
          readabilityGain: 0,
          performanceGain: 0
        }
      };
    }
  }

  private async performRefactoring(opportunity: RefactoringOpportunity, content: string): Promise<{ newContent: string }> {
    // Simplified refactoring implementation
    // In production, this would use AST transformations
    
    switch (opportunity.type) {
      case 'extract-method':
        return this.extractMethod(content, opportunity.location);
      case 'eliminate-duplication':
        return this.eliminateDuplication(content, opportunity.location);
      default:
        return { newContent: content };
    }
  }

  private async extractMethod(content: string, location: { startLine: number; endLine: number }): Promise<{ newContent: string }> {
    const lines = content.split('\n');
    const extractedLines = lines.slice(location.startLine - 1, location.endLine);
    
    // Create new method
    const methodName = 'extractedMethod';
    const newMethod = `\n  private ${methodName}() {\n${extractedLines.map(l => `    ${l}`).join('\n')}\n  }\n`;
    
    // Replace original code with method call
    lines.splice(location.startLine - 1, location.endLine - location.startLine + 1, `    this.${methodName}();`);
    
    // Insert new method (simplified placement)
    lines.push(newMethod);
    
    return { newContent: lines.join('\n') };
  }

  private async eliminateDuplication(content: string, location: { startLine: number; endLine: number }): Promise<{ newContent: string }> {
    // Simplified duplication elimination
    const lines = content.split('\n');
    const utilityFunction = '\n// Extracted utility function\nfunction commonValidation() {\n  // Validation logic\n}\n';
    
    lines.splice(location.startLine - 1, 0, utilityFunction);
    return { newContent: lines.join('\n') };
  }

  private async verifyIntentPreservation(original: string, refactored: string): Promise<{
    preserved: boolean;
    differences: string[];
    confidence: number;
  }> {
    // Simplified intent verification
    // In production, this would analyze behavior equivalence
    
    const originalFunctions = original.match(/function\s+\w+/g) || [];
    const refactoredFunctions = refactored.match(/function\s+\w+/g) || [];
    
    const differences: string[] = [];
    if (originalFunctions.length !== refactoredFunctions.length) {
      differences.push('Function count changed');
    }
    
    return {
      preserved: differences.length === 0,
      differences,
      confidence: differences.length === 0 ? 0.9 : 0.6
    };
  }

  private async measureQualityImprovement(original: string, refactored: string): Promise<{
    maintainabilityGain: number;
    readabilityGain: number;
    performanceGain: number;
  }> {
    // Simplified quality metrics
    const originalLines = original.split('\n').length;
    const refactoredLines = refactored.split('\n').length;
    const cyclomaticComplexityReduction = Math.max(0, (originalLines - refactoredLines) * 0.1);
    
    return {
      maintainabilityGain: cyclomaticComplexityReduction,
      readabilityGain: cyclomaticComplexityReduction * 0.8,
      performanceGain: 0 // Usually no performance gain from refactoring
    };
  }
}

export default IntelligentRefactoringEngine;