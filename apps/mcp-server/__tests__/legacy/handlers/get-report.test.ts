import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import path from 'path';
import { handleGetReport } from '../../src/handlers/get-report.js';
import type { IMcpRequest } from '../../src/rpc-handler.js';

// Mock logger
vi.mock('@specpilot/shared', () => ({
  createStructuredLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock ReportValidator and DiagnosticContextBuilder
const mockValidateReport = vi.fn().mockReturnValue({ valid: true, errors: [] });
const mockBuildDiagnostic = vi.fn().mockReturnValue(null);
vi.mock('@specpilot/reporting', () => ({
  ReportValidator: vi.fn().mockImplementation(() => ({
    validateReport: mockValidateReport,
  })),
  DiagnosticContextBuilder: vi.fn().mockImplementation(() => ({
    build: mockBuildDiagnostic,
  })),
}));

describe('get-report 處理器', () => {
  const testBaseDir = path.join(process.cwd(), 'test-base');
  const testReportsDir = path.join(testBaseDir, 'reports');
  const testReportDir = path.join(testBaseDir, 'test-reports');
  let originalCwd: string;

  // 建立測試用的報表資料
  const createValidReport = () => ({
    executionId: 'test-execution-123',
    flowId: 'test-flow',
    startTime: '2025-09-28T03:13:46.332Z',
    endTime: '2025-09-28T03:13:47.332Z',
    duration: 1000,
    status: 'success' as const,
    summary: {
      totalSteps: 2,
      successfulSteps: 2,
      failedSteps: 0,
      skippedSteps: 0,
    },
    steps: [
      {
        name: 'test_step_1',
        status: 'success' as const,
        startTime: '2025-09-28T03:13:46.332Z',
        duration: 500,
        request: {
          method: 'GET',
          url: 'https://api.example.com/test',
          headerHash: 'sha256:test-hash',
          bodyHash: 'sha256:empty-hash',
        },
        response: {
          statusCode: 200,
          success: true,
          validationResults: ['success'],
          errorMessage: null,
        },
      },
    ],
    config: {
      baseUrl: 'https://api.example.com',
      fallbackUsed: false,
      authNamespaces: ['default'],
    },
  });

  beforeEach(() => {
    originalCwd = process.cwd();

    // 建立測試基礎目錄
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
    mkdirSync(testBaseDir, { recursive: true });
    mkdirSync(testReportsDir, { recursive: true });
    mkdirSync(testReportDir, { recursive: true });

    // Mock process.cwd() 以指向測試基礎目錄
    vi.spyOn(process, 'cwd').mockReturnValue(testBaseDir);
  });

  afterEach(() => {
    // 清理測試目錄
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('成功情境測試', () => {
    it('應該成功讀取 reports/result.json 報表檔案', () => {
      // Arrange
      const reportData = createValidReport();
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
      expect(result.reportSummary).toEqual({
        totalSteps: 2,
        successfulSteps: 2,
        failedSteps: 0,
        skippedSteps: 0,
        duration: 1000,
      });
      expect(result.report).toEqual(reportData);
    });

    it('應該優先讀取 reports/result.json 而非 test-reports/test-report.json', () => {
      // Arrange
      const primaryReport = createValidReport();
      primaryReport.executionId = 'primary-report';

      const secondaryReport = createValidReport();
      secondaryReport.executionId = 'secondary-report';

      writeFileSync(
        path.join(testReportsDir, 'result.json'),
        JSON.stringify(primaryReport, null, 2)
      );
      writeFileSync(
        path.join(testReportDir, 'test-report.json'),
        JSON.stringify(secondaryReport, null, 2)
      );

      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'getReport',
        id: 'test-request-2',
      };

      // Act
      const response = handleGetReport(request);

      // Assert
      expect(response.error).toBeUndefined();
      const result = response.result as any;
      expect(result.reportPath).toBe('reports/result.json');
      expect(result.executionId).toBe('primary-report');
    });

    it('應該能夠讀取 test-reports/test-report.json 當 reports/result.json 不存在時', () => {
      // Arrange
      const reportData = createValidReport();
      writeFileSync(
        path.join(testReportDir, 'test-report.json'),
        JSON.stringify(reportData, null, 2)
      );

      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'getReport',
        id: 'test-request-3',
      };

      // Act
      const response = handleGetReport(request);

      // Assert
      expect(response.error).toBeUndefined();
      const result = response.result as any;
      expect(result.reportPath).toBe('test-reports/test-report.json');
      expect(result.executionId).toBe('test-execution-123');
    });

    it('應該正確處理無參數的請求', () => {
      // Arrange
      const reportData = createValidReport();
      writeFileSync(
        path.join(testReportsDir, 'result.json'),
        JSON.stringify(reportData, null, 2)
      );

      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'getReport',
        id: 'test-request-4',
        // params 欄位為空
      };

      // Act
      const response = handleGetReport(request);

      // Assert
      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
    });
  });

  describe('錯誤情境測試', () => {
    it('應該在報表檔案不存在時回傳 -32603 錯誤', () => {
      // Arrange
      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'getReport',
        id: 'test-request-5',
      };

      // Act
      const response = handleGetReport(request);

      // Assert
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('test-request-5');
      expect(response.result).toBeUndefined();
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32603);
      expect(response.error!.message).toBe('找不到測試報表檔案');
    });

    it('應該在報表檔案格式無效時回傳 -32603 錯誤', () => {
      // Arrange
      writeFileSync(
        path.join(testReportsDir, 'result.json'),
        'invalid json content'
      );

      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'getReport',
        id: 'test-request-6',
      };

      // Act
      const response = handleGetReport(request);

      // Assert
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32603);
      expect(response.error!.message).toBe('報表檔案格式無效');
    });

    it('應該在報表驗證失敗時回傳 -32603 錯誤', () => {
      // Arrange
      const invalidReport = { invalid: 'data' };
      writeFileSync(
        path.join(testReportsDir, 'result.json'),
        JSON.stringify(invalidReport)
      );

      // Mock validator to return validation failure
      mockValidateReport.mockReturnValueOnce({
        valid: false,
        errors: [{ path: '/executionId', message: 'Missing required field', value: undefined }],
      });

      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'getReport',
        id: 'test-request-7',
      };

      // Act
      const response = handleGetReport(request);

      // Assert
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32603);
      expect(response.error!.message).toBe('報表檔案格式無效');
    });

    it('應該正確處理無效參數格式', () => {
      // Arrange
      const reportData = createValidReport();
      writeFileSync(
        path.join(testReportsDir, 'result.json'),
        JSON.stringify(reportData, null, 2)
      );

      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'getReport',
        id: 'test-request-8',
        params: 'invalid-params', // 非物件格式
      };

      // Act
      const response = handleGetReport(request);

      // Assert
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(-32602);
      expect(response.error!.message).toBe('參數必須是物件或為空');
    });
  });

  describe('JSON-RPC 回應格式測試', () => {
    it('應該遵循 JSON-RPC 2.0 成功回應格式', () => {
      // Arrange
      const reportData = createValidReport();
      writeFileSync(
        path.join(testReportsDir, 'result.json'),
        JSON.stringify(reportData, null, 2)
      );

      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'getReport',
        id: 'test-request-9',
      };

      // Act
      const response = handleGetReport(request);

      // Assert
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 'test-request-9',
        result: expect.any(Object),
      });
      expect(response.error).toBeUndefined();
    });

    it('應該遵循 JSON-RPC 2.0 錯誤回應格式', () => {
      // Arrange
      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'getReport',
        id: 'test-request-10',
      };

      // Act
      const response = handleGetReport(request);

      // Assert
      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 'test-request-10',
        error: {
          code: expect.any(Number),
          message: expect.any(String),
        },
      });
      expect(response.result).toBeUndefined();
    });

    it('應該正確處理無 ID 的請求', () => {
      // Arrange
      const reportData = createValidReport();
      writeFileSync(
        path.join(testReportsDir, 'result.json'),
        JSON.stringify(reportData, null, 2)
      );

      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'getReport',
        // 無 id 欄位
      };

      // Act
      const response = handleGetReport(request);

      // Assert
      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBeNull();
      expect(response.result).toBeDefined();
    });
  });

  describe('IGetReportResult 介面測試', () => {
    it('應該回傳符合 IGetReportResult 介面的結果', () => {
      // Arrange
      const reportData = createValidReport();
      writeFileSync(
        path.join(testReportsDir, 'result.json'),
        JSON.stringify(reportData, null, 2)
      );

      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'getReport',
        id: 'test-request-11',
      };

      // Act
      const response = handleGetReport(request);

      // Assert
      expect(response.error).toBeUndefined();
      const result = response.result as any;

      // 檢查必要欄位存在
      expect(result).toHaveProperty('reportPath');
      expect(result).toHaveProperty('executionId');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('reportSummary');
      expect(result).toHaveProperty('report');

      // 檢查 reportSummary 結構
      expect(result.reportSummary).toHaveProperty('totalSteps');
      expect(result.reportSummary).toHaveProperty('successfulSteps');
      expect(result.reportSummary).toHaveProperty('failedSteps');
      expect(result.reportSummary).toHaveProperty('skippedSteps');
      expect(result.reportSummary).toHaveProperty('duration');

      // 檢查型別
      expect(typeof result.reportPath).toBe('string');
      expect(typeof result.executionId).toBe('string');
      expect(['success', 'partial', 'failure']).toContain(result.status);
      expect(typeof result.reportSummary.totalSteps).toBe('number');
      expect(typeof result.reportSummary.duration).toBe('number');
    });
  });
});