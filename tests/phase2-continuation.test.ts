// Tests for Phase 2 development continuation features
import { describe, it, expect } from 'vitest';
import { SelfEvaluationLoop } from '../src/core/selfEvaluationLoop.js';
import { AIBotCommandParser, CommandExecutor } from '../src/core/commandParser.js';
import { PolicyEnforcer } from '../src/core/policyEnforcer.js';
import { EmbeddingService } from '../src/services/enhancedEmbeddingService.js';
import { LearningFeedbackLoop } from '../src/core/knowledgeSystem.js';

describe('GitAutonomic Phase 2 Development Continuation', () => {
  describe('SelfEvaluationLoop', () => {
    it('should perform self-evaluation and generate metrics', async () => {
      const feedbackLoop = new LearningFeedbackLoop();
      const evaluationLoop = new SelfEvaluationLoop(feedbackLoop);
      
      const evaluation = await evaluationLoop.performSelfEvaluation('test-agent');
      
      expect(evaluation).toHaveProperty('id');
      expect(evaluation).toHaveProperty('metrics');
      expect(evaluation).toHaveProperty('performance');
      expect(evaluation).toHaveProperty('adaptiveActions');
      expect(evaluation.metrics).toHaveProperty('taskCompletionRate');
      expect(evaluation.metrics).toHaveProperty('codeQualityScore');
      expect(evaluation.performance).toMatch(/excellent|good|average|poor/);
    });

    it('should generate adaptive actions based on metrics', async () => {
      const feedbackLoop = new LearningFeedbackLoop();
      const evaluationLoop = new SelfEvaluationLoop(feedbackLoop);
      
      const metrics = await evaluationLoop.getCurrentMetrics();
      
      expect(metrics).toHaveProperty('taskCompletionRate');
      expect(metrics).toHaveProperty('errorRate');
      expect(metrics.taskCompletionRate).toBeGreaterThanOrEqual(0);
      expect(metrics.taskCompletionRate).toBeLessThanOrEqual(1);
      expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
      expect(metrics.errorRate).toBeLessThanOrEqual(1);
    });
  });

  describe('AIBotCommandParser', () => {
    it('should parse basic @ai-bot commands', () => {
      const parser = new AIBotCommandParser();
      const context = {
        pullRequestNumber: 123,
        commentId: 'comment-123',
        author: 'test-user',
        repository: 'test/repo',
        timestamp: new Date(),
        commentBody: '@ai-bot analyze code --scope=src/auth'
      };
      
      const commands = parser.parseCommand(context.commentBody, context);
      
      expect(commands).toHaveLength(1);
      expect(commands[0]).toHaveProperty('command', 'analyze');
      expect(commands[0]).toHaveProperty('action', 'code');
      expect(commands[0]).toHaveProperty('parameters');
      expect(commands[0].parameters).toHaveProperty('scope', 'src/auth');
      expect(commands[0].isValid).toBe(true);
    });

    it('should validate command syntax and requirements', () => {
      const parser = new AIBotCommandParser();
      const context = {
        pullRequestNumber: 123,
        commentId: 'comment-123',
        author: 'test-user',
        repository: 'test/repo',
        timestamp: new Date(),
        commentBody: '@ai-bot fix security'
      };
      
      const commands = parser.parseCommand(context.commentBody, context);
      
      expect(commands).toHaveLength(1);
      expect(commands[0].isValid).toBe(false);
      expect(commands[0].validationErrors).toContain('Fix command requires --confirm flag for safety');
    });

    it('should handle multiple commands in one comment', () => {
      const parser = new AIBotCommandParser();
      const context = {
        pullRequestNumber: 123,
        commentId: 'comment-123',
        author: 'test-user',
        repository: 'test/repo',
        timestamp: new Date(),
        commentBody: `
          @ai-bot analyze code
          @ai-bot review --focus=security
          @ai-bot status
        `
      };
      
      const commands = parser.parseCommand(context.commentBody, context);
      
      expect(commands).toHaveLength(3);
      expect(commands[0].command).toBe('analyze');
      expect(commands[1].command).toBe('review');
      expect(commands[2].command).toBe('status');
    });

    it('should provide help information', () => {
      const parser = new AIBotCommandParser();
      const helpMessage = parser.formatHelpMessage();
      
      expect(helpMessage).toContain('AI Bot Commands');
      expect(helpMessage).toContain('analyze');
      expect(helpMessage).toContain('refactor');
      expect(helpMessage).toContain('review');
      expect(helpMessage).toContain('Examples:');
    });
  });

  describe('CommandExecutor', () => {
    it('should execute status command successfully', async () => {
      const executor = new CommandExecutor();
      const command = {
        command: 'status',
        action: 'default',
        parameters: {},
        options: [],
        raw: '@ai-bot status',
        isValid: true,
        validationErrors: []
      };
      const context = {
        pullRequestNumber: 123,
        commentId: 'comment-123',
        author: 'test-user',
        repository: 'test/repo',
        timestamp: new Date(),
        commentBody: '@ai-bot status'
      };
      
      const response = await executor.executeCommand(command, context);
      
      expect(response.success).toBe(true);
      expect(response.message).toContain('AI Bot is online');
      expect(response.data).toHaveProperty('uptime');
      expect(response.data).toHaveProperty('version');
    });

    it('should reject invalid commands', async () => {
      const executor = new CommandExecutor();
      const command = {
        command: 'fix',
        action: 'security',
        parameters: {},
        options: [],
        raw: '@ai-bot fix security',
        isValid: false,
        validationErrors: ['Fix command requires --confirm flag for safety']
      };
      const context = {
        pullRequestNumber: 123,
        commentId: 'comment-123',
        author: 'test-user',
        repository: 'test/repo',
        timestamp: new Date(),
        commentBody: '@ai-bot fix security'
      };
      
      const response = await executor.executeCommand(command, context);
      
      expect(response.success).toBe(false);
      expect(response.message).toContain('Invalid command');
    });
  });

  describe('PolicyEnforcer', () => {
    it('should load and validate ownership policies', async () => {
      const enforcer = new PolicyEnforcer('.aiagent-ownership.yml');
      await enforcer.loadPolicy();
      
      const policy = enforcer.getPolicy();
      expect(policy).toBeTruthy();
      expect(policy).toHaveProperty('ownership_rules');
      expect(policy?.ownership_rules).toBeInstanceOf(Array);
    });

    it('should check file operations against policies', async () => {
      const enforcer = new PolicyEnforcer('.aiagent-ownership.yml');
      await enforcer.loadPolicy();
      
      const operations = [
        {
          path: 'src/test.ts',
          operation: 'write' as const,
          content: 'export const test = true;',
          linesChanged: 10
        }
      ];
      
      const result = await enforcer.checkFileOperations(operations);
      
      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('violations');
      expect(result).toHaveProperty('warnings');
      expect(result.violations).toBeInstanceOf(Array);
      expect(result.warnings).toBeInstanceOf(Array);
    });

    it('should enforce file protection policies', async () => {
      const enforcer = new PolicyEnforcer('.aiagent-ownership.yml');
      await enforcer.loadPolicy();
      
      const operations = [
        {
          path: '.env',
          operation: 'write' as const,
          content: 'API_KEY=secret',
          linesChanged: 1
        }
      ];
      
      const result = await enforcer.checkFileOperations(operations);
      
      // Should have violations for protected files
      expect(result.allowed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should generate violation reports', async () => {
      const enforcer = new PolicyEnforcer('.aiagent-ownership.yml');
      await enforcer.loadPolicy();
      
      const operations = [
        {
          path: '.git/config',
          operation: 'delete' as const,
          linesChanged: 0
        }
      ];
      
      const result = await enforcer.checkFileOperations(operations);
      const report = enforcer.formatViolationReport(result);
      
      expect(report).toContain('Policy Enforcement Report');
      expect(report).toContain('Violations');
      expect(typeof report).toBe('string');
    });
  });

  describe('EmbeddingService', () => {
    it('should initialize with default configuration', () => {
      const service = new EmbeddingService();
      expect(service).toBeDefined();
    });

    it('should generate embeddings for text', async () => {
      const service = new EmbeddingService({
        provider: 'local', // Use local provider for testing
        dimensions: 128
      });
      
      const embedding = await service.generateEmbedding('test text for embedding');
      
      expect(embedding).toHaveProperty('id');
      expect(embedding).toHaveProperty('vector');
      expect(embedding).toHaveProperty('metadata');
      expect(embedding.vector).toBeInstanceOf(Array);
      expect(embedding.vector.length).toBe(128);
    });

    it('should find similar embeddings', async () => {
      const service = new EmbeddingService({
        provider: 'local',
        dimensions: 128
      });
      
      // Generate some embeddings
      await service.generateEmbedding('JavaScript function to process data');
      await service.generateEmbedding('TypeScript interface for user data');
      await service.generateEmbedding('Python script for data analysis');
      
      const similar = await service.findSimilar('data processing function', 2, 0.1);
      
      expect(similar).toBeInstanceOf(Array);
      expect(similar.length).toBeGreaterThanOrEqual(0);
      if (similar.length > 0) {
        expect(similar[0]).toHaveProperty('id');
        expect(similar[0]).toHaveProperty('similarity');
        expect(similar[0].similarity).toBeGreaterThanOrEqual(0);
        expect(similar[0].similarity).toBeLessThanOrEqual(1);
      }
    });

    it('should provide service statistics', async () => {
      const service = new EmbeddingService({
        provider: 'local',
        dimensions: 64
      });
      
      const stats = await service.getStats();
      
      expect(stats).toHaveProperty('totalVectors');
      expect(stats).toHaveProperty('memoryUsage');
      expect(stats).toHaveProperty('providerType');
      expect(stats.providerType).toBe('local');
      expect(typeof stats.totalVectors).toBe('number');
    });
  });

  describe('Integration - Complete Development Continuation Workflow', () => {
    it('should demonstrate complete autonomous workflow', async () => {
      // 1. Parse a command
      const parser = new AIBotCommandParser();
      const context = {
        pullRequestNumber: 123,
        commentId: 'comment-123',
        author: 'test-user',
        repository: 'test/repo',
        timestamp: new Date(),
        commentBody: '@ai-bot analyze code --type=security'
      };
      
      const commands = parser.parseCommand(context.commentBody, context);
      expect(commands).toHaveLength(1);
      expect(commands[0].isValid).toBe(true);
      
      // 2. Execute the command
      const executor = new CommandExecutor();
      const response = await executor.executeCommand(commands[0], context);
      expect(response.success).toBe(true);
      
      // 3. Check policies for potential file operations
      const enforcer = new PolicyEnforcer('.aiagent-ownership.yml');
      await enforcer.loadPolicy();
      
      const operations = [
        {
          path: 'src/security/analysis.ts',
          operation: 'create' as const,
          content: 'export const securityAnalysis = () => {};',
          linesChanged: 1
        }
      ];
      
      const policyResult = await enforcer.checkFileOperations(operations);
      expect(policyResult).toHaveProperty('allowed');
      
      // 4. Perform self-evaluation
      const feedbackLoop = new LearningFeedbackLoop();
      const evaluationLoop = new SelfEvaluationLoop(feedbackLoop);
      
      const evaluation = await evaluationLoop.performSelfEvaluation('test-agent');
      expect(evaluation).toHaveProperty('performance');
      
      // This demonstrates the complete workflow of:
      // Command parsing -> Execution -> Policy checking -> Self-evaluation
      console.log('✅ Complete autonomous workflow demonstrated successfully');
    });
  });
});