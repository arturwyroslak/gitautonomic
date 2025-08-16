// Intelligent Conflict Resolution - Automatically resolves merge conflicts using context
import pino from 'pino';
import { readFile, writeFile } from 'fs/promises';
import { parse as parseJS } from '@babel/parser';
import { getInstallationOctokit } from '../octokit.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ConflictAnalysis {
  filePath: string;
  conflicts: ConflictSection[];
  resolutionStrategy: ResolutionStrategy;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  autoResolvable: boolean;
}

export interface ConflictSection {
  startLine: number;
  endLine: number;
  ourChanges: string[];
  theirChanges: string[];
  baseVersion: string[];
  conflictType: 'content' | 'structure' | 'import' | 'formatting';
  resolution?: Resolution;
}

export interface Resolution {
  strategy: 'ours' | 'theirs' | 'merge' | 'custom';
  resolvedContent: string[];
  reasoning: string;
  confidence: number;
}

export interface ResolutionStrategy {
  primaryStrategy: 'prefer-structure' | 'prefer-newer' | 'prefer-safer' | 'intelligent-merge';
  fallbackStrategy: 'manual-review' | 'prefer-ours' | 'prefer-theirs';
  contextFactors: string[];
}

export interface MergeContext {
  branchInfo: {
    baseBranch: string;
    targetBranch: string;
    sourceBranch: string;
  };
  authorInfo: {
    ourAuthor: string;
    theirAuthor: string;
    authorExpertise: Record<string, number>; // author -> expertise score
  };
  fileHistory: {
    recentChanges: ChangeRecord[];
    changeFrequency: number;
    mainContributors: string[];
  };
  projectContext: {
    fileType: string;
    isCritical: boolean;
    hasTests: boolean;
    testCoverage: number;
  };
}

export interface ChangeRecord {
  author: string;
  timestamp: Date;
  changeType: 'addition' | 'deletion' | 'modification';
  linesChanged: number;
  message: string;
}

export class IntelligentConflictResolver {
  private contextCache = new Map<string, MergeContext>();

  async resolveConflicts(
    filePath: string,
    conflictContent: string,
    installationId: string,
    owner: string,
    repo: string,
    pullRequestNumber: number
  ): Promise<ConflictAnalysis> {
    log.info(`Starting intelligent conflict resolution for ${filePath}`);

    const context = await this.buildMergeContext(filePath, installationId, owner, repo, pullRequestNumber);
    const conflicts = this.parseConflicts(conflictContent);
    const analysis = await this.analyzeConflicts(conflicts, context, filePath);

    return analysis;
  }

  private async buildMergeContext(
    filePath: string,
    installationId: string,
    owner: string,
    repo: string,
    pullRequestNumber: number
  ): Promise<MergeContext> {
    const cacheKey = `${owner}/${repo}/${pullRequestNumber}/${filePath}`;
    
    if (this.contextCache.has(cacheKey)) {
      return this.contextCache.get(cacheKey)!;
    }

    const octokit = await getInstallationOctokit(installationId);
    
    // Get pull request info
    const pr = await octokit.rest.pulls.get({ owner, repo, pull_number: pullRequestNumber });
    
    // Get file history
    const commits = await octokit.rest.pulls.listCommits({ owner, repo, pull_number: pullRequestNumber });
    
    // Get recent file changes
    const recentCommits = await octokit.rest.repos.listCommits({
      owner,
      repo,
      path: filePath,
      per_page: 20
    });

    const context: MergeContext = {
      branchInfo: {
        baseBranch: pr.data.base.ref,
        targetBranch: pr.data.base.ref,
        sourceBranch: pr.data.head.ref
      },
      authorInfo: {
        ourAuthor: pr.data.base.user.login,
        theirAuthor: pr.data.head.user.login,
        authorExpertise: await this.calculateAuthorExpertise(owner, repo, filePath, installationId)
      },
      fileHistory: {
        recentChanges: await this.extractChangeRecords(recentCommits.data),
        changeFrequency: recentCommits.data.length,
        mainContributors: this.extractMainContributors(recentCommits.data)
      },
      projectContext: {
        fileType: this.determineFileType(filePath),
        isCritical: this.isCriticalFile(filePath),
        hasTests: await this.hasAssociatedTests(filePath, owner, repo, installationId),
        testCoverage: await this.estimateTestCoverage(filePath)
      }
    };

    this.contextCache.set(cacheKey, context);
    return context;
  }

