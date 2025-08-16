export interface MemoryItem {
  id: string;
  type: string;
  content: string;
  vector?: number[];
  meta?: Record<string, any>;
  ts: number;
}

export class MemoryStore {
  items: Map<string, MemoryItem> = new Map();
  embedder?: (text: string) => Promise<number[]>;
  constructor(embedder?: (text: string) => Promise<number[]>) { this.embedder = embedder; }
  async add(type: string, content: string, meta: Record<string, any> = {}): Promise<MemoryItem> {
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const vector = this.embedder ? await this.embedder(content) : undefined;
    const item: MemoryItem = { id, type, content, meta, vector, ts: Date.now() };
    this.items.set(id, item);
    return item;
  }
  list(type?: string) { return Array.from(this.items.values()).filter(i => !type || i.type === type); }
  similarity(a: number[] = [], b: number[] = []) { return a.length && b.length ? a.reduce((s,v,i)=>s+v*b[i],0) / (Math.sqrt(a.reduce((s,v)=>s+v*v,0))*Math.sqrt(b.reduce((s,v)=>s+v*v,0))) : 0; }
  async search(query: string, k = 5): Promise<MemoryItem[]> {
    const qv = this.embedder ? await this.embedder(query) : undefined;
    const scored = this.list().map(m => ({ m, score: qv && m.vector ? this.similarity(qv, m.vector) : 0 }));
    return scored.sort((a,b)=>b.score-a.score).slice(0,k).map(s=>s.m);
  }
}

// Missing functions required by adaptiveLoop.ts
export async function fetchStrategicBundle(agentId: string): Promise<string[]> {
  // TODO: implement proper strategic memory fetching from database
  return ['strategic memory placeholder'];
}

export async function compressStrategic(agentId: string): Promise<void> {
  // TODO: implement memory compression logic
}

export async function decayMemories(agentId: string): Promise<void> {
  // TODO: implement memory decay logic
}

export async function addMemory(agentId: string, type: string, content: string, meta?: Record<string, any>): Promise<void> {
  // TODO: implement memory addition to database
}

export default { MemoryStore, fetchStrategicBundle, compressStrategic, decayMemories, addMemory };