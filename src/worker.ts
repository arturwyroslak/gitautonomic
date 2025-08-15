import pino from 'pino';
import { planQueue, execQueue, evalQueue, sweepQueue } from './queue.js';
import { ensurePlan, runAdaptiveIteration } from './ai/adaptiveLoop.js';
import { evaluateAgent } from './services/evalService.js';
import { prisma } from './storage/prisma.js';
import { scheduleActiveAgents } from './services/loopScheduler.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

async function init() {
  log.info('Worker starting with adaptive loop enabled');

  planQueue.process(async job => {
    const { owner, repo, issueNumber } = job.data;
    const id = `${owner}_${repo}_${issueNumber}`.toLowerCase();
    log.info({ id }, 'Planning');
    await ensurePlan(id);
  });

  execQueue.process(async job => {
    const { owner, repo, issueNumber } = job.data;
    const id = `${owner}_${repo}_${issueNumber}`.toLowerCase();
    log.info({ id }, 'Execution iteration');
    await runAdaptiveIteration(id);
  });

  evalQueue.process(async job => {
    const { owner, repo, issueNumber } = job.data;
    const id = `${owner}_${repo}_${issueNumber}`.toLowerCase();
    log.info({ id }, 'Evaluation');
    await evaluateAgent(id);
  });

  sweepQueue.process(async () => {
    log.info('Sweep start');
    await scheduleActiveAgents();
    log.info('Sweep complete');
  });

  setInterval(async () => {
    const agents = await prisma.issueAgent.findMany({ where: { completed: false } });
    for (const a of agents) {
      if (!a.lastEvalAt || Date.now() - a.lastEvalAt.getTime() > 1000 * 60 * 10) {
        await evalQueue.add(`eval-${a.id}-${Date.now()}`, {
          owner: a.owner,
          repo: a.repo,
          issueNumber: a.issueNumber
        }, { delay: 2000 });
      }
    }
  }, 60_000);

  log.info('Worker initialized');
}

init().catch(err => {
  log.error({ err }, 'Worker init failed');
  process.exit(1);
});
