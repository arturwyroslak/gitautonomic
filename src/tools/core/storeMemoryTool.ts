import * as fs from 'fs/promises';
import * as path from 'path';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface MemoryEntry {
  id: string;
  type: 'fact' | 'pattern' | 'decision' | 'lesson' | 'context' | 'relationship' | 'performance';
  content: string;
  metadata: Record<string, any>;
  tags: string[];
  timestamp: Date;
  importance: number; // 0-1 scale
  accessCount: number;
  lastAccessed: Date;
  source: string;
  relatedMemories: string[];
  expires?: Date;
}

export interface MemoryQuery {
  type?: string;
  tags?: string[];
  content?: string;
  timeRange?: { start: Date; end: Date };
  importance?: { min: number; max: number };
  limit?: number;
  sortBy?: 'timestamp' | 'importance' | 'accessCount' | 'relevance';
}

export interface MemoryResult {
  success: boolean;
  memories?: MemoryEntry[];
  memory?: MemoryEntry;
  count?: number;
  message: string;
  error?: string;
}

export class StoreMemoryTool {
  private memories = new Map<string, MemoryEntry>();
  private readonly storageDir = '.memory_store';
  private readonly maxMemories = 10000;
  private readonly compressionThreshold = 5000;

  constructor() {
    this.initializeMemorySystem();
  }

