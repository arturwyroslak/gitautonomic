// AI Bot Command Parser for Processing @ai-bot Commands in PR Comments
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface ParsedCommand {
  command: string;
  action: string;
  parameters: Record<string, any>;
  target?: string;
  options: string[];
  raw: string;
  isValid: boolean;
  validationErrors: string[];
}

export interface CommandContext {
  pullRequestNumber: number;
  commentId: string;
  author: string;
  repository: string;
  timestamp: Date;
  commentBody: string;
}

export interface CommandResponse {
  success: boolean;
  message: string;
  data?: any;
  followUpActions?: string[];
}

export class AIBotCommandParser {
  private readonly botMentions = ['@ai-bot', '@gitautonomic', '@autonomous-agent'];
  private readonly validCommands = new Map<string, CommandDefinition>();

  constructor() {
    this.initializeCommands();
  }

  private initializeCommands(): void {
    // Code analysis commands
    this.validCommands.set('analyze', {
      description: 'Analyze code for issues, patterns, or improvements',
      parameters: ['type', 'scope', 'depth'],
      examples: ['@ai-bot analyze code', '@ai-bot analyze security --scope=src/auth']
    });

    this.validCommands.set('refactor', {
      description: 'Suggest or perform code refactoring',
      parameters: ['target', 'type', 'aggressive'],
      examples: ['@ai-bot refactor src/utils.ts', '@ai-bot refactor --type=extract-method']
    });

    this.validCommands.set('review', {
      description: 'Perform code review on specific files or entire PR',
      parameters: ['files', 'focus', 'format'],
      examples: ['@ai-bot review', '@ai-bot review --focus=security,performance']
    });

    this.validCommands.set('test', {
      description: 'Generate or suggest tests for code',
      parameters: ['type', 'coverage', 'framework'],
      examples: ['@ai-bot test src/api.ts', '@ai-bot test --type=unit --coverage=90']
    });

    this.validCommands.set('fix', {
      description: 'Automatically fix detected issues',
      parameters: ['type', 'severity', 'confirm'],
      examples: ['@ai-bot fix linting', '@ai-bot fix security --confirm']
    });

    this.validCommands.set('explain', {
      description: 'Explain code functionality or decisions',
      parameters: ['file', 'function', 'detail'],
      examples: ['@ai-bot explain src/auth.ts', '@ai-bot explain validateUser --detail=high']
    });

    this.validCommands.set('optimize', {
      description: 'Optimize code for performance or size',
      parameters: ['target', 'metric', 'aggressive'],
      examples: ['@ai-bot optimize performance', '@ai-bot optimize bundle-size --aggressive']
    });

    this.validCommands.set('migrate', {
      description: 'Migrate code to new framework/language/version',
      parameters: ['from', 'to', 'scope'],
      examples: ['@ai-bot migrate --from=js --to=ts', '@ai-bot migrate react16 react18']
    });

    this.validCommands.set('document', {
      description: 'Generate or update documentation',
      parameters: ['type', 'format', 'scope'],
      examples: ['@ai-bot document api', '@ai-bot document --type=readme --scope=src/']
    });

    this.validCommands.set('status', {
      description: 'Get current status of autonomous agent',
      parameters: ['detail', 'history'],
      examples: ['@ai-bot status', '@ai-bot status --detail --history=24h']
    });
  }

  parseCommand(commentBody: string, context: CommandContext): ParsedCommand[] {
    const commands: ParsedCommand[] = [];
    const lines = commentBody.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check if line contains bot mention
      const mention = this.botMentions.find(mention => trimmed.includes(mention));
      if (!mention) continue;
      
      // Extract command after mention
      const afterMention = trimmed.substring(trimmed.indexOf(mention) + mention.length).trim();
      if (!afterMention) continue;
      
      const parsed = this.parseCommandLine(afterMention, trimmed);
      commands.push(parsed);
    }
    
