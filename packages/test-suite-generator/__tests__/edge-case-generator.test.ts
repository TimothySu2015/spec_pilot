/**
 * EdgeCaseGenerator 單元測試
 * 測試邊界值測試產生器的各種功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EdgeCaseGenerator } from '../src/edge-case-generator.js';
import type { EndpointInfo, JSONSchema } from '../src/types.js';

describe('EdgeCaseGenerator', () => {
  let generator: EdgeCaseGenerator;

  beforeEach(() => {
    generator = new EdgeCaseGenerator();
  });

  describe('構造函數', () => {
    it('應該成功建立實例', () => {
      const gen = new EdgeCaseGenerator();
      expect(gen).toBeInstanceOf(EdgeCaseGenerator);
    });

    it('應該能產生邊界測試', () => {
      const gen = new EdgeCaseGenerator();
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', maxLength: 10 },
          },
          required: ['name'],
        },
      });

      const steps = gen.generateEdgeCases(endpoint);
      expect(steps.length).toBeGreaterThan(0);
    });
  });

  describe('generateEdgeCases', () => {
    it('沒有 requestSchema 時應該返回空陣列', () => {
      const endpoint = createEndpoint({
        requestSchema: undefined,
      });

      const steps = generator.generateEdgeCases(endpoint);
      expect(steps).toEqual([]);
    });

    it('沒有 properties 時應該返回空陣列', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
        },
      });

      const steps = generator.generateEdgeCases(endpoint);
      expect(steps).toEqual([]);
    });

    it('properties 為空物件時應該返回空陣列', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {},
        },
      });

      const steps = generator.generateEdgeCases(endpoint);
      expect(steps).toEqual([]);
    });

    it('欄位沒有邊界限制時應該返回空陣列', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' }, // 沒有 minLength, maxLength
            age: { type: 'integer' }, // 沒有 minimum, maximum
          },
          required: ['name', 'age'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);
      expect(steps).toEqual([]);
    });
  });

  describe('字串長度邊界測試', () => {
    it('應該產生 maxLength 測試', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', maxLength: 20 },
          },
          required: ['username'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      const maxLengthStep = steps.find((s) => s.name.includes('最大長度') && !s.name.includes('超過'));
      expect(maxLengthStep).toBeDefined();
      expect(maxLengthStep?.request.body).toBeDefined();

      const username = (maxLengthStep?.request.body as Record<string, unknown>).username;
      expect(typeof username).toBe('string');
      expect((username as string).length).toBe(20);
      expect(maxLengthStep?.expect.status).toBe(200);
    });

    it('應該產生超過 maxLength 測試', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', maxLength: 20 },
          },
          required: ['username'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      const exceedStep = steps.find((s) => s.name.includes('超過最大長度'));
      expect(exceedStep).toBeDefined();

      const username = (exceedStep?.request.body as Record<string, unknown>).username;
      expect((username as string).length).toBe(21);
      expect(exceedStep?.expect.status).toBe(400);
    });

    it('應該產生 minLength 測試', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            password: { type: 'string', minLength: 8 },
          },
          required: ['password'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      const minLengthStep = steps.find((s) => s.name.includes('最小長度'));
      expect(minLengthStep).toBeDefined();

      const password = (minLengthStep?.request.body as Record<string, unknown>).password;
      expect((password as string).length).toBe(8);
      expect(minLengthStep?.expect.status).toBe(200);
    });

    it('應該同時產生 minLength 和 maxLength 測試', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 20 },
          },
          required: ['username'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      expect(steps.length).toBe(3); // 最小長度、最大長度、超過最大長度
      expect(steps.some((s) => s.name.includes('最小長度'))).toBe(true);
      expect(steps.some((s) => s.name.includes('最大長度') && !s.name.includes('超過'))).toBe(true);
      expect(steps.some((s) => s.name.includes('超過最大長度'))).toBe(true);
    });

    it('應該正確處理 maxLength = 0', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            field: { type: 'string', maxLength: 0 },
          },
          required: ['field'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      const maxLengthStep = steps.find((s) => s.name.includes('最大長度') && !s.name.includes('超過'));
      expect(maxLengthStep).toBeDefined();

      const field = (maxLengthStep?.request.body as Record<string, unknown>).field;
      expect((field as string).length).toBe(0);
    });

    it('應該正確處理 minLength = 0', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            field: { type: 'string', minLength: 0 },
          },
          required: ['field'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      const minLengthStep = steps.find((s) => s.name.includes('最小長度'));
      expect(minLengthStep).toBeDefined();

      const field = (minLengthStep?.request.body as Record<string, unknown>).field;
      expect((field as string).length).toBe(0);
    });
  });

  describe('數值範圍邊界測試', () => {
    it('應該產生 integer minimum 測試', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            age: { type: 'integer', minimum: 0 },
          },
          required: ['age'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      const minStep = steps.find((s) => s.name.includes('最小值'));
      expect(minStep).toBeDefined();

      const age = (minStep?.request.body as Record<string, unknown>).age;
      expect(age).toBe(0);
      expect(minStep?.expect.status).toBe(200);
    });

    it('應該產生 integer maximum 測試', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            age: { type: 'integer', maximum: 150 },
          },
          required: ['age'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      const maxStep = steps.find((s) => s.name.includes('最大值'));
      expect(maxStep).toBeDefined();

      const age = (maxStep?.request.body as Record<string, unknown>).age;
      expect(age).toBe(150);
      expect(maxStep?.expect.status).toBe(200);
    });

    it('應該產生 number minimum 測試', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            price: { type: 'number', minimum: 0.01 },
          },
          required: ['price'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      const minStep = steps.find((s) => s.name.includes('最小值'));
      expect(minStep).toBeDefined();

      const price = (minStep?.request.body as Record<string, unknown>).price;
      expect(price).toBe(0.01);
    });

    it('應該產生 number maximum 測試', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            price: { type: 'number', maximum: 999.99 },
          },
          required: ['price'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      const maxStep = steps.find((s) => s.name.includes('最大值'));
      expect(maxStep).toBeDefined();

      const price = (maxStep?.request.body as Record<string, unknown>).price;
      expect(price).toBe(999.99);
    });

    it('應該同時產生 minimum 和 maximum 測試', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            age: { type: 'integer', minimum: 0, maximum: 150 },
          },
          required: ['age'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      expect(steps.length).toBe(2);
      expect(steps.some((s) => s.name.includes('最小值'))).toBe(true);
      expect(steps.some((s) => s.name.includes('最大值'))).toBe(true);
    });

    it('應該正確處理 minimum = 0', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            count: { type: 'integer', minimum: 0 },
          },
          required: ['count'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      const minStep = steps.find((s) => s.name.includes('最小值'));
      expect(minStep).toBeDefined();
      expect((minStep?.request.body as Record<string, unknown>).count).toBe(0);
    });

    it('應該正確處理負數 minimum', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            temperature: { type: 'number', minimum: -273.15 },
          },
          required: ['temperature'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      const minStep = steps.find((s) => s.name.includes('最小值'));
      expect(minStep).toBeDefined();
      expect((minStep?.request.body as Record<string, unknown>).temperature).toBe(-273.15);
    });
  });

  describe('FlowStep 結構', () => {
    it('應該產生正確的 FlowStep 結構', () => {
      const endpoint = createEndpoint({
        operationId: 'createUser',
        summary: '建立使用者',
        requestSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', maxLength: 20 },
          },
          required: ['username'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);
      const step = steps[0];

      expect(step).toHaveProperty('id');
      expect(step).toHaveProperty('name');
      expect(step).toHaveProperty('operationId');
      expect(step).toHaveProperty('request');
      expect(step).toHaveProperty('expect');

      expect(step.operationId).toBe('createUser');
      expect(step.request).toHaveProperty('body');
      expect(step.expect).toHaveProperty('status');
    });

    it('應該使用 summary 作為測試名稱前綴', () => {
      const endpoint = createEndpoint({
        summary: '建立使用者',
        requestSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', maxLength: 20 },
          },
          required: ['username'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      steps.forEach((step) => {
        expect(step.name).toContain('建立使用者');
      });
    });

    it('沒有 summary 時應該使用 operationId', () => {
      const endpoint = createEndpoint({
        summary: undefined,
        operationId: 'createUser',
        requestSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', maxLength: 20 },
          },
          required: ['username'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      steps.forEach((step) => {
        expect(step.name).toContain('createUser');
      });
    });

    it('應該產生正確的步驟 ID', () => {
      const endpoint = createEndpoint({
        operationId: 'createUser',
        requestSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', maxLength: 20 },
          },
          required: ['username'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      steps.forEach((step) => {
        expect(step.id).toContain('create_user');
        expect(step.id).toContain('edge');
        expect(step.id).toContain('username');
      });
    });

    it('應該正確處理 PascalCase operationId', () => {
      const endpoint = createEndpoint({
        operationId: 'CreateUserAccount',
        requestSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', maxLength: 50 },
          },
          required: ['email'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      steps.forEach((step) => {
        expect(step.id).toContain('create_user_account');
      });
    });
  });

  describe('多欄位邊界測試', () => {
    it('應該為每個有邊界限制的欄位產生測試', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', maxLength: 20 },
            password: { type: 'string', minLength: 8 },
            age: { type: 'integer', minimum: 0, maximum: 150 },
          },
          required: ['username', 'password', 'age'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      // username: 最大長度、超過最大長度 = 2
      // password: 最小長度 = 1
      // age: 最小值、最大值 = 2
      // 總共 5 個測試
      expect(steps.length).toBe(5);

      const usernameSteps = steps.filter((s) => s.name.includes('username'));
      const passwordSteps = steps.filter((s) => s.name.includes('password'));
      const ageSteps = steps.filter((s) => s.name.includes('age'));

      expect(usernameSteps.length).toBe(2);
      expect(passwordSteps.length).toBe(1);
      expect(ageSteps.length).toBe(2);
    });

    it('產生的測試資料應該包含所有必填欄位', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', maxLength: 20 },
            email: { type: 'string' },
            age: { type: 'integer' },
          },
          required: ['username', 'email', 'age'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      steps.forEach((step) => {
        const body = step.request.body as Record<string, unknown>;
        expect(body).toHaveProperty('username');
        expect(body).toHaveProperty('email');
        expect(body).toHaveProperty('age');
      });
    });

    it('應該只修改目標邊界欄位，其他欄位使用有效值', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', maxLength: 20 },
            email: { type: 'string', format: 'email' },
          },
          required: ['username', 'email'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      const usernameMaxStep = steps.find((s) => s.name.includes('username') && s.name.includes('最大長度'));
      expect(usernameMaxStep).toBeDefined();

      const body = usernameMaxStep?.request.body as Record<string, unknown>;

      // username 應該是邊界值
      expect((body.username as string).length).toBe(20);

      // email 應該是有效值
      expect(body.email).toBeDefined();
      expect(typeof body.email).toBe('string');
    });
  });

  describe('整合測試', () => {
    it('應該能處理複雜的 schema', () => {
      const endpoint = createEndpoint({
        summary: '建立使用者',
        method: 'post',
        path: '/api/users',
        requestSchema: {
          type: 'object',
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 20 },
            password: { type: 'string', minLength: 8, maxLength: 50 },
            email: { type: 'string', format: 'email' },
            age: { type: 'integer', minimum: 0, maximum: 150 },
            bio: { type: 'string', maxLength: 500 },
          },
          required: ['username', 'password', 'email', 'age'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      // username: 3 個測試 (min, max, exceed)
      // password: 3 個測試 (min, max, exceed)
      // age: 2 個測試 (min, max)
      // bio: 2 個測試 (max, exceed)
      // 總共 10 個測試
      expect(steps.length).toBe(10);

      // 所有測試都應該有完整的資料
      steps.forEach((step) => {
        expect(step.request.body).toBeDefined();
        expect(step.expect.status).toBeGreaterThanOrEqual(200);
        expect(step.expect.status).toBeLessThan(500);
      });
    });

    it('應該能處理混合型別的 schema', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', maxLength: 100 },
            price: { type: 'number', minimum: 0, maximum: 9999.99 },
            quantity: { type: 'integer', minimum: 1 },
            description: { type: 'string' }, // 沒有限制
            tags: { type: 'array' }, // 不支援的類型
          },
          required: ['title', 'price', 'quantity'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);

      // title: 2 個測試
      // price: 2 個測試
      // quantity: 1 個測試
      // description, tags: 0 個測試
      expect(steps.length).toBe(5);
    });

    it('應該能處理所有欄位都沒有邊界限制的情況', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            active: { type: 'boolean' },
          },
          required: ['name', 'email'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);
      expect(steps).toEqual([]);
    });
  });

  describe('邊界案例', () => {
    it('應該能處理空 properties 物件', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);
      expect(steps).toEqual([]);
    });

    it('應該能處理不支援的欄位類型', () => {
      const endpoint = createEndpoint({
        requestSchema: {
          type: 'object',
          properties: {
            tags: { type: 'array', minItems: 1, maxItems: 10 },
            metadata: { type: 'object' },
            active: { type: 'boolean' },
          },
          required: ['tags'],
        },
      });

      const steps = generator.generateEdgeCases(endpoint);
      // 不支援 array, object, boolean 的邊界測試
      expect(steps).toEqual([]);
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
