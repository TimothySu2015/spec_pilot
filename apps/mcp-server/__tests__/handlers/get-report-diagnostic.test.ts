import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import path from 'path';
import { handleGetReport } from '../../src/handlers/get-report.js';
import type { IMcpRequest } from '../../src/rpc-handler.js';
import type { IExecutionReport } from '@specpilot/reporting';

describe('getReport 診斷上下文整合測試', () => {
  const testReportsDir = path.join(process.cwd(), 'reports');

  beforeEach(() => {
    if (!existsSync(testReportsDir)) {
      mkdirSync(testReportsDir, { recursive: true });
    }
  });

  afterEach(() => {
    try {
      if (existsSync(path.join(testReportsDir, 'result.json'))) {
        rmSync(path.join(testReportsDir, 'result.json'));
      }
    } catch (error) {
      // 忽略清理錯誤
    }
  });

  it('應該在成功報表中不包含診斷上下文', () => {
    // Arrange: 建立成功報表
    const successReport: IExecutionReport = {
      executionId: 'success-exec-001',
      flowId: 'success-flow',
      startTime: '2025-09-30T10:00:00.000Z',
      endTime: '2025-09-30T10:00:02.000Z',
      duration: 2000,
      status: 'success',
      summary: {
        totalSteps: 3,
        successfulSteps: 3,
        failedSteps: 0,
        skippedSteps: 0,
      },
      steps: [
        {
          name: '登入',
          status: 'success',
          startTime: '2025-09-30T10:00:00.000Z',
          duration: 500,
          request: {
            method: 'POST',
            url: '/api/auth/login',
            headers: {},
            bodyHash: 'login-data',
          },
          response: {
            statusCode: 200,
            success: true,
            validationResults: ['驗證通過'],
            bodyHash: 'token-abc',
            headersHash: 'headers-123',
          },
        },
        {
          name: '取得使用者資料',
          status: 'success',
          startTime: '2025-09-30T10:00:00.500Z',
          duration: 800,
          request: {
            method: 'GET',
            url: '/api/users/me',
            headers: { authorization: '***' },
            bodyHash: 'empty',
          },
          response: {
            statusCode: 200,
            success: true,
            validationResults: ['驗證通過'],
            bodyHash: 'user-data-xyz',
            headersHash: 'headers-456',
          },
        },
        {
          name: '更新資料',
          status: 'success',
          startTime: '2025-09-30T10:00:01.300Z',
          duration: 700,
          request: {
            method: 'PUT',
            url: '/api/users/me',
            headers: { authorization: '***' },
            bodyHash: 'update-data',
          },
          response: {
            statusCode: 200,
            success: true,
            validationResults: ['驗證通過'],
            bodyHash: 'updated-user',
            headersHash: 'headers-789',
          },
        },
      ],
      config: {
        baseUrl: 'https://api.example.com',
        fallbackUsed: false,
        authNamespaces: ['default'],
      },
    };

    writeFileSync(
      path.join(testReportsDir, 'result.json'),
      JSON.stringify(successReport, null, 2)
    );

    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'getReport',
      id: 'test-success-1',
    };

    // Act
    const response = handleGetReport(request);

    // Assert
    expect(response.error).toBeUndefined();
    expect(response.result).toBeDefined();

    const result = response.result as any;
    expect(result.status).toBe('success');
    expect(result.diagnosticContext).toBeUndefined(); // 成功時不應有診斷上下文
  });

  it('應該在失敗報表中包含完整診斷上下文', () => {
    // Arrange: 建立失敗報表（網路錯誤）
    const failureReport: IExecutionReport = {
      executionId: 'failure-exec-001',
      flowId: 'failure-flow',
      startTime: '2025-09-30T10:00:00.000Z',
      endTime: '2025-09-30T10:00:05.000Z',
      duration: 5000,
      status: 'failure',
      summary: {
        totalSteps: 2,
        successfulSteps: 0,
        failedSteps: 2,
        skippedSteps: 0,
      },
      steps: [
        {
          name: '連線 API',
          status: 'failure',
          startTime: '2025-09-30T10:00:00.000Z',
          duration: 3000,
          request: {
            method: 'GET',
            url: '/api/health',
            headers: {},
            bodyHash: 'empty',
          },
          response: {
            statusCode: 0,
            success: false,
            validationResults: [],
            errorMessage: '網路連線失敗',
            errorDetails: {
              body: {
                _network_error: true,
                error: 'NETWORK_ERROR',
                message: 'Connection timeout',
              },
              headers: {},
              responseTime: 3000,
              bodySize: 100,
              bodyTruncated: false,
            },
          },
        },
        {
          name: '重試連線',
          status: 'failure',
          startTime: '2025-09-30T10:00:03.000Z',
          duration: 2000,
          request: {
            method: 'GET',
            url: '/api/health',
            headers: {},
            bodyHash: 'empty',
          },
          response: {
            statusCode: 0,
            success: false,
            validationResults: [],
            errorMessage: '網路連線失敗',
            errorDetails: {
              body: {
                _network_error: true,
                error: 'NETWORK_ERROR',
                message: 'Connection refused',
              },
              headers: {},
              responseTime: 2000,
              bodySize: 95,
              bodyTruncated: false,
            },
          },
        },
      ],
      config: {
        baseUrl: 'https://api.example.com',
        fallbackUsed: false,
        authNamespaces: ['default'],
      },
    };

    writeFileSync(
      path.join(testReportsDir, 'result.json'),
      JSON.stringify(failureReport, null, 2)
    );

    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'getReport',
      id: 'test-failure-1',
    };

    // Act
    const response = handleGetReport(request);

    // Assert
    expect(response.error).toBeUndefined();
    expect(response.result).toBeDefined();

    const result = response.result as any;
    expect(result.status).toBe('failure');
    expect(result.diagnosticContext).toBeDefined();

    // 驗證診斷上下文結構
    const diagnostic = result.diagnosticContext;
    expect(diagnostic.hasFailed).toBe(true);
    expect(diagnostic.failureCount).toBe(2);
    expect(diagnostic.failedSteps).toHaveLength(2);

    // 驗證失敗步驟診斷
    expect(diagnostic.failedSteps[0].stepName).toBe('連線 API');
    expect(diagnostic.failedSteps[0].classification.primaryType).toBe('network');
    expect(diagnostic.failedSteps[0].classification.confidence).toBeGreaterThanOrEqual(90);

    // 驗證環境資訊
    expect(diagnostic.environment.baseUrl).toBe('https://api.example.com');
    expect(diagnostic.environment.fallbackUsed).toBe(false);

    // 驗證錯誤模式
    expect(diagnostic.errorPatterns).toBeDefined();
    const networkPattern = diagnostic.errorPatterns.find(
      (p: any) => p.pattern === 'all_network_errors'
    );
    expect(networkPattern).toBeDefined();
    expect(networkPattern.likelihood).toBe('high');

    // 驗證診斷提示
    expect(diagnostic.diagnosticHints).toBeDefined();
    expect(diagnostic.diagnosticHints.quickDiagnosis).toContain('網路');
    expect(diagnostic.diagnosticHints.likelyCauses).toContain('API 服務未啟動或無法連線');
    expect(diagnostic.diagnosticHints.suggestedActions).toContain('確認 API 服務是否正在執行');
  });

  it('應該在認證失敗報表中提供認證相關診斷', () => {
    // Arrange: 建立認證失敗報表
    const authFailureReport: IExecutionReport = {
      executionId: 'auth-failure-001',
      flowId: 'auth-flow',
      startTime: '2025-09-30T10:00:00.000Z',
      endTime: '2025-09-30T10:00:01.500Z',
      duration: 1500,
      status: 'failure',
      summary: {
        totalSteps: 3,
        successfulSteps: 1,
        failedSteps: 2,
        skippedSteps: 0,
      },
      steps: [
        {
          name: '登入',
          status: 'success',
          startTime: '2025-09-30T10:00:00.000Z',
          duration: 500,
          request: {
            method: 'POST',
            url: '/api/auth/login',
            headers: {},
            bodyHash: 'login-data',
          },
          response: {
            statusCode: 200,
            success: true,
            validationResults: ['驗證通過'],
            bodyHash: 'token-abc',
            headersHash: 'headers-123',
          },
        },
        {
          name: '取得使用者資料',
          status: 'failure',
          startTime: '2025-09-30T10:00:00.500Z',
          duration: 300,
          request: {
            method: 'GET',
            url: '/api/users/me',
            headers: { authorization: '***' },
            bodyHash: 'empty',
          },
          response: {
            statusCode: 401,
            success: false,
            validationResults: [],
            errorMessage: '認證失敗',
            errorDetails: {
              body: {
                error: 'TOKEN_EXPIRED',
                message: 'Token has expired',
              },
              headers: { 'www-authenticate': 'Bearer' },
              responseTime: 300,
              bodySize: 50,
              bodyTruncated: false,
            },
          },
        },
        {
          name: '更新資料',
          status: 'failure',
          startTime: '2025-09-30T10:00:00.800Z',
          duration: 700,
          request: {
            method: 'PUT',
            url: '/api/users/me/profile',
            headers: { authorization: '***' },
            bodyHash: 'update-data',
          },
          response: {
            statusCode: 401,
            success: false,
            validationResults: [],
            errorMessage: '認證失敗',
            errorDetails: {
              body: {
                error: 'INVALID_TOKEN',
                message: 'Token is invalid',
              },
              headers: { 'www-authenticate': 'Bearer' },
              responseTime: 700,
              bodySize: 48,
              bodyTruncated: false,
            },
          },
        },
      ],
      config: {
        baseUrl: 'https://api.example.com',
        fallbackUsed: false,
        authNamespaces: ['default'],
      },
    };

    writeFileSync(
      path.join(testReportsDir, 'result.json'),
      JSON.stringify(authFailureReport, null, 2)
    );

    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'getReport',
      id: 'test-auth-failure-1',
    };

    // Act
    const response = handleGetReport(request);

    // Assert
    expect(response.error).toBeUndefined();
    const result = response.result as any;
    const diagnostic = result.diagnosticContext;

    expect(diagnostic).toBeDefined();
    expect(diagnostic.failureCount).toBe(2);

    // 驗證認證錯誤分類
    expect(diagnostic.failedSteps[0].classification.primaryType).toBe('auth');
    expect(diagnostic.failedSteps[0].classification.confidence).toBe(95); // 有 errorCode 所以 95

    // 驗證連續認證失敗模式
    const authPattern = diagnostic.errorPatterns.find(
      (p: any) => p.pattern === 'consecutive_auth_failures'
    );
    expect(authPattern).toBeDefined();

    // 驗證認證相關診斷提示
    expect(diagnostic.diagnosticHints.likelyCauses).toContain('認證 Token 遺失、無效或已過期');
    expect(diagnostic.diagnosticHints.suggestedActions).toContain('更新或重新取得認證 Token');
    expect(diagnostic.diagnosticHints.suggestedQuestions).toBeDefined();
    expect(diagnostic.diagnosticHints.suggestedQuestions[0]).toContain('Token');
  });

  it('應該偵測連鎖失敗模式', () => {
    // Arrange: 建立第一步失敗導致後續失敗的報表
    const cascadingReport: IExecutionReport = {
      executionId: 'cascading-001',
      flowId: 'cascading-flow',
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
        {
          name: '登入（第一步）',
          status: 'failure',
          startTime: '2025-09-30T10:00:00.000Z',
          duration: 500,
          request: {
            method: 'POST',
            url: '/api/auth/login',
            headers: {},
            bodyHash: 'login-data',
          },
          response: {
            statusCode: 401,
            success: false,
            validationResults: [],
            errorMessage: '認證失敗',
            errorDetails: {
              body: { error: 'INVALID_CREDENTIALS', message: 'Wrong password' },
              headers: {},
              responseTime: 500,
              bodySize: 45,
              bodyTruncated: false,
            },
          },
        },
        {
          name: '取得使用者資料',
          status: 'success',
          startTime: '2025-09-30T10:00:00.500Z',
          duration: 500,
          request: {
            method: 'GET',
            url: '/api/public/info',
            headers: {},
            bodyHash: 'empty',
          },
          response: {
            statusCode: 200,
            success: true,
            validationResults: ['驗證通過'],
            bodyHash: 'public-info',
            headersHash: 'headers-123',
          },
        },
        {
          name: '更新資料（後續失敗）',
          status: 'failure',
          startTime: '2025-09-30T10:00:01.000Z',
          duration: 1000,
          request: {
            method: 'PUT',
            url: '/api/users/me',
            headers: { authorization: '***' },
            bodyHash: 'update-data',
          },
          response: {
            statusCode: 401,
            success: false,
            validationResults: [],
            errorMessage: '認證失敗',
            errorDetails: {
              body: { error: 'AUTHENTICATION_FAILED', message: 'No valid token' },
              headers: {},
              responseTime: 1000,
              bodySize: 50,
              bodyTruncated: false,
            },
          },
        },
      ],
      config: {
        baseUrl: 'https://api.example.com',
        fallbackUsed: false,
        authNamespaces: ['default'],
      },
    };

    writeFileSync(
      path.join(testReportsDir, 'result.json'),
      JSON.stringify(cascadingReport, null, 2)
    );

    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'getReport',
      id: 'test-cascading-1',
    };

    // Act
    const response = handleGetReport(request);

    // Assert
    expect(response.error).toBeUndefined();
    const result = response.result as any;
    const diagnostic = result.diagnosticContext;

    expect(diagnostic).toBeDefined();

    // 驗證連鎖失敗模式
    const cascadingPattern = diagnostic.errorPatterns.find(
      (p: any) => p.pattern === 'cascading_failures'
    );
    expect(cascadingPattern).toBeDefined();
    expect(cascadingPattern.likelihood).toBe('high');
    expect(cascadingPattern.description).toContain('第一步失敗');

    // 驗證快速診斷提到連鎖失敗
    expect(diagnostic.diagnosticHints.quickDiagnosis).toContain('連鎖失敗');

    // 驗證建議優先修復第一步
    expect(diagnostic.diagnosticHints.suggestedActions).toContain('優先修復第一個失敗的步驟');
  });
});