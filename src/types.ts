export interface PlanTask {
  id: string;
  title: string;
  type: string;
  paths: string[];
  acceptance?: string;
  riskScore?: number;
  dependsOn?: string[];
  priorityScore?: number;
}

export interface HistoricalSignals {
  previousPlanExists: boolean;
  iterations: number;
  doneTasks: number;
  totalTasks: number;
  avgTaskLatencyMs?: number;
  confidence?: number;
  recentFailures?: number;
}

export interface ProviderPlanContext {
  issueTitle: string;
  issueBody: string;
  repoFiles: string[];
  historicalSignals: HistoricalSignals;
  strategicMemories?: string[];
}

export interface ProviderPatchContext {
  tasks: PlanTask[];
  repoSnapshotFiles: { path: string; content: string }[];
  guidance: {
    iteration: number;
    confidence: number;
    maxTasksAllowed: number;
    strategicHints?: string[];
  };
  reasoningChain?: string[];
}

export interface ProviderEvaluationContext {
  issueTitle: string;
  issueBody: string;
  currentTasks: PlanTask[];
  completedTaskIds: string[];
  repoFiles: string[];
  recentCommitsMeta: string[];
  planVersion: number;
  reasoningSummaries?: string[];
}

export interface ProviderEvaluationResult {
  coverageScore: number;
  confidenceAdjustment?: number;
  newTasks?: PlanTask[];
  rationale: string;
  stopRecommended: boolean;
  riskAlerts?: string[];
}

export interface ProviderExplodeContext {
  task: PlanTask;
  repoSnippet: string;
  strategicMemories?: string[];
}

export interface ExplodeResult {
  subtasks: PlanTask[];
  rationale: string;
}

export interface ReasoningTrace {
  phase: string;
  steps: { thought: string; evidence?: string; decision?: string }[];
  summary: string;
}

export interface Provider {
  name(): string;
  generatePlan(ctx: ProviderPlanContext): Promise<string>;
  generatePatch(ctx: ProviderPatchContext): Promise<{ diff: string; noChanges?: boolean; trace?: ReasoningTrace }>;
  evaluateAndSuggest?(ctx: ProviderEvaluationContext): Promise<ProviderEvaluationResult>;
  explodeTask?(ctx: ProviderExplodeContext): Promise<ExplodeResult>;
  metaRefinePrompt?(rawPrompt: string, phase: string): Promise<string>;
}

/* Patch / diff domain */
export interface ParsedDiffFile {
  oldPath: string | null;
  newPath: string | null;
  isNew: boolean;
  isDeleted: boolean;
  isRename: boolean;
  hunks: DiffHunk[];
  added: number;
  deleted: number;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface ParsedDiff {
  files: ParsedDiffFile[];
  totalAdded: number;
  totalDeleted: number;
}

export interface PatchValidationResult {
  ok: boolean;
  reasons: string[];
  fileStats: {
    added: number;
    deleted: number;
    modified: number;
    created: number;
    deletedFiles: number;
    renamed: number;
    largeFileTouches: string[];
  };
}

export interface ApplyPatchOutcome {
  applied: boolean;
  failedFiles: string[];
  commitSha?: string;
  validation: PatchValidationResult;
}
