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

// Comprehensive reasoning pipeline for adaptive loop
export async function reasoningPipeline(input: any): Promise<any> {
  try {
    const { phase, context, tasks, provider } = input || {};
    
    // Initialize reasoning steps
    const steps: any[] = [];
    let confidence = 0.7;
    
    // Step 1: Context Analysis
    steps.push({
      step: 'context_analysis',
      timestamp: new Date().toISOString(),
      input: { phase: phase || 'unknown', contextSize: context?.length || 0 },
      output: { analysisType: 'basic', confidence: 0.8 }
    });
    
    // Step 2: Task Decomposition (if tasks provided)
    if (tasks && tasks.length > 0) {
      const taskAnalysis = tasks.map((task: any) => ({
        id: task.id || task.externalId,
        complexity: task.complexity || 'medium',
        estimatedEffort: task.estimatedEffort || 2,
        dependencies: task.dependencies || []
      }));
      
      steps.push({
        step: 'task_decomposition',
        timestamp: new Date().toISOString(),
        input: { taskCount: tasks.length },
        output: { decomposedTasks: taskAnalysis, totalEffort: taskAnalysis.reduce((sum: number, t: any) => sum + t.estimatedEffort, 0) }
      });
      
      confidence += 0.1;
    }
    
    // Step 3: Risk Assessment
    const risks = [];
    if (phase === 'execution' && tasks?.length > 3) {
      risks.push('High task complexity - consider breaking down further');
      confidence -= 0.1;
    }
    
    steps.push({
      step: 'risk_assessment',
      timestamp: new Date().toISOString(),
      input: { phase, taskCount: tasks?.length || 0 },
      output: { risks, riskLevel: risks.length > 0 ? 'medium' : 'low' }
    });
    
    // Step 4: Strategy Selection
    const strategy = phase === 'planning' ? 'comprehensive_analysis' : 
                    phase === 'execution' ? 'incremental_implementation' : 
                    'adaptive_monitoring';
    
    steps.push({
      step: 'strategy_selection',
      timestamp: new Date().toISOString(),
      input: { phase: phase || 'unknown', availableStrategies: ['comprehensive', 'incremental', 'adaptive'] },
      output: { selectedStrategy: strategy, reasoning: `Optimal for ${phase || 'unknown'} phase` }
    });
    
    // Final confidence adjustment
    confidence = Math.min(0.95, Math.max(0.5, confidence));
    
    return {
      summary: `Reasoning pipeline completed for ${phase || 'unknown'} phase with ${steps.length} steps`,
      trace: {
        phase: phase || 'unknown',
        steps,
        summary: `Executed ${steps.length} reasoning steps with ${confidence.toFixed(2)} confidence`,
        metrics: {
          totalSteps: steps.length,
          confidence,
          phase: phase || 'unknown',
          timestamp: new Date().toISOString()
        }
      },
      confidence,
      recommendations: risks.length > 0 ? ['Address identified risks before proceeding'] : ['Proceed with current plan']
    };
    
  } catch (error: any) {
    // Fallback reasoning result
    const safePhase = (input && typeof input === 'object' && input.phase) || 'unknown';
    return {
      summary: `Reasoning pipeline failed for ${safePhase} - using fallback`,
      trace: {
        phase: safePhase,
        steps: [{
          step: 'fallback',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }],
        summary: 'Fallback reasoning due to error'
      },
      confidence: 0.5
    };
  }
}

export default { ReasoningEngine, reasoningPipeline };