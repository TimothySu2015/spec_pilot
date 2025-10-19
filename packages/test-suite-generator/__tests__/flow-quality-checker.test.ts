/**
 * FlowQualityChecker 單元測試
 * 測試 Flow 品質檢查器的各項功能
 */

import { describe, it, expect } from 'vitest';
import { FlowQualityChecker } from '../src/flow-quality-checker.js';
import type { FlowDefinition } from '@specpilot/flow-parser';
import type { OpenAPIDocument } from '@specpilot/spec-loader';

// ===== 輔助函數 =====

function createMockSpec(options: { includeAuth?: boolean } = {}): OpenAPIDocument {
  const getUserOp: any = {
    operationId: 'getUser',
    responses: {
      '200': { description: 'OK' },
    },
  };

  if (options.includeAuth) {
    getUserOp.security = [{ bearerAuth: [] }];
  }

  return {
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {
      '/users': {
        post: {
          operationId: 'createUser',
          responses: {
            '201': { description: 'Created' },
          },
        },
      },
      '/users/{id}': {
        get: getUserOp,
        put: {
          operationId: 'updateUser',
          responses: {
            '200': { description: 'OK' },
          },
        },
      },
      '/login': {
        post: {
          operationId: 'login',
          responses: {
            '200': { description: 'OK' },
          },
        },
      },
    },
  } as OpenAPIDocument;
}

function createMockFlow(steps: any[]): FlowDefinition {
  return {
    name: 'Test Flow',
    description: '測試流程',
    baseUrl: 'http://localhost:3000',
    steps: steps,
  };
}

// ===== 測試套件 =====

