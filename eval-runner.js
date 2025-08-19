#!/usr/bin/env node
import 'dotenv/config';
import { evaluateAgent } from './src/services/evalService.js';
import { prisma } from './src/storage/prisma.js';
import { cfg } from './src/config.js';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * GitAutonomic Evaluation Script Runner
 * For Computer Science Class Assignment
 * 
 * This script demonstrates the evaluation system for the autonomous AI agent.
 * It can run evaluations on existing agents or create mock evaluations for testing.
 */

async function displaySystemInfo() {
  console.log('='.repeat(60));
  console.log('🤖 GitAutonomic Evaluation Script');
  console.log('   Computer Science Class Assignment');
  console.log('='.repeat(60));
  console.log();
  
  console.log('📊 System Configuration:');
  console.log(`   Auto Expand Tasks: ${cfg.eval.autoExpand}`);
  console.log(`   Max New Tasks/Eval: ${cfg.eval.maxNewTasksPerEval}`);
  console.log(`   Confidence Gate: ${cfg.eval.confidenceGate}`);
  console.log(`   Risk High Threshold: ${cfg.risk.highThreshold}`);
  console.log(`   Coverage Min Lines: ${cfg.coverage.minLines}`);
  console.log();
}

async function listAvailableAgents() {
  try {
    const agents = await prisma.issueAgent.findMany({
      select: {
        id: true,
        issueTitle: true,
        confidence: true,
        phase: true,
        totalTasks: true,
        lastEvalAt: true,
        _count: {
          select: {
            tasks: true
          }
        }
      },
      take: 10
    });

    if (agents.length === 0) {
      console.log('🔍 No agents found in database');
      console.log('   To test the evaluation system, you can:');
      console.log('   1. Create a GitHub issue in a repository with the GitAutonomic app installed');
      console.log('   2. Or run the mock evaluation demo below');
      return [];
    }

    console.log('🤖 Available Agents:');
    console.log('─'.repeat(80));
    console.log('ID'.padEnd(20) + 'Title'.padEnd(30) + 'Confidence'.padEnd(12) + 'Phase'.padEnd(12) + 'Tasks');
    console.log('─'.repeat(80));
    
    agents.forEach(agent => {
      const id = agent.id.substring(0, 18) + '...';
      const title = agent.issueTitle.substring(0, 28) + '...';
      const confidence = (agent.confidence * 100).toFixed(1) + '%';
      const tasks = `${agent._count.tasks}/${agent.totalTasks}`;
      
      console.log(id.padEnd(20) + title.padEnd(30) + confidence.padEnd(12) + agent.phase.padEnd(12) + tasks);
    });
    console.log();
    
    return agents;
  } catch (error) {
    log.error({ error: String(error) }, 'Failed to list agents');
    console.log('❌ Database connection failed. Make sure PostgreSQL is running.');
    return [];
  }
}

