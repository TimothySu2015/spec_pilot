/**
 * SuggestionEngine 單元測試
 * 測試智能建議引擎功能
 */

import { describe, it, expect } from 'vitest';
import { SuggestionEngine } from '../src/suggestion-engine.js';
import type { EndpointInfo } from '../src/types.js';
import type { FlowStep } from '@specpilot/flow-parser';

// ===== 輔助函數 =====

function createMockEndpoint(overrides?: Partial<EndpointInfo>): EndpointInfo {
  return {
    path: '/users',
    method: 'GET',
    operationId: 'getUsers',
    summary: '取得使用者清單',
    ...overrides,
  };
}

function createMockStep(overrides?: Partial<FlowStep>): Partial<FlowStep> {
  return {
    name: '測試步驟',
    request: {
      method: 'GET',
      path: '/users',
    },
    ...overrides,
  };
}

// ===== 測試套件 =====

describe('SuggestionEngine', () => {
  describe('getSuggestions() - 取得智能建議', () => {
    it('應該推薦缺少的 requestBody 必填欄位', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({
        method: 'POST',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
      });

      const currentStep = createMockStep({
        request: {
          method: 'POST',
          path: '/auth/login',
          body: {}, // 空的 body，缺少必填欄位
        },
      });

      const suggestions = engine.getSuggestions(currentStep, endpoint);

      const missingSuggestion = suggestions.find((s) => s.type === 'missing_required');
      expect(missingSuggestion).toBeDefined();
      expect(missingSuggestion!.message).toContain('email');
      expect(missingSuggestion!.message).toContain('password');
      expect(missingSuggestion!.data).toEqual({ fields: ['email', 'password'] });
    });

    it('應該推薦缺少的路徑參數', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({
        path: '/users/{id}',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
      });

      const currentStep = createMockStep({
        request: {
          method: 'GET',
          path: '/users/{id}',
          params: {}, // 空的 params，缺少 id
        },
      });

      const suggestions = engine.getSuggestions(currentStep, endpoint);

      const missingSuggestion = suggestions.find((s) => s.type === 'missing_required');
      expect(missingSuggestion).toBeDefined();
      expect(missingSuggestion!.message).toContain('id');
      expect(missingSuggestion!.data).toEqual({ fields: ['id'] });
    });

    it('應該推薦認證需求', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({
        security: [{ bearerAuth: [] }],
      });

      const currentStep = createMockStep();
      const suggestions = engine.getSuggestions(currentStep, endpoint);

      const authSuggestion = suggestions.find((s) => s.type === 'auth_required');
      expect(authSuggestion).toBeDefined();
      expect(authSuggestion!.message).toContain('認證');
      expect(authSuggestion!.action).toBe('check_auth');
    });

    it('應該推薦驗證條件（狀態碼）', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({
        method: 'GET',
      });

      const currentStep = createMockStep();
      const suggestions = engine.getSuggestions(currentStep, endpoint);

      const validationSuggestion = suggestions.find((s) => s.type === 'validation_suggestion');
      expect(validationSuggestion).toBeDefined();
      expect(validationSuggestion!.message).toContain('驗證');
      expect(validationSuggestion!.action).toBe('add_validation');
      expect(validationSuggestion!.data).toEqual({
        field: 'status',
        rule: 'equals',
        value: 200, // GET 預期 200
      });
    });

    it('當沒有缺少欄位時不應推薦 missing_required', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({
        method: 'POST',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string' },
                },
              },
            },
          },
        },
      });

      const currentStep = createMockStep({
        request: {
          method: 'POST',
          path: '/auth/login',
          body: { email: 'test@example.com' }, // 已提供必填欄位
        },
      });

      const suggestions = engine.getSuggestions(currentStep, endpoint);

      const missingSuggestion = suggestions.find((s) => s.type === 'missing_required');
      expect(missingSuggestion).toBeUndefined();
    });

    it('當端點不需要認證時不應推薦 auth_required', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({
        // 沒有 security
      });

      const currentStep = createMockStep();
      const suggestions = engine.getSuggestions(currentStep, endpoint);

      const authSuggestion = suggestions.find((s) => s.type === 'auth_required');
      expect(authSuggestion).toBeUndefined();
    });

    it('應該返回多個建議', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({
        method: 'POST',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string' },
                },
              },
            },
          },
        },
      });

      const currentStep = createMockStep({
        request: {
          method: 'POST',
          path: '/auth/login',
          body: {}, // 缺少 email
        },
      });

      const suggestions = engine.getSuggestions(currentStep, endpoint);

      // 應該有 3 個建議：missing_required, auth_required, validation_suggestion
      expect(suggestions).toHaveLength(3);
      expect(suggestions.some((s) => s.type === 'missing_required')).toBe(true);
      expect(suggestions.some((s) => s.type === 'auth_required')).toBe(true);
      expect(suggestions.some((s) => s.type === 'validation_suggestion')).toBe(true);
    });
  });

  describe('findMissingRequiredFields() - 尋找缺少的必填欄位', () => {
    it('應該檢查 requestBody 必填欄位', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({
        method: 'POST',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password', 'email'],
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string' },
                  email: { type: 'string' },
                },
              },
            },
          },
        },
      });

      const currentStep = createMockStep({
        request: {
          method: 'POST',
          path: '/users',
          body: {
            username: 'test', // 僅提供 username
          },
        },
      });

      const suggestions = engine.getSuggestions(currentStep, endpoint);
      const missingSuggestion = suggestions.find((s) => s.type === 'missing_required');

      expect(missingSuggestion).toBeDefined();
      expect(missingSuggestion!.data).toEqual({ fields: ['password', 'email'] });
    });

    it('應該檢查路徑參數', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({
        path: '/users/{id}/posts/{postId}',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'postId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
      });

      const currentStep = createMockStep({
        request: {
          method: 'GET',
          path: '/users/{id}/posts/{postId}',
          params: {
            id: '123', // 僅提供 id
          },
        },
      });

      const suggestions = engine.getSuggestions(currentStep, endpoint);
      const missingSuggestion = suggestions.find((s) => s.type === 'missing_required');

      expect(missingSuggestion).toBeDefined();
      expect(missingSuggestion!.data).toEqual({ fields: ['postId'] });
    });

    it('應該忽略非必填的參數', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'optional',
            in: 'query',
            required: false,
            schema: { type: 'string' },
          },
        ],
      });

      const currentStep = createMockStep({
        request: {
          method: 'GET',
          path: '/users/{id}',
          params: {
            id: '123',
            // 沒有提供 optional，但不應該被建議
          },
        },
      });

      const suggestions = engine.getSuggestions(currentStep, endpoint);
      const missingSuggestion = suggestions.find((s) => s.type === 'missing_required');

      expect(missingSuggestion).toBeUndefined();
    });

    it('應該處理 requestBody 不是必填的情況', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({
        method: 'POST',
        requestBody: {
          required: false, // 非必填
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string' },
                },
              },
            },
          },
        },
      });

      const currentStep = createMockStep({
        request: {
          method: 'POST',
          path: '/users',
          body: {}, // 空 body
        },
      });

      const suggestions = engine.getSuggestions(currentStep, endpoint);
      const missingSuggestion = suggestions.find((s) => s.type === 'missing_required');

      // requestBody 不是必填，所以不應該建議
      expect(missingSuggestion).toBeUndefined();
    });

    it('應該處理沒有 requestBody 的情況', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({
        method: 'GET',
        // 沒有 requestBody
      });

      const currentStep = createMockStep();
      const suggestions = engine.getSuggestions(currentStep, endpoint);
      const missingSuggestion = suggestions.find((s) => s.type === 'missing_required');

      expect(missingSuggestion).toBeUndefined();
    });

    it('應該處理沒有參數的情況', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({
        // 沒有 parameters
      });

      const currentStep = createMockStep();
      const suggestions = engine.getSuggestions(currentStep, endpoint);
      const missingSuggestion = suggestions.find((s) => s.type === 'missing_required');

      expect(missingSuggestion).toBeUndefined();
    });
  });

  describe('getExpectedStatusCode() - 取得預期狀態碼', () => {
    const testCases: Array<{ method: string; expectedStatus: number }> = [
      { method: 'GET', expectedStatus: 200 },
      { method: 'POST', expectedStatus: 201 },
      { method: 'PUT', expectedStatus: 200 },
      { method: 'PATCH', expectedStatus: 200 },
      { method: 'DELETE', expectedStatus: 204 },
      { method: 'HEAD', expectedStatus: 200 }, // 預設值
      { method: 'OPTIONS', expectedStatus: 200 }, // 預設值
    ];

    testCases.forEach(({ method, expectedStatus }) => {
      it(`${method} 應該返回 ${expectedStatus}`, () => {
        const engine = new SuggestionEngine();
        const endpoint = createMockEndpoint({ method });
        const currentStep = createMockStep();

        const suggestions = engine.getSuggestions(currentStep, endpoint);
        const validationSuggestion = suggestions.find((s) => s.type === 'validation_suggestion');

        expect(validationSuggestion).toBeDefined();
        expect(validationSuggestion!.data).toEqual({
          field: 'status',
          rule: 'equals',
          value: expectedStatus,
        });
      });
    });

    it('應該處理小寫的 HTTP method', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({ method: 'post' });
      const currentStep = createMockStep();

      const suggestions = engine.getSuggestions(currentStep, endpoint);
      const validationSuggestion = suggestions.find((s) => s.type === 'validation_suggestion');

      expect(validationSuggestion!.data).toEqual({
        field: 'status',
        rule: 'equals',
        value: 201, // POST -> 201
      });
    });
  });

  describe('getAvailableVariables() - 推薦可用變數', () => {
    it('應該從步驟中提取變數', () => {
      const engine = new SuggestionEngine();
      const steps: FlowStep[] = [
        {
          name: '登入',
          request: { method: 'POST', path: '/auth/login' },
          extract: {
            token: 'data.token',
            userId: 'data.user.id',
          },
        } as FlowStep,
      ];

      const variables = engine.getAvailableVariables(steps);

      expect(variables).toEqual(['token', 'userId']);
    });

    it('應該從多個步驟中提取變數', () => {
      const engine = new SuggestionEngine();
      const steps: FlowStep[] = [
        {
          name: '登入',
          request: { method: 'POST', path: '/auth/login' },
          extract: {
            token: 'data.token',
          },
        } as FlowStep,
        {
          name: '取得使用者',
          request: { method: 'GET', path: '/users/me' },
          extract: {
            userId: 'data.id',
            email: 'data.email',
          },
        } as FlowStep,
        {
          name: '建立訂單',
          request: { method: 'POST', path: '/orders' },
          extract: {
            orderId: 'data.orderId',
          },
        } as FlowStep,
      ];

      const variables = engine.getAvailableVariables(steps);

      expect(variables).toEqual(['token', 'userId', 'email', 'orderId']);
    });

    it('應該處理沒有變數的步驟', () => {
      const engine = new SuggestionEngine();
      const steps: FlowStep[] = [
        {
          name: '取得清單',
          request: { method: 'GET', path: '/users' },
          // 沒有 extract
        } as FlowStep,
      ];

      const variables = engine.getAvailableVariables(steps);

      expect(variables).toEqual([]);
    });

    it('應該處理空的步驟陣列', () => {
      const engine = new SuggestionEngine();
      const steps: FlowStep[] = [];

      const variables = engine.getAvailableVariables(steps);

      expect(variables).toEqual([]);
    });

    it('應該處理混合的步驟（有些有變數，有些沒有）', () => {
      const engine = new SuggestionEngine();
      const steps: FlowStep[] = [
        {
          name: '登入',
          request: { method: 'POST', path: '/auth/login' },
          extract: {
            token: 'data.token',
          },
        } as FlowStep,
        {
          name: '取得清單',
          request: { method: 'GET', path: '/users' },
          // 沒有 extract
        } as FlowStep,
        {
          name: '取得使用者',
          request: { method: 'GET', path: '/users/me' },
          extract: {
            userId: 'data.id',
          },
        } as FlowStep,
      ];

      const variables = engine.getAvailableVariables(steps);

      expect(variables).toEqual(['token', 'userId']);
    });
  });

  describe('整合情境測試', () => {
    it('應該為登入端點提供完整建議', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({
        path: '/auth/login',
        method: 'POST',
        security: [], // 登入端點通常不需要認證
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
      });

      const currentStep = createMockStep({
        request: {
          method: 'POST',
          path: '/auth/login',
          body: {
            email: 'test@example.com',
            // 缺少 password
          },
        },
      });

      const suggestions = engine.getSuggestions(currentStep, endpoint);

      // 應該有 missing_required 和 validation_suggestion
      expect(suggestions.some((s) => s.type === 'missing_required')).toBe(true);
      expect(suggestions.some((s) => s.type === 'validation_suggestion')).toBe(true);
      // 不應該有 auth_required（空陣列不算需要認證）
      expect(suggestions.some((s) => s.type === 'auth_required')).toBe(false);
    });

    it('應該為受保護的端點提供認證建議', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({
        path: '/users/me',
        method: 'GET',
        security: [{ bearerAuth: [] }],
      });

      const currentStep = createMockStep();
      const suggestions = engine.getSuggestions(currentStep, endpoint);

      expect(suggestions.some((s) => s.type === 'auth_required')).toBe(true);
      expect(suggestions.some((s) => s.type === 'validation_suggestion')).toBe(true);
    });

    it('應該為建立資源端點提供完整建議', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({
        path: '/users',
        method: 'POST',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'email'],
                properties: {
                  username: { type: 'string' },
                  email: { type: 'string' },
                },
              },
            },
          },
        },
      });

      const currentStep = createMockStep({
        request: {
          method: 'POST',
          path: '/users',
          body: {},
        },
      });

      const suggestions = engine.getSuggestions(currentStep, endpoint);

      // 應該有 3 個建議
      expect(suggestions).toHaveLength(3);
      expect(suggestions.some((s) => s.type === 'missing_required')).toBe(true);
      expect(suggestions.some((s) => s.type === 'auth_required')).toBe(true);
      expect(suggestions.some((s) => s.type === 'validation_suggestion')).toBe(true);

      // 驗證 missing_required 的內容
      const missingSuggestion = suggestions.find((s) => s.type === 'missing_required');
      expect(missingSuggestion!.data).toEqual({ fields: ['username', 'email'] });

      // 驗證 validation_suggestion 的狀態碼
      const validationSuggestion = suggestions.find((s) => s.type === 'validation_suggestion');
      expect(validationSuggestion!.data).toEqual({
        field: 'status',
        rule: 'equals',
        value: 201, // POST -> 201
      });
    });
  });

  describe('邊界條件測試', () => {
    it('應該處理 requestBody.content 為空', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({
        method: 'POST',
        requestBody: {
          required: true,
          content: {}, // 空 content
        },
      });

      const currentStep = createMockStep();
      const suggestions = engine.getSuggestions(currentStep, endpoint);

      // 不應該拋出錯誤
      expect(suggestions).toBeDefined();
      const missingSuggestion = suggestions.find((s) => s.type === 'missing_required');
      expect(missingSuggestion).toBeUndefined();
    });

    it('應該處理 requestBody.content 沒有 application/json', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({
        method: 'POST',
        requestBody: {
          required: true,
          content: {
            'text/plain': { schema: { type: 'string' } },
          },
        },
      });

      const currentStep = createMockStep();
      const suggestions = engine.getSuggestions(currentStep, endpoint);

      // 不應該拋出錯誤
      expect(suggestions).toBeDefined();
    });

    it('應該處理 schema 不是 object', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({
        method: 'POST',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: 'invalid-schema' as any, // 非 object
            },
          },
        },
      });

      const currentStep = createMockStep();
      const suggestions = engine.getSuggestions(currentStep, endpoint);

      // 不應該拋出錯誤
      expect(suggestions).toBeDefined();
    });

    it('應該處理 currentStep.request 為空', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint();
      const currentStep = {
        name: '測試',
        // 沒有 request
      } as Partial<FlowStep>;

      const suggestions = engine.getSuggestions(currentStep, endpoint);

      // 不應該拋出錯誤
      expect(suggestions).toBeDefined();
    });

    it('應該處理空的 security 陣列', () => {
      const engine = new SuggestionEngine();
      const endpoint = createMockEndpoint({
        security: [], // 空陣列
      });

      const currentStep = createMockStep();
      const suggestions = engine.getSuggestions(currentStep, endpoint);

      // 空陣列不應該觸發 auth_required
      const authSuggestion = suggestions.find((s) => s.type === 'auth_required');
      expect(authSuggestion).toBeUndefined();
    });
  });
});
