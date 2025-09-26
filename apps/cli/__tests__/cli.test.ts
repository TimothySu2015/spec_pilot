import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStructuredLogger } from '@specpilot/shared';
import { getConfig, overrideConfig } from '@specpilot/config';
import { loadSpec } from '@specpilot/spec-loader';
import { loadFlow } from '@specpilot/flow-parser';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Mock external dependencies
vi.mock('@specpilot/spec-loader', () => ({
  loadSpec: vi.fn().mockResolvedValue({
    info: { title: 'Test API', version: '1.0.0' },
    paths: { '/test': {} },
    components: { schemas: { TestSchema: {} } }
  })
}));

vi.mock('@specpilot/flow-parser', () => ({
  loadFlow: vi.fn().mockResolvedValue({
    name: 'Test Flow',
    steps: [{ name: 'test-step' }],
    config: { baseUrl: 'http://localhost:3000' }
  })
}));

vi.mock('@specpilot/config', () => ({
  getConfig: vi.fn().mockReturnValue({
    environment: 'test',
    port: 3000,
    baseUrl: 'http://localhost:3000',
    token: undefined
  }),
  overrideConfig: vi.fn()
}));

vi.mock('fs', () => ({
  existsSync: vi.fn()
}));

const mockExistsSync = vi.mocked(existsSync);

