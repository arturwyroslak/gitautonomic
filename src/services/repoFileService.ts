// Repository file fetching and analysis service
import { getInstallationOctokit } from '../octokit.js';
import pino from 'pino';
import { parse as parseYAML } from 'yaml';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface RepoFile {
  path: string;
  content: string;
  type: 'file' | 'dir';
  size: number;
  sha: string;
}

export interface RepoSnapshot {
  files: RepoFile[];
  tree: TreeNode[];
  totalFiles: number;
  totalSize: number;
}

export interface TreeNode {
  path: string;
  type: 'tree' | 'blob';
  size?: number;
  sha: string;
}

export class RepoFileService {
  
  async getRepoSnapshot(
    installationId: string,
    owner: string,
    repo: string,
    branch: string = 'main',
    maxFiles: number = 100,
    maxFileSize: number = 50000
  ): Promise<RepoSnapshot> {
    const octokit = await getInstallationOctokit(installationId);
    
    try {
      // Get the repository tree
      const { data: refData } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`
      });

      const { data: treeData } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: refData.object.sha,
        recursive: 'true'
      });

      // Filter for files only and sort by importance
      const fileEntries = treeData.tree
        .filter(item => item.type === 'blob' && item.size && item.size <= maxFileSize)
        .sort((a, b) => this.getFileImportance(a.path || '') - this.getFileImportance(b.path || ''))
        .slice(0, maxFiles);

      const files: RepoFile[] = [];
      
      // Fetch file contents in batches to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < fileEntries.length; i += batchSize) {
        const batch = fileEntries.slice(i, i + batchSize);
        const batchPromises = batch.map(async (entry) => {
          try {
            const { data } = await octokit.rest.repos.getContent({
              owner,
              repo,
              path: entry.path!,
              ref: branch
            });

            if ('content' in data && data.content) {
              const content = Buffer.from(data.content, 'base64').toString('utf-8');
              return {
                path: entry.path!,
                content,
                type: 'file' as const,
                size: entry.size || 0,
                sha: entry.sha!
              };
            }
          } catch (error) {
            log.warn(`Failed to fetch ${entry.path}: ${error}`);
          }
          return null;
        });

        const batchResults = await Promise.all(batchPromises);
        files.push(...batchResults.filter(Boolean) as RepoFile[]);
      }

      const tree: TreeNode[] = treeData.tree.map(item => ({
        path: item.path!,
        type: item.type as 'tree' | 'blob',
        size: item.size,
        sha: item.sha!
      }));

      return {
        files,
        tree,
        totalFiles: files.length,
        totalSize: files.reduce((sum, f) => sum + f.size, 0)
      };
      
    } catch (error) {
      log.error(`Failed to get repo snapshot: ${error}`);
      throw error;
    }
  }

  async getSpecificFiles(
    installationId: string,
    owner: string,
    repo: string,
    filePaths: string[],
    branch: string = 'main'
  ): Promise<RepoFile[]> {
    const octokit = await getInstallationOctokit(installationId);
    const files: RepoFile[] = [];

    for (const path of filePaths) {
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path,
          ref: branch
        });

        if ('content' in data && data.content) {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          files.push({
            path,
            content,
            type: 'file',
            size: data.size,
            sha: data.sha
          });
        }
      } catch (error) {
        log.warn(`Failed to fetch ${path}: ${error}`);
      }
    }

    return files;
  }

  async getConfigFiles(
    installationId: string,
    owner: string,
    repo: string,
    branch: string = 'main'
  ): Promise<{ aiagent?: any; ownership?: any; packageJson?: any }> {
    const configPaths = [
      '.aiagent.yml',
      '.aiagent-ownership.yml', 
      'package.json',
      'tsconfig.json',
      'docker-compose.yml',
      'Dockerfile'
    ];

    const files = await this.getSpecificFiles(installationId, owner, repo, configPaths, branch);
    const result: any = {};

    for (const file of files) {
      try {
        if (file.path === '.aiagent.yml') {
          result.aiagent = parseYAML(file.content);
        } else if (file.path === '.aiagent-ownership.yml') {
          result.ownership = parseYAML(file.content);
        } else if (file.path === 'package.json') {
          result.packageJson = JSON.parse(file.content);
        }
      } catch (error) {
        log.warn(`Failed to parse ${file.path}: ${error}`);
      }
    }

    return result;
  }

  private getFileImportance(path: string): number {
    // Lower numbers = higher priority
    if (path.match(/\.(md|txt|yml|yaml|json)$/i)) return 1;
    if (path.match(/\.(ts|tsx|js|jsx)$/i)) return 2;
    if (path.match(/\.(py|java|cpp|c|go|rs)$/i)) return 3;
    if (path.match(/\.(css|scss|less|html)$/i)) return 4;
    if (path.match(/test|spec/i)) return 5;
    if (path.includes('node_modules') || path.includes('.git')) return 100;
    return 10;
  }

  async getRelevantFiles(
    installationId: string,
    owner: string,
    repo: string,
    taskPaths: string[],
    branch: string = 'main',
    maxFiles: number = 50
  ): Promise<RepoFile[]> {
    // Get files that are relevant to the tasks being worked on
    const allFiles = await this.getRepoSnapshot(installationId, owner, repo, branch, maxFiles * 2);
    
    // Filter files based on task paths and relevance
    const relevantFiles = allFiles.files.filter(file => {
      // Include config files
      if (this.isConfigFile(file.path)) return true;
      
      // Include files that match task paths
      for (const taskPath of taskPaths) {
        if (file.path.includes(taskPath) || taskPath.includes(file.path)) {
          return true;
        }
      }
      
      // Include files in same directories as task paths
      for (const taskPath of taskPaths) {
        const taskDir = taskPath.split('/').slice(0, -1).join('/');
        if (file.path.startsWith(taskDir)) return true;
      }
      
      return false;
    });

    return relevantFiles.slice(0, maxFiles);
  }

  private isConfigFile(path: string): boolean {
    const configFiles = [
      'package.json', 'tsconfig.json', 'webpack.config.js', 'vite.config.ts',
      '.eslintrc.json', '.prettierrc', 'docker-compose.yml', 'Dockerfile',
      '.aiagent.yml', '.aiagent-ownership.yml', 'README.md'
    ];
    
    const filename = path.split('/').pop() || '';
    return configFiles.includes(filename) || path.endsWith('.config.js') || path.endsWith('.config.ts');
  }
}

export const repoFileService = new RepoFileService();