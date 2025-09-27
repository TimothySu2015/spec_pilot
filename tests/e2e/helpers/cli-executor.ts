import { execa, type ResultPromise } from 'execa';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

export interface CliExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface CliExecutionOptions {
  spec?: string;
  flow?: string;
  baseUrl?: string;
  port?: number;
  token?: string;
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

export class CliExecutor {
  private readonly cliPath: string;
  private readonly projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || path.resolve(__dirname, '../../../');
    this.cliPath = path.join(this.projectRoot, 'apps/cli/bin/specpilot.ts');
  }

  async execute(options: CliExecutionOptions): Promise<CliExecutionResult> {
    const args: string[] = ['run'];

    if (options.spec) {
      args.push('--spec', options.spec);
    }

    if (options.flow) {
      args.push('--flow', options.flow);
    }

    if (options.baseUrl) {
      args.push('--baseUrl', options.baseUrl);
    }

    if (options.port !== undefined) {
      args.push('--port', String(options.port));
    }

    if (options.token) {
      args.push('--token', options.token);
    }

    const startTime = performance.now();

    try {
      const result = await execa('tsx', [this.cliPath, ...args], {
        cwd: options.cwd || this.projectRoot,
        timeout: options.timeout || 30000,
        env: {
          ...process.env,
          ...options.env,
          NODE_ENV: 'test',
        },
        reject: false,
      });

      const endTime = performance.now();

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode ?? 2,
        duration: endTime - startTime,
      };
    } catch (error) {
      const endTime = performance.now();

      if (error && typeof error === 'object' && 'timedOut' in error && error.timedOut) {
        return {
          stdout: '',
          stderr: 'CLI execution timed out',
          exitCode: 2,
          duration: endTime - startTime,
        };
      }

      throw error;
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async readFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  }

  async readJsonFile<T = unknown>(filePath: string): Promise<T> {
    const content = await this.readFile(filePath);
    return JSON.parse(content) as T;
  }

  async cleanupFiles(patterns: string[]): Promise<void> {
    for (const pattern of patterns) {
      const fullPath = path.isAbsolute(pattern)
        ? pattern
        : path.join(this.projectRoot, pattern);

      try {
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          await fs.rm(fullPath, { recursive: true, force: true });
        } else {
          await fs.unlink(fullPath);
        }
      } catch (error) {
        // 檔案不存在時忽略錯誤
      }
    }
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }

  getReportPath(reportName: string = 'result.json'): string {
    return path.join(this.projectRoot, 'reports', reportName);
  }

  getLogPath(logName: string = 'execution.log'): string {
    return path.join(this.projectRoot, 'logs', logName);
  }
}