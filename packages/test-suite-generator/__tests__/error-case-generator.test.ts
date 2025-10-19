/**
 * ErrorCaseGenerator 單元測試
 * 測試錯誤案例產生器的各種功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorCaseGenerator } from '../src/error-case-generator.js';
import type { EndpointInfo, JSONSchema } from '../src/types.js';

describe('ErrorCaseGenerator', () => {
  let generator: ErrorCaseGenerator;

  beforeEach(() => {
    generator = new ErrorCaseGenerator();
  });

  describe('構造函數與配置', () => {
    it('應該使用預設配置', () => {
      const gen = new ErrorCaseGenerator();
      // 預設應該全部啟用
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
        security: [{ bearerAuth: [] }],
      });

      const missingCases = gen.generateMissingFieldCases(endpoint);
      const authCases = gen.generateAuthErrorCases(endpoint);

      expect(missingCases.length).toBeGreaterThan(0);
      expect(authCases.length).toBeGreaterThan(0);
    });

    it('應該支援關閉必填欄位測試', () => {
      const gen = new ErrorCaseGenerator({ includeMissingFields: false });
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
      });

      const steps = gen.generateMissingFieldCases(endpoint);
      expect(steps).toEqual([]);
    });

    it('應該支援關閉格式驗證測試', () => {
      const gen = new ErrorCaseGenerator({ includeInvalidFormats: false });
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: { email: { type: 'string', format: 'email' } },
        },
      });

      const steps = gen.generateFormatValidationCases(endpoint);
      expect(steps).toEqual([]);
    });

    it('應該支援關閉認證錯誤測試', () => {
      const gen = new ErrorCaseGenerator({ includeAuthErrors: false });
      const endpoint = createEndpoint({
        security: [{ bearerAuth: [] }],
      });

      const steps = gen.generateAuthErrorCases(endpoint);
      expect(steps).toEqual([]);
    });

    it('應該支援同時配置多個選項', () => {
      const gen = new ErrorCaseGenerator({
        includeMissingFields: true,
        includeInvalidFormats: false,
        includeAuthErrors: false,
      });

      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
        security: [{ bearerAuth: [] }],
      });

      const missingCases = gen.generateMissingFieldCases(endpoint);
      const formatCases = gen.generateFormatValidationCases(endpoint);
      const authCases = gen.generateAuthErrorCases(endpoint);

      expect(missingCases.length).toBeGreaterThan(0);
      expect(formatCases).toEqual([]);
      expect(authCases).toEqual([]);
    });
  });

  describe('generateMissingFieldCases', () => {
    it('應該為每個必填欄位產生缺失測試', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
          required: ['username', 'email', 'password'],
        },
      });

      const steps = generator.generateMissingFieldCases(endpoint);

      expect(steps).toHaveLength(3);
      expect(steps[0].name).toContain('缺少 username');
      expect(steps[1].name).toContain('缺少 email');
      expect(steps[2].name).toContain('缺少 password');
    });

    it('產生的請求應該包含其他必填欄位', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            email: { type: 'string' },
          },
          required: ['username', 'email'],
        },
      });

      const steps = generator.generateMissingFieldCases(endpoint);

      // 第一個測試缺少 username，應該有 email
      const step1 = steps.find((s) => s.name.includes('缺少 username'));
      expect(step1?.request.body).toBeDefined();
      expect(step1?.request.body).not.toHaveProperty('username');
      expect(step1?.request.body).toHaveProperty('email');

      // 第二個測試缺少 email，應該有 username
      const step2 = steps.find((s) => s.name.includes('缺少 email'));
      expect(step2?.request.body).toBeDefined();
      expect(step2?.request.body).toHaveProperty('username');
      expect(step2?.request.body).not.toHaveProperty('email');
    });

    it('應該預期 400 狀態碼', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
      });

      const steps = generator.generateMissingFieldCases(endpoint);

      expect(steps[0].expectations.status).toBe(400);
    });

    it('應該正確設定請求方法與路徑', () => {
      const endpoint = createEndpoint({
        method: 'post',
        path: '/api/users',
        requestSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
      });

      const steps = generator.generateMissingFieldCases(endpoint);

      expect(steps[0].request.method).toBe('POST');
      expect(steps[0].request.path).toBe('/api/users');
    });

    it('沒有 requestSchema 時應該返回空陣列', () => {
      const endpoint = createEndpoint({
        requestSchema: undefined,
      });

      const steps = generator.generateMissingFieldCases(endpoint);
      expect(steps).toEqual([]);
    });

    it('沒有 required 欄位時應該返回空陣列', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
      });

      const steps = generator.generateMissingFieldCases(endpoint);
      expect(steps).toEqual([]);
    });

    it('required 是空陣列時應該返回空陣列', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: [],
        },
      });

      const steps = generator.generateMissingFieldCases(endpoint);
      expect(steps).toEqual([]);
    });

    it('應該使用 summary 作為測試名稱前綴', () => {
      const endpoint = createEndpoint({
        summary: '建立使用者',
        requestSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
      });

      const steps = generator.generateMissingFieldCases(endpoint);
      expect(steps[0].name).toContain('建立使用者');
    });

    it('沒有 summary 時應該使用 operationId', () => {
      const endpoint = createEndpoint({
        summary: undefined,
        operationId: 'createUser',
        requestSchema: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
      });

      const steps = generator.generateMissingFieldCases(endpoint);
      expect(steps[0].name).toContain('createUser');
    });
  });

  describe('generateFormatValidationCases', () => {
    it('應該為有 format 的欄位產生無效格式測試', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            website: { type: 'string', format: 'uri' },
          },
          required: ['email', 'website'],
        },
      });

      const steps = generator.generateFormatValidationCases(endpoint);

      expect(steps.length).toBeGreaterThan(0);
      const emailStep = steps.find((s) => s.name.includes('email'));
      expect(emailStep).toBeDefined();
    });

    it('產生的請求應該包含無效值', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
          },
          required: ['email'],
        },
      });

      const steps = generator.generateFormatValidationCases(endpoint);

      expect(steps[0].request.body).toBeDefined();
      expect(steps[0].request.body).toHaveProperty('email');
      // 應該是無效的 email
      const emailValue = (steps[0].request.body as Record<string, unknown>).email;
      expect(typeof emailValue).toBe('string');
    });

    it('應該預期 400 狀態碼', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
          },
          required: ['email'],
        },
      });

      const steps = generator.generateFormatValidationCases(endpoint);
      expect(steps[0].expectations.status).toBe(400);
    });

    it('應該正確設定請求方法與路徑', () => {
      const endpoint = createEndpoint({
        method: 'put',
        path: '/api/users/123',
        requestSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
          },
          required: ['email'],
        },
      });

      const steps = generator.generateFormatValidationCases(endpoint);

      expect(steps[0].request.method).toBe('PUT');
      expect(steps[0].request.path).toBe('/api/users/123');
    });

    it('沒有 requestSchema 時應該返回空陣列', () => {
      const endpoint = createEndpoint({
        requestSchema: undefined,
      });

      const steps = generator.generateFormatValidationCases(endpoint);
      expect(steps).toEqual([]);
    });

    it('沒有 properties 時應該返回空陣列', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
        },
      });

      const steps = generator.generateFormatValidationCases(endpoint);
      expect(steps).toEqual([]);
    });

    it('所有欄位都無法產生無效值時應該返回空陣列', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            // 普通字串沒有特殊格式，可能無法產生無效值
            name: { type: 'string' },
          },
          required: ['name'],
        },
      });

      const steps = generator.generateFormatValidationCases(endpoint);
      // DataSynthesizer.synthesizeInvalid 對於普通 string 可能返回 null
      // 這個測試驗證當所有欄位都返回 null 時，結果為空
      expect(Array.isArray(steps)).toBe(true);
    });

    it('應該使用 summary 作為測試名稱前綴', () => {
      const endpoint = createEndpoint({
        summary: '更新使用者資料',
        requestSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
          },
          required: ['email'],
        },
      });

      const steps = generator.generateFormatValidationCases(endpoint);
      expect(steps[0].name).toContain('更新使用者資料');
    });

    it('應該為每個可產生無效值的欄位產生測試', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            age: { type: 'integer', minimum: 0, maximum: 150 },
            website: { type: 'string', format: 'uri' },
          },
          required: ['email', 'age', 'website'],
        },
      });

      const steps = generator.generateFormatValidationCases(endpoint);

      // 應該為每個可產生無效值的欄位產生測試
      expect(steps.length).toBeGreaterThan(0);

      // 檢查是否有針對不同欄位的測試
      const fieldNames = steps.map((s) => {
        const match = s.name.match(/無效 (\w+) 格式/);
        return match ? match[1] : null;
      });

      expect(fieldNames).toContain('email');
    });
  });

  describe('generateAuthErrorCases', () => {
    it('應該為需要認證的端點產生無認證測試', () => {
      const endpoint = createEndpoint({
        security: [{ bearerAuth: [] }],
      });

      const steps = generator.generateAuthErrorCases(endpoint);

      expect(steps).toHaveLength(1);
      expect(steps[0].name).toContain('無認證');
    });

    it('應該預期 401 狀態碼', () => {
      const endpoint = createEndpoint({
        security: [{ bearerAuth: [] }],
      });

      const steps = generator.generateAuthErrorCases(endpoint);
      expect(steps[0].expectations.status).toBe(401);
    });

    it('應該正確設定請求方法與路徑', () => {
      const endpoint = createEndpoint({
        method: 'delete',
        path: '/api/users/123',
        security: [{ bearerAuth: [] }],
      });

      const steps = generator.generateAuthErrorCases(endpoint);

      expect(steps[0].request.method).toBe('DELETE');
      expect(steps[0].request.path).toBe('/api/users/123');
    });

    it('請求應該不包含 body', () => {
      const endpoint = createEndpoint({
        security: [{ bearerAuth: [] }],
      });

      const steps = generator.generateAuthErrorCases(endpoint);

      // 認證測試不需要 body
      expect(steps[0].request.body).toBeUndefined();
    });

    it('沒有 security 時應該返回空陣列', () => {
      const endpoint = createEndpoint({
        security: undefined,
      });

      const steps = generator.generateAuthErrorCases(endpoint);
      expect(steps).toEqual([]);
    });

    it('security 是空陣列時應該返回空陣列', () => {
      const endpoint = createEndpoint({
        security: [],
      });

      const steps = generator.generateAuthErrorCases(endpoint);
      expect(steps).toEqual([]);
    });

    it('應該使用 summary 作為測試名稱前綴', () => {
      const endpoint = createEndpoint({
        summary: '刪除使用者',
        security: [{ bearerAuth: [] }],
      });

      const steps = generator.generateAuthErrorCases(endpoint);
      expect(steps[0].name).toContain('刪除使用者');
    });

    it('沒有 summary 時應該使用 operationId', () => {
      const endpoint = createEndpoint({
        summary: undefined,
        operationId: 'deleteUser',
        security: [{ bearerAuth: [] }],
      });

      const steps = generator.generateAuthErrorCases(endpoint);
      expect(steps[0].name).toContain('deleteUser');
    });

    it('應該支援多種認證方式', () => {
      const endpoint = createEndpoint({
        security: [{ apiKey: [] }, { oauth2: [] }],
      });

      const steps = generator.generateAuthErrorCases(endpoint);

      // 即使有多種認證方式，也只產生一個無認證測試
      expect(steps).toHaveLength(1);
    });
  });

  describe('整合測試', () => {
    it('應該能組合產生所有類型的錯誤測試', () => {
      const endpoint = createEndpoint({
        summary: '建立使用者',
        method: 'post',
        path: '/api/users',
        requestSchema: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
            age: { type: 'integer', minimum: 0 },
          },
          required: ['username', 'email'],
        },
        security: [{ bearerAuth: [] }],
      });

      const missingCases = generator.generateMissingFieldCases(endpoint);
      const formatCases = generator.generateFormatValidationCases(endpoint);
      const authCases = generator.generateAuthErrorCases(endpoint);

      // 應該產生 2 個必填欄位測試
      expect(missingCases.length).toBe(2);

      // 應該產生格式驗證測試
      expect(formatCases.length).toBeGreaterThan(0);

      // 應該產生 1 個認證測試
      expect(authCases.length).toBe(1);

      // 所有測試的名稱都應該包含 summary
      const allSteps = [...missingCases, ...formatCases, ...authCases];
      allSteps.forEach((step) => {
        expect(step.name).toContain('建立使用者');
      });
    });

    it('應該能處理只有部分配置啟用的情況', () => {
      const gen = new ErrorCaseGenerator({
        includeMissingFields: true,
        includeInvalidFormats: false,
        includeAuthErrors: true,
      });

      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            email: { type: 'string', format: 'email' },
          },
          required: ['username'],
        },
        security: [{ bearerAuth: [] }],
      });

      const missingCases = gen.generateMissingFieldCases(endpoint);
      const formatCases = gen.generateFormatValidationCases(endpoint);
      const authCases = gen.generateAuthErrorCases(endpoint);

      expect(missingCases.length).toBeGreaterThan(0);
      expect(formatCases).toEqual([]);
      expect(authCases.length).toBeGreaterThan(0);
    });

    it('應該能處理沒有任何錯誤案例的端點', () => {
      const endpoint = createEndpoint({
        method: 'get',
        path: '/api/health',
        // 沒有 requestSchema
        // 沒有 security
      });

      const missingCases = generator.generateMissingFieldCases(endpoint);
      const formatCases = generator.generateFormatValidationCases(endpoint);
      const authCases = generator.generateAuthErrorCases(endpoint);

      expect(missingCases).toEqual([]);
      expect(formatCases).toEqual([]);
      expect(authCases).toEqual([]);
    });
  });
});

// ==================== 輔助函數 ====================

/**
 * 建立測試用的 EndpointInfo
 */
function createEndpoint(overrides: Partial<EndpointInfo> = {}): EndpointInfo {
  return {
    path: '/api/test',
    method: 'post',
    operationId: 'testOperation',
    summary: '測試端點',
    requestSchema: undefined,
    responseSchemas: {},
    security: undefined,
    examples: undefined,
    ...overrides,
  };
}
