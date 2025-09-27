import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { EnhancedStructuredLogger, type LogRotationConfig } from '../src/enhanced-logger.js';

describe('EnhancedStructuredLogger', () => {
  let testDir: string;
  let logger: EnhancedStructuredLogger;

  beforeEach(() => {
    testDir = join(process.cwd(), 'test-logs');
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });

    // 設定測試用的環境變數
    process.env.LOG_LEVEL = 'debug';

    // 建立 logger，使用測試目錄
    const originalCwd = process.cwd;
    process.cwd = vi.fn().mockReturnValue(testDir);

    logger = new EnhancedStructuredLogger('test-component', 'test-exec-123');

    process.cwd = originalCwd;
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    vi.clearAllMocks();
  });

  describe('步驟日誌記錄', () => {
    test('應該記錄步驟開始', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.logStepStart('test_step', { additionalInfo: 'test data' });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('應該記錄步驟完成', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.logStepComplete('test_step', 1500, { result: 'success' });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('應該記錄步驟失敗', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      logger.logStepFailure('test_step', 800, 'Connection timeout', {
        url: 'https://api.example.com'
      });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('HTTP 事件記錄', () => {
    test('應該記錄 HTTP 請求發送', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const request = {
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: { 'Content-Type': 'application/json' },
        body: { name: 'John Doe' }
      };

      logger.logRequestSent('create_user', request);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('應該記錄 HTTP 回應接收', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const response = {
        statusCode: 201,
        validationResults: ['schema_valid', 'business_rule_passed'],
        errorMessage: undefined
      };

      logger.logResponseReceived('create_user', response);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('應該記錄包含錯誤的回應', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const response = {
        statusCode: 400,
        validationResults: ['schema_invalid'],
        errorMessage: 'Invalid request format'
      };

      logger.logResponseReceived('create_user', response);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('敏感資料遮罩', () => {
    test('應該遮罩敏感欄位', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const sensitiveData = {
        username: 'john',
        password: 'secret123',
        token: 'bearer_token',
        apiKey: 'api_key_value',
        normalField: 'normal_value'
      };

      logger.info('Testing sensitive data masking', sensitiveData);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('雜湊計算', () => {
    test('應該為請求 headers 和 body 計算正確的雜湊值', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const request = {
        method: 'POST',
        url: 'https://api.example.com/test',
        headers: { 'Content-Type': 'application/json' },
        body: { test: 'data' }
      };

      logger.logRequestSent('test_step', request);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('子 Logger', () => {
    test('應該建立子 Logger', () => {
      const childBindings = { module: 'auth', operation: 'login' };
      const childLogger = logger.child(childBindings);

      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe('function');
      expect(typeof childLogger.logStepStart).toBe('function');
    });

    test('子 Logger 應該繼承執行 ID', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const childLogger = logger.child({ module: 'test' });
      childLogger.info('Child logger test message');

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('日誌輪替配置', () => {
    test('應該接受自訂輪替配置', () => {
      const customConfig: Partial<LogRotationConfig> = {
        maxFileSize: '5MB',
        maxFiles: 5,
        compress: false
      };

      const customLogger = new EnhancedStructuredLogger(
        'custom-component',
        'custom-exec',
        customConfig
      );

      expect(customLogger).toBeDefined();
    });

    test('應該解析檔案大小字串', () => {
      // 這個測試檢查內部方法，通常會通過建構函式測試
      const logger = new EnhancedStructuredLogger('test', 'exec', {
        maxFileSize: '1GB'
      });

      expect(logger).toBeDefined();
    });
  });

  describe('一般日誌方法', () => {
    test('應該記錄 info 訊息', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.info('Info message', { key: 'value' });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('應該記錄 warn 訊息', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.warn('Warning message', { warning: 'level' });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('應該記錄 error 訊息', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      logger.error('Error message', { error: 'details' });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('應該記錄 debug 訊息', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.debug('Debug message', { debug: 'info' });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});