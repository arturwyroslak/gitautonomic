import {
  bashTool,
  strReplaceEditorTool,
  reportProgressTool,
  thinkTool,
  storeMemoryTool
} from './core/index.js';

import type {
  BashCommandOptions,
  BashCommandResult,
  FileEditCommand,
  FileEditResult,
  ProgressReportOptions,
  ProgressReportResult,
  ThinkOptions,
  ThinkResult,
  MemoryQuery,
  MemoryResult
} from './core/index.js';

export interface CoreToolsRegistry {
  bash: {
    runCommand: (command: string, options?: BashCommandOptions) => Promise<BashCommandResult>;
    writeInput: (sessionId: string, input: string, delay?: number) => Promise<void>;
    readOutput: (sessionId: string, delay?: number) => Promise<string>;
    stopSession: (sessionId: string) => Promise<void>;
    getActiveSessions: () => string[];
  };
  
  str_replace_editor: {
    executeCommand: (command: FileEditCommand) => Promise<FileEditResult>;
    getFileInfo: (filePath: string) => Promise<{ exists: boolean; isDirectory: boolean; size: number; lines?: number }>;
  };
  
  report_progress: {
    reportProgress: (options: ProgressReportOptions) => Promise<ProgressReportResult>;
    isWorkingDirectoryClean: (workingDir?: string) => Promise<boolean>;
    getCommitHistory: (count?: number, workingDir?: string) => Promise<Array<{ sha: string; message: string; author: string; date: string }>>;
    createBackupBranch: (suffix?: string, workingDir?: string) => Promise<{ success: boolean; branchName?: string; error?: string }>;
    generateProgressSummary: (filesChanged: string[], commitMessage: string) => string;
  };
  
  think: {
    think: (thought: string, options?: ThinkOptions) => Promise<ThinkResult>;
    continueThinking: (sessionId: string, thought: string) => Promise<ThinkResult>;
    concludeSession: (sessionId: string, conclusion: string) => Promise<ThinkResult>;
    getSessionSummary: (sessionId: string) => Promise<string>;
    listSessions: () => Promise<Array<{ id: string; topic: string; thoughtCount: number; timestamp: Date }>>;
    searchThoughts: (query: string) => Promise<Array<{ sessionId: string; thoughtId: string; content: string; relevance: number }>>;
  };
  
  store_memory: {
    storeMemory: (content: string, type?: 'fact' | 'pattern' | 'decision' | 'lesson' | 'context' | 'relationship' | 'performance', options?: any) => Promise<MemoryResult>;
    retrieveMemories: (query: MemoryQuery) => Promise<MemoryResult>;
    updateMemory: (memoryId: string, updates: any) => Promise<MemoryResult>;
    deleteMemory: (memoryId: string) => Promise<MemoryResult>;
    getStatistics: () => Promise<any>;
    searchMemories: (searchText: string, limit?: number) => Promise<MemoryResult>;
    createMemoryCollection: (name: string, description: string, tags: string[]) => Promise<MemoryResult>;
  };
}

/**
 * Core Tools Registry - provides access to all core tools
 */
export class CoreToolsManager {
  private static instance: CoreToolsManager;

  static getInstance(): CoreToolsManager {
    if (!CoreToolsManager.instance) {
      CoreToolsManager.instance = new CoreToolsManager();
    }
    return CoreToolsManager.instance;
  }