    log.info(`Parsed ${commands.length} commands from comment ${context.commentId}`);
    return commands;
  }

  private parseCommandLine(commandLine: string, rawLine: string): ParsedCommand {
    const parts = this.tokenizeCommand(commandLine);
    if (parts.length === 0) {
      return this.createInvalidCommand(rawLine, ['No command specified']);
    }
    
    const command = parts[0]?.toLowerCase() || '';
    const action = parts[1] || 'default';
    const { parameters, options, target } = this.parseParameters(parts.slice(1));
    
    const parsed: ParsedCommand = {
      command,
      action,
      parameters,
      target,
      options,
      raw: rawLine,
      isValid: false,
      validationErrors: []
    };
    
    // Validate command
    this.validateCommand(parsed);
    
    return parsed;
  }

  private tokenizeCommand(commandLine: string): string[] {
    // Simple tokenization that respects quotes
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < commandLine.length; i++) {
      const char = commandLine[i];
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuotes) {
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      tokens.push(current.trim());
    }
    
    return tokens;
  }

  private parseParameters(parts: string[]): {
    parameters: Record<string, any>;
    options: string[];
    target?: string;
  } {
    const parameters: Record<string, any> = {};
    const options: string[] = [];
    let target: string | undefined;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      
      if (part.startsWith('--')) {
        // Long option: --key=value or --flag
        const [key, value] = part.substring(2).split('=', 2);
        if (key && value !== undefined) {
          parameters[key] = this.parseValue(value);
        } else if (key) {
          options.push(key);
        }
      } else if (part.startsWith('-')) {
        // Short option: -f or -k value
        const key = part.substring(1);
        if (key && i + 1 < parts.length && parts[i + 1] && !parts[i + 1]!.startsWith('-')) {
          parameters[key] = this.parseValue(parts[i + 1]!);
          i++; // Skip next part as it's the value
        } else if (key) {
          options.push(key);
        }
      } else if (!target && i === 0) {
        // First non-option part might be the target
        target = part;
      } else {
        // Additional positional arguments
        parameters[`arg${i}`] = this.parseValue(part);
      }
    }
    
    return { parameters, options, target };
  }

  private parseValue(value: string): any {
    // Try to parse as number
    if (/^\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    
    if (/^\d*\.\d+$/.test(value)) {
      return parseFloat(value);
    }
    
    // Try to parse as boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Try to parse as array (comma-separated)
    if (value.includes(',')) {
      return value.split(',').map(v => this.parseValue(v.trim()));
    }
    
    return value;
  }

  private validateCommand(parsed: ParsedCommand): void {
    const definition = this.validCommands.get(parsed.command);
    
    if (!definition) {
      parsed.validationErrors.push(`Unknown command: ${parsed.command}`);
      return;
    }
    
    // Check for required parameters (basic validation)
    if (parsed.command === 'migrate') {
      if (!parsed.parameters.from && !parsed.parameters.to) {
        parsed.validationErrors.push('Migration requires --from and --to parameters');
      }
    }
    
    if (parsed.command === 'fix' && parsed.options.includes('confirm') === false) {
      parsed.validationErrors.push('Fix command requires --confirm flag for safety');
    }
    
    parsed.isValid = parsed.validationErrors.length === 0;
  }

  private createInvalidCommand(raw: string, errors: string[]): ParsedCommand {
    return {
      command: '',
      action: '',
      parameters: {},
      options: [],
      raw,
      isValid: false,
      validationErrors: errors
    };
  }

  getAvailableCommands(): Map<string, CommandDefinition> {
    return new Map(this.validCommands);
  }

  formatHelpMessage(): string {
    let help = '## 🤖 AI Bot Commands\n\n';
    help += 'Available commands for @ai-bot:\n\n';
    
    for (const [command, definition] of this.validCommands) {
      help += `### \`${command}\`\n`;
      help += `${definition.description}\n\n`;
      
      if (definition.parameters.length > 0) {
        help += `**Parameters:** ${definition.parameters.join(', ')}\n\n`;
      }
      
      if (definition.examples.length > 0) {
        help += '**Examples:**\n';
        for (const example of definition.examples) {
          help += `- \`${example}\`\n`;
        }
        help += '\n';
      }
    }
    
    help += '**Tips:**\n';
    help += '- Use `--confirm` for destructive operations\n';
    help += '- Use `--help` with any command for more details\n';
    help += '- Commands can be combined in a single comment\n';
    
    return help;
  }
}

export interface CommandDefinition {
  description: string;
  parameters: string[];
  examples: string[];
}

