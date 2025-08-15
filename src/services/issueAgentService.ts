import { prisma } from "../storage/prisma.js";
import { sha256 } from "../util/hash.js";

export async function ensureIssueAgent(params: { installationId: number; owner: string; repo: string; issueNumber: number; title: string; body: string; }) {
  const id = `${params.owner}_${params.repo}_${params.issueNumber}`.toLowerCase();
  return prisma.issueAgent.upsert({
    where: { id },
    create: { id, installationId: BigInt(params.installationId), owner: params.owner, repo: params.repo, issueNumber: params.issueNumber, issueTitle: params.title, issueBodyHash: sha256(params.body), branchName: `ai/issue-${params.issueNumber}-agent` },
    update: { issueTitle: params.title, issueBodyHash: sha256(params.body) }
  });
}

export async function loadAgent(owner: string, repo: string, number: number) {
  return prisma.issueAgent.findUnique({ where: { id: `${owner}_${repo}_${number}`.toLowerCase() }, include: { tasks: true } });
}
