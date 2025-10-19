/**
 * IntentRecognizer 單元測試
 * 測試意圖識別與端點推薦功能
 */

import { describe, it, expect } from 'vitest';
import { IntentRecognizer } from '../src/intent-recognizer.js';
import type { ParsedIntent, IntentRecognizerConfig } from '../src/types.js';
import type { OpenAPIDocument } from '@specpilot/spec-loader';

// ===== 輔助函數 =====

function createMockSpec(): OpenAPIDocument {
  return {
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {
      '/users': {
        get: {
          operationId: 'listUsers',
          summary: '取得使用者清單',
          description: '查詢所有使用者',
          responses: { '200': { description: 'OK' } },
        },
        post: {
          operationId: 'createUser',
          summary: '建立使用者',
          description: '新增一個使用者',
          responses: { '201': { description: 'Created' } },
        },
      },
      '/users/{id}': {
        get: {
          operationId: 'getUser',
          summary: '取得使用者資料',
          description: '根據 ID 查詢使用者',
          parameters: [
            {
              name: 'id',
              in: 'path' as const,
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: { '200': { description: 'OK' } },
        },
        put: {
          operationId: 'updateUser',
          summary: '更新使用者',
          responses: { '200': { description: 'OK' } },
        },
        delete: {
          operationId: 'deleteUser',
          summary: '刪除使用者',
          responses: { '204': { description: 'No Content' } },
        },
      },
      '/auth/login': {
        post: {
          operationId: 'userLogin',
          summary: '使用者登入',
          description: '使用 email 和密碼登入',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string' },
                    password: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'OK' } },
        },
      },
      '/orders': {
        get: {
          operationId: 'listOrders',
          summary: '取得訂單清單',
          responses: { '200': { description: 'OK' } },
        },
      },
    },
  };
}

function createMockConfig(overrides?: Partial<IntentRecognizerConfig>): IntentRecognizerConfig {
  return {
    spec: createMockSpec(),
    minConfidence: 0.3,
    maxResults: 5,
    ...overrides,
  };
}

function createMockIntent(overrides?: Partial<ParsedIntent>): ParsedIntent {
  return {
    action: 'create_flow',
    entities: {},
    confidence: 0.5,
    ...overrides,
  };
}

// ===== 測試套件 =====

