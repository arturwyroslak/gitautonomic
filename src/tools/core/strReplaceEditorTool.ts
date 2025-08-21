import * as fs from 'fs/promises';
import * as path from 'path';
import pino from 'pino';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface FileEditCommand {
  command: 'view' | 'create' | 'str_replace' | 'insert';
  path: string;
  file_text?: string;
  old_str?: string;
  new_str?: string;
  insert_line?: number;
  view_range?: [number, number];
}

export interface FileEditResult {
  success: boolean;
  content?: string;
  error?: string;
  lineCount?: number;
  message?: string;
}

export class StrReplaceEditorTool {
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB limit

  /**
   * View, create and edit files with various operations
   */
  async executeCommand(command: FileEditCommand): Promise<FileEditResult> {
    try {
      switch (command.command) {
        case 'view':
          return await this.viewFile(command.path, command.view_range);
        case 'create':
          return await this.createFile(command.path, command.file_text || '');
        case 'str_replace':
          return await this.replaceString(command.path, command.old_str!, command.new_str!);
        case 'insert':
          return await this.insertText(command.path, command.insert_line!, command.new_str!);
        default:
          return {
            success: false,
            error: `Unknown command: ${command.command}`
          };
      }
    } catch (error) {
      log.error(`File operation failed: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * View file contents or directory listing
   */
  private async viewFile(filePath: string, range?: [number, number]): Promise<FileEditResult> {
    const absolutePath = path.resolve(filePath);

    try {
      const stats = await fs.stat(absolutePath);

      if (stats.isDirectory()) {
        return await this.listDirectory(absolutePath);
      }

      if (stats.size > this.maxFileSize) {
        return {
          success: false,
          error: `File too large (${stats.size} bytes). Maximum allowed: ${this.maxFileSize} bytes`
        };
      }

      const content = await fs.readFile(absolutePath, 'utf-8');
      const lines = content.split('\n');

      if (range) {
        const [start, end] = range;
        const startIndex = Math.max(0, start - 1);
        const endIndex = end === -1 ? lines.length : Math.min(lines.length, end);
        
        const selectedLines = lines.slice(startIndex, endIndex);
        const numberedLines = selectedLines.map((line, idx) => 
          `${startIndex + idx + 1}: ${line}`
        ).join('\n');

        return {
          success: true,
          content: numberedLines,
          lineCount: selectedLines.length,
          message: `Showing lines ${start} to ${endIndex} of ${lines.length}`
        };
      }

      // Show full file with line numbers
      const numberedContent = lines.map((line, idx) => `${idx + 1}: ${line}`).join('\n');

      return {
        success: true,
        content: numberedContent,
        lineCount: lines.length
      };

    } catch (error) {
      return {
        success: false,
        error: `Could not read file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Create a new file with specified content
   */
  private async createFile(filePath: string, content: string): Promise<FileEditResult> {
    const absolutePath = path.resolve(filePath);

    try {
      // Check if file already exists
      try {
        await fs.access(absolutePath);
        return {
          success: false,
          error: `File already exists: ${filePath}`
        };
      } catch {
        // File doesn't exist, which is what we want
      }

      // Ensure parent directory exists
      const parentDir = path.dirname(absolutePath);
      await fs.mkdir(parentDir, { recursive: true });

      // Create the file
      await fs.writeFile(absolutePath, content, 'utf-8');

      const lines = content.split('\n').length;
      return {
        success: true,
        message: `Created file ${filePath} with ${lines} lines`,
        lineCount: lines
      };

    } catch (error) {
      return {
        success: false,
        error: `Could not create file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Replace string in file
   */
  private async replaceString(filePath: string, oldStr: string, newStr: string): Promise<FileEditResult> {
    const absolutePath = path.resolve(filePath);

    try {
      const content = await fs.readFile(absolutePath, 'utf-8');
      
      // Check if old string exists and is unique
      const occurrences = (content.match(new RegExp(this.escapeRegExp(oldStr), 'g')) || []).length;
      
      if (occurrences === 0) {
        return {
          success: false,
          error: `String not found in file: "${oldStr}"`
        };
      }

      if (occurrences > 1) {
        return {
          success: false,
          error: `String appears ${occurrences} times in file. Make sure old_str is unique.`
        };
      }

      // Perform replacement
      const newContent = content.replace(oldStr, newStr);
      await fs.writeFile(absolutePath, newContent, 'utf-8');

      const linesChanged = newStr.split('\n').length - oldStr.split('\n').length;
      return {
        success: true,
        message: `Successfully replaced string in ${filePath}`,
        lineCount: newContent.split('\n').length,
        content: `Lines changed: ${linesChanged > 0 ? '+' : ''}${linesChanged}`
      };

    } catch (error) {
      return {
        success: false,
        error: `Could not replace string: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Insert text after specified line
   */
  private async insertText(filePath: string, lineNumber: number, text: string): Promise<FileEditResult> {
    const absolutePath = path.resolve(filePath);

    try {
      const content = await fs.readFile(absolutePath, 'utf-8');
      const lines = content.split('\n');

      if (lineNumber < 0 || lineNumber > lines.length) {
        return {
          success: false,
          error: `Invalid line number: ${lineNumber}. File has ${lines.length} lines.`
        };
      }

      // Insert text after the specified line
      lines.splice(lineNumber, 0, text);
      const newContent = lines.join('\n');
      
      await fs.writeFile(absolutePath, newContent, 'utf-8');

      return {
        success: true,
        message: `Inserted text after line ${lineNumber} in ${filePath}`,
        lineCount: lines.length
      };

    } catch (error) {
      return {
        success: false,
        error: `Could not insert text: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * List directory contents
   */
  private async listDirectory(dirPath: string): Promise<FileEditResult> {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      
      const listing = items
        .sort((a, b) => {
          // Directories first, then files, alphabetically
          if (a.isDirectory() !== b.isDirectory()) {
            return a.isDirectory() ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        })
        .map(item => {
          const type = item.isDirectory() ? 'DIR' : 'FILE';
          return `${type}: ${item.name}`;
        })
        .join('\n');

      return {
        success: true,
        content: listing,
        message: `Directory listing for ${dirPath}`,
        lineCount: items.length
      };

    } catch (error) {
      return {
        success: false,
        error: `Could not list directory: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Utility method to escape regex special characters
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get file information
   */
  async getFileInfo(filePath: string): Promise<{ exists: boolean; isDirectory: boolean; size: number; lines?: number }> {
    try {
      const stats = await fs.stat(filePath);
      let lines: number | undefined;

      if (!stats.isDirectory() && stats.size < this.maxFileSize) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          lines = content.split('\n').length;
        } catch {
          // Ignore if can't read file
        }
      }

      return {
        exists: true,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        lines
      };
    } catch {
      return {
        exists: false,
        isDirectory: false,
        size: 0
      };
    }
  }
}

export const strReplaceEditorTool = new StrReplaceEditorTool();