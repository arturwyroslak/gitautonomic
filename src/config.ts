import 'dotenv/config';

export const cfg = {
  appId: process.env.GITHUB_APP_ID!,
  privateKey: (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\\n'),
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET!,
  dbUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL!,
  openaiKey: process.env.OPENAI_API_KEY,
  customEndpoint: process.env.CUSTOM_LLM_ENDPOINT,
  customKey: process.env.CUSTOM_LLM_API_KEY,
  embeddingsModel: process.env.EMBEDDINGS_MODEL || 'text-embedding-3-small',
  defaultModel: 'gpt-4o-mini',

  maxPlanTokens: 2200,
  execTokens: 2400,

  planMarkers: { start: '<!-- TASKS-STRUCTURED -->', end: '<!-- /TASKS-STRUCTURED -->' },

  adaptive: {
    confidenceIncreasePerSuccess: 0.07,
    confidenceDecreaseOnFail: 0.1,
    minBatch: 1,
    maxBatch: 12,
    dynamicRiskWeight: 0.35,
    exploitationBias: 0.55
  },

  termination: {
    requiredConfidence: 0.94,
    maxIdleIterations: 4
  },

  diff: {
    maxBytes: 64000,
    maxDeletesRatio: 0.45,
    maxFilePctChangeMinor: 0.35,   // powyżej tego procentu zmian jeśli task ma niskie ryzyko -> dodatkowa walidacja
    largeFileLineThreshold: 800,
    maxTotalFilesPerIter: 24
  },

  risk: {
    highThreshold: parseFloat(process.env.RISK_HIGH_THRESHOLD || '0.7'),
    escalateThreshold: 0.85
  },

  coverage: {
    minLines: parseFloat(process.env.COVERAGE_MIN_LINES || '0.75'),
    targetLines: 0.82
  },
  security: {
    maxHighSeverityIssues: 5,
    semgrepEnabled: true,
    banditEnabled: true,
    eslintSecurityEnabled: true
  },

  workspace: {
    tempRoot: process.env.AGENT_WORK_ROOT || '/tmp/ai-agent-work'
  },

  semgrep: {
    configPath: '.semgrep.yml',
    failOnSeverity: 'ERROR'
  },

  memory: {
    maxStrategic: 24,
    maxTechnical: 120,
    compressionEvery: 5,
    minSalienceForRetention: 0.42,
    decayIntervalMs: 1000 * 60 * 30
  },

  reasoning: {
    traceEnabled: true,
    keepLastPerPhase: 6,
    metaRefineEvery: 3
  },

  eval: {
    autoExpand: true,
    maxNewTasksPerEval: 4,
    confidenceGate: 0.55
  },

  git: {
    defaultBase: 'main',
    commitAuthorName: 'AI Agent',
    commitAuthorEmail: 'ai-agent@example.local',
    pullRequestTitlePrefix: 'AI Agent:',
    autoPRCreate: true
  },

  patch: {
    enableRefineForLarge: true,
    largePatchLineThreshold: 400,
    refineTemperature: 0.1
  }
};
