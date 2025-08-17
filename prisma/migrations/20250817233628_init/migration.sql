-- CreateTable
CREATE TABLE "InstallationConfig" (
    "id" TEXT NOT NULL,
    "installationId" BIGINT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "endpoint" TEXT,
    "apiKeyHash" TEXT,
    "maxTasksPerIter" INTEGER NOT NULL DEFAULT 4,
    "maxTotalIter" INTEGER NOT NULL DEFAULT 50,
    "adaptiveness" JSONB NOT NULL DEFAULT '{"enabled":true}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueAgent" (
    "id" TEXT NOT NULL,
    "installationId" BIGINT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "issueNumber" INTEGER NOT NULL,
    "issueTitle" TEXT NOT NULL,
    "issueBodyHash" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "prNumber" INTEGER,
    "planCommitSha" TEXT,
    "planVersion" INTEGER NOT NULL DEFAULT 1,
    "planHash" TEXT,
    "expansions" INTEGER NOT NULL DEFAULT 0,
    "totalTasks" INTEGER NOT NULL DEFAULT 0,
    "doneTasks" INTEGER NOT NULL DEFAULT 0,
    "iterations" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "phase" TEXT NOT NULL DEFAULT 'executing',
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "lastIterAt" TIMESTAMP(3),
    "lastEvalAt" TIMESTAMP(3),
    "coverageLines" DOUBLE PRECISION,
    "coverageStmts" DOUBLE PRECISION,
    "coverageBranches" DOUBLE PRECISION,
    "coverageFuncs" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssueAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "issueAgentId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "parentExternalId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "paths" TEXT[],
    "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "origin" TEXT NOT NULL DEFAULT 'initial',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "acceptance" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "generatedAtIteration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Iteration" (
    "id" TEXT NOT NULL,
    "issueAgentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "executedTasks" TEXT[],
    "commitSha" TEXT,
    "success" BOOLEAN NOT NULL,
    "deltaConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Iteration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueEmbedding" (
    "id" TEXT NOT NULL,
    "issueAgentId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "referenceId" TEXT,
    "vector" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileEmbedding" (
    "id" TEXT NOT NULL,
    "installationId" BIGINT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "blobSha" TEXT NOT NULL,
    "vector" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMemory" (
    "id" TEXT NOT NULL,
    "issueAgentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "vectorRef" TEXT,
    "content" JSONB NOT NULL,
    "salience" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "decayFactor" DOUBLE PRECISION NOT NULL DEFAULT 0.98,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReasoningTrace" (
    "id" TEXT NOT NULL,
    "issueAgentId" TEXT NOT NULL,
    "iteration" INTEGER NOT NULL,
    "phase" TEXT NOT NULL,
    "tokens" INTEGER,
    "score" DOUBLE PRECISION,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReasoningTrace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatchLog" (
    "id" TEXT NOT NULL,
    "issueAgentId" TEXT NOT NULL,
    "iteration" INTEGER NOT NULL,
    "tasks" TEXT[],
    "diffHash" TEXT NOT NULL,
    "diffPreview" TEXT NOT NULL,
    "fileStats" JSONB NOT NULL,
    "applied" BOOLEAN NOT NULL,
    "commitSha" TEXT,
    "validation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatchLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstallationConfig_installationId_key" ON "InstallationConfig"("installationId");

-- CreateIndex
CREATE INDEX "IssueAgent_installationId_owner_repo_issueNumber_idx" ON "IssueAgent"("installationId", "owner", "repo", "issueNumber");

-- CreateIndex
CREATE INDEX "Task_issueAgentId_status_idx" ON "Task"("issueAgentId", "status");

-- CreateIndex
CREATE INDEX "Task_issueAgentId_parentExternalId_idx" ON "Task"("issueAgentId", "parentExternalId");

-- CreateIndex
CREATE INDEX "Iteration_issueAgentId_number_idx" ON "Iteration"("issueAgentId", "number");

-- CreateIndex
CREATE INDEX "IssueEmbedding_issueAgentId_scope_idx" ON "IssueEmbedding"("issueAgentId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "FileEmbedding_installationId_owner_repo_path_key" ON "FileEmbedding"("installationId", "owner", "repo", "path");

-- CreateIndex
CREATE INDEX "FileEmbedding_installationId_owner_repo_idx" ON "FileEmbedding"("installationId", "owner", "repo");

-- CreateIndex
CREATE INDEX "AgentMemory_issueAgentId_type_idx" ON "AgentMemory"("issueAgentId", "type");

-- CreateIndex
CREATE INDEX "AgentMemory_issueAgentId_salience_idx" ON "AgentMemory"("issueAgentId", "salience");

-- CreateIndex
CREATE INDEX "ReasoningTrace_issueAgentId_iteration_idx" ON "ReasoningTrace"("issueAgentId", "iteration");

-- CreateIndex
CREATE INDEX "PatchLog_issueAgentId_iteration_idx" ON "PatchLog"("issueAgentId", "iteration");

-- CreateIndex
CREATE INDEX "PatchLog_issueAgentId_diffHash_idx" ON "PatchLog"("issueAgentId", "diffHash");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_issueAgentId_fkey" FOREIGN KEY ("issueAgentId") REFERENCES "IssueAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Iteration" ADD CONSTRAINT "Iteration_issueAgentId_fkey" FOREIGN KEY ("issueAgentId") REFERENCES "IssueAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueEmbedding" ADD CONSTRAINT "IssueEmbedding_issueAgentId_fkey" FOREIGN KEY ("issueAgentId") REFERENCES "IssueAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMemory" ADD CONSTRAINT "AgentMemory_issueAgentId_fkey" FOREIGN KEY ("issueAgentId") REFERENCES "IssueAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReasoningTrace" ADD CONSTRAINT "ReasoningTrace_issueAgentId_fkey" FOREIGN KEY ("issueAgentId") REFERENCES "IssueAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatchLog" ADD CONSTRAINT "PatchLog_issueAgentId_fkey" FOREIGN KEY ("issueAgentId") REFERENCES "IssueAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;