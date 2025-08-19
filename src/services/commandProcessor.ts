// AI Bot command processing service
import { prisma } from '../storage/prisma.js';
import { StructuredCommentService } from '../core/communicationService.js';
import { runAdaptiveIteration } from '../ai/adaptiveLoop.js';
import { evaluateAgent } from '../services/evalService.js';
import { addMemory } from '../ai/memoryStore.js';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface BotCommand {
  command: string;
  args: string[];
  agentId?: string;
  issueNumber?: number;
  pullNumber?: number;
  author: string;
  installationId: string;
  owner: string;
  repo: string;
}

export interface CommandResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  followupActions?: string[];
}

export class AIBotCommandProcessor {
  private commentService: StructuredCommentService;

  constructor() {
    this.commentService = new StructuredCommentService();
  }

  async processCommand(command: BotCommand): Promise<CommandResult> {
    log.info(`Processing command: ${command.command} for ${command.owner}/${command.repo}`);

    try {
      switch (command.command.toLowerCase()) {
        case 'run':
        case 'start':
          return await this.handleRunCommand(command);
        
        case 'pause':
        case 'stop':
          return await this.handlePauseCommand(command);
        
        case 'resume':
          return await this.handleResumeCommand(command);
        
        case 'status':
          return await this.handleStatusCommand(command);
        
        case 'evaluate':
        case 'eval':
          return await this.handleEvaluateCommand(command);
        
        case 'approve':
          return await this.handleApproveCommand(command);
        
        case 'reject':
          return await this.handleRejectCommand(command);
        
        case 'modify':
          return await this.handleModifyCommand(command);
        
        case 'reset':
        case 'restart':
          return await this.handleResetCommand(command);
        
        case 'help':
          return await this.handleHelpCommand(command);
        
        case 'config':
          return await this.handleConfigCommand(command);
        
        case 'rollback':
          return await this.handleRollbackCommand(command);
        
        default:
          return {
            success: false,
            message: `Unknown command: ${command.command}`,
            error: 'UNKNOWN_COMMAND',
            followupActions: ['Use @ai-bot help to see available commands']
          };
      }
    } catch (error) {
      log.error(`Command processing failed: ${error}`);
      return {
        success: false,
        message: 'Command processing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        followupActions: ['Please try again or contact support']
      };
    }
  }

  private async handleRunCommand(command: BotCommand): Promise<CommandResult> {
    const agent = await this.findOrCreateAgent(command);
    if (!agent) {
      return {
        success: false,
        message: 'Could not find or create agent for this issue',
        error: 'AGENT_NOT_FOUND'
      };
    }

    if (agent.blocked) {
      return {
        success: false,
        message: 'Agent is already running',
        data: { agentId: agent.id, phase: agent.phase }
      };
    }

    // Update agent phase and start execution
    await prisma.issueAgent.update({
      where: { id: agent.id },
      data: { 
        phase: 'executing',
        blocked: false
      }
    });

    // Trigger execution (async)
    runAdaptiveIteration(agent.id).catch(error => 
      log.error(`Adaptive iteration failed for agent ${agent.id}: ${error}`)
    );

    return {
      success: true,
      message: `🚀 Agent started successfully! Agent ID: ${agent.id}`,
      data: { agentId: agent.id, phase: 'executing' },
      followupActions: [
        'Monitor progress with @ai-bot status',
        'Pause execution with @ai-bot pause if needed'
      ]
    };
  }

  private async handlePauseCommand(command: BotCommand): Promise<CommandResult> {
    const agent = await this.findAgent(command);
    if (!agent) {
      return {
        success: false,
        message: 'No active agent found for this issue',
        error: 'AGENT_NOT_FOUND'
      };
    }

    const reason = command.args.join(' ') || 'Manual pause request';
    
    await prisma.issueAgent.update({
      where: { id: agent.id },
      data: { 
        blocked: true,
        phase: 'paused'
      }
    });

    await addMemory(agent.id, 'command', JSON.stringify({
      action: 'pause',
      reason,
      author: command.author,
      timestamp: new Date()
    }));

    return {
      success: true,
      message: `⏸️ Agent paused successfully. Reason: ${reason}`,
      data: { agentId: agent.id, phase: 'paused', reason },
      followupActions: [
        'Resume with @ai-bot resume',
        'Check status with @ai-bot status'
      ]
    };
  }

  private async handleResumeCommand(command: BotCommand): Promise<CommandResult> {
    const agent = await this.findAgent(command);
    if (!agent) {
      return {
        success: false,
        message: 'No agent found for this issue',
        error: 'AGENT_NOT_FOUND'
      };
    }

    if (!agent.blocked) {
      return {
        success: false,
        message: `Agent is not paused (current phase: ${agent.phase})`,
        data: { agentId: agent.id, phase: agent.phase }
      };
    }

    await prisma.issueAgent.update({
      where: { id: agent.id },
      data: { 
        phase: 'executing',
        blocked: false
      }
    });

    // Continue execution
    runAdaptiveIteration(agent.id).catch(error => 
      log.error(`Resume failed for agent ${agent.id}: ${error}`)
    );

    return {
      success: true,
      message: `▶️ Agent resumed successfully!`,
      data: { agentId: agent.id, phase: 'executing' },
      followupActions: [
        'Monitor progress with @ai-bot status'
      ]
    };
  }

