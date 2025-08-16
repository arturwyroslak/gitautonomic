import pino from 'pino';
import { Worker } from 'bullmq';
import { connection } from './queue.js';
import { ensurePlan, runAdaptiveIteration } from './ai/adaptiveLoop.js';
import { evaluateAgent } from './services/evalService.js';
import { prisma } from './storage/prisma.js';
import { scheduleActiveAgents } from './services/loopScheduler.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

async function init() {
  log.info('Worker starting with adaptive loop + git/diff engine');

  const planWorker = new Worker('plan', async (job) => {
    const { owner, repo, issueNumber } = job.data;
    const id = `${owner}_${repo}_${issueNumber}`.toLowerCase();
    log.info({ id }, 'Planning');
    await ensurePlan(id);
  }, { connection });

  const execWorker = new Worker('exec', async (job) => {
    const { owner, repo, issueNumber } = job.data;
    const id = `${owner}_${repo}_${issueNumber}`.toLowerCase();
    log.info({ id }, 'Execution iteration');
    await runAdaptiveIteration(id);
  }, { connection });

  const evalWorker = new Worker('eval', async (job) => {
    const { owner, repo, issueNumber } = job.data;
    const id = `${owner}_${repo}_${issueNumber}`.toLowerCase();
    log.info({ id }, 'Evaluation');
    await evaluateAgent(id);
  }, { connection });

  const sweepWorker = new Worker('sweep', async () => {
    log.info('Sweep start');
    await scheduleActiveAgents();
    log.info('Sweep complete');
  }, { connection });

  setInterval(async () => {
    const agents = await prisma.issueAgent.findMany({ where: { completed: false } });
    for (const a of agents) {
      if (!a.lastEvalAt || Date.now() - a.lastEvalAt.getTime() > 1000 * 60 * 10) {
        const evalQueue = (await import('./queue.js')).evalQueue;
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
