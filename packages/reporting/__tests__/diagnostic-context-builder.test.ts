import { describe, it, expect } from 'vitest';
import { DiagnosticContextBuilder } from '../src/diagnostic-context-builder.js';
import type { ExecutionReport, StepResult } from '../src/execution-report.js';

describe('DiagnosticContextBuilder', () => {
  let builder: DiagnosticContextBuilder;

  beforeEach(() => {
    builder = new DiagnosticContextBuilder();
  });

  describe('build', () => {
    it('應該對成功報表回傳 null', () => {
      const report: ExecutionReport = {
        executionId: 'test-001',
        flowId: 'success-flow',
        startTime: '2025-09-30T10:00:00.000Z',
        endTime: '2025-09-30T10:00:01.000Z',
        duration: 1000,
        status: 'success',
        summary: {
          totalSteps: 2,
          successfulSteps: 2,
          failedSteps: 0,
          skippedSteps: 0,
        },
        steps: [
          createSuccessStep('步驟 1', 0),
          createSuccessStep('步驟 2', 1),
        ],
        config: {
          baseUrl: 'https://api.example.com',
          fallbackUsed: false,
          authNamespaces: ['default'],
        },
      };

      const result = builder.build(report);
      expect(result).toBeNull();
    });

    it('應該對失敗報表建立診斷上下文', () => {
      const report: ExecutionReport = {
        executionId: 'test-002',
        flowId: 'failure-flow',
        startTime: '2025-09-30T10:00:00.000Z',
        endTime: '2025-09-30T10:00:02.000Z',
        duration: 2000,
        status: 'failure',
        summary: {
          totalSteps: 3,
          successfulSteps: 1,
          failedSteps: 2,
          skippedSteps: 0,
        },
        steps: [
          createSuccessStep('登入', 0),
          createNetworkErrorStep('取得使用者資料', 1),
          createAuthErrorStep('更新資料', 2),
        ],
        config: {
          baseUrl: 'https://api.example.com',
          fallbackUsed: false,
          authNamespaces: ['default'],
        },
      };

      const result = builder.build(report);

      expect(result).not.toBeNull();
      expect(result!.hasFailed).toBe(true);
      expect(result!.failureCount).toBe(2);
      expect(result!.failedSteps).toHaveLength(2);
      expect(result!.environment.baseUrl).toBe('https://api.example.com');
      expect(result!.diagnosticHints).toBeDefined();
    });
  });

  describe('錯誤分類', () => {
    it('應該正確分類網路錯誤 (status: 0)', () => {
      const report = createReportWithSteps([
        createNetworkErrorStep('測試步驟', 0),
      ]);

      const result = builder.build(report);

      expect(result).not.toBeNull();
      expect(result!.failedSteps[0].classification.primaryType).toBe('network');
      expect(result!.failedSteps[0].classification.confidence).toBe(95);
      expect(result!.failedSteps[0].classification.indicators).toContain('statusCode: 0');
    });

    it('應該正確分類認證錯誤 (401)', () => {
      const report = createReportWithSteps([
        createAuthErrorStep('認證失敗', 0),
      ]);

      const result = builder.build(report);

      expect(result).not.toBeNull();
      expect(result!.failedSteps[0].classification.primaryType).toBe('auth');
      expect(result!.failedSteps[0].classification.confidence).toBeGreaterThanOrEqual(80);
      expect(result!.failedSteps[0].classification.indicators).toContain('HTTP 401');
    });

    it('應該正確分類授權錯誤 (403)', () => {
      const report = createReportWithSteps([
        createForbiddenErrorStep('權限不足', 0),
      ]);

      const result = builder.build(report);

      expect(result).not.toBeNull();
      expect(result!.failedSteps[0].classification.primaryType).toBe('auth');
      expect(result!.failedSteps[0].classification.confidence).toBe(85);
    });

    it('應該正確分類驗證錯誤 (400)', () => {
      const report = createReportWithSteps([
        createValidationErrorStep('欄位驗證失敗', 0),
      ]);

      const result = builder.build(report);

      expect(result).not.toBeNull();
      expect(result!.failedSteps[0].classification.primaryType).toBe('validation');
      expect(result!.failedSteps[0].classification.confidence).toBeGreaterThanOrEqual(85);
    });

    it('應該正確分類伺服器錯誤 (500)', () => {
      const report = createReportWithSteps([
        createServerErrorStep('內部錯誤', 0),
      ]);

      const result = builder.build(report);

      expect(result).not.toBeNull();
      expect(result!.failedSteps[0].classification.primaryType).toBe('server');
      expect(result!.failedSteps[0].classification.confidence).toBe(90);
    });

    it('應該結合錯誤代碼提高認證錯誤的信心度', () => {
      const report = createReportWithSteps([
        createAuthErrorStepWithCode('Token 過期', 0, 'TOKEN_EXPIRED'),
      ]);

      const result = builder.build(report);

      expect(result).not.toBeNull();
      expect(result!.failedSteps[0].classification.primaryType).toBe('auth');
      expect(result!.failedSteps[0].classification.confidence).toBe(95);
      expect(result!.failedSteps[0].classification.indicators).toContain('error: TOKEN_EXPIRED');
    });
  });

  describe('錯誤模式偵測', () => {
    it('應該偵測連續認證失敗模式', () => {
      const report = createReportWithSteps([
        createAuthErrorStep('步驟 1', 0),
        createAuthErrorStep('步驟 2', 1),
        createAuthErrorStep('步驟 3', 2),
      ]);

      const result = builder.build(report);

      expect(result).not.toBeNull();
      const pattern = result!.errorPatterns.find(p => p.pattern === 'consecutive_auth_failures');
      expect(pattern).toBeDefined();
      expect(pattern!.likelihood).toBe('high');
      expect(pattern!.affectedSteps).toHaveLength(3);
    });

    it('應該偵測連鎖失敗模式', () => {
      const report = createReportWithSteps([
        createAuthErrorStep('第一步失敗', 0),
        createSuccessStep('步驟 2', 1),
        createAuthErrorStep('後續失敗', 2),
      ]);

      const result = builder.build(report);

      expect(result).not.toBeNull();
      const pattern = result!.errorPatterns.find(p => p.pattern === 'cascading_failures');
      expect(pattern).toBeDefined();
      expect(pattern!.likelihood).toBe('high');
      expect(pattern!.description).toContain('第一步失敗');
    });

    it('應該偵測全部網路錯誤模式', () => {
      const report = createReportWithSteps([
        createNetworkErrorStep('步驟 1', 0),
        createNetworkErrorStep('步驟 2', 1),
        createNetworkErrorStep('步驟 3', 2),
      ]);

      const result = builder.build(report);

      expect(result).not.toBeNull();
      const pattern = result!.errorPatterns.find(p => p.pattern === 'all_network_errors');
      expect(pattern).toBeDefined();
      expect(pattern!.likelihood).toBe('high');
      expect(pattern!.description).toContain('API 服務可能未啟動');
    });

    it('應該偵測同一資源的失敗模式', () => {
      const report = createReportWithSteps([
        createAuthErrorStepWithUrl('取得使用者', 0, '/users/1'),
        createAuthErrorStepWithUrl('更新使用者', 1, '/users/2'),
        createAuthErrorStepWithUrl('刪除使用者', 2, '/users/3'),
      ]);

      const result = builder.build(report);

      expect(result).not.toBeNull();
      const pattern = result!.errorPatterns.find(p => p.pattern === 'same_resource_failures');
      expect(pattern).toBeDefined();
      expect(pattern!.description).toContain('users');
    });
  });

  describe('診斷提示生成', () => {
    it('應該為網路錯誤生成正確的診斷提示', () => {
      const report = createReportWithSteps([
        createNetworkErrorStep('連線失敗', 0),
        createNetworkErrorStep('再次失敗', 1),
      ]);

      const result = builder.build(report);

      expect(result).not.toBeNull();
      const hints = result!.diagnosticHints;

      expect(hints.quickDiagnosis).toContain('網路錯誤');
      expect(hints.quickDiagnosis).toContain('API 服務可能未啟動');
      expect(hints.likelyCauses).toContain('API 服務未啟動或無法連線');
      expect(hints.suggestedActions).toContain('確認 API 服務是否正在執行');
    });

    it('應該為認證錯誤生成正確的診斷提示', () => {
      const report = createReportWithSteps([
        createAuthErrorStep('認證失敗', 0),
      ]);

      const result = builder.build(report);

      expect(result).not.toBeNull();
      const hints = result!.diagnosticHints;

      expect(hints.quickDiagnosis).toContain('認證問題');
      expect(hints.likelyCauses).toContain('認證 Token 遺失、無效或已過期');
      expect(hints.suggestedActions).toContain('更新或重新取得認證 Token');
      expect(hints.suggestedQuestions).toBeDefined();
      expect(hints.suggestedQuestions![0]).toContain('Token');
    });

    it('應該為連鎖失敗生成特定建議', () => {
      const report = createReportWithSteps([
        createAuthErrorStep('第一步', 0),
        createSuccessStep('第二步', 1),
        createValidationErrorStep('後續失敗', 2),
      ]);

      const result = builder.build(report);

      expect(result).not.toBeNull();
      const hints = result!.diagnosticHints;

      expect(hints.quickDiagnosis).toContain('第一步失敗導致後續連鎖失敗');
      expect(hints.suggestedActions).toContain('優先修復第一個失敗的步驟');
    });

    it('應該為驗證錯誤生成正確的診斷提示', () => {
      const report = createReportWithSteps([
        createValidationErrorStep('Schema 驗證失敗', 0),
      ]);

      const result = builder.build(report);

      expect(result).not.toBeNull();
      const hints = result!.diagnosticHints;

      expect(hints.likelyCauses).toContain('請求資料格式不符合 API 規格');
      expect(hints.suggestedActions).toContain('比對 API 規格，檢查請求資料格式');
      expect(hints.suggestedQuestions).toBeDefined();
      expect(hints.suggestedQuestions![0]).toContain('欄位');
    });
  });

  describe('環境診斷', () => {
    it('應該正確記錄環境資訊', () => {
      const report = createReportWithSteps([
        createAuthErrorStep('失敗', 0),
      ]);
      report.config.baseUrl = 'https://staging.example.com';
      report.config.fallbackUsed = true;
      report.config.authNamespaces = ['admin', 'user'];

      const result = builder.build(report);

      expect(result).not.toBeNull();
      expect(result!.environment.baseUrl).toBe('https://staging.example.com');
      expect(result!.environment.fallbackUsed).toBe(true);
      expect(result!.environment.authNamespaces).toEqual(['admin', 'user']);
    });
  });
});