export class CommandExecutor {
  async executeCommand(
    command: ParsedCommand,
    context: CommandContext
  ): Promise<CommandResponse> {
    if (!command.isValid) {
      return {
        success: false,
        message: `Invalid command: ${command.validationErrors.join(', ')}`
      };
    }
    
    log.info(`Executing command: ${command.command} ${command.action}`, {
      pullRequest: context.pullRequestNumber,
      author: context.author
    } as any);
    
    try {
      switch (command.command) {
        case 'status':
          return await this.handleStatusCommand(command, context);
        case 'analyze':
          return await this.handleAnalyzeCommand(command, context);
        case 'review':
          return await this.handleReviewCommand(command, context);
        case 'refactor':
          return await this.handleRefactorCommand(command, context);
        case 'fix':
          return await this.handleFixCommand(command, context);
        case 'test':
          return await this.handleTestCommand(command, context);
        case 'explain':
          return await this.handleExplainCommand(command, context);
        case 'optimize':
          return await this.handleOptimizeCommand(command, context);
        case 'migrate':
          return await this.handleMigrateCommand(command, context);
        case 'document':
          return await this.handleDocumentCommand(command, context);
        default:
          return {
            success: false,
            message: `Command '${command.command}' is not implemented yet`
          };
      }
    } catch (error) {
      log.error(`Command execution failed: ${error}`, {
        command: command.command,
        context
      } as any);
      
      return {
        success: false,
        message: `Command execution failed: ${error}`
      };
    }
  }

  private async handleStatusCommand(
    command: ParsedCommand,
    context: CommandContext
  ): Promise<CommandResponse> {
    return {
      success: true,
      message: '🟢 AI Bot is online and ready to assist!',
      data: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        version: '2.1.0',
        features: ['code-analysis', 'refactoring', 'testing', 'documentation']
      }
    };
  }

  private async handleAnalyzeCommand(
    command: ParsedCommand,
    context: CommandContext
  ): Promise<CommandResponse> {
    return {
      success: true,
      message: `🔍 Starting analysis of PR #${context.pullRequestNumber}`,
      followUpActions: ['run-code-analysis', 'generate-report']
    };
  }

  private async handleReviewCommand(
    command: ParsedCommand,
    context: CommandContext
  ): Promise<CommandResponse> {
    return {
      success: true,
      message: `📝 Starting code review of PR #${context.pullRequestNumber}`,
      followUpActions: ['perform-review', 'post-comments']
    };
  }

  private async handleRefactorCommand(
    command: ParsedCommand,
    context: CommandContext
  ): Promise<CommandResponse> {
    if (!command.parameters.confirm) {
      return {
        success: false,
        message: '⚠️ Refactoring requires --confirm flag for safety'
      };
    }
    
    return {
      success: true,
      message: `🔧 Starting refactoring analysis`,
      followUpActions: ['analyze-refactoring', 'create-suggestions']
    };
  }

  private async handleFixCommand(
    command: ParsedCommand,
    context: CommandContext
  ): Promise<CommandResponse> {
    return {
      success: true,
      message: `🔨 Starting automated fixes`,
      followUpActions: ['run-linter', 'apply-fixes', 'create-commit']
    };
  }

  private async handleTestCommand(
    command: ParsedCommand,
    context: CommandContext
  ): Promise<CommandResponse> {
    return {
      success: true,
      message: `🧪 Generating tests for target code`,
      followUpActions: ['analyze-coverage', 'generate-tests', 'validate-tests']
    };
  }

  private async handleExplainCommand(
    command: ParsedCommand,
    context: CommandContext
  ): Promise<CommandResponse> {
    return {
      success: true,
      message: `📚 Generating code explanation`,
      followUpActions: ['analyze-code', 'generate-explanation']
    };
  }

  private async handleOptimizeCommand(
    command: ParsedCommand,
    context: CommandContext
  ): Promise<CommandResponse> {
    return {
      success: true,
      message: `⚡ Starting optimization analysis`,
      followUpActions: ['performance-analysis', 'suggest-optimizations']
    };
  }

  private async handleMigrateCommand(
    command: ParsedCommand,
    context: CommandContext
  ): Promise<CommandResponse> {
    return {
      success: true,
      message: `🚀 Starting migration from ${command.parameters.from} to ${command.parameters.to}`,
      followUpActions: ['analyze-compatibility', 'create-migration-plan']
    };
  }

  private async handleDocumentCommand(
    command: ParsedCommand,
    context: CommandContext
  ): Promise<CommandResponse> {
    return {
      success: true,
      message: `📄 Generating documentation`,
      followUpActions: ['analyze-code', 'generate-docs', 'update-readme']
    };
  }
}