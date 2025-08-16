import { Octokit } from 'octokit';
import { getInstallationOctokit } from "../octokit.js";
import { prisma } from "../storage/prisma.js";
import { cfg } from "../config.js";

export interface PRServiceOptions { token: string; owner: string; repo: string; }

export interface PROptions {
  installationId: number;
  owner: string;
  repo: string;
  agentId: string;
}

export class PRService {
  octo: Octokit;
  owner: string; repo: string;
  constructor(opts: PRServiceOptions) {
    this.octo = new Octokit({ auth: opts.token });
    this.owner = opts.owner; this.repo = opts.repo;
  }
  async ensureBranch(branch: string, from = 'main') {
    const base = await this.octo.request('GET /repos/{owner}/{repo}/git/ref/{ref}', { owner: this.owner, repo: this.repo, ref: `heads/${from}` });
    try {
      await this.octo.request('GET /repos/{owner}/{repo}/git/ref/{ref}', { owner: this.owner, repo: this.repo, ref: `heads/${branch}` });
    } catch {
      await this.octo.request('POST /repos/{owner}/{repo}/git/refs', { owner: this.owner, repo: this.repo, ref: `refs/heads/${branch}`, sha: base.data.object.sha });
    }
  }
  async createOrUpdatePR(params: { branch: string; title: string; body?: string }) {
    const prs = await this.octo.request('GET /repos/{owner}/{repo}/pulls', { owner: this.owner, repo: this.repo, head: `${this.owner}:${params.branch}`, state: 'open' });
    if (prs.data.length) return prs.data[0];
    const pr = await this.octo.request('POST /repos/{owner}/{repo}/pulls', { owner: this.owner, repo: this.repo, title: params.title, head: params.branch, base: 'main', body: params.body });
    return pr.data;
  }
}

// Missing function required by adaptiveLoop.ts
export async function ensurePullRequest(options: PROptions): Promise<number> {
  const agent = await prisma.issueAgent.findUnique({ where: { id: options.agentId } });
  if (!agent) throw new Error('Agent not found');
  
  if (agent.prNumber) {
    return agent.prNumber;
  }

  const octo = await getInstallationOctokit(options.installationId.toString());
  
  try {
    const { data: pr } = await octo.rest.pulls.create({
      owner: options.owner,
      repo: options.repo,
      title: `${cfg.git.pullRequestTitlePrefix} ${agent.issueTitle}`,
      head: agent.branchName,
      base: cfg.git.defaultBase,
      body: `Automated implementation of issue #${agent.issueNumber}\n\n- [ ] Implementation in progress\n- [ ] Tests added\n- [ ] Documentation updated`,
      draft: true
    });

    await prisma.issueAgent.update({
      where: { id: agent.id },
      data: { prNumber: pr.number }
    });

    return pr.number;
  } catch (e) {
    console.error('Failed to create PR:', e);
    return 0;
  }
}

export default { PRService, ensurePullRequest };