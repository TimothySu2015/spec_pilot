/**
 * DependencyResolver 單元測試
 * 測試依賴解析器的各種功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyResolver } from '../src/dependency-resolver.js';
import type { EndpointInfo } from '../src/types.js';

describe('DependencyResolver', () => {
  let resolver: DependencyResolver;

  beforeEach(() => {
    resolver = new DependencyResolver();
  });

  describe('構造函數', () => {
    it('應該成功建立實例', () => {
      const r = new DependencyResolver();
      expect(r).toBeInstanceOf(DependencyResolver);
    });
  });

  describe('resolveExecutionOrder', () => {
    it('應該產生完整的 CRUD 流程', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser', summary: '建立使用者' }),
        createEndpoint({ method: 'GET', path: '/users/{id}', operationId: 'getUser', summary: '取得使用者' }),
        createEndpoint({ method: 'PUT', path: '/users/{id}', operationId: 'updateUser', summary: '更新使用者' }),
        createEndpoint({ method: 'DELETE', path: '/users/{id}', operationId: 'deleteUser', summary: '刪除使用者' }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      expect(steps).toHaveLength(4);
      expect(steps[0].name).toContain('建立使用者');
      expect(steps[0].request.method).toBe('POST');
      expect(steps[0].capture).toBeDefined();
      expect(steps[0].capture?.[0].variableName).toBe('resourceId');

      expect(steps[1].name).toContain('取得使用者');
      expect(steps[1].request.path).toContain('{{resourceId}}');

      expect(steps[2].name).toContain('更新使用者');
      expect(steps[2].request.path).toContain('{{resourceId}}');

      expect(steps[3].name).toContain('刪除使用者');
      expect(steps[3].request.path).toContain('{{resourceId}}');
    });

    it('應該只產生 POST 步驟（沒有其他操作）', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser' }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      expect(steps).toHaveLength(1);
      expect(steps[0].request.method).toBe('POST');
    });

    it('應該跳過沒有 POST 的資源', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'GET', path: '/users', operationId: 'listUsers' }),
        createEndpoint({ method: 'GET', path: '/users/{id}', operationId: 'getUser' }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      // 沒有 POST 端點，不會產生流程
      expect(steps).toEqual([]);
    });

    it('應該跳過帶路徑參數的 POST 端點', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users/{id}/activate', operationId: 'activateUser' }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      // POST 端點有路徑參數，不視為資源建立端點
      expect(steps).toEqual([]);
    });

    it('空陣列應該返回空陣列', () => {
      const steps = resolver.resolveExecutionOrder([]);
      expect(steps).toEqual([]);
    });

    it('應該處理多個資源類型', () => {
      const endpoints: EndpointInfo[] = [
        // users 資源
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser' }),
        createEndpoint({ method: 'GET', path: '/users/{id}', operationId: 'getUser' }),
        // posts 資源
        createEndpoint({ method: 'POST', path: '/posts', operationId: 'createPost' }),
        createEndpoint({ method: 'DELETE', path: '/posts/{id}', operationId: 'deletePost' }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      // users: POST + GET = 2
      // posts: POST + DELETE = 2
      expect(steps).toHaveLength(4);

      const userSteps = steps.filter((s) => s.request.path.includes('/users'));
      const postSteps = steps.filter((s) => s.request.path.includes('/posts'));

      expect(userSteps).toHaveLength(2);
      expect(postSteps).toHaveLength(2);
    });

    it('應該為登入端點使用 authToken', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/auth/login', operationId: 'login', summary: '使用者登入' }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      expect(steps).toHaveLength(1);
      expect(steps[0].capture?.[0].variableName).toBe('authToken');
      expect(steps[0].capture?.[0].path).toBe('token');
    });

    it('應該產生正確的預期狀態碼', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser' }),
        createEndpoint({ method: 'GET', path: '/users/{id}', operationId: 'getUser' }),
        createEndpoint({ method: 'PUT', path: '/users/{id}', operationId: 'updateUser' }),
        createEndpoint({ method: 'DELETE', path: '/users/{id}', operationId: 'deleteUser' }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      expect(steps[0].expect.statusCode).toBe(201); // POST
      expect(steps[1].expect.statusCode).toBe(200); // GET
      expect(steps[2].expect.statusCode).toBe(200); // PUT
      expect(steps[3].expect.statusCode).toBe(204); // DELETE
    });

    it('應該使用 OpenAPI responses 中的狀態碼', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({
          method: 'POST',
          path: '/users',
          operationId: 'createUser',
          responses: { 200: {}, 201: {}, 400: {} },
        }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      // 應該選擇最小的 2xx 狀態碼（200）
      expect(steps[0].expect.statusCode).toBe(200);
    });

    it('應該避免步驟名稱重複動作詞', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser', summary: '建立使用者' }),
        createEndpoint({ method: 'GET', path: '/users/{id}', operationId: 'getUser', summary: '取得使用者' }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      // summary 已經包含動作詞，不應該重複
      expect(steps[0].name).toBe('建立使用者');
      expect(steps[1].name).toBe('取得使用者');
    });

    it('summary 沒有動作詞時應該加上動作詞', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser', summary: '使用者' }),
        createEndpoint({ method: 'GET', path: '/users/{id}', operationId: 'getUser', summary: '使用者' }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      expect(steps[0].name).toBe('建立使用者');
      expect(steps[1].name).toBe('取得使用者');
    });

    it('沒有 summary 時應該使用 operationId', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser', summary: undefined }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      expect(steps[0].name).toBe('建立createUser');
    });

    it('應該為 PUT 產生 request body', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser' }),
        createEndpoint({
          method: 'PUT',
          path: '/users/{id}',
          operationId: 'updateUser',
          requestSchema: {
            type: 'object',
            properties: { name: { type: 'string' } },
            required: ['name'],
          },
        }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      const putStep = steps.find((s) => s.request.method === 'PUT');
      expect(putStep?.request.body).toBeDefined();
    });

    it('應該為 PATCH 產生 request body', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser' }),
        createEndpoint({
          method: 'PATCH',
          path: '/users/{id}',
          operationId: 'patchUser',
          requestSchema: {
            type: 'object',
            properties: { status: { type: 'string' } },
            required: ['status'],
          },
        }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      const patchStep = steps.find((s) => s.request.method === 'PATCH');
      expect(patchStep?.request.body).toBeDefined();
    });

    it('應該支援 PATCH 方法', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser' }),
        createEndpoint({ method: 'PATCH', path: '/users/{id}', operationId: 'patchUser' }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      expect(steps).toHaveLength(2);
      const patchStep = steps.find((s) => s.request.method === 'PATCH');
      expect(patchStep).toBeDefined();
    });
  });

  describe('analyzeDependencies', () => {
    it('應該正確建立依賴圖', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser' }),
        createEndpoint({ method: 'GET', path: '/users/{id}', operationId: 'getUser' }),
        createEndpoint({ method: 'DELETE', path: '/users/{id}', operationId: 'deleteUser' }),
      ];

      const graph = resolver.analyzeDependencies(endpoints);

      expect(graph.nodes).toHaveLength(3);
      expect(graph.edges).toHaveLength(2); // createUser -> getUser, createUser -> deleteUser

      // 檢查節點
      expect(graph.nodes[0].operationId).toBe('createUser');
      expect(graph.nodes[0].resourceType).toBe('users');

      // 檢查邊
      const edgeToGet = graph.edges.find((e) => e.to === 'getUser');
      expect(edgeToGet).toBeDefined();
      expect(edgeToGet?.from).toBe('createUser');
      expect(edgeToGet?.type).toBe('requires');
      expect(edgeToGet?.variable).toBe('id');
    });

    it('沒有 POST 端點時應該沒有邊', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'GET', path: '/users', operationId: 'listUsers' }),
        createEndpoint({ method: 'GET', path: '/users/{id}', operationId: 'getUser' }),
      ];

      const graph = resolver.analyzeDependencies(endpoints);

      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toEqual([]);
    });

    it('應該正確識別邊的類型', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser' }),
        createEndpoint({ method: 'GET', path: '/users/{id}', operationId: 'getUser' }),
        createEndpoint({ method: 'PUT', path: '/users/{id}', operationId: 'updateUser' }),
        createEndpoint({ method: 'PATCH', path: '/users/{id}', operationId: 'patchUser' }),
        createEndpoint({ method: 'DELETE', path: '/users/{id}', operationId: 'deleteUser' }),
      ];

      const graph = resolver.analyzeDependencies(endpoints);

      const getEdge = graph.edges.find((e) => e.to === 'getUser');
      const putEdge = graph.edges.find((e) => e.to === 'updateUser');
      const patchEdge = graph.edges.find((e) => e.to === 'patchUser');
      const deleteEdge = graph.edges.find((e) => e.to === 'deleteUser');

      expect(getEdge?.type).toBe('requires');
      expect(putEdge?.type).toBe('modifies');
      expect(patchEdge?.type).toBe('modifies');
      expect(deleteEdge?.type).toBe('deletes');
    });

    it('應該正確提取路徑參數', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser' }),
        createEndpoint({ method: 'GET', path: '/users/{userId}', operationId: 'getUser' }),
      ];

      const graph = resolver.analyzeDependencies(endpoints);

      const edge = graph.edges[0];
      expect(edge.variable).toBe('userId');
    });

    it('應該按資源類型分組', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser' }),
        createEndpoint({ method: 'POST', path: '/posts', operationId: 'createPost' }),
        createEndpoint({ method: 'GET', path: '/users/{id}', operationId: 'getUser' }),
      ];

      const graph = resolver.analyzeDependencies(endpoints);

      const userNodes = graph.nodes.filter((n) => n.resourceType === 'users');
      const postNodes = graph.nodes.filter((n) => n.resourceType === 'posts');

      expect(userNodes).toHaveLength(2);
      expect(postNodes).toHaveLength(1);
    });
  });

  describe('資源類型提取', () => {
    it('應該從基本路徑提取資源類型', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser' }),
      ];

      const graph = resolver.analyzeDependencies(endpoints);
      expect(graph.nodes[0].resourceType).toBe('users');
    });

    it('應該從帶路徑參數的路徑提取資源類型', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'GET', path: '/users/{id}', operationId: 'getUser' }),
      ];

      const graph = resolver.analyzeDependencies(endpoints);
      expect(graph.nodes[0].resourceType).toBe('users');
    });

    it('應該從多層路徑提取第一個非參數段', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'GET', path: '/api/v1/users/{id}', operationId: 'getUser' }),
      ];

      const graph = resolver.analyzeDependencies(endpoints);
      expect(graph.nodes[0].resourceType).toBe('api');
    });

    it('應該處理路徑參數在前的情況', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'GET', path: '/{tenant}/users', operationId: 'getUsers' }),
      ];

      const graph = resolver.analyzeDependencies(endpoints);
      expect(graph.nodes[0].resourceType).toBe('users');
    });

    it('應該處理只有路徑參數的路徑', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'GET', path: '/{id}', operationId: 'getResource' }),
      ];

      const graph = resolver.analyzeDependencies(endpoints);
      expect(graph.nodes[0].resourceType).toBe('unknown');
    });

    it('應該處理空路徑', () => {
      const endpoints: EndpointInfo[] = [createEndpoint({ method: 'GET', path: '/', operationId: 'root' })];

      const graph = resolver.analyzeDependencies(endpoints);
      expect(graph.nodes[0].resourceType).toBe('unknown');
    });
  });

  describe('路徑參數提取', () => {
    it('應該提取路徑參數', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser' }),
        createEndpoint({ method: 'GET', path: '/users/{id}', operationId: 'getUser' }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      expect(steps[1].request.path).toBe('/users/{{resourceId}}');
    });

    it('應該提取自訂參數名稱', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser' }),
        createEndpoint({ method: 'GET', path: '/users/{userId}', operationId: 'getUser' }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      // 仍然使用 resourceId（變數名稱固定）
      expect(steps[1].request.path).toBe('/users/{{resourceId}}');
    });

    it('應該處理沒有路徑參數的情況', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser' }),
      ];

      const graph = resolver.analyzeDependencies(endpoints);

      // POST 端點沒有路徑參數，不會建立邊
      expect(graph.edges).toEqual([]);
    });
  });

  describe('整合測試', () => {
    it('應該產生完整的使用者管理流程', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({
          method: 'POST',
          path: '/users',
          operationId: 'createUser',
          summary: '建立使用者',
          requestSchema: {
            type: 'object',
            properties: {
              username: { type: 'string' },
              email: { type: 'string', format: 'email' },
            },
            required: ['username', 'email'],
          },
          responses: { 201: {} },
        }),
        createEndpoint({
          method: 'GET',
          path: '/users/{id}',
          operationId: 'getUser',
          summary: '取得使用者',
          responses: { 200: {} },
        }),
        createEndpoint({
          method: 'PUT',
          path: '/users/{id}',
          operationId: 'updateUser',
          summary: '更新使用者',
          requestSchema: {
            type: 'object',
            properties: {
              username: { type: 'string' },
            },
            required: ['username'],
          },
          responses: { 200: {} },
        }),
        createEndpoint({
          method: 'DELETE',
          path: '/users/{id}',
          operationId: 'deleteUser',
          summary: '刪除使用者',
          responses: { 204: {} },
        }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      expect(steps).toHaveLength(4);

      // 檢查步驟順序
      expect(steps[0].request.method).toBe('POST');
      expect(steps[1].request.method).toBe('GET');
      expect(steps[2].request.method).toBe('PUT');
      expect(steps[3].request.method).toBe('DELETE');

      // 檢查變數引用
      expect(steps[0].capture).toBeDefined();
      expect(steps[1].request.path).toContain('{{resourceId}}');
      expect(steps[2].request.path).toContain('{{resourceId}}');
      expect(steps[3].request.path).toContain('{{resourceId}}');

      // 檢查 request body
      expect(steps[0].request.body).toBeDefined();
      expect(steps[2].request.body).toBeDefined();

      // 檢查狀態碼
      expect(steps[0].expect.statusCode).toBe(201);
      expect(steps[1].expect.statusCode).toBe(200);
      expect(steps[2].expect.statusCode).toBe(200);
      expect(steps[3].expect.statusCode).toBe(204);
    });

    it('應該處理多個資源的複雜流程', () => {
      const endpoints: EndpointInfo[] = [
        // Users
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser', summary: '建立使用者' }),
        createEndpoint({ method: 'GET', path: '/users/{id}', operationId: 'getUser', summary: '取得使用者' }),
        createEndpoint({ method: 'DELETE', path: '/users/{id}', operationId: 'deleteUser', summary: '刪除使用者' }),

        // Posts
        createEndpoint({ method: 'POST', path: '/posts', operationId: 'createPost', summary: '建立文章' }),
        createEndpoint({ method: 'GET', path: '/posts/{id}', operationId: 'getPost', summary: '取得文章' }),
        createEndpoint({ method: 'PUT', path: '/posts/{id}', operationId: 'updatePost', summary: '更新文章' }),
        createEndpoint({ method: 'DELETE', path: '/posts/{id}', operationId: 'deletePost', summary: '刪除文章' }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      // Users: POST + GET + DELETE = 3
      // Posts: POST + GET + PUT + DELETE = 4
      expect(steps).toHaveLength(7);

      const userSteps = steps.filter((s) => s.request.path.includes('/users'));
      const postSteps = steps.filter((s) => s.request.path.includes('/posts'));

      expect(userSteps).toHaveLength(3);
      expect(postSteps).toHaveLength(4);
    });

    it('應該處理部分 CRUD 的情況', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/logs', operationId: 'createLog' }),
        createEndpoint({ method: 'GET', path: '/logs/{id}', operationId: 'getLog' }),
        // 沒有 PUT, DELETE (唯讀資源)
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      expect(steps).toHaveLength(2); // POST + GET
      expect(steps[0].request.method).toBe('POST');
      expect(steps[1].request.method).toBe('GET');
    });
  });

  describe('步驟名稱產生（避免重複）', () => {
    it('應該避免重複動作詞（summary 已包含動作詞）', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser', summary: '建立使用者' }),
        createEndpoint({ method: 'GET', path: '/users/{id}', operationId: 'getUser', summary: '取得使用者' }),
        createEndpoint({ method: 'PUT', path: '/users/{id}', operationId: 'updateUser', summary: '更新使用者' }),
        createEndpoint({ method: 'DELETE', path: '/users/{id}', operationId: 'deleteUser', summary: '刪除使用者' }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      // 步驟名稱應該直接使用 summary，不重複動作詞
      expect(steps[0].name).toBe('建立使用者'); // 不是「建立建立使用者」
      expect(steps[1].name).toBe('取得使用者'); // 不是「取得取得使用者」
      expect(steps[2].name).toBe('更新使用者'); // 不是「更新更新使用者」
      expect(steps[3].name).toBe('刪除使用者'); // 不是「刪除刪除使用者」
    });

    it('應該正確處理 summary 不包含動作詞的情況', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser', summary: '使用者' }),
        createEndpoint({ method: 'GET', path: '/users/{id}', operationId: 'getUser', summary: '使用者詳情' }),
        createEndpoint({ method: 'PUT', path: '/users/{id}', operationId: 'updateUser', summary: '使用者資料' }),
        createEndpoint({ method: 'DELETE', path: '/users/{id}', operationId: 'deleteUser', summary: '使用者' }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      // 步驟名稱應該加上動作詞
      expect(steps[0].name).toBe('建立使用者');
      expect(steps[1].name).toBe('取得使用者詳情');
      expect(steps[2].name).toBe('更新使用者資料');
      expect(steps[3].name).toBe('刪除使用者');
    });

    it('應該處理 summary 包含其他動作詞的情況', () => {
      const endpoints: EndpointInfo[] = [
        // POST 端點但 summary 是「註冊使用者」
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser', summary: '註冊使用者' }),
        // GET 端點但 summary 是「查詢使用者」
        createEndpoint({ method: 'GET', path: '/users/{id}', operationId: 'getUser', summary: '查詢使用者詳情' }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      // 步驟名稱應該保留原 summary 的動作詞
      expect(steps[0].name).toBe('註冊使用者'); // 不是「建立註冊使用者」
      expect(steps[1].name).toBe('查詢使用者詳情'); // 不是「取得查詢使用者詳情」
    });

    it('應該處理沒有 summary 的情況', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser' }),
        createEndpoint({ method: 'GET', path: '/users/{id}', operationId: 'getUser' }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      // 沒有 summary 時，使用 operationId
      expect(steps[0].name).toBe('建立createUser');
      expect(steps[1].name).toBe('取得getUser');
    });

    it('應該處理登入端點的特殊情況', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/auth/login', operationId: 'login', summary: '登入系統' }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      // 登入端點應該保留 summary
      expect(steps[0].name).toBe('登入系統');
      expect(steps[0].capture?.[0].variableName).toBe('authToken'); // 應該提取 authToken
    });

    it('應該處理 summary 以「新增」開頭的情況', () => {
      const endpoints: EndpointInfo[] = [
        createEndpoint({ method: 'POST', path: '/users', operationId: 'createUser', summary: '新增使用者' }),
      ];

      const steps = resolver.resolveExecutionOrder(endpoints);

      // 「新增」也是建立的同義詞，應該保留
      expect(steps[0].name).toBe('新增使用者'); // 不是「建立新增使用者」
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
    method: 'GET',
    operationId: 'testOperation',
    summary: undefined,
    requestSchema: undefined,
    responseSchemas: {},
    responses: undefined,
    security: undefined,
    examples: undefined,
    ...overrides,
  };
}
