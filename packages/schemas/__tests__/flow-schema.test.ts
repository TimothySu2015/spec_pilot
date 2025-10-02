import { describe, it, expect } from 'vitest';
import { FlowDefinitionSchema, HTTPMethodSchema } from '../src/flow-schema';

describe('FlowDefinitionSchema', () => {
  it('應該接受有效的 Flow 定義', () => {
    const validFlow = {
      name: '使用者管理測試',
      description: '測試使用者 CRUD 操作',
      version: '1.0.0',
      baseUrl: 'http://localhost:3000',
      variables: {
        username: 'admin',
        password: '123456',
      },
      steps: [
        {
          name: '測試步驟',
          request: {
            method: 'GET',
            path: '/api/users',
          },
          expect: {
            statusCode: 200,
          },
        },
      ],
    };

    const result = FlowDefinitionSchema.safeParse(validFlow);
    expect(result.success).toBe(true);
  });

  it('應該拒絕缺少必填欄位的 Flow', () => {
    const invalidFlow = {
      description: '缺少 name',
      baseUrl: 'http://localhost:3000',
      steps: [],
    };

    const result = FlowDefinitionSchema.safeParse(invalidFlow);
    expect(result.success).toBe(false);
  });

  it('應該接受變數語法的 baseUrl', () => {
    const flowWithVariable = {
      name: '測試',
      baseUrl: '{{api_url}}',
      steps: [
        {
          name: '步驟',
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
  it('應該接受有效的 HTTP 方法', () => {
    const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

    validMethods.forEach((method) => {
      const result = HTTPMethodSchema.safeParse(method);
      expect(result.success).toBe(true);
    });
  });

  it('應該拒絕無效的 HTTP 方法', () => {
    const result = HTTPMethodSchema.safeParse('INVALID');
    expect(result.success).toBe(false);
  });
});
