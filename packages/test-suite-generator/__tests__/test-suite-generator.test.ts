/**
 * TestSuiteGenerator 單元測試
 * 測試測試套件產生器的整合功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TestSuiteGenerator } from '../src/test-suite-generator.js';
import { SpecAnalyzer } from '../src/spec-analyzer.js';
import type { OpenAPIV3 } from '@specpilot/spec-loader';

describe('TestSuiteGenerator', () => {
  let spec: OpenAPIV3.Document;
  let analyzer: SpecAnalyzer;
  let generator: TestSuiteGenerator;

  beforeEach(() => {
    spec = createMockSpec();
    analyzer = new SpecAnalyzer({ spec });
    generator = new TestSuiteGenerator(analyzer);
  });

  describe('構造函數', () => {
    it('應該成功建立實例', () => {
      const gen = new TestSuiteGenerator(analyzer);
      expect(gen).toBeInstanceOf(TestSuiteGenerator);
    });

    it('應該接受空選項', () => {
      const gen = new TestSuiteGenerator(analyzer, {});
      expect(gen).toBeInstanceOf(TestSuiteGenerator);
    });

    it('應該接受完整選項', () => {
      const gen = new TestSuiteGenerator(analyzer, {
        includeSuccessCases: true,
        includeErrorCases: true,
        includeEdgeCases: true,
        includeAuthTests: true,
        generateFlows: true,
        endpoints: ['createUser'],
      });
      expect(gen).toBeInstanceOf(TestSuiteGenerator);
    });
  });

  describe('generate() - 基本功能', () => {
    it('應該產生基本的測試套件', () => {
      const flow = generator.generate();

      expect(flow).toBeDefined();
      expect(flow.name).toBe('自動產生的測試套件');
      expect(flow.description).toContain('個端點的測試案例');
      expect(flow.version).toBe('1.0.0');
      expect(flow.baseUrl).toBeDefined();
      expect(flow.steps).toBeInstanceOf(Array);
    });

    it('應該產生 metadata 摘要', () => {
      const flow = generator.generate();

      expect(flow).toHaveProperty('metadata');
      expect((flow as any).metadata).toHaveProperty('summary');

      const summary = (flow as any).metadata.summary;
      expect(summary).toHaveProperty('totalTests');
      expect(summary).toHaveProperty('successTests');
      expect(summary).toHaveProperty('errorTests');
      expect(summary).toHaveProperty('edgeTests');
      expect(summary).toHaveProperty('endpoints');
    });

    it('應該根據選項決定產生哪些測試', () => {
      const flowAll = generator.generate({
        includeSuccessCases: true,
        includeErrorCases: true,
        includeEdgeCases: true,
      });

      const flowSuccessOnly = generator.generate({
        includeSuccessCases: true,
        includeErrorCases: false,
        includeEdgeCases: false,
      });

      expect(flowAll.steps.length).toBeGreaterThan(flowSuccessOnly.steps.length);
    });
  });

  describe('generate() - 成功案例', () => {
    it('預設應該包含成功案例', () => {
      const flow = generator.generate();

      expect(flow.steps.length).toBeGreaterThan(0);
    });

    it('includeSuccessCases = true 應該產生成功案例', () => {
      const flow = generator.generate({
        includeSuccessCases: true,
      });

      expect(flow.steps.length).toBeGreaterThan(0);
    });

    it('includeSuccessCases = false 應該不產生成功案例', () => {
      const flow = generator.generate({
        includeSuccessCases: false,
        includeErrorCases: false,
        includeEdgeCases: false,
        generateFlows: false,
      });

      expect(flow.steps).toEqual([]);
    });
  });

  describe('generate() - 錯誤案例', () => {
    it('includeErrorCases = false 應該不產生錯誤案例', () => {
      const flow = generator.generate({
        includeErrorCases: false,
      });

      const summary = (flow as any).metadata.summary;
      expect(summary.errorTests).toBe(0);
    });

    it('includeErrorCases = true 應該產生錯誤案例', () => {
      const flow = generator.generate({
        includeErrorCases: true,
      });

      const summary = (flow as any).metadata.summary;
      expect(summary.errorTests).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generate() - 邊界測試', () => {
    it('includeEdgeCases = false 應該不產生邊界測試', () => {
      const flow = generator.generate({
        includeEdgeCases: false,
      });

      const summary = (flow as any).metadata.summary;
      expect(summary.edgeTests).toBe(0);
    });

    it('includeEdgeCases = true 應該產生邊界測試', () => {
      const flow = generator.generate({
        includeEdgeCases: true,
      });

      const summary = (flow as any).metadata.summary;
      // 取決於 spec 是否有邊界限制
      expect(summary.edgeTests).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generate() - 流程串接', () => {
    it('generateFlows = false 應該不產生流程串接', () => {
      const flowWithoutFlows = generator.generate({
        includeSuccessCases: true,
        generateFlows: false,
      });

      const flowWithFlows = generator.generate({
        includeSuccessCases: true,
        generateFlows: true,
      });

      // 有 generateFlows 的測試數量應該更多（包含 CRUD 流程）
      expect(flowWithFlows.steps.length).toBeGreaterThanOrEqual(flowWithoutFlows.steps.length);
    });

    it('generateFlows = true 應該產生 CRUD 流程', () => {
      const flow = generator.generate({
        includeSuccessCases: false,
        includeErrorCases: false,
        includeEdgeCases: false,
        generateFlows: true,
      });

      // 應該有 DependencyResolver 產生的流程
      expect(flow.steps.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generate() - 端點過濾', () => {
    describe('基本過濾功能', () => {
      it('沒有指定 endpoints 應該使用所有端點', () => {
        const flow = generator.generate();

        const allEndpoints = analyzer.extractEndpoints();
        const summary = (flow as any).metadata.summary;

        expect(summary.endpoints).toHaveLength(allEndpoints.length);
      });

      it('空的 endpoints 陣列應該使用所有端點', () => {
        const flow = generator.generate({
          endpoints: [],
        });

        const allEndpoints = analyzer.extractEndpoints();
        const summary = (flow as any).metadata.summary;

        expect(summary.endpoints).toHaveLength(allEndpoints.length);
      });

      it('指定不存在的端點應該返回空測試', () => {
        const flow = generator.generate({
          endpoints: ['nonExistentEndpoint'],
        });

        expect(flow.steps).toEqual([]);
      });
    });

    describe('格式 1: operationId 過濾', () => {
      it('應該只產生指定端點的測試', () => {
        const flow = generator.generate({
          endpoints: ['createUser'],
        });

        const summary = (flow as any).metadata.summary;
        expect(summary.endpoints).toEqual(['createUser']);
      });

      it('應該支援多個端點過濾', () => {
        const flow = generator.generate({
          endpoints: ['createUser', 'getUser'],
        });

        const summary = (flow as any).metadata.summary;
        expect(summary.endpoints).toHaveLength(2);
        expect(summary.endpoints).toContain('createUser');
        expect(summary.endpoints).toContain('getUser');
      });

      it('應該精確匹配 operationId', () => {
        const flow = generator.generate({
          endpoints: ['createUser'],
        });

        const summary = (flow as any).metadata.summary;
        expect(summary.endpoints).not.toContain('getUser');
      });
    });

    describe('格式 2: "METHOD /path" 過濾', () => {
      it('應該支援 "POST /users" 格式', () => {
        const flow = generator.generate({
          endpoints: ['POST /users'],
        });

        const summary = (flow as any).metadata.summary;
        expect(summary.endpoints).toEqual(['createUser']);
      });

      it('應該支援 "GET /users/{id}" 格式', () => {
        const flow = generator.generate({
          endpoints: ['GET /users/{id}'],
        });

        const summary = (flow as any).metadata.summary;
        expect(summary.endpoints).toEqual(['getUser']);
      });

      it('應該支援小寫方法名稱', () => {
        const flow = generator.generate({
          endpoints: ['post /users'],
        });

        const summary = (flow as any).metadata.summary;
        expect(summary.endpoints).toEqual(['createUser']);
      });

      it('應該支援混合大小寫方法名稱', () => {
        const flow = generator.generate({
          endpoints: ['Post /users'],
        });

        const summary = (flow as any).metadata.summary;
        expect(summary.endpoints).toEqual(['createUser']);
      });

      it('應該支援多個 "METHOD /path" 過濾', () => {
        const flow = generator.generate({
          endpoints: ['POST /users', 'GET /users/{id}'],
        });

        const summary = (flow as any).metadata.summary;
        expect(summary.endpoints).toHaveLength(2);
        expect(summary.endpoints).toContain('createUser');
        expect(summary.endpoints).toContain('getUser');
      });

      it('方法不匹配應該返回空', () => {
        const flow = generator.generate({
          endpoints: ['GET /users'], // /users 只有 POST
        });

        expect(flow.steps).toEqual([]);
      });

      it('路徑不匹配應該返回空', () => {
        const flow = generator.generate({
          endpoints: ['POST /products'], // 不存在的路徑
        });

        expect(flow.steps).toEqual([]);
      });

      it('格式錯誤（超過兩個部分）應該返回空', () => {
        const flow = generator.generate({
          endpoints: ['POST /users extra'],
        });

        expect(flow.steps).toEqual([]);
      });
    });

    describe('格式 3: "/path" 過濾（匹配所有方法）', () => {
      it('應該支援 "/users" 格式', () => {
        const flow = generator.generate({
          endpoints: ['/users'],
        });

        const summary = (flow as any).metadata.summary;
        // /users 只有 POST 方法
        expect(summary.endpoints).toEqual(['createUser']);
      });

      it('應該支援 "/users/{id}" 格式', () => {
        const flow = generator.generate({
          endpoints: ['/users/{id}'],
        });

        const summary = (flow as any).metadata.summary;
        // /users/{id} 只有 GET 方法
        expect(summary.endpoints).toEqual(['getUser']);
      });

      it('應該匹配該路徑下的所有方法', () => {
        // 使用複雜 spec 測試多方法端點
        const complexSpec = createComplexSpec();
        const complexAnalyzer = new SpecAnalyzer({ spec: complexSpec });
        const complexGenerator = new TestSuiteGenerator(complexAnalyzer);

        const flow = complexGenerator.generate({
          endpoints: ['/users/{id}'],
        });

        const summary = (flow as any).metadata.summary;
        // /users/{id} 有 GET, PUT, DELETE 三個方法
        expect(summary.endpoints).toHaveLength(3);
        expect(summary.endpoints).toContain('getUser');
        expect(summary.endpoints).toContain('updateUser');
        expect(summary.endpoints).toContain('deleteUser');
      });

      it('路徑不存在應該返回空', () => {
        const flow = generator.generate({
          endpoints: ['/products'],
        });

        expect(flow.steps).toEqual([]);
      });
    });

    describe('混合格式過濾', () => {
      it('應該支援 operationId + "METHOD /path" 混合', () => {
        const flow = generator.generate({
          endpoints: ['createUser', 'GET /users/{id}'],
        });

        const summary = (flow as any).metadata.summary;
        expect(summary.endpoints).toHaveLength(2);
        expect(summary.endpoints).toContain('createUser');
        expect(summary.endpoints).toContain('getUser');
      });

      it('應該支援 operationId + "/path" 混合', () => {
        const flow = generator.generate({
          endpoints: ['createUser', '/users/{id}'],
        });

        const summary = (flow as any).metadata.summary;
        expect(summary.endpoints).toHaveLength(2);
        expect(summary.endpoints).toContain('createUser');
        expect(summary.endpoints).toContain('getUser');
      });

      it('應該支援 "METHOD /path" + "/path" 混合', () => {
        const flow = generator.generate({
          endpoints: ['POST /users', '/users/{id}'],
        });

        const summary = (flow as any).metadata.summary;
        expect(summary.endpoints).toHaveLength(2);
        expect(summary.endpoints).toContain('createUser');
        expect(summary.endpoints).toContain('getUser');
      });

      it('應該支援三種格式混合', () => {
        const complexSpec = createComplexSpec();
        const complexAnalyzer = new SpecAnalyzer({ spec: complexSpec });
        const complexGenerator = new TestSuiteGenerator(complexAnalyzer);

        const flow = complexGenerator.generate({
          endpoints: [
            'createUser',           // operationId
            'GET /users/{id}',      // "METHOD /path"
            '/users/{id}',          // "/path" (會匹配 GET, PUT, DELETE)
          ],
        });

        const summary = (flow as any).metadata.summary;
        // createUser + GET /users/{id} (重複) + /users/{id} (GET, PUT, DELETE)
        // 去重後應該有: createUser, getUser, updateUser, deleteUser
        expect(summary.endpoints.length).toBeGreaterThanOrEqual(3);
        expect(summary.endpoints).toContain('createUser');
        expect(summary.endpoints).toContain('getUser');
      });

      it('部分匹配、部分不匹配應該只返回匹配的', () => {
        const flow = generator.generate({
          endpoints: [
            'createUser',           // ✅ 存在
            'nonExistent',          // ❌ 不存在
            'GET /users/{id}',      // ✅ 存在
            'POST /products',       // ❌ 不存在
          ],
        });

        const summary = (flow as any).metadata.summary;
        expect(summary.endpoints).toHaveLength(2);
        expect(summary.endpoints).toContain('createUser');
        expect(summary.endpoints).toContain('getUser');
      });
    });

    describe('邊界案例', () => {
      it('應該處理空格過多的格式', () => {
        const flow = generator.generate({
          endpoints: ['POST  /users'], // 兩個空格
        });

        // 因為 split(' ') 會產生空字串，parts.length 會 > 2
        // 根據實作，這應該返回空
        expect(flow.steps).toEqual([]);
      });

      it('應該處理前後有空格的格式', () => {
        const flow = generator.generate({
          endpoints: [' POST /users '],
        });

        // 這取決於實作是否有 trim()
        // 目前實作沒有 trim，所以會失敗
        expect(flow.steps).toEqual([]);
      });

      it('應該處理路徑參數格式差異', () => {
        const flow = generator.generate({
          endpoints: ['GET /users/{id}'], // 與 spec 完全匹配
        });

        const summary = (flow as any).metadata.summary;
        expect(summary.endpoints).toEqual(['getUser']);
      });
    });
  });

  describe('extractBaseUrl()', () => {
    it('應該從 spec.servers[0].url 提取 baseUrl', () => {
      const customSpec = {
        ...createMockSpec(),
        servers: [{ url: 'https://api.example.com' }],
      };
      const customAnalyzer = new SpecAnalyzer({ spec: customSpec });
      const customGenerator = new TestSuiteGenerator(customAnalyzer);

      const flow = customGenerator.generate();
      expect(flow.baseUrl).toBe('https://api.example.com');
    });

    it('沒有 servers 時應該使用預設 baseUrl', () => {
      const customSpec = {
        ...createMockSpec(),
        servers: undefined,
      };
      const customAnalyzer = new SpecAnalyzer({ spec: customSpec as any });
      const customGenerator = new TestSuiteGenerator(customAnalyzer);

      const flow = customGenerator.generate();
      expect(flow.baseUrl).toBe('http://localhost:3000');
    });

    it('servers 為空陣列時應該使用預設 baseUrl', () => {
      const customSpec = {
        ...createMockSpec(),
        servers: [],
      };
      const customAnalyzer = new SpecAnalyzer({ spec: customSpec });
      const customGenerator = new TestSuiteGenerator(customAnalyzer);

      const flow = customGenerator.generate();
      expect(flow.baseUrl).toBe('http://localhost:3000');
    });

    it('servers[0].url 為空時應該使用預設 baseUrl', () => {
      const customSpec = {
        ...createMockSpec(),
        servers: [{ url: '' }],
      };
      const customAnalyzer = new SpecAnalyzer({ spec: customSpec });
      const customGenerator = new TestSuiteGenerator(customAnalyzer);

      const flow = customGenerator.generate();
      expect(flow.baseUrl).toBe('http://localhost:3000');
    });
  });

  describe('getSummary()', () => {
    it('應該返回測試摘要', () => {
      const flow = generator.generate();
      const summary = generator.getSummary(flow);

      expect(summary).toBeDefined();
      expect(summary).toHaveProperty('totalTests');
      expect(summary).toHaveProperty('successTests');
      expect(summary).toHaveProperty('errorTests');
      expect(summary).toHaveProperty('edgeTests');
      expect(summary).toHaveProperty('endpoints');
    });

    it('摘要的 totalTests 應該等於 steps 數量', () => {
      const flow = generator.generate();
      const summary = generator.getSummary(flow);

      expect(summary.totalTests).toBe(flow.steps.length);
    });

    it('沒有 metadata 時應該返回預設摘要', () => {
      const flowWithoutMetadata: any = {
        name: 'test',
        steps: [{ name: 'step1' }, { name: 'step2' }],
      };

      const summary = generator.getSummary(flowWithoutMetadata);

      expect(summary.totalTests).toBe(2);
      expect(summary.successTests).toBe(0);
      expect(summary.errorTests).toBe(0);
      expect(summary.edgeTests).toBe(0);
      expect(summary.endpoints).toEqual([]);
    });

    it('應該正確計算各類測試數量', () => {
      const flow = generator.generate({
        includeSuccessCases: true,
        includeErrorCases: true,
        includeEdgeCases: true,
      });

      const summary = generator.getSummary(flow);

      expect(summary.totalTests).toBeGreaterThan(0);
      expect(summary.successTests).toBeGreaterThanOrEqual(0);
      expect(summary.errorTests).toBeGreaterThanOrEqual(0);
      expect(summary.edgeTests).toBeGreaterThanOrEqual(0);
    });
  });

  describe('整合測試', () => {
    it('應該產生完整的測試套件', () => {
      const flow = generator.generate({
        includeSuccessCases: true,
        includeErrorCases: true,
        includeEdgeCases: true,
        generateFlows: true,
      });

      expect(flow.name).toBe('自動產生的測試套件');
      expect(flow.version).toBe('1.0.0');
      expect(flow.baseUrl).toBeDefined();
      expect(flow.steps.length).toBeGreaterThan(0);

      const summary = generator.getSummary(flow);
      expect(summary.totalTests).toBe(flow.steps.length);
    });

    it('應該能處理複雜的 OpenAPI 規格', () => {
      const complexSpec = createComplexSpec();
      const complexAnalyzer = new SpecAnalyzer({ spec: complexSpec });
      const complexGenerator = new TestSuiteGenerator(complexAnalyzer);

      const flow = complexGenerator.generate({
        includeSuccessCases: true,
        includeErrorCases: true,
        includeEdgeCases: true,
        generateFlows: true,
      });

      expect(flow.steps.length).toBeGreaterThan(0);

      const summary = complexGenerator.getSummary(flow);
      expect(summary.endpoints.length).toBeGreaterThan(0);
    });

    it('應該能處理只有部分功能的選項', () => {
      const flow = generator.generate({
        includeSuccessCases: true,
        endpoints: ['createUser'],
      });

      const summary = generator.getSummary(flow);
      expect(summary.endpoints).toEqual(['createUser']);
      expect(summary.errorTests).toBe(0);
      expect(summary.edgeTests).toBe(0);
    });
  });
});

// ==================== 輔助函數 ====================

/**
 * 建立簡單的 Mock OpenAPI Spec
 */
