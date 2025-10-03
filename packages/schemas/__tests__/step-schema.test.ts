import { describe, it, expect } from 'vitest';
import { FlowRequestSchema, FlowStepSchema } from '../src/step-schema';

describe('FlowRequestSchema', () => {
  it('應該接受僅提供 url 的設定', () => {
    const valid = {
      method: 'GET',
      url: 'https://api.example.com/users',
    };
    expect(() => FlowRequestSchema.parse(valid)).not.toThrow();
  });

  it('應該接受 query 參數設定', () => {
    const valid = {
      method: 'GET',
      path: '/api/users',
      query: {
        page: '1',
        limit: '10',
      },
    };
    expect(() => FlowRequestSchema.parse(valid)).not.toThrow();
  });

  it('缺少 path 與 url 時應該驗證失敗', () => {
    const invalid = {
      method: 'GET',
    };
    expect(() => FlowRequestSchema.parse(invalid)).toThrow();
  });
});

describe('FlowStepSchema', () => {
  it('應該接受包含 auth 的步驟', () => {
    const valid = {
      name: '登入',
      request: { method: 'POST', path: '/login' },
      expect: { statusCode: 200 },
      auth: {
        type: 'login',
        tokenExtraction: { path: 'token' },
      },
    };
    expect(() => FlowStepSchema.parse(valid)).not.toThrow();
  });

  it('應該接受包含 retryPolicy 的步驟', () => {
    const valid = {
      name: '取得資料',
      request: { method: 'GET', path: '/data' },
      expect: { statusCode: 200 },
      retryPolicy: {
        maxRetries: 3,
        delayMs: 500,
      },
    };
    expect(() => FlowStepSchema.parse(valid)).not.toThrow();
  });
});