  private parseConflicts(content: string): ConflictSection[] {
    const conflicts: ConflictSection[] = [];
    const lines = content.split('\n');
    
    let currentConflict: Partial<ConflictSection> | null = null;
    let inOurSection = false;
    let inTheirSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      
      if (line.startsWith('<<<<<<<')) {
        // Start of conflict
        currentConflict = {
          startLine: i,
          ourChanges: [],
          theirChanges: [],
          baseVersion: []
        };
        inOurSection = true;
      } else if (line.startsWith('=======')) {
        // Switch from our to their changes
        inOurSection = false;
        inTheirSection = true;
      } else if (line.startsWith('>>>>>>>')) {
        // End of conflict
        if (currentConflict) {
          currentConflict.endLine = i;
          currentConflict.conflictType = this.determineConflictType(currentConflict);
          conflicts.push(currentConflict as ConflictSection);
        }
        currentConflict = null;
        inOurSection = false;
        inTheirSection = false;
      } else if (currentConflict) {
        if (inOurSection) {
          currentConflict.ourChanges!.push(line);
        } else if (inTheirSection) {
          currentConflict.theirChanges!.push(line);
        }
      }
    }
    
    return conflicts;
  }

  private determineConflictType(conflict: Partial<ConflictSection>): 'content' | 'structure' | 'import' | 'formatting' {
    const ourCode = conflict.ourChanges?.join('\n') || '';
    const theirCode = conflict.theirChanges?.join('\n') || '';
    
    // Check for import conflicts
    if (ourCode.includes('import') || theirCode.includes('import') || 
        ourCode.includes('require') || theirCode.includes('require')) {
      return 'import';
    }
    
    // Check for structural changes (brackets, indentation)
    const ourStructure = ourCode.replace(/\s+/g, '');
    const theirStructure = theirCode.replace(/\s+/g, '');
    
    if (ourStructure === theirStructure) {
      return 'formatting';
    }
    
    // Check for structural elements
    const structuralKeywords = ['function', 'class', 'interface', 'type', 'const', 'let', 'var'];
    const hasStructuralChanges = structuralKeywords.some(keyword => 
      ourCode.includes(keyword) || theirCode.includes(keyword)
    );
    
    return hasStructuralChanges ? 'structure' : 'content';
  }

  private async analyzeConflicts(
    conflicts: ConflictSection[],
    context: MergeContext,
    filePath: string
  ): Promise<ConflictAnalysis> {
    const resolutionStrategy = this.determineResolutionStrategy(context);
    
    for (const conflict of conflicts) {
      conflict.resolution = await this.resolveConflict(conflict, context, resolutionStrategy);
    }
    
    const confidence = this.calculateOverallConfidence(conflicts);
    const riskLevel = this.assessRiskLevel(conflicts, context);
    const autoResolvable = this.isAutoResolvable(conflicts, riskLevel, confidence);
    
    return {
      filePath,
      conflicts,
      resolutionStrategy,
      confidence,
      riskLevel,
      autoResolvable
    };
  }

  private determineResolutionStrategy(context: MergeContext): ResolutionStrategy {
    const contextFactors: string[] = [];
    let primaryStrategy: ResolutionStrategy['primaryStrategy'] = 'intelligent-merge';
    
    // Factor in file criticality
    if (context.projectContext.isCritical) {
      contextFactors.push('Critical file - prefer safer changes');
      primaryStrategy = 'prefer-safer';
    }
    
    // Factor in test coverage
    if (context.projectContext.testCoverage > 80) {
      contextFactors.push('High test coverage - more confident in changes');
    } else if (context.projectContext.testCoverage < 30) {
      contextFactors.push('Low test coverage - prefer conservative approach');
      if (primaryStrategy === 'intelligent-merge') {
        primaryStrategy = 'prefer-safer';
      }
    }
    
    // Factor in author expertise
    const ourExpertise = context.authorInfo.authorExpertise[context.authorInfo.ourAuthor] || 0;
    const theirExpertise = context.authorInfo.authorExpertise[context.authorInfo.theirAuthor] || 0;
    
    if (Math.abs(ourExpertise - theirExpertise) > 0.3) {
      const expertAuthor = ourExpertise > theirExpertise ? 'ours' : 'theirs';
      contextFactors.push(`Significant expertise difference - favor ${expertAuthor}`);
    }
    
    // Factor in change frequency
    if (context.fileHistory.changeFrequency > 10) {
      contextFactors.push('High change frequency - prefer structural consistency');
      primaryStrategy = 'prefer-structure';
    }
    
    return {
      primaryStrategy,
      fallbackStrategy: context.projectContext.isCritical ? 'manual-review' : 'prefer-ours',
      contextFactors
    };
  }

  private async resolveConflict(
    conflict: ConflictSection,
    context: MergeContext,
    strategy: ResolutionStrategy
  ): Promise<Resolution> {
    
    switch (conflict.conflictType) {
      case 'formatting':
        return this.resolveFormattingConflict(conflict);
      
      case 'import':
        return this.resolveImportConflict(conflict, context);
      
      case 'structure':
        return this.resolveStructuralConflict(conflict, context, strategy);
      
      case 'content':
      default:
        return this.resolveContentConflict(conflict, context, strategy);
    }
  }

  private resolveFormattingConflict(conflict: ConflictSection): Resolution {
    // For formatting conflicts, prefer the more consistent style
    const ourFormatted = this.normalizeFormatting(conflict.ourChanges.join('\n'));
    const theirFormatted = this.normalizeFormatting(conflict.theirChanges.join('\n'));
    
    // Simple heuristic: prefer the version with more consistent indentation
    const ourConsistency = this.calculateFormattingConsistency(conflict.ourChanges);
    const theirConsistency = this.calculateFormattingConsistency(conflict.theirChanges);
    
    if (ourConsistency > theirConsistency) {
      return {
        strategy: 'ours',
        resolvedContent: conflict.ourChanges,
        reasoning: 'Chose our version due to better formatting consistency',
        confidence: 0.8
      };
    } else {
      return {
        strategy: 'theirs',
        resolvedContent: conflict.theirChanges,
        reasoning: 'Chose their version due to better formatting consistency',
        confidence: 0.8
      };
    }
  }

  private resolveImportConflict(conflict: ConflictSection, context: MergeContext): Resolution {
    // Merge imports intelligently
    const ourImports = this.extractImports(conflict.ourChanges);
    const theirImports = this.extractImports(conflict.theirChanges);
    
    // Combine and deduplicate imports
    const mergedImports = new Map<string, string>();
    
    [...ourImports, ...theirImports].forEach(imp => {
      const source = this.extractImportSource(imp);
      if (source) {
        mergedImports.set(source, imp);
      }
    });
    
    const resolvedContent = Array.from(mergedImports.values());
    
    return {
      strategy: 'merge',
      resolvedContent,
      reasoning: 'Merged imports and removed duplicates',
      confidence: 0.9
    };
  }

  private resolveStructuralConflict(
    conflict: ConflictSection,
    context: MergeContext,
    strategy: ResolutionStrategy
  ): Resolution {
    
    if (strategy.primaryStrategy === 'prefer-structure') {
      // Analyze which version maintains better structure
      const ourStructureScore = this.analyzeStructure(conflict.ourChanges);
      const theirStructureScore = this.analyzeStructure(conflict.theirChanges);
      
      if (ourStructureScore > theirStructureScore) {
        return {
          strategy: 'ours',
          resolvedContent: conflict.ourChanges,
          reasoning: 'Chose our version for better structural integrity',
          confidence: 0.7
        };
      } else {
        return {
          strategy: 'theirs',
          resolvedContent: conflict.theirChanges,
          reasoning: 'Chose their version for better structural integrity',
          confidence: 0.7
        };
      }
    }
    
    // Fallback to content-based resolution
    return this.resolveContentConflict(conflict, context, strategy);
  }

  private resolveContentConflict(
    conflict: ConflictSection,
    context: MergeContext,
    strategy: ResolutionStrategy
  ): Resolution {
    
    // Try intelligent merging first
    if (strategy.primaryStrategy === 'intelligent-merge') {
      const mergeResult = this.attemptIntelligentMerge(conflict);
      if (mergeResult.confidence > 0.6) {
        return mergeResult;
      }
    }
    
    // Factor in author expertise
    const ourExpertise = context.authorInfo.authorExpertise[context.authorInfo.ourAuthor] || 0;
    const theirExpertise = context.authorInfo.authorExpertise[context.authorInfo.theirAuthor] || 0;
    
    if (strategy.primaryStrategy === 'prefer-safer') {
      // Prefer the version that makes smaller changes
      const ourChangeSize = this.calculateChangeSize(conflict.ourChanges);
      const theirChangeSize = this.calculateChangeSize(conflict.theirChanges);
      
      if (ourChangeSize < theirChangeSize) {
        return {
          strategy: 'ours',
          resolvedContent: conflict.ourChanges,
          reasoning: 'Chose our version as it represents smaller, safer changes',
          confidence: 0.6
        };
      } else {
        return {
          strategy: 'theirs',
          resolvedContent: conflict.theirChanges,
          reasoning: 'Chose their version as it represents smaller, safer changes',
          confidence: 0.6
        };
      }
    }
    
    if (Math.abs(ourExpertise - theirExpertise) > 0.2) {
      if (ourExpertise > theirExpertise) {
        return {
          strategy: 'ours',
          resolvedContent: conflict.ourChanges,
          reasoning: 'Chose our version based on author expertise',
          confidence: 0.7
        };
      } else {
        return {
          strategy: 'theirs',
          resolvedContent: conflict.theirChanges,
          reasoning: 'Chose their version based on author expertise',
          confidence: 0.7
        };
      }
    }
    
    // Default fallback
    return {
      strategy: 'ours',
      resolvedContent: conflict.ourChanges,
      reasoning: 'Using default fallback strategy',
      confidence: 0.4
    };
  }

  private attemptIntelligentMerge(conflict: ConflictSection): Resolution {
    // Try to merge non-conflicting parts
    const ourLines = conflict.ourChanges;
    const theirLines = conflict.theirChanges;
    
    // Simple line-by-line merge attempt
    const merged: string[] = [];
    const maxLines = Math.max(ourLines.length, theirLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const ourLine = ourLines[i] || '';
      const theirLine = theirLines[i] || '';
      
      if (ourLine === theirLine) {
        merged.push(ourLine);
      } else if (!ourLine) {
        merged.push(theirLine);
      } else if (!theirLine) {
        merged.push(ourLine);
      } else {
        // Conflicting lines - merge heuristically
        const mergedLine = this.mergeLines(ourLine, theirLine);
        merged.push(mergedLine);
      }
    }
    
    return {
      strategy: 'merge',
      resolvedContent: merged,
      reasoning: 'Attempted intelligent line-by-line merge',
      confidence: 0.5
    };
  }

  private mergeLines(ourLine: string, theirLine: string): string {
    // Simple merge heuristics
    if (ourLine.includes(theirLine)) return ourLine;
    if (theirLine.includes(ourLine)) return theirLine;
    
    // For similar lines, prefer the longer one (more complete)
    if (this.calculateSimilarity(ourLine, theirLine) > 0.7) {
      return ourLine.length > theirLine.length ? ourLine : theirLine;
    }
    
    // Default: combine both
    return `${ourLine}\n${theirLine}`;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: (number | null)[][] = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      if (matrix[0]) matrix[0][i] = i;
    }
    for (let j = 0; j <= str2.length; j++) {
      const row = matrix[j];
      if (row) row[0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        const currentRow = matrix[j];
        const prevRow = matrix[j - 1];
        
        if (currentRow && prevRow) {
          currentRow[i] = Math.min(
            (currentRow[i - 1] || 0) + 1,
            (prevRow[i] || 0) + 1,
            (prevRow[i - 1] || 0) + substitutionCost
          );
        }
      }
    }
    
    return matrix[str2.length]?.[str1.length] || 0;
  }

  // Utility methods
  private async calculateAuthorExpertise(
    owner: string,
    repo: string,
    filePath: string,
    installationId: string
  ): Promise<Record<string, number>> {
    try {
      const octokit = await getInstallationOctokit(installationId);
      const commits = await octokit.rest.repos.listCommits({
        owner,
        repo,
        path: filePath,
        per_page: 50
      });
      
      const authorStats = new Map<string, { commits: number; linesChanged: number }>();
      
      for (const commit of commits.data) {
        const author = commit.author?.login || commit.commit.author?.name || 'unknown';
        const stats = authorStats.get(author) || { commits: 0, linesChanged: 0 };
        stats.commits++;
        
        try {
          const commitDetails = await octokit.rest.repos.getCommit({
            owner,
            repo,
            ref: commit.sha
          });
          stats.linesChanged += commitDetails.data.stats?.total || 0;
        } catch (error) {
          // Skip if we can't get commit details
        }
        
        authorStats.set(author, stats);
      }
      
      // Calculate expertise scores (0-1 scale)
      const maxCommits = Math.max(...Array.from(authorStats.values()).map(s => s.commits));
      const maxLines = Math.max(...Array.from(authorStats.values()).map(s => s.linesChanged));
      
      const expertise: Record<string, number> = {};
      for (const [author, stats] of authorStats) {
        const commitScore = maxCommits > 0 ? stats.commits / maxCommits : 0;
        const lineScore = maxLines > 0 ? stats.linesChanged / maxLines : 0;
        expertise[author] = (commitScore + lineScore) / 2;
      }
      
      return expertise;
    } catch (error) {
      log.warn(`Failed to calculate author expertise: ${error}`);
      return {};
    }
  }

  private async extractChangeRecords(commits: any[]): Promise<ChangeRecord[]> {
    return commits.slice(0, 10).map(commit => ({
      author: commit.author?.login || commit.commit.author?.name || 'unknown',
      timestamp: new Date(commit.commit.author?.date || Date.now()),
      changeType: 'modification' as const,
      linesChanged: commit.stats?.total || 0,
      message: commit.commit.message
    }));
  }

  private extractMainContributors(commits: any[]): string[] {
    const contributorCounts = new Map<string, number>();
    
    commits.forEach(commit => {
      const author = commit.author?.login || commit.commit.author?.name || 'unknown';
      contributorCounts.set(author, (contributorCounts.get(author) || 0) + 1);
    });
    
    return Array.from(contributorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([author]) => author);
  }

  private determineFileType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const typeMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'react',
      'tsx': 'react-typescript',
      'vue': 'vue',
      'py': 'python',
      'java': 'java',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'cpp': 'cpp',
      'c': 'c',
      'php': 'php',
      'rb': 'ruby'
    };
    
    return typeMap[ext || ''] || 'unknown';
  }

  private isCriticalFile(filePath: string): boolean {
    const criticalPatterns = [
      /\/index\./,
      /\/main\./,
      /\/app\./,
      /\/server\./,
      /\/config\./,
      /package\.json$/,
      /tsconfig\.json$/,
      /webpack\.config\./,
      /\/src\/core\//,
      /\/lib\//
    ];
    
    return criticalPatterns.some(pattern => pattern.test(filePath));
  }

  private async hasAssociatedTests(
    filePath: string,
    owner: string,
    repo: string,
    installationId: string
  ): Promise<boolean> {
    const testPatterns = [
      filePath.replace(/\.(js|ts|jsx|tsx)$/, '.test.$1'),
      filePath.replace(/\.(js|ts|jsx|tsx)$/, '.spec.$1'),
      filePath.replace(/\/src\//, '/tests/'),
      filePath.replace(/\/src\//, '/__tests__/')
    ];
    
    try {
      const octokit = await getInstallationOctokit(installationId);
      
      for (const testPath of testPatterns) {
        try {
          await octokit.rest.repos.getContent({ owner, repo, path: testPath });
          return true;
        } catch {
          // File doesn't exist, try next pattern
        }
      }
    } catch (error) {
      log.debug(`Failed to check for test files: ${error}`);
    }
    
    return false;
  }

  private async estimateTestCoverage(filePath: string): Promise<number> {
    // Placeholder implementation - in production would integrate with coverage tools
    return Math.random() * 100;
  }

  private normalizeFormatting(code: string): string {
    return code
      .replace(/\s+/g, ' ')
      .replace(/\s*{\s*/g, '{')
      .replace(/\s*}\s*/g, '}')
      .replace(/\s*;\s*/g, ';')
      .trim();
  }

  private calculateFormattingConsistency(lines: string[]): number {
    if (lines.length === 0) return 0;
    
    const indentations = lines
      .filter(line => line.trim().length > 0)
      .map(line => line.match(/^\s*/)?.[0].length || 0);
    
    if (indentations.length === 0) return 1;
    
    // Calculate consistency based on indentation patterns
    const indentSet = new Set(indentations);
    return 1 - (indentSet.size / indentations.length);
  }

  private extractImports(lines: string[]): string[] {
    return lines.filter(line => 
      line.trim().startsWith('import ') || 
      line.trim().startsWith('const ') && line.includes('require(') ||
      line.trim().startsWith('let ') && line.includes('require(') ||
      line.trim().startsWith('var ') && line.includes('require(')
    );
  }

  private extractImportSource(importLine: string): string | null {
    const match = importLine.match(/from\s+['"`]([^'"`]+)['"`]/) || 
                  importLine.match(/require\(['"`]([^'"`]+)['"`]\)/);
    return match ? (match[1] || null) : null;
  }

  private analyzeStructure(lines: string[]): number {
    let score = 0;
    const code = lines.join('\n');
    
    // Check for balanced brackets
    const openBrackets = (code.match(/\{/g) || []).length;
    const closeBrackets = (code.match(/\}/g) || []).length;
    if (openBrackets === closeBrackets) score += 2;
    
    // Check for proper function structure
    const functionMatches = code.match(/function\s+\w+\([^)]*\)\s*\{/g) || [];
    score += functionMatches.length;
    
    // Check for class structure
    const classMatches = code.match(/class\s+\w+/g) || [];
    score += classMatches.length * 2;
    
    return score;
  }

  private calculateChangeSize(lines: string[]): number {
    return lines.reduce((size, line) => size + line.length, 0);
  }

  private calculateOverallConfidence(conflicts: ConflictSection[]): number {
    if (conflicts.length === 0) return 1;
    
    const totalConfidence = conflicts.reduce((sum, conflict) => 
      sum + (conflict.resolution?.confidence || 0), 0
    );
    
    return totalConfidence / conflicts.length;
  }

  private assessRiskLevel(conflicts: ConflictSection[], context: MergeContext): 'low' | 'medium' | 'high' {
    if (context.projectContext.isCritical) return 'high';
    if (context.projectContext.testCoverage < 50) return 'medium';
    if (conflicts.some(c => c.conflictType === 'structure')) return 'medium';
    if (conflicts.length > 5) return 'medium';
    
    return 'low';
  }

  private isAutoResolvable(
    conflicts: ConflictSection[],
    riskLevel: 'low' | 'medium' | 'high',
    confidence: number
  ): boolean {
    if (riskLevel === 'high') return false;
    if (confidence < 0.7) return false;
    if (conflicts.some(c => !c.resolution || c.resolution.confidence < 0.6)) return false;
    
    return true;
  }

  // Public API methods
  async applyResolution(filePath: string, analysis: ConflictAnalysis): Promise<string> {
    const originalContent = await readFile(filePath, 'utf-8');
    const lines = originalContent.split('\n');
    
    // Apply resolutions in reverse order to maintain line numbers
    const sortedConflicts = [...analysis.conflicts].sort((a, b) => b.startLine - a.startLine);
    
    for (const conflict of sortedConflicts) {
      if (conflict.resolution) {
        lines.splice(
          conflict.startLine,
          conflict.endLine - conflict.startLine + 1,
          ...conflict.resolution.resolvedContent
        );
      }
    }
    
    return lines.join('\n');
  }

  async generateResolutionReport(analysis: ConflictAnalysis): Promise<{
    summary: string;
    details: string[];
    recommendations: string[];
  }> {
    const resolvedCount = analysis.conflicts.filter(c => c.resolution).length;
    const totalCount = analysis.conflicts.length;
    
    const summary = `Resolved ${resolvedCount}/${totalCount} conflicts with ${(analysis.confidence * 100).toFixed(1)}% confidence`;
    
    const details = analysis.conflicts.map(conflict => 
      `Lines ${conflict.startLine}-${conflict.endLine}: ${conflict.conflictType} conflict resolved using ${conflict.resolution?.strategy} strategy (${conflict.resolution?.reasoning})`
    );
    
    const recommendations = [];
    if (analysis.riskLevel === 'high') {
      recommendations.push('Manual review recommended due to high risk level');
    }
    if (analysis.confidence < 0.8) {
      recommendations.push('Consider manual verification due to moderate confidence');
    }
    if (!analysis.autoResolvable) {
      recommendations.push('Automatic resolution not recommended - manual intervention required');
    }
    
    return { summary, details, recommendations };
  }
}

export default IntelligentConflictResolver;