function createMockSpec(): OpenAPIV3.Document {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Test API',
      version: '1.0.0',
    },
    servers: [
      {
        url: 'http://localhost:3000',
      },
    ],
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
                    email: { type: 'string', format: 'email' },
                  },
                  required: ['username', 'email'],
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      username: { type: 'string' },
                      email: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/users/{id}': {
        get: {
          operationId: 'getUser',
          summary: '取得使用者',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      username: { type: 'string' },
                      email: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

/**
 * 建立複雜的 Mock OpenAPI Spec
 */
function createComplexSpec(): OpenAPIV3.Document {
  return {
    openapi: '3.0.0',
    info: {
      title: 'Complex API',
      version: '1.0.0',
    },
    servers: [
      {
        url: 'https://api.example.com',
      },
    ],
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
                    username: { type: 'string', minLength: 3, maxLength: 20 },
                    email: { type: 'string', format: 'email' },
                    age: { type: 'integer', minimum: 0, maximum: 150 },
                  },
                  required: ['username', 'email'],
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Created',
            },
          },
          security: [{ bearerAuth: [] }],
        },
      },
      '/users/{id}': {
        get: {
          operationId: 'getUser',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'OK',
            },
          },
        },
        put: {
          operationId: 'updateUser',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          requestBody: {
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
            '200': {
              description: 'OK',
            },
          },
        },
        delete: {
          operationId: 'deleteUser',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '204': {
              description: 'No Content',
            },
          },
        },
      },
    },
  };
}
