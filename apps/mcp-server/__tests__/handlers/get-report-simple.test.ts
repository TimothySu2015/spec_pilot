import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import path from 'path';

// Mock dependencies
vi.mock('@specpilot/shared', () => ({
  createStructuredLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockValidateReport = vi.fn().mockReturnValue({ valid: true, errors: [] });
vi.mock('@specpilot/reporting', () => ({
  ReportValidator: vi.fn().mockImplementation(() => ({
    validateReport: mockValidateReport,
  })),
}));

// Import after mocks
const { handleGetReport } = await import('../../src/handlers/get-report.js');
import type { IMcpRequest } from '../../src/rpc-handler.js';

describe('get-report 處理器簡化測試', () => {
  const testReportsDir = path.join(process.cwd(), 'reports');
  const testReportDir = path.join(process.cwd(), 'test-reports');

  beforeEach(() => {
    // 確保目錄存在
    if (!existsSync(testReportsDir)) {
      mkdirSync(testReportsDir, { recursive: true });
    }
    if (!existsSync(testReportDir)) {
      mkdirSync(testReportDir, { recursive: true });
    }

    // 重置 mock
    mockValidateReport.mockReset();
    mockValidateReport.mockReturnValue({ valid: true, errors: [] });
  });

  afterEach(() => {
    // 清理測試檔案
    try {
      if (existsSync(path.join(testReportsDir, 'result.json'))) {
        rmSync(path.join(testReportsDir, 'result.json'));
      }
      if (existsSync(path.join(testReportDir, 'test-report.json'))) {
        rmSync(path.join(testReportDir, 'test-report.json'));
      }
    } catch (error) {
      // 忽略清理錯誤
    }
  });

  it('應該成功讀取存在的報表檔案', () => {
    // Arrange
    const reportData = {
      executionId: 'test-execution-123',
      flowId: 'test-flow',
      startTime: '2025-09-28T03:13:46.332Z',
      endTime: '2025-09-28T03:13:47.332Z',
      duration: 1000,
      status: 'success' as const,
      summary: {
        totalSteps: 1,
        successfulSteps: 1,
        failedSteps: 0,
        skippedSteps: 0,
      },
      steps: [],
      config: {
        baseUrl: 'https://api.example.com',
        fallbackUsed: false,
        authNamespaces: ['default'],
      },
    };

    writeFileSync(
      path.join(testReportsDir, 'result.json'),
      JSON.stringify(reportData, null, 2)
    );

    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'getReport',
      id: 'test-request-1',
    };

    // Act
    const response = handleGetReport(request);

    // Assert
    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('test-request-1');
    expect(response.error).toBeUndefined();
    expect(response.result).toBeDefined();

    const result = response.result as any;
    expect(result.reportPath).toBe('reports/result.json');
    expect(result.executionId).toBe('test-execution-123');
    expect(result.status).toBe('success');
  });

  it('應該在報表檔案不存在時回傳錯誤', () => {
    // Arrange
    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'getReport',
      id: 'test-request-2',
    };

    // Act
    const response = handleGetReport(request);

    // Assert
    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('test-request-2');
    expect(response.result).toBeUndefined();
    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(-32603);
    expect(response.error!.message).toBe('找不到測試報表檔案');
  });

  it('應該在 JSON 格式無效時回傳錯誤', () => {
    // Arrange
    writeFileSync(
      path.join(testReportsDir, 'result.json'),
      'invalid json content'
    );

    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'getReport',
      id: 'test-request-3',
    };

    // Act
    const response = handleGetReport(request);

    // Assert
    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(-32603);
    expect(response.error!.message).toBe('報表檔案格式無效');
  });

  it('應該在報表驗證失敗時回傳錯誤', () => {
    // Arrange
    const invalidReport = { invalid: 'data' };
    writeFileSync(
      path.join(testReportsDir, 'result.json'),
      JSON.stringify(invalidReport)
    );

    mockValidateReport.mockReturnValueOnce({
      valid: false,
      errors: [{ path: '/executionId', message: 'Missing required field', value: undefined }],
    });

    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'getReport',
      id: 'test-request-4',
    };

    // Act
    const response = handleGetReport(request);

    // Assert
    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(-32603);
    expect(response.error!.message).toBe('報表檔案格式無效');
  });

  it('應該支援環境變數配置報表路徑', () => {
    // Arrange
    const reportData = {
      executionId: 'custom-execution-123',
      flowId: 'custom-flow',
      startTime: '2025-09-28T03:13:46.332Z',
      endTime: '2025-09-28T03:13:47.332Z',
      duration: 1000,
      status: 'success' as const,
      summary: {
        totalSteps: 1,
        successfulSteps: 1,
        failedSteps: 0,
        skippedSteps: 0,
      },
      steps: [],
      config: {
        baseUrl: 'https://api.example.com',
        fallbackUsed: false,
        authNamespaces: ['default'],
      },
    };

    // 建立自訂路徑的報表檔案
    const customDir = path.join(process.cwd(), 'custom-reports');
    if (!existsSync(customDir)) {
      mkdirSync(customDir, { recursive: true });
    }

    writeFileSync(
      path.join(customDir, 'my-report.json'),
      JSON.stringify(reportData, null, 2)
    );

    // 設定環境變數
    const originalEnv = process.env.SPEC_PILOT_REPORT_PATHS;
    process.env.SPEC_PILOT_REPORT_PATHS = 'custom-reports/my-report.json,reports/result.json';

    try {
      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'getReport',
        id: 'custom-path-test',
      };

      // Act
      const response = handleGetReport(request);

      // Assert
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('custom-path-test');
      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();

      const result = response.result as any;
      expect(result.reportPath).toBe('custom-reports/my-report.json');
      expect(result.executionId).toBe('custom-execution-123');

      // 清理自訂目錄
      rmSync(customDir, { recursive: true, force: true });
    } finally {
      // 恢復原始環境變數
      if (originalEnv !== undefined) {
        process.env.SPEC_PILOT_REPORT_PATHS = originalEnv;
      } else {
        delete process.env.SPEC_PILOT_REPORT_PATHS;
      }
    }
  });
});