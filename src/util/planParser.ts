import yaml from 'yaml';
import { PlanTask } from "../types.js";
import { cfg } from "../config.js";

export function extractPlanTasks(planContent: string): PlanTask[] {
  const start = planContent.indexOf(cfg.planMarkers.start);
  const end = planContent.indexOf(cfg.planMarkers.end);
  if (start === -1 || end === -1) return [];
  const block = planContent.slice(start + cfg.planMarkers.start.length, end);
  let doc: any;
  try { doc = yaml.parse(block); } catch { return []; }
  if (!doc || !Array.isArray(doc.tasks)) return [];
  return doc.tasks.map((t: any, idx: number) => ({
    id: String(t.id ?? `T${idx+1}`),
    title: t.title || 'Untitled',
    type: t.type || 'code',
    paths: Array.isArray(t.paths) ? t.paths : [],
    acceptance: t.acceptance,
    riskScore: typeof t.riskScore === 'number' ? t.riskScore : 0.3,
    dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn : []
  }));
}
