import { cfg } from '../config.js';

export interface Chunk {
  id: string;
  text: string;
  tokenEstimate: number;
}

export class ContextWindowManager {
  maxTokens: number;
  safetyMargin: number;
  constructor(maxTokens = cfg.model.maxContextTokens ?? 16000, safetyMargin = 0.1) {
    this.maxTokens = maxTokens;
    this.safetyMargin = safetyMargin;
  }
  estimateTokens(text: string) { return Math.ceil(text.length / 4); }
  chunk(text: string, opts: { targetPerChunk?: number } = {}): Chunk[] {
    const target = opts.targetPerChunk ?? Math.floor(this.maxTokens * (1 - this.safetyMargin) / 4);
    const chunks: Chunk[] = [];
    let current: string[] = [];
    let currentLen = 0;
    const words = text.split(/(\s+)/);
    for (const w of words) {
      if (currentLen + w.length > target && current.length) {
        const joined = current.join('');
        chunks.push({ id: String(chunks.length), text: joined, tokenEstimate: this.estimateTokens(joined) });
        current = [];
        currentLen = 0;
      }
      current.push(w);
      currentLen += w.length;
    }
    if (current.length) {
      const joined = current.join('');
      chunks.push({ id: String(chunks.length), text: joined, tokenEstimate: this.estimateTokens(joined) });
    }
    return chunks;
  }
  trimToFit(prefix: string, body: string, suffix = ''): { text: string; truncated: boolean } {
    const total = prefix + body + suffix;
    if (this.estimateTokens(total) <= this.maxTokens * (1 - this.safetyMargin)) {
      return { text: total, truncated: false };
    }
    const allowed = Math.floor(this.maxTokens * (1 - this.safetyMargin) * 4); // char heuristic
    const bodyAllowed = Math.max(0, allowed - (prefix.length + suffix.length));
    return { text: prefix + body.slice(0, bodyAllowed) + suffix, truncated: true };
  }
}

export default { ContextWindowManager };