// ========== 測試輔助函式 ==========

function createSuccessStep(name: string, index: number): StepResult {
  return {
    name,
    status: 'success',
    startTime: `2025-09-30T10:00:${String(index).padStart(2, '0')}.000Z`,
    duration: 100,
    request: {
      method: 'GET',
      url: '/api/test',
      headers: {},
      bodyHash: 'empty',
    },
    response: {
      statusCode: 200,
      success: true,
      validationResults: ['驗證通過'],
      bodyHash: 'abc123',
      headersHash: 'def456',
    },
  };
}

function createNetworkErrorStep(name: string, index: number): StepResult {
  return {
    name,
    status: 'failure',
    startTime: `2025-09-30T10:00:${String(index).padStart(2, '0')}.000Z`,
    duration: 5000,
    request: {
      method: 'GET',
      url: '/api/test',
      headers: {},
      bodyHash: 'empty',
    },
    response: {
      statusCode: 0,
      success: false,
      validationResults: [],
      errorMessage: '網路連線失敗',
      errorDetails: {
        body: { _network_error: true, error: 'NETWORK_ERROR', message: 'Network timeout' },
        headers: {},
        responseTime: 5000,
        bodySize: 100,
        bodyTruncated: false,
      },
    },
  };
}

function createAuthErrorStep(name: string, index: number): StepResult {
  return {
    name,
    status: 'failure',
    startTime: `2025-09-30T10:00:${String(index).padStart(2, '0')}.000Z`,
    duration: 150,
    request: {
      method: 'GET',
      url: '/api/protected',
      headers: { authorization: '***' },
      bodyHash: 'empty',
    },
    response: {
      statusCode: 401,
      success: false,
      validationResults: [],
      errorMessage: '認證失敗',
      errorDetails: {
        body: { error: 'Unauthorized', message: 'Invalid token' },
        headers: { 'www-authenticate': 'Bearer' },
        responseTime: 150,
        bodySize: 50,
        bodyTruncated: false,
      },
    },
  };
}

