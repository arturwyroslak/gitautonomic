import { describe, it, expect } from "vitest";
import { ContextWindowManager } from "../src/ai/contextWindowManager.js";
import { ReasoningEngine } from "../src/ai/reasoningEngine.js";
import IntelligentRefactoringEngine from "../src/services/intelligentRefactoringEngine.js";
import MigrationAssistant from "../src/services/migrationAssistant.js";

describe("GitAutonomic Core Services", () => {
  describe("ContextWindowManager", () => {
    it("should estimate tokens correctly", () => {
      const manager = new ContextWindowManager();
      const text = "Hello world";
      const tokens = manager.estimateTokens(text);
      expect(tokens).toBeGreaterThan(0);
    });

    it("should trim text to fit within limits", () => {
      const manager = new ContextWindowManager(100); // Small limit for testing
      const longText = "a".repeat(1000);
      const result = manager.trimToFit("", longText);
      expect(result.truncated).toBe(true);
      expect(result.text.length).toBeLessThan(1000);
    });

    it("should trim files array correctly", () => {
      const manager = new ContextWindowManager();
      const files = [
        { path: "test1.ts", content: "content1" },
        { path: "test2.ts", content: "content2" }
      ];
      const trimmed = manager.trimFiles(files, []);
      expect(trimmed).toHaveLength(2);
      expect(trimmed[0].path).toBe("test1.ts");
    });
  });

  describe("IntelligentRefactoringEngine", () => {
    it("should analyze refactoring opportunities", async () => {
      const engine = new IntelligentRefactoringEngine();
      const opportunities = await engine.analyzeRefactoringOpportunities("/tmp/test-project");
      expect(Array.isArray(opportunities)).toBe(true);
      expect(opportunities.length).toBeGreaterThan(0);
    });

    it("should have valid refactoring opportunity structure", async () => {
      const engine = new IntelligentRefactoringEngine();
      const opportunities = await engine.analyzeRefactoringOpportunities("/tmp/test-project");
      expect(opportunities.length).toBeGreaterThan(0);
      const opp = opportunities[0];
      expect(opp).toHaveProperty("type");
      expect(opp).toHaveProperty("description");
      expect(opp).toHaveProperty("confidence");
      expect(opp.confidence).toBeGreaterThan(0);
      expect(opp.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("MigrationAssistant", () => {
    it("should create migration plan", async () => {
      const assistant = new MigrationAssistant();
      const plan = await assistant.createMigrationPlan("/tmp/test-project", "typescript");
      expect(plan).toHaveProperty("sourceLanguage");
      expect(plan).toHaveProperty("targetLanguage");
      expect(plan.targetLanguage).toBe("typescript");
      expect(Array.isArray(plan.steps)).toBe(true);
    });

    it("should translate simple code", async () => {
      const assistant = new MigrationAssistant();
      const result = await assistant.translateCode(
        "var x = 5;", 
        "javascript", 
        "typescript"
      );
      expect(result).toHaveProperty("translatedCode");
      expect(result).toHaveProperty("idiomaticAdaptations");
      expect(Array.isArray(result.idiomaticAdaptations)).toBe(true);
    });
  });

  describe("ReasoningEngine", () => {
    it("should create reasoning engine with mock model", () => {
      const mockModel = {
        complete: async (prompt: string) => JSON.stringify([{ task: "test" }])
      };
      const mockTools = {
        diff: {
          parse: async (diffText: string) => ({}),
          applyUnified: async (diffText: string) => ({ ok: true })
        }
      };
      const engine = new ReasoningEngine(mockModel, mockTools);
      expect(engine).toBeDefined();
      expect(engine.model).toBeDefined();
      expect(engine.tools).toBeDefined();
    });

    it("should plan with mock model", async () => {
      const mockModel = {
        complete: async (prompt: string) => JSON.stringify([{ task: "test task", id: "1" }])
      };
      const mockTools = {
        diff: {
          parse: async (diffText: string) => ({}),
          applyUnified: async (diffText: string) => ({ ok: true })
        }
      };
      const engine = new ReasoningEngine(mockModel, mockTools);
      const plan = await engine.plan("test objective");
      expect(Array.isArray(plan)).toBe(true);
    });
  });
});