describe('FlowQualityChecker', () => {
  describe('check() - 主檢查方法', () => {
    it('應該返回完整的 QualityReport', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者 - 成功',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: { username: 'testuser' } },
          expect: { statusCode: 201 },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      expect(report).toHaveProperty('totalIssues');
      expect(report).toHaveProperty('errors');
      expect(report).toHaveProperty('warnings');
      expect(report).toHaveProperty('infos');
      expect(report).toHaveProperty('issues');
      expect(report).toHaveProperty('score');
    });

    it('應該正確計算評分 (100 分 - error*10 - warning*5 - info*2)', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者成功',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: { username: 'x' } },
          expect: { statusCode: 200 }, // 錯誤狀態碼 -> error (-10)
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      // 1 個 error (狀態碼錯誤) -10 分
      // 2 個 warning (測試資料過短: "x" 一般 + username 特定) -10 分
      expect(report.score).toBe(80);
    });

    it('空 Flow 應該返回 100 分', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      expect(report.totalIssues).toBe(0);
      expect(report.score).toBe(100);
    });
  });

  describe('checkStatusCodes() - 檢查狀態碼', () => {
    it('應該通過正確的狀態碼 (POST -> 201)', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者 - 成功',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: {} },
          expect: { statusCode: 201 },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const statusIssues = report.issues.filter(i => i.type === 'invalid_status_code');
      expect(statusIssues).toHaveLength(0);
    });

    it('應該偵測錯誤的狀態碼 (POST -> 200 instead of 201)', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者 - 成功',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: {} },
          expect: { statusCode: 200 },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const statusIssues = report.issues.filter(i => i.type === 'invalid_status_code');
      expect(statusIssues).toHaveLength(1);
      expect(statusIssues[0].severity).toBe('error');
      expect(statusIssues[0].message).toContain('預期狀態碼 200 與 OpenAPI 規格不符');
      expect(statusIssues[0].suggestion).toContain('應該使用 201');
    });

    it('應該忽略沒有 expect.statusCode 的步驟', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: {} },
          // 沒有 expect
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const statusIssues = report.issues.filter(i => i.type === 'invalid_status_code');
      expect(statusIssues).toHaveLength(0);
    });

    it('應該忽略找不到對應 OpenAPI 端點的步驟', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立訂單 - 成功',
          operationId: 'createOrder',
          request: { method: 'POST', path: '/orders', body: {} },
          expect: { statusCode: 201 },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const statusIssues = report.issues.filter(i => i.type === 'invalid_status_code');
      expect(statusIssues).toHaveLength(0);
    });

    it('應該支援變數路徑的狀態碼檢查 ({{userId}})', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step2',
          name: '取得使用者 - 成功',
          operationId: 'getUser',
          request: { method: 'GET', path: '/users/{{userId}}' },
          expect: { statusCode: 200 },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const statusIssues = report.issues.filter(i => i.type === 'invalid_status_code');
      expect(statusIssues).toHaveLength(0);
    });

    it('應該支援具體 ID 路徑的狀態碼檢查 (/users/1)', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step2',
          name: '取得使用者 - 成功',
          operationId: 'getUser',
          request: { method: 'GET', path: '/users/1' },
          expect: { statusCode: 200 },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const statusIssues = report.issues.filter(i => i.type === 'invalid_status_code');
      expect(statusIssues).toHaveLength(0);
    });
  });

  describe('checkTestDataQuality() - 檢查測試資料品質', () => {
    it('應該偵測過短的字串資料（單字元）', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: { name: 'x' } },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const dataIssues = report.issues.filter(i => i.type === 'poor_test_data');
      expect(dataIssues.length).toBeGreaterThan(0);
      expect(dataIssues[0].message).toContain('過於簡單');
    });

    it('應該偵測不正確的 email 格式', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: { email: 'test' } },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const emailIssues = report.issues.filter(i =>
        i.type === 'poor_test_data' && i.message.includes('Email')
      );
      expect(emailIssues.length).toBeGreaterThan(0);
      expect(emailIssues[0].message).toContain('Email 格式可能不正確');
    });

    it('應該忽略故意的無效 email ("invalid-email")', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者 - 無效 email',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: { email: 'invalid-email' } },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const emailIssues = report.issues.filter(i =>
        i.type === 'poor_test_data' && i.message.includes('Email')
      );
      expect(emailIssues).toHaveLength(0);
    });

    it('應該偵測過短的 username', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: { username: 'ab' } },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const usernameIssues = report.issues.filter(i =>
        i.type === 'poor_test_data' && i.message.includes('username')
      );
      expect(usernameIssues.length).toBeGreaterThan(0);
      expect(usernameIssues[0].suggestion).toContain('testuser');
    });

    it('應該偵測過短的 password', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: { password: 'pw' } },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const passwordIssues = report.issues.filter(i =>
        i.type === 'poor_test_data' && i.message.includes('password')
      );
      expect(passwordIssues.length).toBeGreaterThan(0);
      expect(passwordIssues[0].suggestion).toContain('password123');
    });

    it('應該通過正確的測試資料', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者',
          operationId: 'createUser',
          request: {
            method: 'POST',
            path: '/users',
            body: {
              username: 'testuser',
              email: 'test@example.com',
              password: 'password123',
            },
          },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const dataIssues = report.issues.filter(i => i.type === 'poor_test_data');
      expect(dataIssues).toHaveLength(0);
    });
  });

  describe('checkStepNames() - 檢查步驟名稱', () => {
    it('應該偵測重複的步驟名稱', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: {} },
        },
        {
          id: 'step2',
          name: '建立使用者',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: {} },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const nameIssues = report.issues.filter(i =>
        i.type === 'duplicate_name' && i.message.includes('步驟名稱重複')
      );
      expect(nameIssues.length).toBeGreaterThan(0);
    });

    it('應該偵測名稱中的重複文字', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立 建立 使用者',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: {} },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const duplicateWordIssues = report.issues.filter(i =>
        i.type === 'duplicate_name' && i.message.includes('重複文字')
      );
      expect(duplicateWordIssues.length).toBeGreaterThan(0);
      expect(duplicateWordIssues[0].message).toContain('建立');
    });

    it('應該通過唯一且正確的步驟名稱', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: {} },
        },
        {
          id: 'step2',
          name: '取得使用者',
          operationId: 'getUser',
          request: { method: 'GET', path: '/users/1' },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const nameIssues = report.issues.filter(i => i.type === 'duplicate_name');
      expect(nameIssues).toHaveLength(0);
    });
  });

  describe('checkAuthFlow() - 檢查認證流程', () => {
    it('應該偵測需要認證但缺少登入步驟的情況', () => {
      const spec = createMockSpec({ includeAuth: true });
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '取得使用者',
          operationId: 'getUser',
          request: { method: 'GET', path: '/users/1' },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const authIssues = report.issues.filter(i => i.type === 'missing_auth');
      expect(authIssues.length).toBeGreaterThan(0);
      expect(authIssues[0].message).toContain('缺少登入步驟');
    });

    it('應該通過包含登入步驟的 Flow', () => {
      const spec = createMockSpec({ includeAuth: true });
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '使用者登入',
          operationId: 'login',
          request: { method: 'POST', path: '/login', body: {} },
        },
        {
          id: 'step2',
          name: '取得使用者',
          operationId: 'getUser',
          request: { method: 'GET', path: '/users/1' },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const authIssues = report.issues.filter(i => i.type === 'missing_auth');
      expect(authIssues).toHaveLength(0);
    });

    it('應該通過有全域 auth 設定的 Flow', () => {
      const spec = createMockSpec({ includeAuth: true });
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '取得使用者',
          operationId: 'getUser',
          request: { method: 'GET', path: '/users/1' },
        },
      ]);
      flow.globals = { auth: { token: 'test-token' } };

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const authIssues = report.issues.filter(i => i.type === 'missing_auth');
      expect(authIssues).toHaveLength(0);
    });

    it('應該通過不需要認證的 Flow', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: {} },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const authIssues = report.issues.filter(i => i.type === 'missing_auth');
      expect(authIssues).toHaveLength(0);
    });
  });

  describe('checkPathParameters() - 檢查路徑參數', () => {
    it('應該偵測未替換的路徑參數 ({id})', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '取得使用者',
          operationId: 'getUser',
          request: { method: 'GET', path: '/users/{id}' },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const pathIssues = report.issues.filter(i => i.type === 'invalid_path_param');
      expect(pathIssues.length).toBeGreaterThan(0);
      expect(pathIssues[0].message).toContain('未處理的參數');
    });

    it('應該通過正確使用變數的路徑 ({{userId}})', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: {} },
          capture: [{ variableName: 'userId', path: 'id' }],
        },
        {
          id: 'step2',
          name: '取得使用者',
          operationId: 'getUser',
          request: { method: 'GET', path: '/users/{{userId}}' },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const pathIssues = report.issues.filter(i => i.type === 'invalid_path_param');
      expect(pathIssues).toHaveLength(0);
    });

    it('應該通過使用具體值的路徑 (/users/1)', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '取得使用者',
          operationId: 'getUser',
          request: { method: 'GET', path: '/users/1' },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const pathIssues = report.issues.filter(i => i.type === 'invalid_path_param');
      expect(pathIssues).toHaveLength(0);
    });

    it('如果有前置 capture 步驟，應該允許 {id}', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: {} },
          capture: [{ variableName: 'userId', path: 'id' }],
        },
        {
          id: 'step2',
          name: '取得使用者',
          operationId: 'getUser',
          request: { method: 'GET', path: '/users/{id}' },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const pathIssues = report.issues.filter(i => i.type === 'invalid_path_param');
      expect(pathIssues).toHaveLength(0);
    });
  });

  describe('checkCaptureFields() - 檢查 capture 欄位', () => {
    it('應該偵測登入端點未 capture token', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '使用者登入',
          operationId: 'login',
          request: { method: 'POST', path: '/login', body: {} },
          capture: [{ variableName: 'userId', path: 'id' }],
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const captureIssues = report.issues.filter(i =>
        i.type === 'wrong_capture_field' && i.message.includes('登入端點')
      );
      expect(captureIssues.length).toBeGreaterThan(0);
      expect(captureIssues[0].suggestion).toContain('authToken');
    });

    it('應該通過登入端點正確 capture token', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '使用者登入',
          operationId: 'login',
          request: { method: 'POST', path: '/login', body: {} },
          capture: [{ variableName: 'authToken', path: 'token' }],
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const captureIssues = report.issues.filter(i =>
        i.type === 'wrong_capture_field' && i.message.includes('登入端點')
      );
      expect(captureIssues).toHaveLength(0);
    });

    it('應該提示建立端點通常應該 capture id', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: {} },
          capture: [{ variableName: 'username', path: 'username' }],
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const captureIssues = report.issues.filter(i =>
        i.type === 'wrong_capture_field' && i.message.includes('建立資源')
      );
      expect(captureIssues.length).toBeGreaterThan(0);
      expect(captureIssues[0].severity).toBe('info');
    });

    it('應該通過建立端點正確 capture id', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: {} },
          capture: [{ variableName: 'userId', path: 'id' }],
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const captureIssues = report.issues.filter(i =>
        i.type === 'wrong_capture_field' && i.message.includes('建立資源')
      );
      expect(captureIssues).toHaveLength(0);
    });

    it('應該忽略沒有 capture 的步驟', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '取得使用者',
          operationId: 'getUser',
          request: { method: 'GET', path: '/users/1' },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const captureIssues = report.issues.filter(i => i.type === 'wrong_capture_field');
      expect(captureIssues).toHaveLength(0);
    });
  });

  describe('generateFixSuggestions() - 產生修正建議', () => {
    it('應該產生狀態碼修正建議', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者 - 成功',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: {} },
          expect: { statusCode: 200 },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();
      const suggestions = checker.generateFixSuggestions(report);

      const statusSuggestions = suggestions.filter(s => s.fieldPath === 'expect.statusCode');
      expect(statusSuggestions.length).toBeGreaterThan(0);
      expect(statusSuggestions[0].currentValue).toBe(200);
      expect(statusSuggestions[0].suggestedValue).toBe(201);
    });

    it('應該產生 username 修正建議', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: { username: 'x' } },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();
      const suggestions = checker.generateFixSuggestions(report);

      const usernameSuggestions = suggestions.filter(s => s.fieldPath === 'request.body.username');
      expect(usernameSuggestions.length).toBeGreaterThan(0);
      expect(usernameSuggestions[0].currentValue).toBe('x');
      expect(usernameSuggestions[0].suggestedValue).toBe('testuser');
    });

    it('應該產生 password 修正建議', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: { password: 'pw' } },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();
      const suggestions = checker.generateFixSuggestions(report);

      const passwordSuggestions = suggestions.filter(s => s.fieldPath === 'request.body.password');
      expect(passwordSuggestions.length).toBeGreaterThan(0);
      expect(passwordSuggestions[0].suggestedValue).toBe('password123');
    });

    it('應該產生 email 修正建議', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: { email: 'test' } },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();
      const suggestions = checker.generateFixSuggestions(report);

      const emailSuggestions = suggestions.filter(s => s.fieldPath === 'request.body.email');
      expect(emailSuggestions.length).toBeGreaterThan(0);
      expect(emailSuggestions[0].suggestedValue).toBe('test@example.com');
    });

    it('應該產生重複名稱修正建議', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立 建立 使用者',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: {} },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();
      const suggestions = checker.generateFixSuggestions(report);

      const nameSuggestions = suggestions.filter(s => s.fieldPath === 'name');
      expect(nameSuggestions.length).toBeGreaterThan(0);
      expect(nameSuggestions[0].currentValue).toBe('建立 建立 使用者');
      expect(nameSuggestions[0].suggestedValue).toBe('建立 使用者');
    });

    it('空報告應該返回空建議', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();
      const suggestions = checker.generateFixSuggestions(report);

      expect(suggestions).toHaveLength(0);
    });
  });

  describe('normalizePathForLookup() - 私有方法（透過行為測試）', () => {
    it('應該正確處理變數路徑 ({{userId}} -> {id})', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '取得使用者 - 成功',
          operationId: 'getUser',
          request: { method: 'GET', path: '/users/{{userId}}' },
          expect: { statusCode: 200 },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      // 如果正規化正確，應該能找到 /users/{id} 端點並驗證狀態碼
      const statusIssues = report.issues.filter(i => i.type === 'invalid_status_code');
      expect(statusIssues).toHaveLength(0);
    });

    it('應該正確處理數字路徑 (/users/123 -> /users/{id})', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '取得使用者 - 成功',
          operationId: 'getUser',
          request: { method: 'GET', path: '/users/123' },
          expect: { statusCode: 200 },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      const statusIssues = report.issues.filter(i => i.type === 'invalid_status_code');
      expect(statusIssues).toHaveLength(0);
    });
  });

  describe('完整情境測試', () => {
    it('應該完整檢查一個包含多種問題的 Flow', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立 建立 使用者 - 成功',
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: { username: 'x', email: 'test' } },
          expect: { statusCode: 200 }, // 應該是 201
        },
        {
          id: 'step2',
          name: '建立 建立 使用者 - 成功', // 重複名稱
          operationId: 'createUser',
          request: { method: 'POST', path: '/users', body: { username: 'y' } },
        },
        {
          id: 'step3',
          name: '取得使用者',
          operationId: 'getUser',
          request: { method: 'GET', path: '/users/{id}' }, // 未處理的路徑參數
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      expect(report.totalIssues).toBeGreaterThan(5);
      expect(report.errors).toBeGreaterThan(0);
      expect(report.warnings).toBeGreaterThan(0);
      expect(report.score).toBeLessThan(100);

      // 應該包含各種類型的問題
      const issueTypes = new Set(report.issues.map(i => i.type));
      expect(issueTypes.has('invalid_status_code')).toBe(true);
      expect(issueTypes.has('poor_test_data')).toBe(true);
      expect(issueTypes.has('duplicate_name')).toBe(true);
      expect(issueTypes.has('invalid_path_param')).toBe(true);
    });

    it('應該通過完美的 CRUD Flow', () => {
      const spec = createMockSpec();
      const flow = createMockFlow([
        {
          id: 'step1',
          name: '建立使用者',
          operationId: 'createUser',
          request: {
            method: 'POST',
            path: '/users',
            body: { username: 'testuser', email: 'test@example.com' },
          },
          expect: { statusCode: 201 },
          capture: [{ variableName: 'userId', path: 'id' }],
        },
        {
          id: 'step2',
          name: '取得使用者',
          operationId: 'getUser',
          request: { method: 'GET', path: '/users/{{userId}}' },
          expect: { statusCode: 200 },
        },
        {
          id: 'step3',
          name: '更新使用者',
          operationId: 'updateUser',
          request: {
            method: 'PUT',
            path: '/users/{{userId}}',
            body: { username: 'updateduser' },
          },
          expect: { statusCode: 200 },
        },
      ]);

      const checker = new FlowQualityChecker(spec, flow);
      const report = checker.check();

      expect(report.totalIssues).toBe(0);
      expect(report.score).toBe(100);
    });
  });
});
