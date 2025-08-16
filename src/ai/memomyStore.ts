import { prisma } from "../storage/prisma.js";
import { randomUUID } from "node:crypto";
import { cfg } from "../config.js";

export type MemoryType = 'strategic' | 'technical' | 'risk' | 'evaluation' | 'compression';

interface MemoryInput {
  issueAgentId: string;
  type: MemoryType;
  content: any;
  salience?: number;
  decayFactor?: number;
}

export async function addMemory(m: MemoryInput) {
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

export async function listTopMemories(issueAgentId: string, type: MemoryType, limit: number) {
  return prisma.agentMemory.findMany({
    where: { issueAgentId, type },
    orderBy: { salience: 'desc' },
    take: limit
  });
}

export async function selectiveRetention(issueAgentId: string) {
  // strategia: ogranicz liczbę rekordów wg konfiguracji
  const limits: Record<MemoryType, number> = {
    strategic: cfg.memory.maxStrategic,
    technical: cfg.memory.maxTechnical,
    risk: 40,
    evaluation: 60,
    compression: 16
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

export async function decayMemories(issueAgentId: string) {
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

export async function compressStrategic(issueAgentId: string) {
  // Na razie prosta heurystyka – łączy top strategic & evaluation
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
