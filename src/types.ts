export interface PlanTask { id: string; title: string; type: string; paths: string[]; acceptance?: string; riskScore?: number; dependsOn?: string[]; }
export interface ProviderPlanContext { issueTitle: string; issueBody: string; repoFiles: string[]; historicalSignals: { previousPlanExists: boolean; iterations: number; doneTasks: number; totalTasks: number; }; }
export interface ProviderPatchContext { tasks: PlanTask[]; repoSnapshotFiles: { path: string; content: string }[]; guidance: { iteration: number; confidence: number; maxTasksAllowed: number; }; }
export interface ProviderEvaluationContext { issueTitle: string; issueBody: string; currentTasks: PlanTask[]; completedTaskIds: string[]; repoFiles: string[]; recentCommitsMeta: string[]; planVersion: number; }
export interface ProviderEvaluationResult { coverageScore: number; confidenceAdjustment?: number; newTasks?: PlanTask[]; rationale: string; stopRecommended: boolean; }
export interface ProviderExplodeContext { task: PlanTask; repoSnippet: string; }
export interface ExplodeResult { subtasks: PlanTask[]; rationale: string; }
export interface Provider { name(): string; generatePlan(ctx: ProviderPlanContext): Promise<string>; generatePatch(ctx: ProviderPatchContext): Promise<{ diff: string; noChanges?: boolean }>; evaluateAndSuggest?(ctx: ProviderEvaluationContext): Promise<ProviderEvaluationResult>; explodeTask?(ctx: ProviderExplodeContext): Promise<ExplodeResult>; }
