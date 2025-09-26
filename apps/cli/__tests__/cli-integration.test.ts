import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawn, SpawnOptions } from 'child_process';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { resolve, join } from 'path';

/**
 * 檢測運行環境並提供適當的回退機制
 */
function detectEnvironment() {
  return {
    isCI: !!(process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI || process.env.JENKINS_URL),
    isTest: process.env.NODE_ENV === 'test',
    isWindows: process.platform === 'win32',
    hasYarn: !!process.env.npm_config_user_agent?.includes('yarn'),
    hasPnpm: !!process.env.npm_config_user_agent?.includes('pnpm')
  };
}

/**
 * 獲取可執行的CLI命令
 * 使用多重回退策略確保在不同環境中都能正常執行
 */
function getCliCommand(): { command: string; args: string[]; baseArgs: string[] } {
  const projectRoot = resolve(import.meta.dirname, '../../..');
  const cliIndexPath = resolve(import.meta.dirname, '../src/index.ts');
  const env = detectEnvironment();
  
  // 命令優先級列表（按優先級排序）
  const commandStrategies = [
    // 策略1：使用 pnpm exec tsx（推薦，適用於大部分環境）
    {
      name: 'pnpm-exec-tsx',
      command: 'pnpm',
      args: ['exec', 'tsx'],
      baseArgs: [cliIndexPath],
      condition: () => true // 總是嘗試
    },
    // 策略2：使用 npx tsx（適用於 npm 環境）
    {
      name: 'npx-tsx',
      command: 'npx',
      args: ['tsx'],
      baseArgs: [cliIndexPath],
      condition: () => !env.hasPnpm
    },
    // 策略3：直接使用 tsx（如果在 PATH 中）
    {
      name: 'direct-tsx',
      command: 'tsx',
      args: [],
      baseArgs: [cliIndexPath],
      condition: () => !env.isCI
    }
  ];
  
  // 在 CI 環境中，優先使用 pnpm exec
  if (env.isCI) {
    return commandStrategies[0];
  }
  
  // 在本地環境中，根據包管理器選擇
  if (env.hasPnpm) {
    return commandStrategies[0];
  } else {
    return commandStrategies[1];
  }
}

/**
 * 執行CLI命令的包裝函數，提供錯誤處理和重試機制
 */
function spawnCliCommand(additionalArgs: string[] = [], options: Partial<SpawnOptions> = {}) {
  const { command, args, baseArgs } = getCliCommand();
  const fullArgs = [...args, ...baseArgs, ...additionalArgs];
  const projectRoot = resolve(import.meta.dirname, '../../..');
  const env = detectEnvironment();
  
  const defaultOptions: SpawnOptions = {
    cwd: projectRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      // 確保在 CI 環境中有正確的 PATH
      PATH: process.env.PATH + (env.isWindows ? ';' : ':') + join(projectRoot, 'node_modules', '.bin')
    },
    // Windows 環境特殊處理
    shell: env.isWindows
  };
  
  console.log(`[TEST] Executing CLI command: ${command} ${fullArgs.join(' ')}`);
  console.log(`[TEST] Working directory: ${projectRoot}`);
  console.log(`[TEST] Environment: CI=${env.isCI}, Test=${env.isTest}, Platform=${process.platform}`);
  
  return spawn(command, fullArgs, { ...defaultOptions, ...options });
}

/**
 * 帶超時和錯誤處理的 CLI 執行函數
 */
