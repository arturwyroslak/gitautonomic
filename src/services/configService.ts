import { prisma } from "../storage/prisma.js";

export async function getInstallationConfig(installationId: number) {
  return prisma.installationConfig.findUnique({ where: { installationId: BigInt(installationId) } });
}

export async function upsertInstallationConfig(installationId: number, data: { provider: string; model: string; endpoint?: string; apiKeyHash?: string; maxTasksPerIter?: number; maxTotalIter?: number; adaptiveness?: any; maxPlanExpansions?: number; evaluation?: { enabled: boolean; maxEvaluationRounds: number; autoExpand: boolean; maxNewTasksPerEval: number; reanalysisConfidenceGate: number; } }) {
  return prisma.installationConfig.upsert({
    where: { installationId: BigInt(installationId) },
    create: { id: `inst_${installationId}`, installationId: BigInt(installationId), provider: data.provider, model: data.model, endpoint: data.endpoint, apiKeyHash: data.apiKeyHash, maxTasksPerIter: data.maxTasksPerIter ?? 4, maxTotalIter: data.maxTotalIter ?? 50, adaptiveness: data.adaptiveness ?? { enabled: true, maxPlanExpansions: data.maxPlanExpansions ?? 5, evaluation: data.evaluation } },
    update: { provider: data.provider, model: data.model, endpoint: data.endpoint, apiKeyHash: data.apiKeyHash, maxTasksPerIter: data.maxTasksPerIter ?? 4, maxTotalIter: data.maxTotalIter ?? 50, adaptiveness: data.adaptiveness ?? { enabled: true, maxPlanExpansions: data.maxPlanExpansions ?? 5, evaluation: data.evaluation } }
  });
}
