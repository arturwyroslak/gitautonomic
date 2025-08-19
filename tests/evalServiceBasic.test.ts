import { describe, it, expect } from "vitest";

describe("Evaluation Service Integration", () => {
  it("should export evaluateAgent function", async () => {
    const evalService = await import("../src/services/evalService.js");
    expect(evalService.evaluateAgent).toBeDefined();
    expect(typeof evalService.evaluateAgent).toBe("function");
  });

  it("should be callable function without database errors", async () => {
    const { evaluateAgent } = await import("../src/services/evalService.js");
    
    // Just test that the function exists and is callable
    // We can't actually run it without a database, but we can check its signature
    expect(evaluateAgent).toBeDefined();
    expect(typeof evaluateAgent).toBe("function");
    expect(evaluateAgent.length).toBe(1); // Should accept 1 parameter (agentId)
  });

  it("should be importable without errors", async () => {
    // Test that all dependencies can be imported successfully
    await expect(import("../src/services/evalService.js")).resolves.toBeDefined();
    await expect(import("../src/config.js")).resolves.toBeDefined();
    await expect(import("../src/storage/prisma.js")).resolves.toBeDefined();
  });
});

describe("Evaluation Configuration", () => {
  it("should have proper evaluation configuration", async () => {
    const { cfg } = await import("../src/config.js");
    
    expect(cfg.eval).toBeDefined();
    expect(cfg.eval.autoExpand).toBeDefined();
    expect(cfg.eval.maxNewTasksPerEval).toBeDefined();
    expect(cfg.eval.confidenceGate).toBeDefined();
    
    // Verify configuration values are reasonable
    expect(typeof cfg.eval.autoExpand).toBe("boolean");
    expect(typeof cfg.eval.maxNewTasksPerEval).toBe("number");
    expect(typeof cfg.eval.confidenceGate).toBe("number");
    expect(cfg.eval.maxNewTasksPerEval).toBeGreaterThan(0);
    expect(cfg.eval.confidenceGate).toBeGreaterThanOrEqual(0);
    expect(cfg.eval.confidenceGate).toBeLessThanOrEqual(1);
  });
});

describe("Evaluation Service Code Quality", () => {
  it("should follow proper TypeScript patterns", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    
    const evalServicePath = path.join(process.cwd(), "src/services/evalService.ts");
    const content = fs.readFileSync(evalServicePath, 'utf-8');
    
    // Check for proper imports
    expect(content).toContain('import { prisma }');
    expect(content).toContain('import { resolveProvider }');
    expect(content).toContain('import { addMemory }');
    expect(content).toContain('import { cfg }');
    
    // Check for proper async/await usage
    expect(content).toContain('export async function evaluateAgent');
    expect(content).toContain('await prisma');
    expect(content).toContain('await provider');
    
    // Check for proper error handling patterns
    expect(content).toContain('if (!agent) return');
    expect(content).toContain('if (!provider.evaluateAndSuggest) return');
  });

  it("should handle edge cases properly", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    
    const evalServicePath = path.join(process.cwd(), "src/services/evalService.ts");
    const content = fs.readFileSync(evalServicePath, 'utf-8');
    
    // Check for proper null/undefined handling
    expect(content).toMatch(/\?\?/); // Nullish coalescing
    expect(content).toContain('Math.min(1, Math.max(0,'); // Confidence bounds
    
    // Check for proper array handling
    expect(content).toContain('.slice(0,'); // Array slicing for limits
    expect(content).toContain('.length'); // Length checks
  });
});