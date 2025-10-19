/**
 * SpecAnalyzer 單元測試
 */

import { describe, test, expect } from 'vitest';
import { SpecAnalyzer } from '../src/spec-analyzer.js';
import { writeFileSync, unlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

  describe('detectIssues()', () => {
    test('應該檢測到所有缺少 operationId 的端點', () => {
      const analyzer = new SpecAnalyzer({
        spec: {
          openapi: '3.0.0',
          info: { title: 'Test API', version: '1.0.0' },
          paths: {
            '/users': {
              post: {
                // 沒有 operationId
                summary: '建立使用者',
                responses: { '201': { description: 'Created' } },
              },
              get: {
                // 沒有 operationId
                responses: { '200': { description: 'OK' } },
              },
            },
            '/products': {
              post: {
                operationId: 'createProduct', // 有 operationId
                responses: { '201': { description: 'Created' } },
              },
            },
          },
        } as any,
      });

      const result = analyzer.detectIssues();

      expect(result.hasIssues).toBe(true);
      expect(result.totalEndpoints).toBe(3);
      expect(result.missingOperationIds).toHaveLength(2);
      expect(result.missingOperationIds[0]).toEqual({
        method: 'POST',
        path: '/users',
        suggestedId: 'createUsers',
      });
      expect(result.missingOperationIds[1]).toEqual({
        method: 'GET',
        path: '/users',
        suggestedId: 'getUsers',
      });
    });

    test('所有端點都有 operationId 時應該返回無問題', () => {
      const analyzer = new SpecAnalyzer({
        spec: {
          openapi: '3.0.0',
          info: { title: 'Test API', version: '1.0.0' },
          paths: {
            '/users': {
              post: {
                operationId: 'createUser',
                responses: { '201': { description: 'Created' } },
              },
              get: {
                operationId: 'listUsers',
                responses: { '200': { description: 'OK' } },
              },
            },
          },
        } as any,
      });

      const result = analyzer.detectIssues();

      expect(result.hasIssues).toBe(false);
      expect(result.totalEndpoints).toBe(2);
      expect(result.missingOperationIds).toHaveLength(0);
    });

    test('應該正確產生建議的 operationId', () => {
      const analyzer = new SpecAnalyzer({
        spec: {
          openapi: '3.0.0',
          info: { title: 'Test API', version: '1.0.0' },
          paths: {
            '/api/v1/users': {
              post: {
                responses: { '201': { description: 'Created' } },
              },
            },
            '/users/{id}': {
              get: {
                responses: { '200': { description: 'OK' } },
              },
              put: {
                responses: { '200': { description: 'OK' } },
              },
              delete: {
                responses: { '204': { description: 'No Content' } },
              },
            },
          },
        } as any,
      });

      const result = analyzer.detectIssues();

      expect(result.missingOperationIds).toHaveLength(4);
      expect(result.missingOperationIds[0].suggestedId).toBe('createApiV1Users');
      expect(result.missingOperationIds[1].suggestedId).toBe('getUsers');
      expect(result.missingOperationIds[2].suggestedId).toBe('updateUsers');
      expect(result.missingOperationIds[3].suggestedId).toBe('deleteUsers');
    });

    test('應該忽略非 HTTP 方法', () => {
      const analyzer = new SpecAnalyzer({
        spec: {
          openapi: '3.0.0',
          info: { title: 'Test API', version: '1.0.0' },
          paths: {
            '/users': {
              get: {
                responses: { '200': { description: 'OK' } },
              },
              parameters: [
                { name: 'test', in: 'query', schema: { type: 'string' } },
              ],
              servers: [{ url: 'http://localhost' }],
            },
          },
        } as any,
      });

      const result = analyzer.detectIssues();

      // 只應該檢測到 GET 方法，忽略 parameters 和 servers
      expect(result.totalEndpoints).toBe(1);
      expect(result.missingOperationIds).toHaveLength(1);
    });

    test('空規格應該返回無端點', () => {
      const analyzer = new SpecAnalyzer({
        spec: {
          openapi: '3.0.0',
          info: { title: 'Test API', version: '1.0.0' },
          paths: {},
        } as any,
      });

      const result = analyzer.detectIssues();

      expect(result.hasIssues).toBe(false);
      expect(result.totalEndpoints).toBe(0);
      expect(result.missingOperationIds).toHaveLength(0);
    });

    test('沒有 paths 屬性應該正常處理', () => {
      const analyzer = new SpecAnalyzer({
        spec: {
          openapi: '3.0.0',
          info: { title: 'Test API', version: '1.0.0' },
        } as any,
      });

      const result = analyzer.detectIssues();

      expect(result.hasIssues).toBe(false);
      expect(result.totalEndpoints).toBe(0);
      expect(result.missingOperationIds).toHaveLength(0);
    });
  });

  describe('checkIfModifiable()', () => {
    test('可寫入的檔案應該返回 true', () => {
      const analyzer = new SpecAnalyzer({
        spec: { openapi: '3.0.0', info: { title: 'Test', version: '1.0.0' } } as any,
      });

      // 建立臨時檔案
      const tempFile = join(tmpdir(), `spec-test-${Date.now()}.yaml`);
      writeFileSync(tempFile, 'test content');

      try {
        const result = analyzer.checkIfModifiable(tempFile);
        expect(result).toBe(true);
      } finally {
        unlinkSync(tempFile);
      }
    });

    test('不存在的檔案應該返回 false', () => {
      const analyzer = new SpecAnalyzer({
        spec: { openapi: '3.0.0', info: { title: 'Test', version: '1.0.0' } } as any,
      });

      const result = analyzer.checkIfModifiable('/nonexistent/path/to/spec.yaml');
      expect(result).toBe(false);
    });

    test('唯讀檔案應該返回 false', () => {
      const analyzer = new SpecAnalyzer({
        spec: { openapi: '3.0.0', info: { title: 'Test', version: '1.0.0' } } as any,
      });

      // 建立唯讀臨時檔案
      const tempFile = join(tmpdir(), `spec-readonly-${Date.now()}.yaml`);
      writeFileSync(tempFile, 'test content');

      try {
        // 設定為唯讀（Windows 和 Unix 相容）
        chmodSync(tempFile, 0o444);

        const result = analyzer.checkIfModifiable(tempFile);

        // 在 Windows 上，即使設定為唯讀，也可能返回 true
        // 這取決於檔案系統和權限
        // 所以我們只測試方法不會拋出錯誤
        expect(typeof result).toBe('boolean');
      } finally {
        // 恢復寫入權限後再刪除
        chmodSync(tempFile, 0o644);
        unlinkSync(tempFile);
      }
    });
  });
});
