import { Provider, ProviderPlanContext, ProviderPatchContext, ProviderEvaluationContext, ProviderEvaluationResult, ProviderExplodeContext, ExplodeResult } from "../types.js";

export abstract class BaseProvider implements Provider {
  abstract name(): string;
  abstract generatePlan(ctx: ProviderPlanContext): Promise<string>;
  abstract generatePatch(ctx: ProviderPatchContext): Promise<{ diff: string; noChanges?: boolean }>; 
  evaluateAndSuggest?(ctx: ProviderEvaluationContext): Promise<ProviderEvaluationResult>;
  explodeTask?(ctx: ProviderExplodeContext): Promise<ExplodeResult>;

  protected sanitizeModelOutput(txt: string): string {
    return txt.replace(/```(?:diff|patch)?/g, '');
  }
}
