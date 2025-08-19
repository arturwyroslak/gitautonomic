import { prisma } from "../storage/prisma.js";
import { randomUUID } from "node:crypto";
import { cfg } from "../config.js";
import { embeddingService } from "../services/embeddingService.js";

export type MemoryType = 'strategic' | 'technical' | 'risk' | 'evaluation' | 'compression' | 'context' | 'learning' | 'feedback';

export interface MemoryItem {
  id: string;
  type: string;
  content: string;
  vector?: number[];
  meta?: Record<string, any>;
  ts: number;
  similarity?: number;
}

interface MemoryInput {
  issueAgentId: string;
  type: MemoryType;
  content: any;
  salience?: number;
  decayFactor?: number;
}

export class MemoryStore {
  items: Map<string, MemoryItem> = new Map();
  
  constructor() {
    // Use the embedding service for vector operations
  }
  
  async add(type: string, content: string, meta: Record<string, any> = {}): Promise<MemoryItem> {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    
    try {
      // Generate embedding using the embedding service
      const embedding = await embeddingService.generateEmbedding(content, { type, ...meta });
      const vector = embedding.vector;
      
      const item: MemoryItem = { id, type, content, meta, vector, ts: Date.now() };
      this.items.set(id, item);
      
      return item;
    } catch (error) {
      // Fallback without embeddings if service fails
      const item: MemoryItem = { id, type, content, meta, ts: Date.now() };
      this.items.set(id, item);
      return item;
    }
  }
  
  list(type?: string) { 
    return Array.from(this.items.values()).filter(i => !type || i.type === type); 
  }
  
  similarity(a: number[] = [], b: number[] = []) { 
    return a.length && b.length ? 
      a.reduce((s,v,i)=>s+v*(b[i] ?? 0),0) / (Math.sqrt(a.reduce((s,v)=>s+v*v,0))*Math.sqrt(b.reduce((s,v)=>s+v*v,0))) : 0; 
  }
  
  async search(query: string, k = 5): Promise<MemoryItem[]> {
    try {
      // Use embedding service for semantic search
      const results = await embeddingService.findSimilar(query, k, 0.7);
      
      // Map results back to MemoryItems
      const items: MemoryItem[] = [];
      for (const result of results) {
        const item = this.items.get(result.id);
        if (item) {
          items.push({ ...item, similarity: result.similarity });
        }
      }
      
      return items;
    } catch (error) {
      // Fallback to simple text search
      return this.simpleTextSearch(query, k);
    }
  }

  private simpleTextSearch(query: string, k: number): MemoryItem[] {
    const queryLower = query.toLowerCase();
    const matches = Array.from(this.items.values())
      .filter(item => item.content.toLowerCase().includes(queryLower))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, k);
    
    return matches;
  }

  async searchByType(type: string, query?: string, k = 5): Promise<MemoryItem[]> {
    const typeItems = this.list(type);
    
    if (!query) {
      return typeItems.slice(0, k);
    }
    
    try {
      // Filter by type in metadata
      const results = await embeddingService.findSimilar(query, k * 2, 0.6, { type });
      
      const items: MemoryItem[] = [];
      for (const result of results) {
        const item = this.items.get(result.id);
        if (item && item.type === type) {
          items.push({ ...item, similarity: result.similarity });
        }
      }
      
      return items.slice(0, k);
    } catch (error) {
      return typeItems.filter(item => 
        item.content.toLowerCase().includes(query.toLowerCase())
      ).slice(0, k);
    }
  }

  async addContextMemory(context: string, metadata: Record<string, any> = {}): Promise<MemoryItem> {
    return await this.add('context', context, {
      ...metadata,
      timestamp: new Date().toISOString(),
      priority: metadata.priority || 'normal'
    });
  }

  async addLearningMemory(learning: string, metadata: Record<string, any> = {}): Promise<MemoryItem> {
    return await this.add('learning', learning, {
      ...metadata,
      timestamp: new Date().toISOString(),
      category: metadata.category || 'general'
    });
  }

  async getRecentMemories(type?: string, limit = 10): Promise<MemoryItem[]> {
    const items = type ? this.list(type) : Array.from(this.items.values());
    return items
      .sort((a, b) => b.ts - a.ts)
      .slice(0, limit);
  }

  async getRelevantContext(query: string, maxItems = 5): Promise<string> {
    const relevantMemories = await this.search(query, maxItems);
    
    if (relevantMemories.length === 0) {
      return 'No relevant context found.';
    }
    
    return relevantMemories
      .map(memory => `[${memory.type}] ${memory.content}`)
      .join('\n\n');
  }
}

