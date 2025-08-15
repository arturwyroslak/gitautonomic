import { ReasoningEngine } from '../ai/reasoningEngine.js';

export async function planTasks(engine: ReasoningEngine, objective: string, maxSteps = 8) {
  return engine.plan(objective, maxSteps);
}

export default { planTasks };