  /**
   * Store facts about the codebase for future sessions
   */
  async storeMemory(
    content: string,
    type: MemoryEntry['type'] = 'fact',
    options: {
      tags?: string[];
      metadata?: Record<string, any>;
      importance?: number;
      source?: string;
      relatedTo?: string[];
      expiresIn?: number; // days
    } = {}
  ): Promise<MemoryResult> {
    try {
      const memory: MemoryEntry = {
        id: this.generateMemoryId(),
        type,
        content,
        metadata: options.metadata || {},
        tags: options.tags || [],
        timestamp: new Date(),
        importance: options.importance || this.calculateImportance(content, type),
        accessCount: 0,
        lastAccessed: new Date(),
        source: options.source || 'user',
        relatedMemories: options.relatedTo || [],
        expires: options.expiresIn ? new Date(Date.now() + options.expiresIn * 24 * 60 * 60 * 1000) : undefined
      };

      // Find related memories automatically
      const relatedMemories = await this.findRelatedMemories(content, memory.tags);
      memory.relatedMemories.push(...relatedMemories.map(m => m.id));

      this.memories.set(memory.id, memory);
      await this.saveMemory(memory);

      // Check if we need to compress old memories
      if (this.memories.size > this.compressionThreshold) {
        await this.compressOldMemories();
      }

      return {
        success: true,
        memory,
        message: `Memory stored with ID: ${memory.id}`
      };

    } catch (error) {
      log.error(`Store memory failed: ${error}`);
      return {
        success: false,
        message: 'Failed to store memory',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Retrieve memories based on query
   */
  async retrieveMemories(query: MemoryQuery): Promise<MemoryResult> {
    try {
      await this.loadAllMemories();
      await this.cleanupExpiredMemories();

      let memories = Array.from(this.memories.values());

      // Apply filters
      if (query.type) {
        memories = memories.filter(m => m.type === query.type);
      }

      if (query.tags && query.tags.length > 0) {
        memories = memories.filter(m => 
          query.tags!.some(tag => m.tags.includes(tag))
        );
      }

      if (query.content) {
        memories = memories.filter(m => 
          this.calculateSimilarity(query.content!, m.content) > 0.3
        );
      }

      if (query.timeRange) {
        memories = memories.filter(m => 
          m.timestamp >= query.timeRange!.start && m.timestamp <= query.timeRange!.end
        );
      }

      if (query.importance) {
        memories = memories.filter(m => 
          m.importance >= query.importance!.min && m.importance <= query.importance!.max
        );
      }

      // Sort memories
      const sortBy = query.sortBy || 'importance';
      memories.sort((a, b) => {
        switch (sortBy) {
          case 'timestamp':
            return b.timestamp.getTime() - a.timestamp.getTime();
          case 'importance':
            return b.importance - a.importance;
          case 'accessCount':
            return b.accessCount - a.accessCount;
          case 'relevance':
            if (query.content) {
              const aRelevance = this.calculateSimilarity(query.content, a.content);
              const bRelevance = this.calculateSimilarity(query.content, b.content);
              return bRelevance - aRelevance;
            }
            return b.importance - a.importance;
          default:
            return 0;
        }
      });

      // Apply limit
      if (query.limit) {
        memories = memories.slice(0, query.limit);
      }

      // Update access counts
      memories.forEach(memory => {
        memory.accessCount++;
        memory.lastAccessed = new Date();
        this.memories.set(memory.id, memory);
      });

      return {
        success: true,
        memories,
        count: memories.length,
        message: `Retrieved ${memories.length} memories`
      };

    } catch (error) {
      log.error(`Retrieve memories failed: ${error}`);
      return {
        success: false,
        memories: [],
        count: 0,
        message: 'Failed to retrieve memories',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update an existing memory
   */
  async updateMemory(memoryId: string, updates: Partial<MemoryEntry>): Promise<MemoryResult> {
    try {
      const memory = this.memories.get(memoryId);
      if (!memory) {
        return {
          success: false,
          message: `Memory not found: ${memoryId}`,
          error: 'MEMORY_NOT_FOUND'
        };
      }

      // Apply updates
      Object.assign(memory, updates, { lastAccessed: new Date() });
      this.memories.set(memoryId, memory);
      await this.saveMemory(memory);

      return {
        success: true,
        memory,
        message: `Memory updated: ${memoryId}`
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to update memory',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete a memory
   */
  async deleteMemory(memoryId: string): Promise<MemoryResult> {
    try {
      const memory = this.memories.get(memoryId);
      if (!memory) {
        return {
          success: false,
          message: `Memory not found: ${memoryId}`,
          error: 'MEMORY_NOT_FOUND'
        };
      }

      this.memories.delete(memoryId);
      
      // Remove from disk
      try {
        const filePath = path.join(this.storageDir, `${memoryId}.json`);
        await fs.unlink(filePath);
      } catch {
        // File may not exist
      }

      // Remove references from related memories
      for (const [id, mem] of this.memories) {
        if (mem.relatedMemories.includes(memoryId)) {
          mem.relatedMemories = mem.relatedMemories.filter(rid => rid !== memoryId);
          await this.saveMemory(mem);
        }
      }

      return {
        success: true,
        message: `Memory deleted: ${memoryId}`
      };

    } catch (error) {
      return {
        success: false,
        message: 'Failed to delete memory',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get memory statistics
   */
  async getStatistics(): Promise<{
    totalMemories: number;
    memoriesByType: Record<string, number>;
    averageImportance: number;
    mostAccessedMemories: MemoryEntry[];
    oldestMemories: MemoryEntry[];
    recentMemories: MemoryEntry[];
  }> {
    await this.loadAllMemories();
    
    const memories = Array.from(this.memories.values());
    
    const memoriesByType = memories.reduce((acc, memory) => {
      acc[memory.type] = (acc[memory.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const averageImportance = memories.reduce((sum, m) => sum + m.importance, 0) / memories.length;

    const mostAccessed = [...memories]
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 5);

    const oldest = [...memories]
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .slice(0, 5);

    const recent = [...memories]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 5);

    return {
      totalMemories: memories.length,
      memoriesByType,
      averageImportance,
      mostAccessedMemories: mostAccessed,
      oldestMemories: oldest,
      recentMemories: recent
    };
  }

  /**
   * Search memories with natural language
   */
  async searchMemories(searchText: string, limit: number = 10): Promise<MemoryResult> {
    const query: MemoryQuery = {
      content: searchText,
      limit,
      sortBy: 'relevance'
    };

    return this.retrieveMemories(query);
  }

  /**
   * Create a memory collection/category
   */
  async createMemoryCollection(name: string, description: string, tags: string[]): Promise<MemoryResult> {
    return this.storeMemory(
      `Collection: ${name} - ${description}`,
      'context',
      {
        tags: ['collection', ...tags],
        metadata: { isCollection: true, name, description },
        importance: 0.8,
        source: 'system'
      }
    );
  }

  private async initializeMemorySystem(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      log.warn(`Could not create memory storage directory: ${error}`);
    }
  }

  private async loadAllMemories(): Promise<void> {
    try {
      const files = await fs.readdir(this.storageDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const memoryId = file.replace('.json', '');
          if (!this.memories.has(memoryId)) {
            const memory = await this.loadMemory(memoryId);
            if (memory) {
              this.memories.set(memoryId, memory);
            }
          }
        }
      }
    } catch {
      // Directory doesn't exist or other error
    }
  }

  private async saveMemory(memory: MemoryEntry): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      const filePath = path.join(this.storageDir, `${memory.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(memory, null, 2), 'utf-8');
    } catch (error) {
      log.warn(`Could not save memory ${memory.id}: ${error}`);
    }
  }

  private async loadMemory(memoryId: string): Promise<MemoryEntry | null> {
    try {
      const filePath = path.join(this.storageDir, `${memoryId}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      const memory = JSON.parse(content);
      
      // Convert timestamp strings back to Date objects
      memory.timestamp = new Date(memory.timestamp);
      memory.lastAccessed = new Date(memory.lastAccessed);
      if (memory.expires) {
        memory.expires = new Date(memory.expires);
      }

      return memory;
    } catch {
      return null;
    }
  }

  private async cleanupExpiredMemories(): Promise<void> {
    const now = new Date();
    const expiredIds: string[] = [];

    for (const [id, memory] of this.memories) {
      if (memory.expires && memory.expires < now) {
        expiredIds.push(id);
      }
    }

    for (const id of expiredIds) {
      await this.deleteMemory(id);
    }
  }

  private async compressOldMemories(): Promise<void> {
    // Implement memory compression by removing least important/accessed memories
    const memories = Array.from(this.memories.values());
    
    // Sort by composite score (importance + access frequency)
    memories.sort((a, b) => {
      const scoreA = a.importance * 0.7 + (a.accessCount / 100) * 0.3;
      const scoreB = b.importance * 0.7 + (b.accessCount / 100) * 0.3;
      return scoreA - scoreB;
    });

    // Remove lowest scoring memories
    const toRemove = memories.slice(0, memories.length - this.maxMemories);
    for (const memory of toRemove) {
      await this.deleteMemory(memory.id);
    }

    log.info(`Compressed ${toRemove.length} old memories`);
  }

  private async findRelatedMemories(content: string, tags: string[]): Promise<MemoryEntry[]> {
    const related: MemoryEntry[] = [];
    
    for (const memory of this.memories.values()) {
      // Check content similarity
      const contentSimilarity = this.calculateSimilarity(content, memory.content);
      
      // Check tag overlap
      const tagOverlap = tags.filter(tag => memory.tags.includes(tag)).length;
      
      if (contentSimilarity > 0.4 || tagOverlap > 0) {
        related.push(memory);
      }
    }

    return related.slice(0, 5); // Limit to 5 related memories
  }

  private calculateImportance(content: string, type: MemoryEntry['type']): number {
    let importance = 0.5; // baseline

    // Type-based importance
    const typeImportance = {
      'decision': 0.8,
      'lesson': 0.9,
      'pattern': 0.7,
      'performance': 0.6,
      'relationship': 0.6,
      'context': 0.5,
      'fact': 0.4
    };
    
    importance = typeImportance[type] || 0.5;

    // Content-based adjustments
    const importantKeywords = ['critical', 'important', 'key', 'essential', 'major', 'significant'];
    const lowerContent = content.toLowerCase();
    
    importantKeywords.forEach(keyword => {
      if (lowerContent.includes(keyword)) {
        importance += 0.1;
      }
    });

    return Math.max(0, Math.min(1, importance));
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

  private generateMemoryId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const storeMemoryTool = new StoreMemoryTool();