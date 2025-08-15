import { OpenAIProvider } from "./openaiProvider.js";
import { Provider } from "../types.js";
import { cfg } from "../config.js";

interface ProviderConfig {
  provider: string;
  model: string;
  endpoint?: string;
  apiKeyPlain?: string;
  ghModelsToken?: string;
}

export function buildProvider(pc: ProviderConfig): Provider {
  switch(pc.provider){
    case 'openai':
      return new OpenAIProvider(pc.apiKeyPlain, pc.model);
    case 'mock':
    default:
      return new OpenAIProvider(undefined, pc.model || cfg.defaultModel);
  }
}
