import { PlanTask } from "../types.js";

interface SourceChunk { id: string; size: number; text: string; relevance: number; }

export class ContextWindowManager {
  constructor(private maxChars: number) {}

  trimFiles(files: { path: string; content: string }[], tasks: PlanTask[]): { path: string; content: string }[] {
    const needed = new Set<string>();
    tasks.forEach(t => t.paths.forEach(p => needed.add(p)));
    const prioritized = files.map(f => {
      const direct = needed.has(f.path) ? 1 : 0;
      const sizePenalty = f.content.length / 8000;
      const relevance = direct ? 2 - sizePenalty : Math.max(0.1, 1 - sizePenalty);
      return { ...f, relevance };
    }).sort((a,b)=> b.relevance - a.relevance);

    const result: { path: string; content: string }[] = [];
    let acc = 0;
    for (const f of prioritized) {
      if (acc + f.content.length > this.maxChars) break;
      result.push(f);
      acc += f.content.length;
    }
    return result;
  }

  packReasoning(chains: string[]): string {
    const joined: SourceChunk[] = chains.map((c,i)=> ({
      id: `R${i}`,
      size: c.length,
      text: c,
      relevance: 1 - (i * 0.05)
    }));
    joined.sort((a,b)=> b.relevance - a.relevance);
    const out: string[] = [];
    let acc = 0;
    for (const j of joined) {
      if (acc + j.size > this.maxChars * 0.35) break;
      out.push(j.text);
      acc += j.size;
    }
    return out.join('\n---\n');
  }
}
