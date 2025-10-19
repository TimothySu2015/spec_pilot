/**
 * Flow Generator 端對端測試
 * 測試完整的對話式 Flow 產生流程
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NLPFlowParser } from '../src/nlp-parser.js';
import { IntentRecognizer } from '../src/intent-recognizer.js';
import { ContextManager } from '../src/context-manager.js';
import { FlowBuilder } from '../src/flow-builder.js';

// ===== 測試用 OpenAPI Spec =====

const testSpec = {
  openapi: '3.0.0',
  info: { title: 'User API', version: '1.0.0' },
  paths: {
    '/users': {
      get: {
        summary: '取得使用者列表',
        operationId: 'listUsers',
        responses: { '200': { description: '成功' } }
      },
      post: {
        summary: '建立使用者',
        operationId: 'createUser',
        responses: { '201': { description: '建立成功' } }
      }
    },
    '/users/{id}': {
      get: {
        summary: '取得單一使用者',
        operationId: 'getUser',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: '成功' } }
      },
      put: {
        summary: '更新使用者',
        operationId: 'updateUser',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: '更新成功' } }
      },
      delete: {
        summary: '刪除使用者',
        operationId: 'deleteUser',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '204': { description: '刪除成功' } }
      }
    },
    '/auth/login': {
      post: {
        summary: '使用者登入',
        operationId: 'login',
        responses: { '200': { description: '登入成功' } }
      }
    }
  }
};

// ===== 端對端測試套件 =====

describe('Flow Generator - 端對端測試', () => {
  let parser: NLPFlowParser;
  let recognizer: IntentRecognizer;
  let contextManager: ContextManager;
  let flowBuilder: FlowBuilder;

  beforeEach(() => {
    parser = new NLPFlowParser({ spec: testSpec });
    recognizer = new IntentRecognizer({ spec: testSpec });
    contextManager = ContextManager.getInstance();
    flowBuilder = new FlowBuilder();
  });

  describe('場景 1：完整的單步驟 Flow 產生', () => {
    it('應該從自然語言產生登入測試 Flow', async () => {
      // Step 1: 解析用戶輸入
      const userInput = '建立使用者登入測試';
      const intent = await parser.parse(userInput);

      expect(intent.action).toBe('create_flow');
      expect(intent.confidence).toBeGreaterThan(0.5);

      // Step 2: 推薦端點
      const matches = recognizer.recommendEndpoints(intent);

      expect(matches).toBeDefined();
      expect(matches.length).toBeGreaterThan(0);

      // 查找登入端點
      const loginMatch = matches.find(m => m.endpoint.path === '/auth/login');
      expect(loginMatch).toBeDefined();
      expect(loginMatch!.endpoint.method).toBe('POST');

      // Step 3: 建構 Flow
      const selectedEndpoint = loginMatch!.endpoint;
      const flow = flowBuilder
        .setName('使用者登入測試')
        .setDescription('測試使用者登入功能')
        .addStep({
          name: '登入',
          method: selectedEndpoint.method,
          path: selectedEndpoint.path,
          expectedStatusCode: 200,
          extractVariables: {
            token: 'token',
            userId: 'user.id'
          }
        })
        .build();

      // 驗證產生的 Flow
      expect(flow.name).toBe('使用者登入測試');
      expect(flow.steps).toHaveLength(1);
      expect(flow.steps[0].request.method).toBe('POST');
      expect(flow.steps[0].request.path).toBe('/auth/login');
      expect(flow.steps[0].capture).toHaveLength(2);
    });

    it('應該從自然語言產生建立使用者 Flow', async () => {
      // Step 1: 解析建立使用者請求
      const createIntent = await parser.parse('建立新使用者');
      expect(createIntent.action).toBe('create_flow');

      // Step 2: 推薦建立端點
      const createMatches = recognizer.recommendEndpoints(createIntent);
      const createEndpoint = createMatches.find(m =>
        m.endpoint.path === '/users' && m.endpoint.method === 'POST'
      );

      expect(createEndpoint).toBeDefined();

      // Step 3: 建構 Flow
      flowBuilder
        .setName('使用者 CRUD 測試')
        .addStep({
          name: '建立使用者',
          method: createEndpoint!.endpoint.method,
          path: createEndpoint!.endpoint.path,
          expectedStatusCode: 201,
          extractVariables: {
            userId: 'id'
          }
        });

      const flow = flowBuilder.build();

      expect(flow.name).toBe('使用者 CRUD 測試');
      expect(flow.steps).toHaveLength(1);
      expect(flow.steps[0].capture?.[0].variableName).toBe('userId');
    });
  });

  describe('場景 2：多步驟 Flow 建立', () => {
    it('應該建立完整的 CRUD Flow', async () => {
      // 解析建立意圖
      const createIntent = await parser.parse('建立使用者 CRUD 測試');
      const createMatches = recognizer.recommendEndpoints(createIntent);

      const createEndpoint = createMatches.find(m =>
        m.endpoint.method === 'POST' && m.endpoint.path === '/users'
      );

      // 建立 FlowBuilder 並新增步驟
      flowBuilder.setName('使用者 CRUD 測試');

      // 步驟 1: 建立使用者
      flowBuilder.addStep({
        name: '建立使用者',
        method: createEndpoint!.endpoint.method,
        path: createEndpoint!.endpoint.path,
        expectedStatusCode: 201,
        extractVariables: { userId: 'id' }
      });

      // 解析取得意圖
      const getIntent = await parser.parse('取得使用者');
      const getMatches = recognizer.recommendEndpoints(getIntent);
      const getEndpoint = getMatches.find(m =>
        m.endpoint.method === 'GET' && m.endpoint.path.includes('{id}')
      );

      // 步驟 2: 取得使用者
      flowBuilder.addStep({
        name: '取得使用者',
        method: getEndpoint!.endpoint.method,
        path: getEndpoint!.endpoint.path.replace('{id}', '{{userId}}'),
        expectedStatusCode: 200
      });

      // 解析刪除意圖
      const deleteIntent = await parser.parse('刪除使用者');
      const deleteMatches = recognizer.recommendEndpoints(deleteIntent);
      const deleteEndpoint = deleteMatches.find(m =>
        m.endpoint.method === 'DELETE'
      );

      // 步驟 3: 刪除使用者
      flowBuilder.addStep({
        name: '刪除使用者',
        method: deleteEndpoint!.endpoint.method,
        path: deleteEndpoint!.endpoint.path.replace('{id}', '{{userId}}'),
        expectedStatusCode: 204
      });

      const finalFlow = flowBuilder.build();

      // 驗證完整流程
      expect(finalFlow.steps).toHaveLength(3);
      expect(finalFlow.steps[0].request.method).toBe('POST');
      expect(finalFlow.steps[1].request.method).toBe('GET');
      expect(finalFlow.steps[2].request.method).toBe('DELETE');

      // 驗證變數提取和使用
      expect(finalFlow.steps[0].capture).toHaveLength(1);
      expect(finalFlow.steps[1].request.path).toContain('{{userId}}');
      expect(finalFlow.steps[2].request.path).toContain('{{userId}}');
    });
  });

  describe('場景 3：端點推薦準確度', () => {
    it('應該正確推薦端點（基於關鍵字匹配）', async () => {
      const testCases = [
        {
          input: '建立使用者',
          expectedMethod: 'POST',
          expectedPath: '/users',
        },
        {
          input: '取得使用者列表',
          expectedMethod: 'GET',
          expectedPath: '/users',
        },
        {
          input: '更新使用者資料',
          expectedMethod: 'PUT',
          expectedPath: '/users/{id}',
        },
        {
          input: '刪除使用者',
          expectedMethod: 'DELETE',
          expectedPath: '/users/{id}',
        },
        {
          input: '使用者登入',
          expectedMethod: 'POST',
          expectedPath: '/auth/login',
        }
      ];

      for (const testCase of testCases) {
        const intent = await parser.parse(testCase.input);
        const matches = recognizer.recommendEndpoints(intent);

        expect(matches.length).toBeGreaterThan(0);

        const topMatch = matches[0];
        expect(topMatch.endpoint.method).toBe(testCase.expectedMethod);
        expect(topMatch.endpoint.path).toBe(testCase.expectedPath);
        expect(topMatch.confidence).toBeGreaterThanOrEqual(0.3);
      }
    });

    it('應該根據信心度排序推薦結果', async () => {
      const intent = await parser.parse('取得使用者');
      const matches = recognizer.recommendEndpoints(intent);

      // 驗證結果按信心度降序排列
      for (let i = 0; i < matches.length - 1; i++) {
        expect(matches[i].confidence).toBeGreaterThanOrEqual(matches[i + 1].confidence);
      }

      // 最高信心度的結果應該是 GET 相關端點
      expect(matches[0].endpoint.method).toBe('GET');
    });
  });

  describe('場景 4：上下文管理', () => {
    it('應該正確建立和取得上下文', () => {
      // 建立上下文
      const contextId = contextManager.createContext();

      expect(contextId).toBeDefined();
      expect(typeof contextId).toBe('string');

      // 取得上下文
      const context = contextManager.getContext(contextId);

      expect(context).toBeDefined();
      expect(context?.contextId).toBe(contextId);
      expect(context?.currentFlow).toBeDefined();
      expect(context?.conversationHistory).toEqual([]);
    });

    it('應該能新增對話記錄到上下文', async () => {
      const contextId = contextManager.createContext();
      const intent = await parser.parse('建立使用者測試');

      // 新增對話記錄
      contextManager.addConversationTurn(contextId, {
        role: 'user',
        content: '建立使用者測試',
        timestamp: new Date().toISOString(),
        parsedIntent: intent
      });

      const context = contextManager.getContext(contextId);
      expect(context?.conversationHistory).toHaveLength(1);
      expect(context?.conversationHistory[0].content).toBe('建立使用者測試');
      expect(context?.conversationHistory[0].parsedIntent).toBe(intent);
    });

    it('應該能更新上下文中的 Flow', () => {
      const contextId = contextManager.createContext();

      const flow = flowBuilder
        .setName('測試流程')
        .addStep({
          name: '測試步驟',
          method: 'GET',
          path: '/test',
          expectedStatusCode: 200
        })
        .build();

      // 更新上下文
      const context = contextManager.getContext(contextId);
      if (context) {
        context.currentFlow = flow;
      }

      const updatedContext = contextManager.getContext(contextId);
      expect(updatedContext?.currentFlow.name).toBe('測試流程');
      expect(updatedContext?.currentFlow.steps).toHaveLength(1);
    });

    it('應該能取得當前 Flow 狀態', () => {
      const contextId = contextManager.createContext();

      const flow = flowBuilder
        .setName('測試流程')
        .addStep({
          name: '測試步驟',
          method: 'GET',
          path: '/test',
          expectedStatusCode: 200
        })
        .build();

      // 更新上下文
      contextManager.updateContext(contextId, { currentFlow: flow });

      // 取得當前 Flow
      const currentFlow = contextManager.getCurrentFlow(contextId);
      expect(currentFlow?.name).toBe('測試流程');
      expect(currentFlow?.steps).toHaveLength(1);
    });
  });

  describe('場景 5：完整工作流整合', () => {
    it('應該產生包含登入+CRUD 的完整測試流程', async () => {
      // 建立完整的測試流程：登入 -> 建立 -> 讀取 -> 更新 -> 刪除
      flowBuilder.setName('完整使用者管理測試');

      // 步驟 1: 登入
      const loginIntent = await parser.parse('先登入取得 token');
      const loginMatches = recognizer.recommendEndpoints(loginIntent);
      const loginEndpoint = loginMatches.find(m => m.endpoint.path === '/auth/login');

      if (loginEndpoint) {
        flowBuilder.addStep({
          name: '登入',
          method: loginEndpoint.endpoint.method,
          path: loginEndpoint.endpoint.path,
          expectedStatusCode: 200,
          extractVariables: { authToken: 'token' }
        });
      }

      // 步驟 2-5: CRUD 操作
      const crudOperations = [
        { name: '建立使用者', method: 'POST', path: '/users', status: 201, extractVars: { newUserId: 'id' } },
        { name: '取得建立的使用者', method: 'GET', path: '/users/{{newUserId}}', status: 200 },
        { name: '更新使用者', method: 'PUT', path: '/users/{{newUserId}}', status: 200 },
        { name: '刪除使用者', method: 'DELETE', path: '/users/{{newUserId}}', status: 204 }
      ];

      crudOperations.forEach(op => {
        flowBuilder.addStep({
          name: op.name,
          method: op.method,
          path: op.path,
          expectedStatusCode: op.status,
          ...(op.extractVars && { extractVariables: op.extractVars })
        });
      });

      const fullFlow = flowBuilder.build();

      // 驗證完整流程
      expect(fullFlow.name).toBe('完整使用者管理測試');
      expect(fullFlow.steps).toHaveLength(5);

      // 驗證步驟順序
      expect(fullFlow.steps[0].name).toBe('登入');
      expect(fullFlow.steps[1].name).toBe('建立使用者');
      expect(fullFlow.steps[2].name).toBe('取得建立的使用者');
      expect(fullFlow.steps[3].name).toBe('更新使用者');
      expect(fullFlow.steps[4].name).toBe('刪除使用者');

      // 驗證 HTTP 方法
      expect(fullFlow.steps.map(s => s.request.method)).toEqual([
        'POST', 'POST', 'GET', 'PUT', 'DELETE'
      ]);

      // 驗證變數替換
      expect(fullFlow.steps[2].request.path).toContain('{{newUserId}}');
      expect(fullFlow.steps[3].request.path).toContain('{{newUserId}}');
      expect(fullFlow.steps[4].request.path).toContain('{{newUserId}}');
    });
  });
});
