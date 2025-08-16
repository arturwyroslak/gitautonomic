import { renderTemplate } from './promptTemplates.js';
import { ContextWindowManager } from './contextWindowManager.js';
import { cfg } from '../config.js';

export interface LLMModel {
  complete(prompt: string, opts?: { temperature?: number; maxTokens?: number }): Promise<string>;
}

export interface Toolset {
  diff: {
    parse(diffText: string): Promise<any>;
    applyUnified(diffText: string, opts?: any): Promise<{ ok: boolean; errors?: string[] }>;
  };
  fs?: {
    read(path: string): Promise<string>;
    write(path: string, content: string): Promise<void>;
  };
  memory?: any;
}

export class ReasoningEngine {
  model: LLMModel;
  prompts = { build: renderTemplate };
  ctx: ContextWindowManager;
  tools: Toolset;
  constructor(model: LLMModel, tools: Toolset, ctx = new ContextWindowManager()) {
    this.model = model;
    this.tools = tools;
    this.ctx = ctx;
  }
  async plan(objective: string, maxSteps = 8) {
    const prompt = renderTemplate('task_plan', { objective, maxSteps });
    const raw = await this.model.complete(prompt, { temperature: 0 });
    try { return JSON.parse(raw); } catch { return []; }
  }
  async reflectiveLoop(task: string, context: string, opts: { maxRounds?: number } = {}) {
    const maxRounds = opts.maxRounds ?? 5;
    const history: any[] = [];
    for (let i=0;i<maxRounds;i++) {
      const prompt = renderTemplate('reasoning_step', {
        task,
        context: context.slice(-8000),
        constraints: 'Stay concise, JSON only'
      });
      const out = await this.model.complete(prompt, { temperature: 0.3 });
      let parsed: any;
      try { parsed = JSON.parse(out); } catch { parsed = { thought: out, actions: [] }; }
      history.push(parsed);
      if (!parsed.actions || parsed.actions.length === 0) break;
    }
    return history;
  }

  async decompose(objective: string, options: { limit?: number } = {}): Promise<any[]> {
    // Decompose complex objective into smaller tasks
    const limit = options.limit || 10;
    const prompt = `Decompose this objective into ${limit} smaller, actionable tasks:
    
Objective: ${objective}

Return a JSON array of tasks, each with: { id, title, description, dependencies }`;

    const response = await this.model.complete(prompt, { temperature: 0.3 });
    try {
      return JSON.parse(response);
    } catch {
      return [{ id: '1', title: objective, description: 'Single task', dependencies: [] }];
    }
  }

  async analyzeObjective(objective: string, options: any = {}): Promise<any> {
    // Analyze objective to understand complexity, risks, and approach
    const prompt = `Analyze this software development objective:
    
Objective: ${objective}

Provide analysis with:
- complexity: low/medium/high
- estimated_effort: hours
- risks: array of risk descriptions
- approach: recommended implementation approach
- prerequisites: required dependencies or setup

Return as JSON.`;

    const response = await this.model.complete(prompt, { temperature: 0.3 });
    try {
      return JSON.parse(response);
    } catch {
      return {
        complexity: 'medium',
        estimated_effort: 4,
        risks: ['Unknown complexity'],
        approach: 'Iterative development',
        prerequisites: []
      };
    }
  }
}

// Missing function required by adaptiveLoop.ts
export async function reasoningPipeline(input: any): Promise<any> {
  // TODO: implement proper reasoning pipeline
  return {
    summary: `Reasoning completed for ${input.phase}`,
    trace: {
      phase: input.phase,
      steps: [],
      summary: 'Basic reasoning trace'
    },
    confidence: 0.8
  };
}

export default { ReasoningEngine, reasoningPipeline };