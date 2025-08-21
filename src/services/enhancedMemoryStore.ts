// Enhanced Memory Store with Embedding Integration
import { prisma } from '../storage/prisma.js';
import { getInstallationOctokit } from '../octokit.js';
import { embeddingService } from './embeddingService.js';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface MemoryEntry {
  id: string;
  type: 'code_pattern' | 'solution' | 'error_resolution' | 'best_practice' | 'context' | 'learning' | 'feedback';
  content: any;
  vectorRef?: string;
  embedding?: number[];
  salience: number;
  decayFactor: number;
  metadata?: any;
  timestamp: Date;
}

export interface QueryResult {
  entry: MemoryEntry;
  similarity: number;
  relevance: number;
  embeddingSimilarity?: number;
}

export interface MemoryAnalytics {
  totalMemories: number;
  typeDistribution: Record<string, number>;
  averageSalience: number;
  oldestMemory: Date | null;
  newestMemory: Date | null;
  memoriesLastWeek: number;
  topPatterns: Array<{ pattern: string; count: number; avgSalience: number }>;
}

export class EnhancedMemoryStore {
  constructor(private issueAgentId: string) {}

  async store(entry: Omit<MemoryEntry, 'id' | 'timestamp'>): Promise<string> {
    try {
      // Generate embedding for the content
      let embedding: number[] | undefined;
      let vectorRef: string | undefined;
      
      try {
        const contentText = typeof entry.content === 'string' 
          ? entry.content 
          : JSON.stringify(entry.content);
        
        const embeddingResult = await embeddingService.generateEmbedding(contentText, {
          type: entry.type,
          agentId: this.issueAgentId,
          ...entry.metadata
        });
        
        embedding = embeddingResult.vector;
        vectorRef = embeddingResult.id;
        
        log.debug(`Generated embedding for memory entry: ${vectorRef}`);
      } catch (embeddingError) {
        log.warn(`Failed to generate embedding: ${embeddingError}, storing without embedding`);
      }

      const memoryEntry = await prisma.agentMemory.create({
        data: {
          id: `memory-${this.issueAgentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          issueAgentId: this.issueAgentId,
          type: entry.type,
          content: entry.content,
          vectorRef: vectorRef || null,
          salience: entry.salience,
          decayFactor: entry.decayFactor,
        }
      });

      log.info(`Stored memory entry: ${memoryEntry.id} with ${vectorRef ? 'embedding' : 'no embedding'}`);
      return memoryEntry.id;
    } catch (error: any) {
      log.error('Failed to store memory entry:', error);
      throw error;
    }
  }

  async query(queryText: string, type?: string, limit = 10): Promise<QueryResult[]> {
    try {
      // Get relevant memories from database
      const memories = await prisma.agentMemory.findMany({
        where: {
          issueAgentId: this.issueAgentId,
          ...(type && { type })
        },
        orderBy: [
          { salience: 'desc' },
          { createdAt: 'desc' }
        ],
        take: limit * 3 // Get more to allow for better filtering
      });

      // Try semantic search using embeddings first
      let embeddingResults: Array<{ id: string; similarity: number }> = [];
      
      try {
        const similarityResults = await embeddingService.findSimilar(queryText, limit * 2, 0.3);
        embeddingResults = similarityResults.map(result => ({
          id: result.id,
          similarity: result.similarity
        }));
        
        log.debug(`Found ${embeddingResults.length} embedding matches for query`);
      } catch (embeddingError) {
        log.warn(`Embedding search failed: ${embeddingError}, falling back to text similarity`);
      }

      // Apply decay to salience based on age and calculate relevance
      const results: QueryResult[] = memories.map(memory => {
        const age = Date.now() - memory.createdAt.getTime();
        const ageDays = age / (1000 * 60 * 60 * 24);
        const decayedSalience = memory.salience * Math.pow(memory.decayFactor, ageDays);
        
        // Try to find embedding similarity
        const embeddingMatch = embeddingResults.find(er => er.id === memory.vectorRef);
        const embeddingSimilarity = embeddingMatch?.similarity || 0;
        
        // Fallback to text similarity if no embedding
        const textSimilarity = this.calculateTextSimilarity(
          queryText.toLowerCase(),
          JSON.stringify(memory.content).toLowerCase()
        );
        
        // Use embedding similarity if available, otherwise text similarity
        const similarity = embeddingSimilarity > 0 ? embeddingSimilarity : textSimilarity;
        
        // Combine similarity, salience, and recency for relevance score
        const recencyBoost = Math.max(0, 1 - ageDays / 30); // Boost for memories < 30 days old
        const relevance = (similarity * 0.5) + (decayedSalience * 0.3) + (recencyBoost * 0.2);
        
        return {
          entry: {
            id: memory.id,
            type: memory.type as any,
            content: memory.content,
            vectorRef: memory.vectorRef || undefined,
            salience: decayedSalience,
            decayFactor: memory.decayFactor,
            timestamp: memory.createdAt
          },
          similarity,
          relevance,
          embeddingSimilarity: embeddingSimilarity > 0 ? embeddingSimilarity : undefined
        };
      });

      // Sort by relevance and return top results
      const sortedResults = results
        .filter(result => result.relevance > 0.1) // Filter out very low relevance
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);

      log.debug(`Query '${queryText}' returned ${sortedResults.length} results`);
      
      return sortedResults;
        
    } catch (error: any) {
      log.error('Failed to query memory store:', error);
      return [];
    }
  }

  async getAnalytics(): Promise<MemoryAnalytics> {
    try {
      const memories = await prisma.agentMemory.findMany({
        where: { issueAgentId: this.issueAgentId }
      });

      const typeDistribution: Record<string, number> = {};
      let totalSalience = 0;
      let oldestDate: Date | null = null;
      let newestDate: Date | null = null;

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      let memoriesLastWeek = 0;

      const patternMap = new Map<string, { count: number; totalSalience: number }>();

      for (const memory of memories) {
        // Type distribution
        typeDistribution[memory.type] = (typeDistribution[memory.type] || 0) + 1;
        
        // Salience tracking
        totalSalience += memory.salience;
        
        // Date tracking
        if (!oldestDate || memory.createdAt < oldestDate) {
          oldestDate = memory.createdAt;
        }
        if (!newestDate || memory.createdAt > newestDate) {
          newestDate = memory.createdAt;
        }
        
        // Recent memories
        if (memory.createdAt > weekAgo) {
          memoriesLastWeek++;
        }
        
        // Pattern extraction
        try {
          const content = typeof memory.content === 'string' 
            ? memory.content 
            : JSON.stringify(memory.content);
          
          const patterns = this.extractPatterns(content);
          patterns.forEach(pattern => {
            const existing = patternMap.get(pattern) || { count: 0, totalSalience: 0 };
            patternMap.set(pattern, {
              count: existing.count + 1,
              totalSalience: existing.totalSalience + memory.salience
            });
          });
        } catch (error) {
          // Skip pattern extraction if content parsing fails
        }
      }

      const topPatterns = Array.from(patternMap.entries())
        .map(([pattern, data]) => ({
          pattern,
          count: data.count,
          avgSalience: data.totalSalience / data.count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalMemories: memories.length,
        typeDistribution,
        averageSalience: memories.length > 0 ? totalSalience / memories.length : 0,
        oldestMemory: oldestDate,
        newestMemory: newestDate,
        memoriesLastWeek,
        topPatterns
      };
    } catch (error) {
      log.error({ error: String(error) }, 'Failed to get memory analytics');
      return {
        totalMemories: 0,
        typeDistribution: {},
        averageSalience: 0,
        oldestMemory: null,
        newestMemory: null,
        memoriesLastWeek: 0,
        topPatterns: []
      };
    }
  }

  private extractPatterns(text: string): string[] {
    const patterns: string[] = [];
    
    // Extract common coding patterns
    const codePatterns = [
      /class\s+\w+/g,
      /function\s+\w+/g,
      /async\s+function/g,
      /await\s+\w+/g,
      /import\s+.*from/g,
      /export\s+(default\s+)?/g,
      /try\s*{[\s\S]*?catch/g,
      /if\s*\([^)]+\)/g,
      /for\s*\([^)]+\)/g,
      /while\s*\([^)]+\)/g
    ];
    
    codePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        patterns.push(...matches.map(match => match.replace(/\s+/g, ' ').trim()));
      }
    });
    
    // Extract error patterns
    const errorPatterns = [
      /Error:\s*[^.!?]*[.!?]/g,
      /TypeError:\s*[^.!?]*[.!?]/g,
      /ReferenceError:\s*[^.!?]*[.!?]/g,
      /SyntaxError:\s*[^.!?]*[.!?]/g
    ];
    
    errorPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        patterns.push(...matches);
      }
    });
    
    return patterns.slice(0, 20); // Limit patterns per text
  }

  async storeCodePattern(code: string, pattern: string, language: string): Promise<string> {
    return this.store({
      type: 'code_pattern',
      content: {
        code,
        pattern,
        language,
        extractedAt: new Date().toISOString()
      },
      salience: 0.8,
      decayFactor: 0.98,
      metadata: { language, pattern }
    });
  }

  async storeSolution(problem: string, solution: string, context: any): Promise<string> {
    return this.store({
      type: 'solution',
      content: {
        problem,
        solution,
        context,
        success: true,
        timestamp: new Date().toISOString()
      },
      salience: 0.9,
      decayFactor: 0.95,
      metadata: { problemType: this.categorizeProblem(problem) }
    });
  }

  async storeErrorResolution(error: string, resolution: string, context: any): Promise<string> {
    return this.store({
      type: 'error_resolution',
      content: {
        error,
        resolution,
        context,
        resolvedAt: new Date().toISOString()
      },
      salience: 0.85,
      decayFactor: 0.97,
      metadata: { errorType: this.categorizeError(error) }
    });
  }

  async storeBestPractice(practice: string, domain: string, reasoning: string): Promise<string> {
    return this.store({
      type: 'best_practice',
      content: {
        practice,
        domain,
        reasoning,
        storedAt: new Date().toISOString()
      },
      salience: 0.75,
      decayFactor: 0.99, // Best practices decay slowly
      metadata: { domain }
    });
  }

  async storeLearningFeedback(action: string, outcome: string, feedback: string): Promise<string> {
    return this.store({
      type: 'learning',
      content: {
        action,
        outcome,
        feedback,
        learnedAt: new Date().toISOString()
      },
      salience: 0.8,
      decayFactor: 0.96,
      metadata: { actionType: this.categorizeAction(action) }
    });
  }

  private categorizeProblem(problem: string): string {
    const lower = problem.toLowerCase();
    if (lower.includes('compile') || lower.includes('build')) return 'compilation';
    if (lower.includes('test') || lower.includes('spec')) return 'testing';
    if (lower.includes('deploy') || lower.includes('production')) return 'deployment';
    if (lower.includes('performance') || lower.includes('slow')) return 'performance';
    if (lower.includes('security') || lower.includes('vulnerability')) return 'security';
    if (lower.includes('ui') || lower.includes('frontend')) return 'frontend';
    if (lower.includes('api') || lower.includes('backend')) return 'backend';
    return 'general';
  }

  private categorizeError(error: string): string {
    const lower = error.toLowerCase();
    if (lower.includes('typeerror')) return 'type_error';
    if (lower.includes('referenceerror')) return 'reference_error';
    if (lower.includes('syntaxerror')) return 'syntax_error';
    if (lower.includes('networkerror')) return 'network_error';
    if (lower.includes('timeout')) return 'timeout_error';
    if (lower.includes('permission')) return 'permission_error';
    return 'unknown_error';
  }

  private categorizeAction(action: string): string {
    const lower = action.toLowerCase();
    if (lower.includes('refactor')) return 'refactoring';
    if (lower.includes('test')) return 'testing';
    if (lower.includes('debug')) return 'debugging';
    if (lower.includes('optimize')) return 'optimization';
    if (lower.includes('implement')) return 'implementation';
    if (lower.includes('fix')) return 'bug_fix';
    return 'general';
  }

  async getRecentMemories(type?: string, limit = 20): Promise<MemoryEntry[]> {
    try {
      const memories = await prisma.agentMemory.findMany({
        where: {
          issueAgentId: this.issueAgentId,
          ...(type && { type })
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return memories.map(memory => ({
        id: memory.id,
        type: memory.type as any,
        content: memory.content,
        vectorRef: memory.vectorRef || undefined,
        salience: memory.salience,
        decayFactor: memory.decayFactor,
        timestamp: memory.createdAt
      }));
    } catch (error: any) {
      log.error({ error: String(error) }, 'Failed to get recent memories');
      return [];
    }
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  async getMemoryStats(): Promise<{
    totalMemories: number;
    averageSalience: number;
    typeDistribution: Record<string, number>;
    oldestMemory?: Date;
    newestMemory?: Date;
  }> {
    try {
      const memories = await prisma.agentMemory.findMany({
        where: { issueAgentId: this.issueAgentId }
      });

      const totalMemories = memories.length;
      const averageSalience = memories.length > 0 
        ? memories.reduce((sum, m) => sum + m.salience, 0) / memories.length 
        : 0;

      const typeDistribution = memories.reduce((dist, memory) => {
        dist[memory.type] = (dist[memory.type] || 0) + 1;
        return dist;
      }, {} as Record<string, number>);

      const timestamps = memories.map(m => m.createdAt);
      const oldestMemory = timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : undefined;
      const newestMemory = timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : undefined;

      return {
        totalMemories,
        averageSalience,
        typeDistribution,
        oldestMemory,
        newestMemory
      };
    } catch (error: any) {
      log.error({ error: String(error) }, 'Failed to get memory stats');
      return {
        totalMemories: 0,
        averageSalience: 0,
        typeDistribution: {}
      };
    }
  }
}