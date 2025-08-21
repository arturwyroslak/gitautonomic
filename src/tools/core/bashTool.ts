import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface BashSession {
  id: string;
  process: ChildProcess;
  events: EventEmitter;
  cwd: string;
  isActive: boolean;
  timeout?: NodeJS.Timeout;
}

export interface BashCommandOptions {
  sessionId?: string;
  async?: boolean;
  timeout?: number;
  cwd?: string;
  env?: Record<string, string>;
}

export interface BashCommandResult {
  success: boolean;
  output: string;
  error?: string;
  sessionId: string;
  exitCode?: number;
}

export class BashTool {
  private sessions = new Map<string, BashSession>();
  private readonly defaultTimeout = 120000; // 2 minutes

  /**
   * Run bash commands in interactive sessions
   */
  async runCommand(command: string, options: BashCommandOptions = {}): Promise<BashCommandResult> {
    const sessionId = options.sessionId || this.generateSessionId();
    const session = this.getOrCreateSession(sessionId, options.cwd, options.env);

    try {
      if (options.async) {
        return await this.runAsyncCommand(session, command, options.timeout);
      } else {
        return await this.runSyncCommand(session, command, options.timeout);
      }
    } catch (error) {
      log.error(`Bash command failed: ${error}`);
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId
      };
    }
  }

  /**
   * Write input to an interactive session
   */
  async writeInput(sessionId: string, input: string, delay?: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error(`Session ${sessionId} not found or inactive`);
    }

    session.process.stdin?.write(input);
    
    if (delay) {
      await new Promise(resolve => setTimeout(resolve, delay * 1000));
    }
  }

  /**
   * Read output from an async session
   */
  async readOutput(sessionId: string, delay: number = 1): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const session = this.sessions.get(sessionId);
        if (session) {
          const output = this.getSessionOutput(session);
          resolve(output);
        } else {
          resolve('');
        }
      }, delay * 1000);
    });
  }

  /**
   * Stop a running bash session
   */
  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      if (session.timeout) {
        clearTimeout(session.timeout);
      }
      session.process.kill('SIGTERM');
      this.sessions.delete(sessionId);
    }
  }

  /**
   * List all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys()).filter(id => {
      const session = this.sessions.get(id);
      return session?.isActive;
    });
  }

  private getOrCreateSession(sessionId: string, cwd?: string, env?: Record<string, string>): BashSession {
    let session = this.sessions.get(sessionId);
    
    if (!session || !session.isActive) {
      const workingDir = cwd || process.cwd();
      const environment = { ...process.env, ...env };
      
      const childProcess = spawn('bash', ['-i'], {
        cwd: workingDir,
        env: environment,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      session = {
        id: sessionId,
        process: childProcess,
        events: new EventEmitter(),
        cwd: workingDir,
        isActive: true
      };

      this.setupProcessHandlers(session);
      this.sessions.set(sessionId, session);
    }

    return session;
  }

  private async runSyncCommand(session: BashSession, command: string, timeout?: number): Promise<BashCommandResult> {
    return new Promise((resolve) => {
      const timeoutMs = timeout ? timeout * 1000 : this.defaultTimeout;
      let output = '';
      let error = '';

      const timer = setTimeout(() => {
        resolve({
          success: false,
          output,
          error: 'Command timed out',
          sessionId: session.id
        });
      }, timeoutMs);

      const onData = (data: Buffer) => {
        output += data.toString();
      };

      const onError = (data: Buffer) => {
        error += data.toString();
      };

      const onExit = (code: number | null) => {
        clearTimeout(timer);
        session.process.stdout?.removeListener('data', onData);
        session.process.stderr?.removeListener('data', onError);
        session.process.removeListener('exit', onExit);

        resolve({
          success: code === 0,
          output,
          error: error || undefined,
          sessionId: session.id,
          exitCode: code || undefined
        });
      };

      session.process.stdout?.on('data', onData);
      session.process.stderr?.on('data', onError);
      session.process.on('exit', onExit);

      // Execute command
      session.process.stdin?.write(command + '\n');
    });
  }

  private async runAsyncCommand(session: BashSession, command: string, timeout?: number): Promise<BashCommandResult> {
    const timeoutMs = timeout ? timeout * 1000 : this.defaultTimeout;
    
    // Set up timeout for async command
    if (session.timeout) {
      clearTimeout(session.timeout);
    }
    
    session.timeout = setTimeout(() => {
      this.stopSession(session.id);
    }, timeoutMs);

    // Execute command
    session.process.stdin?.write(command + '\n');

    return {
      success: true,
      output: 'Command started asynchronously',
      sessionId: session.id
    };
  }

  private setupProcessHandlers(session: BashSession): void {
    session.process.on('exit', (code) => {
      log.info(`Bash session ${session.id} exited with code ${code}`);
      session.isActive = false;
      if (session.timeout) {
        clearTimeout(session.timeout);
      }
    });

    session.process.on('error', (error) => {
      log.error(`Bash session ${session.id} error: ${error}`);
      session.isActive = false;
    });

    // Store output for later retrieval
    let outputBuffer = '';
    session.process.stdout?.on('data', (data) => {
      outputBuffer += data.toString();
      session.events.emit('output', data.toString());
    });

    session.process.stderr?.on('data', (data) => {
      outputBuffer += data.toString();
      session.events.emit('error', data.toString());
    });

    // Store output in session for retrieval
    (session as any).outputBuffer = outputBuffer;
  }

  private getSessionOutput(session: BashSession): string {
    return (session as any).outputBuffer || '';
  }

  private generateSessionId(): string {
    return `bash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const bashTool = new BashTool();