export interface AIToolContext {
  register(name: string, tool: any): void;
  get<T=any>(name: string): T | undefined;
  list(): string[];
}

export class PluginRegistry implements AIToolContext {
  private tools = new Map<string, any>();
  register(name: string, tool: any) {
    if (this.tools.has(name)) throw new Error(`Tool already registered: ${name}`);
    this.tools.set(name, tool);
  }
  replace(name: string, tool: any) {
    this.tools.set(name, tool);
  }
  get<T=any>(name: string): T | undefined {
    return this.tools.get(name);
  }
  require<T=any>(name: string): T {
    const v = this.get<T>(name);
    if (!v) throw new Error(`Missing tool: ${name}`);
    return v;
  }
  list(): string[] {
    return Array.from(this.tools.keys()).sort();
  }
}

export interface Plugin {
  name: string;
  init(registry: PluginRegistry): Promise<void> | void;
  dispose?(): Promise<void> | void;
}

export class PluginHost {
  private registry: PluginRegistry;
  private plugins: Plugin[] = [];
  constructor(registry = new PluginRegistry()) { this.registry = registry; }
  async use(plugin: Plugin) {
    await plugin.init(this.registry);
    this.plugins.push(plugin);
  }
  async shutdown() {
    for (const p of [...this.plugins].reverse()) {
      if (p.dispose) await p.dispose();
    }
  }
  context() { return this.registry; }
}

export default { PluginRegistry, PluginHost };