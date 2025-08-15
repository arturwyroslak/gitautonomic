export interface PromptTemplateMap { [key: string]: string; }

export const promptTemplates: PromptTemplateMap = {
  patch_refine: `You are an AI patch refinement assistant. The current unified diff has validation issues: {{reasons}}. Produce an improved unified diff ONLY. Do not add commentary.\n\nCurrent diff:\n{{diff}}\n\nReturn ONLY the corrected unified diff starting with diff --git.`,
  reasoning_step: `You are an internal reasoning module. Task: {{task}}\nContext:\n{{context}}\nConstraints: {{constraints}}\nRespond with structured JSON: {"thought":"...","actions":[...]}.` ,
  task_plan: `Create a concise ordered JSON array of steps to accomplish: {{objective}}. Limit steps to {{maxSteps}}. Each step: {"id":"n","title":"...","rationale":"..."}. Only output JSON.`
};

export function renderTemplate(name: string, vars: Record<string, any>): string {
  let tpl = promptTemplates[name];
  if (!tpl) throw new Error(`Missing prompt template: ${name}`);
  for (const [k,v] of Object.entries(vars)) {
    tpl = tpl.replaceAll(`{{${k}}}`, String(v));
  }
  return tpl;
}

export default { promptTemplates, renderTemplate };