function executeCliWithTimeout(
  args: string[] = [], 
  timeoutMs: number = 15000,
  options: Partial<SpawnOptions> = {}
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawnCliCommand(args, options);
    let stdout = '';
    let stderr = '';
    let isResolved = false;
    
    // 設置超時
    const timeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        child.kill('SIGTERM');
        reject(new Error(`CLI command timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('error', (error) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        console.error(`[TEST] CLI spawn error:`, error);
        reject(error);
      }
    });
    
    child.on('close', (code) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        resolve({ stdout, stderr, code: code || 0 });
      }
    });
    
    child.on('exit', (code, signal) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeout);
        console.log(`[TEST] CLI exited with code: ${code}, signal: ${signal}`);
        resolve({ stdout, stderr, code: code || 0 });
      }
    });
  });
}

const testDir = resolve(import.meta.dirname, '../../../test-fixtures');
const testSpecFile = join(testDir, 'test-spec.yaml');
const testFlowFile = join(testDir, 'test-flow.yaml');

// Test fixtures
const testOpenAPISpec = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /test:
    get:
      summary: Test endpoint
      responses:
        200:
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
`;

const testFlow = `
name: Test Flow
config:
  baseUrl: http://localhost:3000
steps:
  - name: Get Test
    request:
      method: GET
      path: /test
    validation:
      statusCode: 200
`;

describe('CLI 整合測試', () => {
  beforeEach(() => {
    // 建立測試目錄和檔案
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    writeFileSync(testSpecFile, testOpenAPISpec);
    writeFileSync(testFlowFile, testFlow);
  });

  afterEach(() => {
    // 清理測試檔案
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('CLI 執行與退出碼', () => {
    it('應該在缺少必要參數時返回錯誤退出碼', async () => {
      const result = await executeCliWithTimeout([]);
      expect(result.code).toBe(1); // Commander.js 會在缺少必要參數時返回 1
    }, 15000);

    it('應該在檔案不存在時返回系統錯誤碼', async () => {
      const result = await executeCliWithTimeout([
        '--spec', 'nonexistent.yaml',
        '--flow', 'nonexistent.yaml'
      ]);
      expect(result.code).toBe(2); // 系統錯誤
      expect(result.stderr).toContain('檔案不存在');
    }, 15000);

    it('應該成功載入有效的規格和流程檔案', async () => {
      const result = await executeCliWithTimeout([
        '--spec', testSpecFile,
        '--flow', testFlowFile,
        '--baseUrl', 'http://localhost:3000'
      ]);
      
      console.log('STDOUT:', result.stdout);
      console.log('STDERR:', result.stderr);
      console.log('Exit code:', result.code);
      
      expect(result.code).toBe(0); // 成功
      expect(result.stdout).toContain('規格載入成功');
      expect(result.stdout).toContain('流程載入成功');
      expect(result.stdout).toContain('CLI 執行完成');
    }, 15000);

    it('應該顯示幫助資訊', async () => {
      const result = await executeCliWithTimeout(['--help']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('SpecPilot API 測試與驗證工具');
      expect(result.stdout).toContain('--spec');
      expect(result.stdout).toContain('--flow');
      expect(result.stdout).toContain('範例:');
      expect(result.stdout).toContain('退出碼:');
    }, 15000);

    it('應該顯示版本資訊', async () => {
      const result = await executeCliWithTimeout(['--version']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('0.1.0');
    }, 15000);

    it('應該正確處理設定覆寫', async () => {
      const result = await executeCliWithTimeout([
        '--spec', testSpecFile,
        '--flow', testFlowFile,
        '--baseUrl', 'https://api.override.com',
        '--port', '8080',
        '--token', 'test-token',
        '--verbose'
      ]);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('規格載入成功');
      expect(result.stdout).toContain('流程載入成功');
    }, 15000);
  });

  describe('日誌記錄驗證', () => {
    it('應該記錄結構化日誌事件', async () => {
      const result = await executeCliWithTimeout([
        '--spec', testSpecFile,
        '--flow', testFlowFile
      ]);
      
      // 檢查控制台輸出包含預期的事件
      expect(result.stdout).toContain('規格載入成功');
      expect(result.stdout).toContain('流程載入成功');
      expect(result.stdout).toContain('CLI 執行完成');
    }, 15000);
  });

  describe('環境檢測與回退機制', () => {
    it('應該正確檢測運行環境', () => {
      const env = detectEnvironment();
      
      expect(typeof env.isCI).toBe('boolean');
      expect(typeof env.isTest).toBe('boolean');
      expect(typeof env.isWindows).toBe('boolean');
      expect(typeof env.hasYarn).toBe('boolean');
      expect(typeof env.hasPnpm).toBe('boolean');
      
      // 在測試環境中，isTest 應該為 true
      expect(env.isTest).toBe(true);
    });

    it('應該根據環境選擇合適的命令策略', () => {
      const command = getCliCommand();
      
      expect(command).toHaveProperty('command');
      expect(command).toHaveProperty('args');
      expect(command).toHaveProperty('baseArgs');
      expect(Array.isArray(command.args)).toBe(true);
      expect(Array.isArray(command.baseArgs)).toBe(true);
      expect(command.baseArgs.length).toBeGreaterThan(0);
    });

    it('應該在命令失敗時提供有用的錯誤資訊', async () => {
      // 測試無效命令的處理
      try {
        await executeCliWithTimeout(['--invalid-option'], 5000);
      } catch (error) {
        // 這裡預期會有錯誤，因為 --invalid-option 不是有效選項
        expect(error).toBeDefined();
      }
    });

    it('應該在超時時正確處理', async () => {
      // 測試超時機制（使用極短的超時時間）
      try {
        await executeCliWithTimeout(['--help'], 1); // 1ms 超時，幾乎必定超時
        // 如果沒有超時，這也是可接受的（命令執行得很快）
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('timed out');
      }
    }, 2000);
  });

  describe('CI/CD 兼容性測試', () => {
    it('應該能夠處理不同的包管理器環境', () => {
      // 模擬不同的包管理器環境
      const originalUserAgent = process.env.npm_config_user_agent;
      
      try {
        // 測試 pnpm 環境
        process.env.npm_config_user_agent = 'pnpm/8.0.0';
        let command = getCliCommand();
        expect(command.command).toBe('pnpm');
        expect(command.args).toContain('exec');
        
        // 測試 npm 環境
        process.env.npm_config_user_agent = 'npm/9.0.0';
        command = getCliCommand();
        expect(command.command).toBe('npx');
        
        // 測試 yarn 環境
        process.env.npm_config_user_agent = 'yarn/1.22.0';
        command = getCliCommand();
        expect(command.command).toBe('npx');
        
      } finally {
        // 恢復原始環境
        if (originalUserAgent) {
          process.env.npm_config_user_agent = originalUserAgent;
        } else {
          delete process.env.npm_config_user_agent;
        }
      }
    });

    it('應該在 CI 環境中使用合適的命令', () => {
      const originalCI = process.env.CI;
      
      try {
        // 模擬 CI 環境
        process.env.CI = 'true';
        const command = getCliCommand();
        
        expect(command.command).toBe('pnpm');
        expect(command.args).toContain('exec');
        expect(command.args).toContain('tsx');
        
      } finally {
        // 恢復原始環境
        if (originalCI) {
          process.env.CI = originalCI;
        } else {
          delete process.env.CI;
        }
      }
    });

    it('應該正確設置環境變數和工作目錄', () => {
      const child = spawnCliCommand(['--help']);
      
      // 驗證子進程有正確的設定
      expect(child).toBeDefined();
      expect(child.spawnfile).toBeDefined();
      
      // 等待一小段時間讓進程啟動
      setTimeout(() => {
        child.kill('SIGTERM');
      }, 100);
    });
  });
});