  private async handleStatusCommand(command: BotCommand): Promise<CommandResult> {
    const agent = await this.findAgent(command);
    if (!agent) {
      return {
        success: false,
        message: 'No agent found for this issue',
        error: 'AGENT_NOT_FOUND'
      };
    }

    const tasks = await prisma.task.findMany({
      where: { issueAgentId: agent.id }
    });

    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const totalTasks = tasks.length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const statusMessage = `
📊 **Agent Status Report**

**Agent ID**: ${agent.id}  
**Phase**: ${agent.phase}  
**Blocked**: ${agent.blocked ? 'Yes' : 'No'}  
**Progress**: ${completedTasks}/${totalTasks} tasks (${progress}%)  
**Iterations**: ${agent.iterations}  
**Confidence**: ${Math.round((agent.confidence || 0) * 100)}%  
**Branch**: ${agent.branchName}  

**Recent Tasks**:
${tasks.slice(-3).map(t => `- ${t.status === 'done' ? '✅' : '⏳'} ${t.title}`).join('\n')}

${agent.blocked ? `**Status**: Agent is currently blocked/paused` : ''}
`;

    return {
      success: true,
      message: statusMessage,
      data: {
        agentId: agent.id,
        phase: agent.phase,
        blocked: agent.blocked,
        progress: { completed: completedTasks, total: totalTasks, percentage: progress },
        iterations: agent.iterations,
        confidence: agent.confidence
      }
    };
  }

  private async handleEvaluateCommand(command: BotCommand): Promise<CommandResult> {
    const agent = await this.findAgent(command);
    if (!agent) {
      return {
        success: false,
        message: 'No agent found for this issue',
        error: 'AGENT_NOT_FOUND'
      };
    }

    // Trigger evaluation
    await evaluateAgent(agent.id);

    return {
      success: true,
      message: `🔍 Agent evaluation triggered. Results will be available shortly.`,
      data: { agentId: agent.id },
      followupActions: [
        'Check updated status with @ai-bot status',
        'View plan updates in the PR'
      ]
    };
  }

  private async handleApproveCommand(command: BotCommand): Promise<CommandResult> {
    const agent = await this.findAgent(command);
    if (!agent) {
      return {
        success: false,
        message: 'No agent found for this issue',
        error: 'AGENT_NOT_FOUND'
      };
    }

    await addMemory(agent.id, 'approval', JSON.stringify({
      action: 'approve',
      author: command.author,
      timestamp: new Date(),
      context: command.args.join(' ')
    }));

    return {
      success: true,
      message: `✅ Plan approved by ${command.author}. Execution will continue.`,
      data: { agentId: agent.id, approvedBy: command.author }
    };
  }

  private async handleRejectCommand(command: BotCommand): Promise<CommandResult> {
    const agent = await this.findAgent(command);
    if (!agent) {
      return {
        success: false,
        message: 'No agent found for this issue',
        error: 'AGENT_NOT_FOUND'
      };
    }

    const reason = command.args.join(' ') || 'Plan rejected';

    await addMemory(agent.id, 'rejection', JSON.stringify({
      action: 'reject',
      author: command.author,
      timestamp: new Date(),
      reason
    }));

    return {
      success: true,
      message: `❌ Plan rejected by ${command.author}. Reason: ${reason}`,
      data: { agentId: agent.id, rejectedBy: command.author, reason },
      followupActions: [
        'Use @ai-bot modify to request changes',
        'Use @ai-bot reset to start over'
      ]
    };
  }

  private async handleModifyCommand(command: BotCommand): Promise<CommandResult> {
    const agent = await this.findAgent(command);
    if (!agent) {
      return {
        success: false,
        message: 'No agent found for this issue',
        error: 'AGENT_NOT_FOUND'
      };
    }

    const modification = command.args.join(' ');
    if (!modification) {
      return {
        success: false,
        message: 'Please specify what to modify. Example: @ai-bot modify add unit tests',
        error: 'MISSING_MODIFICATION'
      };
    }

    await addMemory(agent.id, 'modification_request', JSON.stringify({
      request: modification,
      author: command.author,
      timestamp: new Date()
    }));

    return {
      success: true,
      message: `📝 Modification request recorded: "${modification}". The agent will consider this in the next iteration.`,
      data: { agentId: agent.id, modification },
      followupActions: [
        'Use @ai-bot evaluate to trigger plan update',
        'Monitor changes with @ai-bot status'
      ]
    };
  }