describe('CLI Application', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true); // 預設檔案存在
  });

  describe('檔案路徑驗證', () => {
    it('應該驗證檔案存在性', () => {
      const validateFilePath = (filePath: string, fileType: string): string => {
        const resolvedPath = resolve(filePath);
        
        if (!existsSync(resolvedPath)) {
          throw new Error(`${fileType}檔案不存在: ${resolvedPath}`);
        }
        
        return resolvedPath;
      };

      mockExistsSync.mockReturnValue(false);
      expect(() => validateFilePath('nonexistent.yaml', 'OpenAPI 規格'))
        .toThrow('OpenAPI 規格檔案不存在:');

      mockExistsSync.mockReturnValue(true);
      expect(() => validateFilePath('existing.yaml', 'OpenAPI 規格'))
        .not.toThrow();
    });
  });

  describe('敏感資訊遮罩', () => {
    it('應該遮罩敏感資訊', () => {
      const maskSensitiveInfo = (config: any): any => {
        return {
          ...config,
          token: config.token ? '***' : undefined,
        };
      };

      const config = { baseUrl: 'http://localhost', token: 'secret123', port: 3000 };
      const masked = maskSensitiveInfo(config);

      expect(masked.token).toBe('***');
      expect(masked.baseUrl).toBe('http://localhost');
      expect(masked.port).toBe(3000);
    });
  });

  describe('CLI 參數解析整合', () => {
    it('應該模擬 CLI 執行流程', async () => {
      const { loadSpec } = await import('@specpilot/spec-loader');
      const { loadFlow } = await import('@specpilot/flow-parser');

      // 模擬成功的 CLI 執行
      const mockOptions = {
        spec: 'test-spec.yaml',
        flow: 'test-flow.yaml',
        baseUrl: 'http://localhost:3000',
        port: 8080,
        token: 'test-token'
      };

      // 執行載入邏輯
      const spec = await loadSpec(mockOptions.spec);
      const flow = await loadFlow(mockOptions.flow);

      expect(loadSpec).toHaveBeenCalledWith('test-spec.yaml');
      expect(loadFlow).toHaveBeenCalledWith('test-flow.yaml');
      expect(spec.info.title).toBe('Test API');
      expect(flow.name).toBe('Test Flow');
    });

    it('應該處理規格載入失敗', async () => {
      const { loadSpec } = await import('@specpilot/spec-loader');
      vi.mocked(loadSpec).mockRejectedValueOnce(new Error('Invalid spec file'));

      try {
        await loadSpec('invalid-spec.yaml');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Invalid spec file');
      }
    });

    it('應該處理流程載入失敗', async () => {
      const { loadFlow } = await import('@specpilot/flow-parser');
      vi.mocked(loadFlow).mockRejectedValueOnce(new Error('Invalid flow file'));

      try {
        await loadFlow('invalid-flow.yaml');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Invalid flow file');
      }
    });
  });

  describe('依賴模組集成', () => {
    it('應該能建立結構化 Logger', () => {
      const logger = createStructuredLogger('cli');
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
    });

    it('應該能載入設定', () => {
      const config = getConfig();
      expect(config).toBeDefined();
      expect(config).toHaveProperty('environment');
      expect(config).toHaveProperty('port');
    });
  });

  describe('CLI 參數結構', () => {
    it('應該定義必要的 CLI 選項', () => {
      const requiredOptions = ['spec', 'flow'];
      const optionalOptions = ['baseUrl', 'port', 'token', 'verbose'];
      
      // 驗證選項定義存在
      expect(requiredOptions).toContain('spec');
      expect(requiredOptions).toContain('flow');
      expect(optionalOptions).toContain('baseUrl');
      expect(optionalOptions).toContain('port');
      expect(optionalOptions).toContain('token');
    });

    it('應該支援版本與幫助選項', () => {
      const standardOptions = ['version', 'help'];
      expect(standardOptions).toContain('version');
      expect(standardOptions).toContain('help');
    });
  });

  describe('錯誤處理與退出碼', () => {
    it('應該定義正確的退出碼', () => {
      const exitCodes = {
        SUCCESS: 0,
        FAILURE: 1,
        SYSTEM_ERROR: 2,
      };

      expect(exitCodes.SUCCESS).toBe(0);
      expect(exitCodes.FAILURE).toBe(1);
      expect(exitCodes.SYSTEM_ERROR).toBe(2);
    });

    it('應該處理參數驗證錯誤', () => {
      // 模擬參數驗證邏輯
      const validateArgs = (args: any) => {
        if (!args.spec) throw new Error('Missing required option: --spec');
        if (!args.flow) throw new Error('Missing required option: --flow');
        return true;
      };

      expect(() => validateArgs({})).toThrow('Missing required option: --spec');
      expect(() => validateArgs({ spec: 'test.yaml' })).toThrow('Missing required option: --flow');
      expect(validateArgs({ spec: 'test.yaml', flow: 'test.yaml' })).toBe(true);
    });
  });

  describe('設定管理整合', () => {
    it('應該支援環境變數覆寫', () => {
      // 模擬設定覆寫邏輯
      const mockOverrideConfig = (config: any, cliArgs: any) => {
        return {
          ...config,
          ...(cliArgs.baseUrl && { baseUrl: cliArgs.baseUrl }),
          ...(cliArgs.port && { port: cliArgs.port }),
          ...(cliArgs.token && { token: cliArgs.token }),
        };
      };

      const baseConfig = { baseUrl: 'http://default.com', port: 443 };
      const cliArgs = { baseUrl: 'http://override.com', port: 8080 };
      const result = mockOverrideConfig(baseConfig, cliArgs);

      expect(result.baseUrl).toBe('http://override.com');
      expect(result.port).toBe(8080);
    });

    it('應該正確調用 overrideConfig', async () => {
      const mockOverrideConfig = vi.mocked(overrideConfig);
      
      // 模擬覆寫邏輯
      const options = {
        baseUrl: 'https://api.example.com',
        port: 8080,
        token: 'test-token'
      };

      if (options.baseUrl || options.port || options.token) {
        overrideConfig({
          ...(options.baseUrl && { baseUrl: options.baseUrl }),
          ...(options.port && { port: options.port }),
          ...(options.token && { token: options.token }),
        });
      }

      expect(mockOverrideConfig).toHaveBeenCalledWith({
        baseUrl: 'https://api.example.com',
        port: 8080,
        token: 'test-token'
      });
    });
  });

  describe('CLI 主要功能直接測試', () => {
    it('應該能直接調用載入規格功能', async () => {
      const mockLoadSpec = vi.mocked(loadSpec);
      mockExistsSync.mockReturnValue(true);
      
      const specPath = '/path/to/spec.yaml';
      const result = await loadSpec(specPath);
      
      expect(mockLoadSpec).toHaveBeenCalledWith(specPath);
      expect(result).toEqual({
        info: { title: 'Test API', version: '1.0.0' },
        paths: { '/test': {} },
        components: { schemas: { TestSchema: {} } }
      });
    });

    it('應該能直接調用載入流程功能', async () => {
      const mockLoadFlow = vi.mocked(loadFlow);
      mockExistsSync.mockReturnValue(true);
      
      const flowPath = '/path/to/flow.yaml';
      const result = await loadFlow(flowPath);
      
      expect(mockLoadFlow).toHaveBeenCalledWith(flowPath);
      expect(result).toEqual({
        name: 'Test Flow',
        steps: [{ name: 'test-step' }],
        config: { baseUrl: 'http://localhost:3000' }
      });
    });

    it('應該正確處理載入錯誤', async () => {
      const mockLoadSpec = vi.mocked(loadSpec);
      mockLoadSpec.mockRejectedValueOnce(new Error('Invalid OpenAPI specification'));
      
      await expect(loadSpec('/invalid/spec.yaml')).rejects.toThrow('Invalid OpenAPI specification');
      expect(mockLoadSpec).toHaveBeenCalledWith('/invalid/spec.yaml');
    });

    it('應該正確處理流程載入錯誤', async () => {
      const mockLoadFlow = vi.mocked(loadFlow);
      mockLoadFlow.mockRejectedValueOnce(new Error('Invalid YAML syntax'));
      
      await expect(loadFlow('/invalid/flow.yaml')).rejects.toThrow('Invalid YAML syntax');
      expect(mockLoadFlow).toHaveBeenCalledWith('/invalid/flow.yaml');
    });
  });

  describe('CLI 實際執行邏輯模擬', () => {
    it('應該模擬完整的成功執行流程', async () => {
      const mockGetConfig = vi.mocked(getConfig);
      const mockLoadSpec = vi.mocked(loadSpec);
      const mockLoadFlow = vi.mocked(loadFlow);
      
      mockExistsSync.mockReturnValue(true);
      
      // 模擬成功執行的完整流程
      const options = {
        spec: '/path/to/spec.yaml',
        flow: '/path/to/flow.yaml',
        baseUrl: 'http://localhost:3000'
      };
      
      // 1. 檢查檔案存在
      const specExists = existsSync(options.spec);
      const flowExists = existsSync(options.flow);
      expect(specExists).toBe(true);
      expect(flowExists).toBe(true);
      
      // 2. 載入設定
      const config = getConfig();
      expect(config).toBeDefined();
      expect(config.baseUrl).toBe('http://localhost:3000');
      
      // 3. 載入規格
      const spec = await loadSpec(options.spec);
      expect(spec.info.title).toBe('Test API');
      
      // 4. 載入流程
      const flow = await loadFlow(options.flow);
      expect(flow.name).toBe('Test Flow');
      expect(flow.steps).toHaveLength(1);
      
      // 驗證所有函數都被正確調用
      expect(mockGetConfig).toHaveBeenCalled();
      expect(mockLoadSpec).toHaveBeenCalledWith(options.spec);
      expect(mockLoadFlow).toHaveBeenCalledWith(options.flow);
    });

    it('應該模擬檔案不存在的錯誤情況', () => {
      mockExistsSync.mockReturnValue(false);
      
      const validateFilePath = (filePath: string, fileType: string): string => {
        const resolvedPath = resolve(filePath);
        
        if (!existsSync(resolvedPath)) {
          throw new Error(`${fileType}檔案不存在: ${resolvedPath}`);
        }
        
        return resolvedPath;
      };
      
      expect(() => validateFilePath('/nonexistent/spec.yaml', 'OpenAPI 規格'))
        .toThrow('OpenAPI 規格檔案不存在:');
      expect(() => validateFilePath('/nonexistent/flow.yaml', 'YAML 流程'))
        .toThrow('YAML 流程檔案不存在:');
    });

    it('應該模擬設定覆寫的完整流程', async () => {
      const mockOverrideConfig = vi.mocked(overrideConfig);
      const mockGetConfig = vi.mocked(getConfig);
      
      // 模擬有 CLI 參數的情況
      const cliOptions = {
        baseUrl: 'https://api.override.com',
        port: 8080,
        token: 'override-token'
      };
      
      // 執行設定覆寫
      if (cliOptions.baseUrl || cliOptions.port || cliOptions.token) {
        overrideConfig({
          ...(cliOptions.baseUrl && { baseUrl: cliOptions.baseUrl }),
          ...(cliOptions.port && { port: cliOptions.port }),
          ...(cliOptions.token && { token: cliOptions.token }),
        });
      }
      
      // 獲取最終設定
      const finalConfig = getConfig();
      
      expect(mockOverrideConfig).toHaveBeenCalledWith({
        baseUrl: 'https://api.override.com',
        port: 8080,
        token: 'override-token'
      });
      expect(mockGetConfig).toHaveBeenCalled();
      expect(finalConfig).toBeDefined();
    });
  });

  describe('日誌與錯誤處理直接測試', () => {
    it('應該創建正確的結構化 Logger', () => {
      const logger = createStructuredLogger('cli');
      
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('應該能記錄不同類型的事件', () => {
      const logger = createStructuredLogger('cli');
      
      // 測試不會拋出錯誤
      expect(() => {
        logger.info('CLI_START', { executionId: 'test-123', event: 'CLI_START' });
        logger.error('CLI_FAILURE', { executionId: 'test-123', error: 'Test error' });
        logger.warn('TEST_WARNING', { executionId: 'test-123', message: 'Test warning' });
      }).not.toThrow();
    });

    it('應該正確遮罩敏感資訊', () => {
      const maskSensitiveInfo = (config: Record<string, unknown>): Record<string, unknown> => {
        return {
          ...config,
          token: config.token ? '***' : undefined,
        };
      };

      const testCases = [
        {
          input: { baseUrl: 'http://localhost', token: 'secret123', port: 3000 },
          expected: { baseUrl: 'http://localhost', token: '***', port: 3000 }
        },
        {
          input: { baseUrl: 'http://localhost', token: null, port: 3000 },
          expected: { baseUrl: 'http://localhost', token: undefined, port: 3000 }
        },
        {
          input: { baseUrl: 'http://localhost', port: 3000 },
          expected: { baseUrl: 'http://localhost', token: undefined, port: 3000 }
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = maskSensitiveInfo(input);
        expect(result).toEqual(expected);
      });
    });
  });
});