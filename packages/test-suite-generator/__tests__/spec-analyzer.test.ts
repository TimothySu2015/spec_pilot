/**
 * SpecAnalyzer 單元測試
 */

import { describe, test, expect } from 'vitest';
import { SpecAnalyzer } from '../src/spec-analyzer.js';

describe('SpecAnalyzer', () => {
  test('應該提取基本端點資訊', () => {
    const analyzer = new SpecAnalyzer({
      spec: {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/users': {
            post: {
              operationId: 'createUser',
              summary: '建立使用者',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        username: { type: 'string' },
                      },
                      required: ['username'],
                    },
                  },
                },
              },
              responses: {
                '201': {
                  description: '成功',
                },
              },
            },
          },
        },
      } as any,
    });

    const endpoints = analyzer.extractEndpoints();

    expect(endpoints).toHaveLength(1);
    expect(endpoints[0].operationId).toBe('createUser');
    expect(endpoints[0].method).toBe('POST');
    expect(endpoints[0].path).toBe('/users');
  });

  test('應該識別認證端點', () => {
    const analyzer = new SpecAnalyzer({
      spec: {
        openapi: '3.0.0',
        info: { title: 'Auth API', version: '1.0.0' },
        paths: {
          '/auth/login': {
            post: {
              operationId: 'userLogin',
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        username: { type: 'string' },
                        password: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          token: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      } as any,
    });

    const authFlow = analyzer.getAuthenticationFlow();

    expect(authFlow).not.toBeNull();
    expect(authFlow?.operationId).toBe('userLogin');
  });
});
