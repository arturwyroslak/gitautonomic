import { buildProvider } from "../providers/providerFactory.js";
import { cfg } from "../config.js";
import { getInstallationConfig } from "./configService.js";

export async function resolveProvider(installationId: number) {
  const ic = await getInstallationConfig(installationId);
  const provider = ic?.provider || (cfg.openaiKey ? 'openai' : 'mock');
  const config = { provider, model: ic?.model || cfg.defaultModel, endpoint: ic?.endpoint || undefined, apiKeyPlain: (provider==='openai') ? cfg.openaiKey : undefined, ghModelsToken: undefined };
  return buildProvider(config);
}
