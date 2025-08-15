#!/usr/bin/env node
import { bootstrap } from './runtime/engineBootstrap.js';
import { AutoOrchestrator } from './ai/autoOrchestrator.js';

async function main() {
  const objective = process.argv.slice(2).join(' ') || 'Improve documentation';
  const model = {
    async complete(prompt: string) {
      if (prompt.includes('task_plan')) {
        return JSON.stringify([
          { id: '1', title: 'Generate patch improving README', rationale: 'Add missing section' },
            { id: '2', title: 'Review patch', rationale: 'Ensure correctness' }
        ], null, 2);
      }
      return '{"thought":"placeholder","actions":[]}';
    }
  };
  const { engine, host } = bootstrap({ model });
  const orchestrator = new AutoOrchestrator(engine, host, {
    onEvent: e => {
      if (e.type === 'plan.generated') console.log('Plan steps:', e.steps.length);
      else if (e.type === 'patch.refined') console.log('Patch refined:', e.ok, e.reasons);
      else if (e.type === 'error') console.error('Error:', e.error);
      else if (e.type === 'done') console.log('Done:', e.summary);
    }
  });
  await orchestrator.runObjective(objective);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