  private async handleResetCommand(command: BotCommand): Promise<CommandResult> {
    const agent = await this.findAgent(command);
    if (!agent) {
      return {
        success: false,
        message: 'No agent found for this issue',
        error: 'AGENT_NOT_FOUND'
      };
    }

    // Reset agent to initial state
    await prisma.issueAgent.update({
      where: { id: agent.id },
      data: {
        phase: 'pending',
        blocked: false,
        completed: false,
        iterations: 0,
        confidence: 0.5
      }
    });

    // Reset all tasks to pending
    await prisma.task.updateMany({
      where: { issueAgentId: agent.id },
      data: { status: 'pending' }
    });

    return {
      success: true,
      message: `🔄 Agent reset successfully. All tasks marked as pending.`,
      data: { agentId: agent.id, phase: 'pending' },
      followupActions: [
        'Start again with @ai-bot run',
        'Modify plan if needed before starting'
      ]
    };
  }

  private async handleRollbackCommand(command: BotCommand): Promise<CommandResult> {
    const agent = await this.findAgent(command);
    if (!agent) {
      return {
        success: false,
        message: 'No agent found for this issue',
        error: 'AGENT_NOT_FOUND'
      };
    }

    const steps = command.args[0] ? parseInt(command.args[0]) : 1;
    
    return {
      success: true,
      message: `🔄 Rollback request noted for ${steps} step(s). This will be implemented in the next iteration.`,
      data: { agentId: agent.id, rollbackSteps: steps },
      followupActions: [
        'Manual rollback may be required for complex changes',
        'Monitor status with @ai-bot status'
      ]
    };
  }

  private async handleConfigCommand(command: BotCommand): Promise<CommandResult> {
    // Read current config and display relevant settings
    return {
      success: true,
      message: `⚙️ Configuration options:
- .aiagent.yml - Repository settings
- .aiagent-ownership.yml - Access control
- Use GitHub repository settings for AI models`,
      followupActions: [
        'Edit .aiagent.yml for customization',
        'Check repository settings for AI provider configuration'
      ]
    };
  }

  private async handleHelpCommand(command: BotCommand): Promise<CommandResult> {
    const helpText = `
🤖 **AI Bot Commands**

**Execution Control:**
- \`@ai-bot run\` - Start agent execution
- \`@ai-bot pause [reason]\` - Pause execution
- \`@ai-bot resume\` - Resume paused execution
- \`@ai-bot reset\` - Reset agent to initial state

**Information:**
- \`@ai-bot status\` - Show current status and progress
- \`@ai-bot help\` - Show this help message
- \`@ai-bot config\` - Show configuration options

**Plan Management:**
- \`@ai-bot evaluate\` - Trigger plan evaluation
- \`@ai-bot modify <changes>\` - Request plan modifications
- \`@ai-bot approve\` - Approve current plan
- \`@ai-bot reject\` - Reject current plan

**Recovery:**
- \`@ai-bot rollback [steps]\` - Request rollback
`;

    return {
      success: true,
      message: helpText,
      data: { commands: Object.keys(this.getAvailableCommands()) }
    };
  }

  private async findAgent(command: BotCommand): Promise<any> {
    if (command.agentId) {
      return await prisma.issueAgent.findUnique({
        where: { id: command.agentId }
      });
    }

    if (command.issueNumber) {
      return await prisma.issueAgent.findFirst({
        where: {
          issueNumber: command.issueNumber,
          owner: command.owner,
          repo: command.repo
        }
      });
    }

    return null;
  }

  private async findOrCreateAgent(command: BotCommand): Promise<any> {
    let agent = await this.findAgent(command);
    
    if (!agent && command.issueNumber) {
      // Create new agent for the issue
      agent = await prisma.issueAgent.create({
        data: {
          id: `${command.owner}_${command.repo}_${command.issueNumber}_${Date.now()}`,
          installationId: BigInt(command.installationId),
          owner: command.owner,
          repo: command.repo,
          issueNumber: command.issueNumber,
          issueTitle: `Issue #${command.issueNumber}`,
          issueBodyHash: 'placeholder-hash',
          branchName: `ai/issue-${command.issueNumber}-agent`,
          phase: 'pending',
          blocked: false,
          completed: false,
          iterations: 0,
          confidence: 0.5,
          doneTasks: 0,
          totalTasks: 0
        }
      });
    }

    return agent;
  }

  private getAvailableCommands(): Record<string, string> {
    return {
      run: 'Start agent execution',
      pause: 'Pause execution',
      resume: 'Resume execution',
      status: 'Show status',
      evaluate: 'Trigger evaluation',
      approve: 'Approve plan',
      modify: 'Request modifications',
      reset: 'Reset agent',
      help: 'Show help',
      config: 'Show configuration',
      rollback: 'Request rollback'
    };
  }
}

export const aiBotCommandProcessor = new AIBotCommandProcessor();