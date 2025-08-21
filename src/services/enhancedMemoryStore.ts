// Enhanced Memory Store with Embedding Integration
import { prisma } from '../storage/prisma.js';
import { getInstallationOctokit } from '../octokit.js';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface MemoryEntry {
  id: string;
  type: 'code_pattern' | 'solution' | 'error_resolution' | 'best_practice' | 'context';
  content: any;
  vectorRef?: string;
  salience: number;
  decayFactor: number;
  metadata?: any;
  timestamp: Date;
}

export interface QueryResult {
  entry: MemoryEntry;
  similarity: number;
  relevance: number;
}

export class EnhancedMemoryStore {
  constructor(private issueAgentId: string) {}

  async store(entry: Omit<MemoryEntry, 'id' | 'timestamp'>): Promise<string> {
    try {
      const memoryEntry = await prisma.agentMemory.create({
        data: {
          id: `memory-${this.issueAgentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          issueAgentId: this.issueAgentId,
          type: entry.type,
          content: entry.content,
          vectorRef: entry.vectorRef || null,
          salience: entry.salience,
          decayFactor: entry.decayFactor,
        }
      });

      log.info(`Stored memory entry: ${memoryEntry.id}`);
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
        take: limit * 2 // Get more to filter
      });

      // Apply decay to salience based on age
      const results: QueryResult[] = memories.map(memory => {
        const age = Date.now() - memory.createdAt.getTime();
        const ageDays = age / (1000 * 60 * 60 * 24);
        const decayedSalience = memory.salience * Math.pow(memory.decayFactor, ageDays);
        
        // Simple text similarity (in production, use embeddings)
        const similarity = this.calculateTextSimilarity(
          queryText.toLowerCase(),
          JSON.stringify(memory.content).toLowerCase()
        );
        
        const relevance = (similarity * 0.7) + (decayedSalience * 0.3);
        
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
          relevance
        };
      });

      // Sort by relevance and return top results
      return results
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);
        
    } catch (error: any) {
      log.error('Failed to query memory store:', error);
      return [];
    }
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
      decayFactor: 0.98
    });
  }

  async storeSolution(problem: string, solution: string, context: any): Promise<string> {
    return this.store({
      type: 'solution',
      content: {
        problem,
        solution,
        context,
        success: true
      },
      salience: 0.9,
      decayFactor: 0.95
    });
  }

  async storeErrorResolution(error: string, resolution: string, files: string[]): Promise<string> {
    return this.store({
      type: 'error_resolution',
      content: {
        error,
        resolution,
        files,
        resolvedAt: new Date().toISOString()
      },
      salience: 0.85,
      decayFactor: 0.97
    });
  }

  async storeBestPractice(practice: string, domain: string, examples: string[]): Promise<string> {
    return this.store({
      type: 'best_practice',
      content: {
        practice,
        domain,
        examples,
        importance: 'high'
      },
      salience: 0.75,
      decayFactor: 0.99 // Best practices decay slowly
    });
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
      log.error('Failed to get recent memories:', error);
      return [];
    }
  }

  async reinforceMemory(memoryId: string, salienceBoost = 0.1): Promise<void> {
    try {
      await prisma.agentMemory.update({
        where: { id: memoryId },
        data: {
          salience: {
            increment: salienceBoost
          },
          updatedAt: new Date()
        }
      });
      
      log.info(`Reinforced memory: ${memoryId}`);
    } catch (error: any) {
      log.error('Failed to reinforce memory:', error);
    }
  }

  async forgetMemory(memoryId: string): Promise<void> {
    try {
      await prisma.agentMemory.delete({
        where: { id: memoryId }
      });
      
      log.info(`Forgot memory: ${memoryId}`);
    } catch (error: any) {
      log.error('Failed to forget memory:', error);
    }
  }

  async decay(): Promise<number> {
    try {
      // Get all memories for this agent
      const memories = await prisma.agentMemory.findMany({
        where: { issueAgentId: this.issueAgentId }
      });

      let decayedCount = 0;
      
      for (const memory of memories) {
        const age = Date.now() - memory.createdAt.getTime();
        const ageDays = age / (1000 * 60 * 60 * 24);
        const newSalience = memory.salience * Math.pow(memory.decayFactor, ageDays / 7); // Weekly decay
        
        if (newSalience < 0.1) {
          // Forget very low salience memories
          await this.forgetMemory(memory.id);
          decayedCount++;
        } else if (newSalience !== memory.salience) {
          // Update salience
          await prisma.agentMemory.update({
            where: { id: memory.id },
            data: { salience: newSalience }
          });
        }
      }

      return decayedCount;
    } catch (error: any) {
      log.error('Failed to decay memories:', error);
      return 0;
    }
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
      log.error('Failed to get memory stats:', error);
      return {
        totalMemories: 0,
        averageSalience: 0,
        typeDistribution: {}
      };
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

  // Embedding integration methods (for future use with actual embedding models)
  async storeWithEmbedding(entry: Omit<MemoryEntry, 'id' | 'timestamp'>, text: string): Promise<string> {
    // TODO: Generate embeddings using actual embedding model
    // For now, store without embedding
    return this.store(entry);
  }

  async semanticSearch(queryText: string, limit = 10): Promise<QueryResult[]> {
    // TODO: Implement actual semantic search with embeddings
    // For now, fall back to text similarity
    return this.query(queryText, undefined, limit);
  }
}

// Factory function for creating memory stores
export function createMemoryStore(issueAgentId: string): EnhancedMemoryStore {
  return new EnhancedMemoryStore(issueAgentId);
}

export default { EnhancedMemoryStore, createMemoryStore };