  /**
   * Get all core tools in a structured registry
   */
  getToolsRegistry(): CoreToolsRegistry {
    return {
      bash: {
        runCommand: bashTool.runCommand.bind(bashTool),
        writeInput: bashTool.writeInput.bind(bashTool),
        readOutput: bashTool.readOutput.bind(bashTool),
        stopSession: bashTool.stopSession.bind(bashTool),
        getActiveSessions: bashTool.getActiveSessions.bind(bashTool)
      },
      
      str_replace_editor: {
        executeCommand: strReplaceEditorTool.executeCommand.bind(strReplaceEditorTool),
        getFileInfo: strReplaceEditorTool.getFileInfo.bind(strReplaceEditorTool)
      },
      
      report_progress: {
        reportProgress: reportProgressTool.reportProgress.bind(reportProgressTool),
        isWorkingDirectoryClean: reportProgressTool.isWorkingDirectoryClean.bind(reportProgressTool),
        getCommitHistory: reportProgressTool.getCommitHistory.bind(reportProgressTool),
        createBackupBranch: reportProgressTool.createBackupBranch.bind(reportProgressTool),
        generateProgressSummary: reportProgressTool.generateProgressSummary.bind(reportProgressTool)
      },
      
      think: {
        think: thinkTool.think.bind(thinkTool),
        continueThinking: thinkTool.continueThinking.bind(thinkTool),
        concludeSession: thinkTool.concludeSession.bind(thinkTool),
        getSessionSummary: thinkTool.getSessionSummary.bind(thinkTool),
        listSessions: thinkTool.listSessions.bind(thinkTool),
        searchThoughts: thinkTool.searchThoughts.bind(thinkTool)
      },
      
      store_memory: {
        storeMemory: storeMemoryTool.storeMemory.bind(storeMemoryTool),
        retrieveMemories: storeMemoryTool.retrieveMemories.bind(storeMemoryTool),
        updateMemory: storeMemoryTool.updateMemory.bind(storeMemoryTool),
        deleteMemory: storeMemoryTool.deleteMemory.bind(storeMemoryTool),
        getStatistics: storeMemoryTool.getStatistics.bind(storeMemoryTool),
        searchMemories: storeMemoryTool.searchMemories.bind(storeMemoryTool),
        createMemoryCollection: storeMemoryTool.createMemoryCollection.bind(storeMemoryTool)
      }
    };
  }

  /**
   * Get individual tool instances
   */
  getBashTool() { return bashTool; }
  getStrReplaceEditorTool() { return strReplaceEditorTool; }
  getReportProgressTool() { return reportProgressTool; }
  getThinkTool() { return thinkTool; }
  getStoreMemoryTool() { return storeMemoryTool; }

  /**
   * Execute a tool command with unified interface
   */
  async executeToolCommand(toolName: string, methodName: string, ...args: any[]): Promise<any> {
    const tools = this.getToolsRegistry();
    const tool = (tools as any)[toolName];
    
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    const method = tool[methodName];
    if (!method || typeof method !== 'function') {
      throw new Error(`Method not found: ${toolName}.${methodName}`);
    }

    return await method(...args);
  }

  /**
   * Get tool documentation and usage information
   */
  getToolDocumentation(): Record<string, any> {
    return {
      bash: {
        description: 'Run bash commands in interactive sessions',
        methods: {
          runCommand: 'Execute bash command with options for async/sync operation',
          writeInput: 'Send input to an interactive session',
          readOutput: 'Read output from an async session',
          stopSession: 'Stop a running bash session',
          getActiveSessions: 'List all active sessions'
        }
      },
      str_replace_editor: {
        description: 'View, create and edit files',
        methods: {
          executeCommand: 'Execute file operations (view/create/str_replace/insert)',
          getFileInfo: 'Get file information and metadata'
        }
      },
      report_progress: {
        description: 'Commit and push changes, update PR descriptions',
        methods: {
          reportProgress: 'Commit and push changes with progress update',
          isWorkingDirectoryClean: 'Check if working directory has uncommitted changes',
          getCommitHistory: 'Get recent commit history',
          createBackupBranch: 'Create backup branch before making changes',
          generateProgressSummary: 'Generate progress summary for reporting'
        }
      },
      think: {
        description: 'Use for complex reasoning and brainstorming',
        methods: {
          think: 'Record a thought and analyze it',
          continueThinking: 'Add to an existing thinking session',
          concludeSession: 'Conclude a thinking session with final thoughts',
          getSessionSummary: 'Get summary of a thinking session',
          listSessions: 'List all thinking sessions',
          searchThoughts: 'Search across all thoughts'
        }
      },
      store_memory: {
        description: 'Store facts about the codebase for future sessions',
        methods: {
          storeMemory: 'Store a new memory with metadata and tags',
          retrieveMemories: 'Query and retrieve memories based on criteria',
          updateMemory: 'Update an existing memory',
          deleteMemory: 'Delete a memory by ID',
          getStatistics: 'Get memory system statistics',
          searchMemories: 'Search memories with natural language',
          createMemoryCollection: 'Create a memory collection/category'
        }
      }
    };
  }
}

// Export singleton instance
export const coreToolsManager = CoreToolsManager.getInstance();

// Export individual tools for direct access
export {
  bashTool,
  strReplaceEditorTool,
  reportProgressTool,
  thinkTool,
  storeMemoryTool
} from './core/index.js';