function createAuthErrorStepWithCode(name: string, index: number, errorCode: string): StepResult {
  const step = createAuthErrorStep(name, index);
  step.response.errorDetails!.body = { error: errorCode, message: 'Authentication failed' };
  return step;
}

function createAuthErrorStepWithUrl(name: string, index: number, url: string): StepResult {
  const step = createAuthErrorStep(name, index);
  step.request.url = url;
  return step;
}

function createForbiddenErrorStep(name: string, index: number): StepResult {
  const step = createAuthErrorStep(name, index);
  step.response.statusCode = 403;
  step.response.errorMessage = '權限不足';
  step.response.errorDetails!.body = { error: 'Forbidden', message: 'Access denied' };
  return step;
}

function createValidationErrorStep(name: string, index: number): StepResult {
  return {
    name,
    status: 'failure',
    startTime: `2025-09-30T10:00:${String(index).padStart(2, '0')}.000Z`,
    duration: 100,
    request: {
      method: 'POST',
      url: '/api/users',
      headers: {},
      bodyHash: 'data123',
    },
    response: {
      statusCode: 400,
      success: false,
      validationResults: ['Schema 驗證失敗: email 格式錯誤'],
      errorMessage: '請求資料格式錯誤',
      errorDetails: {
        body: { error: 'ValidationError', fields: { email: 'Invalid format' } },
        headers: {},
        responseTime: 100,
        bodySize: 80,
        bodyTruncated: false,
      },
    },
  };
}