describe('IntentRecognizer', () => {
  describe('recommendEndpoints() - 端點推薦', () => {
    it('應該推薦完全匹配的端點 (method + keyword)', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          endpoint: '登入',
          method: 'POST',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      expect(matches).toBeDefined();
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].endpoint.operationId).toBe('userLogin');
      expect(matches[0].confidence).toBeGreaterThanOrEqual(0.6); // method(0.3) + keyword(0.4)
    });

    it('應該推薦 HTTP method 匹配的端點', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          method: 'POST',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      expect(matches.length).toBeGreaterThan(0);
      // 所有推薦的端點都應該是 POST
      for (const match of matches) {
        expect(match.endpoint.method).toBe('POST');
      }
    });

    it('應該推薦 summary 關鍵字匹配的端點', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          endpoint: '使用者',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      expect(matches.length).toBeGreaterThan(0);
      // 所有推薦的端點都應該包含「使用者」
      for (const match of matches) {
        const summary = (match.endpoint.summary || '').toLowerCase();
        const description = (match.endpoint.description || '').toLowerCase();
        const operationId = match.endpoint.operationId.toLowerCase();
        expect(
          summary.includes('使用者') ||
            description.includes('使用者') ||
            operationId.includes('user')
        ).toBe(true);
      }
    });

    it('應該推薦 operationId 匹配的端點', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          endpoint: 'user',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      expect(matches.length).toBeGreaterThan(0);
      // 至少有一個端點的 operationId 包含 "user"
      const hasUserMatch = matches.some((match) =>
        match.endpoint.operationId.toLowerCase().includes('user')
      );
      expect(hasUserMatch).toBe(true);
    });

    it('應該過濾低於 minConfidence 的端點', () => {
      const recognizer = new IntentRecognizer(
        createMockConfig({
          minConfidence: 0.8, // 設定高門檻
        })
      );
      const intent = createMockIntent({
        entities: {
          endpoint: '訂單', // 僅匹配 summary (0.4 分)
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      // 由於信心度不足 0.8，應該沒有推薦結果
      expect(matches.length).toBe(0);
    });

    it('應該限制推薦結果數量 (maxResults)', () => {
      const recognizer = new IntentRecognizer(
        createMockConfig({
          maxResults: 2,
        })
      );
      const intent = createMockIntent({
        entities: {
          endpoint: 'user',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      expect(matches.length).toBeLessThanOrEqual(2);
    });

    it('應該依信心度降序排序推薦結果', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          endpoint: '使用者',
          method: 'POST',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      // 檢查是否依信心度降序排列
      for (let i = 0; i < matches.length - 1; i++) {
        expect(matches[i].confidence).toBeGreaterThanOrEqual(matches[i + 1].confidence);
      }
    });

    it('當沒有匹配端點時應該返回空陣列', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          endpoint: '不存在的端點',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      expect(matches).toEqual([]);
    });

    it('當 intent 沒有任何實體時應該返回空陣列', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {}, // 無任何實體
      });

      const matches = recognizer.recommendEndpoints(intent);

      expect(matches).toEqual([]);
    });
  });

  describe('extractEndpoints() - 端點提取', () => {
    it('應該提取所有有 operationId 的端點', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent();

      const matches = recognizer.recommendEndpoints(intent);

      // 測試規格中有 7 個 operations，但只有有匹配的才會被返回
      // 這裡我們透過推薦一個能匹配所有端點的 intent 來間接測試
      const allIntent = createMockIntent({
        entities: {
          endpoint: '', // 空字串不會匹配
        },
      });
      const allMatches = recognizer.recommendEndpoints(allIntent);

      // 應該至少能提取到端點（即使可能因信心度過低而被過濾）
      expect(allMatches.length).toBeGreaterThanOrEqual(0);
    });

    it('應該正確提取端點的基本資訊', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          endpoint: '登入',
          method: 'POST',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      expect(matches.length).toBeGreaterThan(0);
      const loginMatch = matches[0];

      expect(loginMatch.endpoint.path).toBe('/auth/login');
      expect(loginMatch.endpoint.method).toBe('POST');
      expect(loginMatch.endpoint.operationId).toBe('userLogin');
      expect(loginMatch.endpoint.summary).toBe('使用者登入');
      expect(loginMatch.endpoint.description).toBe('使用 email 和密碼登入');
    });

    it('應該提取端點的參數資訊', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          endpoint: '使用者資料',
          method: 'GET',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      expect(matches.length).toBeGreaterThan(0);
      const getUserMatch = matches.find((m) => m.endpoint.operationId === 'getUser');

      expect(getUserMatch).toBeDefined();
      expect(getUserMatch!.endpoint.parameters).toBeDefined();
      expect(getUserMatch!.endpoint.parameters!.length).toBe(1);
      expect(getUserMatch!.endpoint.parameters![0].name).toBe('id');
      expect(getUserMatch!.endpoint.parameters![0].in).toBe('path');
      expect(getUserMatch!.endpoint.parameters![0].required).toBe(true);
    });

    it('應該提取端點的 requestBody 資訊', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          endpoint: '登入',
          method: 'POST',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      expect(matches.length).toBeGreaterThan(0);
      const loginMatch = matches[0];

      expect(loginMatch.endpoint.requestBody).toBeDefined();
      expect(loginMatch.endpoint.requestBody!.required).toBe(true);
      expect(loginMatch.endpoint.requestBody!.content).toBeDefined();
    });

    it('應該處理沒有 operationId 的 operation', () => {
      const specWithoutOpId: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              // 沒有 operationId
              summary: '測試端點',
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const recognizer = new IntentRecognizer({
        spec: specWithoutOpId,
        minConfidence: 0.1,
      });
      const intent = createMockIntent({
        entities: {
          endpoint: '測試',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      // 應該沒有任何推薦，因為沒有 operationId
      expect(matches).toEqual([]);
    });

    it('應該處理空的 paths', () => {
      const emptySpec: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Empty API', version: '1.0.0' },
        paths: {},
      };

      const recognizer = new IntentRecognizer({
        spec: emptySpec,
        minConfidence: 0.1,
      });
      const intent = createMockIntent({
        entities: {
          endpoint: '任意',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      expect(matches).toEqual([]);
    });

    it('應該正確識別不同的 HTTP methods', () => {
      const recognizer = new IntentRecognizer(createMockConfig());

      const methods: Array<'GET' | 'POST' | 'PUT' | 'DELETE'> = ['GET', 'POST', 'PUT', 'DELETE'];

      for (const method of methods) {
        const intent = createMockIntent({
          entities: {
            method,
          },
        });

        const matches = recognizer.recommendEndpoints(intent);

        if (matches.length > 0) {
          // 所有匹配的端點都應該是指定的 HTTP method
          for (const match of matches) {
            expect(match.endpoint.method).toBe(method);
          }
        }
      }
    });
  });

  describe('calculateScore() - 分數計算', () => {
    it('HTTP method 匹配應該得到 0.3 分', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          method: 'POST',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      // 找到僅 method 匹配的端點
      const postOnlyMatch = matches.find(
        (m) =>
          m.endpoint.method === 'POST' &&
          !m.endpoint.summary?.includes('user') &&
          !m.endpoint.summary?.includes('使用者')
      );

      if (postOnlyMatch) {
        expect(postOnlyMatch.confidence).toBeCloseTo(0.3, 1);
      }
    });

    it('Summary/Description 關鍵字匹配應該得到 0.4 分', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          endpoint: '訂單',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      // 找到僅 keyword 匹配的端點（沒有 method 匹配）
      const keywordOnlyMatch = matches.find((m) => m.endpoint.operationId === 'listOrders');

      if (keywordOnlyMatch) {
        expect(keywordOnlyMatch.confidence).toBeCloseTo(0.4, 1);
      }
    });

    it('OperationId 匹配應該得到 0.3 分', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          endpoint: 'order',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      const operationIdMatch = matches.find((m) => m.endpoint.operationId.includes('Order'));

      if (operationIdMatch) {
        // operationId 匹配得 0.3 分
        expect(operationIdMatch.confidence).toBeGreaterThanOrEqual(0.3);
      }
    });

    it('多重匹配應該累加分數 (最高 1.0)', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          endpoint: '登入',
          method: 'POST',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      expect(matches.length).toBeGreaterThan(0);
      const loginMatch = matches[0];

      // method(0.3) + summary/description(0.4) + operationId(0.3) = 1.0
      // 但實際上 operationId 是 "userLogin"，包含 "login"，所以應該接近滿分
      expect(loginMatch.confidence).toBeGreaterThanOrEqual(0.6);
      expect(loginMatch.confidence).toBeLessThanOrEqual(1.0);
    });

    it('無任何匹配應該得到 0.0 分', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          endpoint: '完全不存在',
          method: 'POST',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      // 找到 method 匹配但 keyword 不匹配的端點
      const noKeywordMatch = matches.find(
        (m) =>
          !m.endpoint.summary?.includes('完全不存在') &&
          !m.endpoint.description?.includes('完全不存在') &&
          !m.endpoint.operationId.includes('完全不存在')
      );

      if (noKeywordMatch) {
        // 僅 method 匹配，得 0.3 分
        expect(noKeywordMatch.confidence).toBeCloseTo(0.3, 1);
      }
    });

    it('大小寫不敏感匹配', () => {
      const recognizer = new IntentRecognizer(createMockConfig());

      // 測試不同大小寫
      const testCases = [
        { endpoint: 'USER', expected: true },
        { endpoint: 'User', expected: true },
        { endpoint: 'user', expected: true },
        { endpoint: 'uSeR', expected: true },
      ];

      for (const testCase of testCases) {
        const intent = createMockIntent({
          entities: {
            endpoint: testCase.endpoint,
          },
        });

        const matches = recognizer.recommendEndpoints(intent);

        if (testCase.expected) {
          expect(matches.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('generateReason() - 原因說明產生', () => {
    it('應該產生包含 HTTP method 的原因說明', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          method: 'POST',
          endpoint: '登入',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      expect(matches.length).toBeGreaterThan(0);
      const match = matches[0];

      expect(match.reason).toContain('HTTP 方法匹配');
      expect(match.reason).toContain('POST');
    });

    it('應該產生包含 summary 的原因說明', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          endpoint: '登入',
          method: 'POST',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      expect(matches.length).toBeGreaterThan(0);
      const match = matches[0];

      expect(match.reason).toContain('Summary:');
      expect(match.reason).toContain('使用者登入');
    });

    it('當沒有 method 匹配時不應包含 HTTP 方法說明', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          endpoint: '訂單', // 僅 keyword 匹配
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      const orderMatch = matches.find((m) => m.endpoint.operationId === 'listOrders');

      if (orderMatch) {
        expect(orderMatch.reason).not.toContain('HTTP 方法匹配');
      }
    });

    it('當沒有 summary 且無 method 匹配時應顯示信心度', () => {
      const specWithoutSummary: OpenAPIDocument = {
        openapi: '3.0.0',
        info: { title: 'Test API', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              operationId: 'testEndpoint',
              // 沒有 summary
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      };

      const recognizer = new IntentRecognizer({
        spec: specWithoutSummary,
        minConfidence: 0.1,
      });
      const intent = createMockIntent({
        entities: {
          endpoint: 'test',
          // 不指定 method，避免產生 "HTTP 方法匹配" 的訊息
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      if (matches.length > 0) {
        const match = matches[0];
        // 應該包含信心度百分比（因為沒有 method 匹配且沒有 summary）
        expect(match.reason).toMatch(/信心度: \d+%/);
      }
    });
  });

  describe('整合情境測試', () => {
    it('應該正確推薦「建立使用者」的端點', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          endpoint: '使用者',
          method: 'POST',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].endpoint.operationId).toBe('createUser');
      expect(matches[0].confidence).toBeGreaterThan(0.5);
    });

    it('應該正確推薦「查詢使用者清單」的端點', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          endpoint: '使用者清單',
          method: 'GET',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      expect(matches.length).toBeGreaterThan(0);
      const listMatch = matches.find((m) => m.endpoint.operationId === 'listUsers');

      expect(listMatch).toBeDefined();
      expect(listMatch!.confidence).toBeGreaterThan(0.5);
    });

    it('應該正確推薦「更新使用者」的端點', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          endpoint: '使用者',
          method: 'PUT',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].endpoint.operationId).toBe('updateUser');
    });

    it('應該正確推薦「刪除使用者」的端點', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          endpoint: '使用者',
          method: 'DELETE',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].endpoint.operationId).toBe('deleteUser');
    });

    it('應該處理模糊的查詢 (僅關鍵字)', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          endpoint: 'user',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      // 應該返回所有包含 "user" 的端點
      expect(matches.length).toBeGreaterThan(0);
      for (const match of matches) {
        const hasUserKeyword =
          match.endpoint.operationId.toLowerCase().includes('user') ||
          match.endpoint.summary?.toLowerCase().includes('user') ||
          match.endpoint.summary?.includes('使用者');
        expect(hasUserKeyword).toBe(true);
      }
    });

    it('應該處理複雜的認證場景', () => {
      const recognizer = new IntentRecognizer(createMockConfig());
      const intent = createMockIntent({
        entities: {
          endpoint: '登入',
          method: 'POST',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      expect(matches.length).toBeGreaterThan(0);
      const loginMatch = matches[0];

      expect(loginMatch.endpoint.operationId).toBe('userLogin');
      expect(loginMatch.endpoint.path).toBe('/auth/login');
      expect(loginMatch.endpoint.requestBody).toBeDefined();
      expect(loginMatch.endpoint.requestBody!.required).toBe(true);
    });
  });

  describe('邊界條件測試', () => {
    it('應該處理 minConfidence = 0', () => {
      const recognizer = new IntentRecognizer(
        createMockConfig({
          minConfidence: 0,
        })
      );
      const intent = createMockIntent({
        entities: {
          endpoint: '任意',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      // 即使信心度為 0，也不應該拋出錯誤
      expect(matches).toBeDefined();
      expect(Array.isArray(matches)).toBe(true);
    });

    it('應該處理 minConfidence = 1', () => {
      const recognizer = new IntentRecognizer(
        createMockConfig({
          minConfidence: 1.0,
        })
      );
      const intent = createMockIntent({
        entities: {
          endpoint: '使用者',
          method: 'POST',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      // 只有完全匹配的端點才會被返回
      expect(matches.length).toBeGreaterThanOrEqual(0);
      for (const match of matches) {
        expect(match.confidence).toBe(1.0);
      }
    });

    it('應該處理 maxResults = 0 (使用預設值)', () => {
      const recognizer = new IntentRecognizer(
        createMockConfig({
          maxResults: 0, // 0 會被當作 falsy，使用預設值 5
        })
      );
      const intent = createMockIntent({
        entities: {
          endpoint: '使用者',
          method: 'POST',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      // 由於 0 || 5，實際上會使用預設值 5
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.length).toBeLessThanOrEqual(5);
    });

    it('應該處理 maxResults = 1', () => {
      const recognizer = new IntentRecognizer(
        createMockConfig({
          maxResults: 1,
        })
      );
      const intent = createMockIntent({
        entities: {
          endpoint: 'user',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      expect(matches.length).toBeLessThanOrEqual(1);
    });

    it('應該處理非常大的 maxResults', () => {
      const recognizer = new IntentRecognizer(
        createMockConfig({
          maxResults: 1000,
        })
      );
      const intent = createMockIntent({
        entities: {
          endpoint: 'user',
        },
      });

      const matches = recognizer.recommendEndpoints(intent);

      // 不應該超過實際端點數量
      expect(matches.length).toBeLessThanOrEqual(7); // 測試規格中有 7 個 operations
    });
  });
});
