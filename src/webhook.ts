import { Webhooks } from "@octokit/webhooks";
import { cfg } from "./config.js";
import { getInstallationOctokit } from "./octokit.js";
import { ensureIssueAgent } from "./services/issueAgentService.js";
import { planQueue, execQueue } from "./queue.js";
import { loadAgent } from "./services/issueAgentService.js";
import { sha256 } from "./util/hash.js";
import { prisma } from "./storage/prisma.js";

export const webhooks = new Webhooks({ secret: cfg.webhookSecret });

webhooks.on('issues', async e => {
  const { action, issue, repository, installation } = e.payload;
  if (!installation) return;
  const inst = installation.id;
  const owner = repository.owner.login;
  const repo = repository.name;

  if (['opened','edited','reopened'].includes(action)) {
    await ensureIssueAgent({
      installationId: inst,
      owner,
      repo,
      issueNumber: issue.number,
      title: issue.title,
      body: issue.body || ''
    });
    const agent = await loadAgent(owner, repo, issue.number);
    const bodyHash = sha256(issue.body || '');
    const bodyChanged = agent && bodyHash !== agent.issueBodyHash;

    if (!agent?.planCommitSha || bodyChanged) {
      await planQueue.add(`plan-${owner}-${repo}-${issue.number}-${Date.now()}`, {
        installationId: inst, owner, repo, issueNumber: issue.number
      });
    } else {
      if (!agent.completed) {
        await execQueue.add(`exec-${owner}-${repo}-${issue.number}-${Date.now()}`, {
          installationId: inst, owner, repo, issueNumber: issue.number, trigger:'auto'
        }, { delay: 1500 });
      }
    }
  }
});

webhooks.on('pull_request.closed', async e => {
  if (!e.payload.pull_request.merged) return;
  const body = e.payload.pull_request.body || '';
  const match = body.match(/issue #(\d+)/i);
  if (match) {
    const issueNum = parseInt(match?.[1] || '0', 10);
    const octo = await getInstallationOctokit(e.payload.installation!.id);
    await octo.rest.issues.createComment({
      owner: e.payload.repository.owner.login,
      repo: e.payload.repository.name,
      issue_number: issueNum,
      body: "PR merged – closing issue."
    });
    await octo.rest.issues.update({
      owner: e.payload.repository.owner.login,
      repo: e.payload.repository.name,
      issue_number: issueNum,
      state: 'closed'
    });
  }
});

webhooks.on('issues.closed', async e => {
  const { installation, repository, issue } = e.payload;
  if (!installation) return;
  await prisma.issueAgent.updateMany({
    where: {
      installationId: BigInt(installation.id),
      owner: repository.owner.login,
      repo: repository.name,
      issueNumber: issue.number
    },
    data: { completed: true }
  });
});
