import { cfg } from "../config.js";
import { PlanTask } from "../types.js";

export function systemTemplate(phase: string) {
  return [
    `You are an autonomous senior multi-stage software engineering agent.`,
    `Phase: ${phase}`,
    `Output MUST follow the requested format exactly.`,
    `Be deterministic, concise, structural; DO NOT add informal commentary.`,
    `Confidence adaptation, risk management, and task dependency integrity are critical.`
  ].join('\n');
}

export function planUserTemplate(params: {
  issueTitle: string;
  issueBody: string;
  repoFiles: string[];
  historical: any;
  strategic: string[];
}) {
  return [
    `ISSUE TITLE: ${params.issueTitle}`,
    `ISSUE BODY:\n${params.issueBody}`,
    `HISTORICAL: ${JSON.stringify(params.historical).slice(0,800)}`,
    params.strategic.length ? `STRATEGIC_MEMORY:\n${params.strategic.join('\n')}` : '',
    `REPO FILE SAMPLE (${params.repoFiles.length}):`,
    params.repoFiles.slice(0, 120).join('\n'),
    `FORMAT STRICT:`,
    `${cfg.planMarkers.start}`,
    `tasks:`,
    `  - id: T1`,
    `    title: ...`,
    `    type: code|test|doc|refactor|migration`,
    `    paths: [file.ts]`,
    `    acceptance: "objective"`,
    `    riskScore: 0.0-1.0`,
    `    dependsOn: []`,
    `dependencies: []`,
    `migrations: []`,
    `${cfg.planMarkers.end}`
  ].join('\n');
}

export function patchSystem() {
  return systemTemplate('execution') + '\nReturn ONLY valid unified diffs or NO_CHANGES.';
}

export function patchUser(params: {
  tasks: PlanTask[];
  trimmedFiles: { path: string; content: string }[];
  reasoning?: string;
  iteration: number;
  confidence: number;
}) {
  const taskLines = params.tasks.map(t =>
    `${t.id} (${t.type}) risk=${t.riskScore ?? 0} priority=${t.priorityScore ?? 0} :: ${t.title} -> ${t.paths.join(',')}`
  ).join('\n');

  const filesStr = params.trimmedFiles.map(f =>
    `FILE: ${f.path}\n${f.content.slice(0,2500)}`
  ).join('\n\n');

  return [
    `ITERATION: ${params.iteration} CONFIDENCE=${params.confidence.toFixed(2)}`,
    params.reasoning ? `REASONING_BUNDLE:\n${params.reasoning}` : '',
    `TASKS:\n${taskLines}`,
    `FILES:\n${filesStr}`,
    `REQUIREMENTS: Provide ONLY unified diff or NO_CHANGES if no modifications required.`
  ].join('\n');
}