// Database-backed memory functions
export async function addMemory(m: MemoryInput): Promise<any>;
export async function addMemory(agentId: string, type: string, content: string, meta?: Record<string, any>): Promise<void>;
export async function addMemory(mOrAgentId: MemoryInput | string, type?: string, content?: string, meta?: Record<string, any>): Promise<any> {
  if (typeof mOrAgentId === 'string') {
    // New signature for adaptiveLoop.ts compatibility
    const agentId = mOrAgentId;
    if (!type || !content) throw new Error('Type and content are required');
    
    return prisma.agentMemory.create({
      data: {
        id: randomUUID(),
        issueAgentId: agentId,
        type: type as MemoryType,
        content: content,
        salience: 0.5,
        decayFactor: 0.98
      }
    });
  } else {
    // Original signature
    const m = mOrAgentId;
    const sal = m.salience ?? 0.5;
    return prisma.agentMemory.create({
      data: {
        id: randomUUID(),
        issueAgentId: m.issueAgentId,
        type: m.type,
        content: m.content,
        salience: sal,
        decayFactor: m.decayFactor ?? 0.98
      }
    });
  }
}

export async function listTopMemories(issueAgentId: string, type: MemoryType, limit: number) {
  return prisma.agentMemory.findMany({
    where: { issueAgentId, type },
    orderBy: { salience: 'desc' },
    take: limit
  });
}

export async function selectiveRetention(issueAgentId: string) {
  const limits: Record<MemoryType, number> = {
    strategic: cfg.memory.maxStrategic,
    technical: cfg.memory.maxTechnical,
    risk: 40,
    evaluation: 60,
    compression: 16,
    context: 30,
    learning: 20,
    feedback: 10
  };

  for (const [type, max] of Object.entries(limits)) {
    const items = await prisma.agentMemory.findMany({
      where: { issueAgentId, type },
      orderBy: [{ salience: 'desc' }, { updatedAt: 'desc' }],
      skip: max
    });
    if (items.length) {
      await prisma.agentMemory.deleteMany({ where: { id: { in: items.map((i: any) => i.id) } } });
    }
  }
}

export async function decayMemories(issueAgentId: string): Promise<void> {
  const all = await prisma.agentMemory.findMany({ where: { issueAgentId } });
  for (const m of all) {
    const newSalience = m.salience * m.decayFactor;
    if (newSalience < cfg.memory.minSalienceForRetention) {
      await prisma.agentMemory.delete({ where: { id: m.id } });
    } else {
      await prisma.agentMemory.update({ where: { id: m.id }, data: { salience: newSalience } });
    }
  }
}

export async function compressStrategic(issueAgentId: string): Promise<void> {
  const strategic = await listTopMemories(issueAgentId, 'strategic', 10);
  const evaluation = await listTopMemories(issueAgentId, 'evaluation', 5);
  const text = [
    'SYNTHESIS:',
    ...strategic.map((s: any) => `S:${JSON.stringify(s.content)}`),
    ...evaluation.map((e: any) => `E:${JSON.stringify(e.content)}`)
  ].join('\n').slice(0, 4000);
  
  await addMemory({
    issueAgentId,
    type: 'compression',
    content: { synthesis: text, ts: Date.now() },
    salience: 0.7
  });
  await selectiveRetention(issueAgentId);
}

export async function fetchStrategicBundle(issueAgentId: string): Promise<string[]> {
  const comp = await listTopMemories(issueAgentId, 'compression', 2);
  const strat = await listTopMemories(issueAgentId, 'strategic', 6);
  return [...comp, ...strat].map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content));
}

export default { MemoryStore, fetchStrategicBundle, compressStrategic, decayMemories, addMemory };