async function runMockEvaluation() {
  console.log('🧪 Running Mock Evaluation Demo');
  console.log('─'.repeat(40));
  
  // Simulate the evaluation process without database
  const mockAgent = {
    id: 'demo-agent-123',
    issueTitle: 'Implement user authentication system',
    confidence: 0.75,
    totalTasks: 3,
    tasks: [
      { id: 'task-1', title: 'Design login UI', status: 'done', riskScore: 0.2 },
      { id: 'task-2', title: 'Implement backend auth', status: 'pending', riskScore: 0.6 },
      { id: 'task-3', title: 'Add unit tests', status: 'pending', riskScore: 0.3 }
    ]
  };

  const mockEvalResult = {
    coverageScore: 0.82,
    rationale: 'Good progress on UI implementation. Backend authentication needs attention due to security considerations. Testing coverage is adequate.',
    confidenceAdjustment: 0.05,
    stopRecommended: false,
    newTasks: [
      {
        id: 'task-4',
        title: 'Add password encryption',
        type: 'security',
        riskScore: 0.7,
        priority: 'high'
      },
      {
        id: 'task-5', 
        title: 'Implement session management',
        type: 'backend',
        riskScore: 0.5,
        priority: 'medium'
      }
    ]
  };

  console.log('📝 Agent Information:');
  console.log(`   ID: ${mockAgent.id}`);
  console.log(`   Issue: ${mockAgent.issueTitle}`);
  console.log(`   Current Confidence: ${(mockAgent.confidence * 100).toFixed(1)}%`);
  console.log(`   Total Tasks: ${mockAgent.totalTasks}`);
  console.log();

  console.log('📋 Current Tasks:');
  mockAgent.tasks.forEach((task, i) => {
    const status = task.status === 'done' ? '✅' : '⏳';
    const risk = task.riskScore < 0.3 ? '🟢' : task.riskScore < 0.6 ? '🟡' : '🔴';
    console.log(`   ${i + 1}. ${status} ${task.title} ${risk} (risk: ${(task.riskScore * 100).toFixed(0)}%)`);
  });
  console.log();

  console.log('🔍 Evaluation Results:');
  console.log(`   Coverage Score: ${(mockEvalResult.coverageScore * 100).toFixed(1)}%`);
  console.log(`   Rationale: ${mockEvalResult.rationale}`);
  console.log(`   Confidence Adjustment: ${mockEvalResult.confidenceAdjustment >= 0 ? '+' : ''}${(mockEvalResult.confidenceAdjustment * 100).toFixed(1)}%`);
  console.log(`   New Confidence: ${((mockAgent.confidence + mockEvalResult.confidenceAdjustment) * 100).toFixed(1)}%`);
  console.log(`   Continue Processing: ${!mockEvalResult.stopRecommended ? 'Yes' : 'No'}`);
  console.log();

  if (mockEvalResult.newTasks.length > 0) {
    console.log('🆕 Suggested New Tasks:');
    mockEvalResult.newTasks.forEach((task, i) => {
      const risk = task.riskScore < 0.3 ? '🟢' : task.riskScore < 0.6 ? '🟡' : '🔴';
      console.log(`   ${i + 1}. ${task.title} [${task.type}] ${risk} (${task.priority} priority)`);
    });
    console.log();
  }

  console.log('✅ Mock evaluation completed successfully!');
  console.log();
}

async function runRealEvaluation(agentId) {
  console.log(`🔄 Running Evaluation for Agent: ${agentId}`);
  console.log('─'.repeat(50));
  
  try {
    const startTime = Date.now();
    await evaluateAgent(agentId);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Evaluation completed successfully in ${duration}ms`);
    
    // Show updated agent info
    const updatedAgent = await prisma.issueAgent.findUnique({
      where: { id: agentId },
      select: {
        confidence: true,
        phase: true,
        lastEvalAt: true,
        totalTasks: true
      }
    });
    
    if (updatedAgent) {
      console.log();
      console.log('📊 Updated Agent Status:');
      console.log(`   Confidence: ${(updatedAgent.confidence * 100).toFixed(1)}%`);
      console.log(`   Phase: ${updatedAgent.phase}`);
      console.log(`   Total Tasks: ${updatedAgent.totalTasks}`);
      console.log(`   Last Evaluated: ${updatedAgent.lastEvalAt?.toISOString()}`);
    }
  } catch (error) {
    log.error({ error: String(error), agentId }, 'Evaluation failed');
    console.log(`❌ Evaluation failed: ${error.message}`);
  }
  console.log();
}

async function showUsageHelp() {
  console.log('📖 Usage Examples:');
  console.log();
  console.log('1. Run mock evaluation (no database required):');
  console.log('   npm run eval:demo');
  console.log();
  console.log('2. List available agents:');
  console.log('   npm run eval:list');
  console.log();
  console.log('3. Evaluate specific agent:');
  console.log('   npm run eval:run <agent-id>');
  console.log();
  console.log('4. Show system configuration:');
  console.log('   npm run eval:config');
  console.log();
}

async function main() {
  const command = process.argv[2];
  const agentId = process.argv[3];

  await displaySystemInfo();

  switch (command) {
    case 'demo':
    case '--demo':
    case '-d':
      await runMockEvaluation();
      break;
      
    case 'list':
    case '--list':
    case '-l':
      await listAvailableAgents();
      break;
      
    case 'run':
    case '--run':
    case '-r':
      if (!agentId) {
        console.log('❌ Agent ID required for real evaluation');
        console.log('Usage: npm run eval:run <agent-id>');
        process.exit(1);
      }
      await runRealEvaluation(agentId);
      break;
      
    case 'config':
    case '--config':
    case '-c':
      // System info already displayed above
      break;
      
    case 'help':
    case '--help':
    case '-h':
    default:
      await showUsageHelp();
      break;
  }
  
  console.log('🎓 GitAutonomic Evaluation Script completed');
  console.log('   Ready for Computer Science class demonstration!');
  console.log();
  
  process.exit(0);
}

main().catch(error => {
  log.error({ error: String(error) }, 'Script failed');
  console.error('💥 Script failed:', error.message);
  process.exit(1);
});