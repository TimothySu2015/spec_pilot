import { describe, it, expect } from 'vitest';
import { FlowDefinitionSchema, HTTPMethodSchema } from '../src/flow-schema';

describe('FlowDefinitionSchema', () => {
  it('應該接受完整的 Flow 定義', () => {
    const validFlow = {
      name: '使用者管理流程',
      description: '涵蓋登入與 CRUD 操作',
      version: '1.0.0',
      globals: {
        baseUrl: 'http://localhost:3000',
      },
      variables: {
        username: 'admin',
        password: '123456',
      },
      steps: [
        {
          name: '登入',
          request: {
            method: 'POST',
            path: '/auth/login',
            headers: {
              'Content-Type': 'application/json',
            },
          },
          expect: {
            statusCode: 200,
          },
          validation: [
            { rule: 'notNull', path: 'token' },
          ],
          capture: [
            { variableName: 'token', path: 'token' },
          ],
        },
      ],
      options: {
        timeout: 3000,
        failFast: true,
      },
      reporting: {
        verbose: true,
      },
    };

    const result = FlowDefinitionSchema.safeParse(validFlow);
    expect(result.success).toBe(true);
  });

  it('缺少必要欄位時應該驗證失敗', () => {
    const invalidFlow = {
      description: '缺少 name',
      steps: [],
    };

    const result = FlowDefinitionSchema.safeParse(invalidFlow);
    expect(result.success).toBe(false);
  });

  it('應該允許 baseUrl 使用變數', () => {
    const flowWithVariable = {
      name: '變數 baseUrl',
      baseUrl: '{{api_url}}',
      steps: [
        {
          name: '健康檢查',
          request: { method: 'GET', path: '/' },
          expect: { statusCode: 200 },
        },
      ],
    };

    const result = FlowDefinitionSchema.safeParse(flowWithVariable);
    expect(result.success).toBe(true);
  });
});

describe('HTTPMethodSchema', () => {
  it('應該接受合法的 HTTP 方法', () => {
    const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

    validMethods.forEach(method => {
      const result = HTTPMethodSchema.safeParse(method);
      expect(result.success).toBe(true);
    });
  });

  it('應該拒絕未知的 HTTP 方法', () => {
    const result = HTTPMethodSchema.safeParse('INVALID');
    expect(result.success).toBe(false);
  });
});
