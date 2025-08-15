# Architecture Overview

```mermaid
flowchart TD
  A[CLI] --> B[Bootstrap]
  B --> C[ReasoningEngine]
  C --> D[Plugins / Tools]
  D --> E[Git / Workspace]
  C --> F[AutoOrchestrator]
  F --> G[Patch Refinement]
  F --> H[Diff Optimization Strategy]
```

## Modules
- AutoOrchestrator: High-level loop plan -> execute -> refine
- PluginRegistry: Dynamic tool & step handler injection
- Strategies: Extensible reasoning enhancements
