import { ReasoningEngine } from '../ai/reasoningEngine.js';
import { PluginHost, PluginRegistry } from '../ai/pluginRegistry.js';
import { parseUnifiedDiff } from '../git/diffParser.js';
import { applyUnifiedDiff } from '../git/diffApplier.js';
import { WorkspaceManager } from '../git/workspaceManager.js';

export interface BootstrapDeps {
  model: {
    complete(prompt: string, opts?: { temperature?: number; maxTokens?: number }): Promise<string>;
  };
  workspaceRoot?: string;
}

export function bootstrap(deps: BootstrapDeps) {
  const registry = new PluginRegistry();
  const workspace = new WorkspaceManager(deps.workspaceRoot);
  const tools = {
    diff: {
      parse: async (t: string) => parseUnifiedDiff(t),
      applyUnified: async (d: string, _opts?: any) => applyUnifiedDiff(d, workspace, _opts)
    },
    fs: {
      read: (p: string) => workspace.readFile(p),
      write: (p: string, c: string) => workspace.writeFile(p, c)
    }
  };
  const engine = new ReasoningEngine(deps.model as any, tools as any);
  const host = new PluginHost(registry);
  registry.register('workspace', workspace);
  registry.register('engine', engine);
  return { engine, host, registry, workspace };
}

export default { bootstrap };