function createServerErrorStep(name: string, index: number): StepResult {
  return {
    name,
    status: 'failure',
    startTime: `2025-09-30T10:00:${String(index).padStart(2, '0')}.000Z`,
    duration: 200,
    request: {
      method: 'GET',
      url: '/api/data',
      headers: {},
      bodyHash: 'empty',
    },
    response: {
      statusCode: 500,
      success: false,
      validationResults: [],
      errorMessage: '伺服器內部錯誤',
      errorDetails: {
        body: { error: 'InternalServerError', message: 'Database connection failed' },
        headers: {},
        responseTime: 200,
        bodySize: 70,
        bodyTruncated: false,
      },
    },
  };
}

function createReportWithSteps(steps: StepResult[]): ExecutionReport {
  const failedCount = steps.filter(s => s.status === 'failure').length;
  const successCount = steps.filter(s => s.status === 'success').length;

  return {
    executionId: 'test-report',
    flowId: 'test-flow',
    startTime: '2025-09-30T10:00:00.000Z',
    endTime: '2025-09-30T10:00:10.000Z',
    duration: 10000,
    status: failedCount > 0 ? 'failure' : 'success',
    summary: {
      totalSteps: steps.length,
      successfulSteps: successCount,
      failedSteps: failedCount,
      skippedSteps: 0,
    },
    steps,
    config: {
      baseUrl: 'https://api.example.com',
      fallbackUsed: false,
      authNamespaces: ['default'],
    },
  };
}