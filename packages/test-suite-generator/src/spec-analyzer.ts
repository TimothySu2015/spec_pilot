/**
 * Spec Analyzer - OpenAPI 規格分析器
 * 解析 OpenAPI 規格提取端點、Schema、範例等資訊
 */

import type { EndpointInfo, DependencyGraph, AuthFlowInfo, SpecAnalyzerConfig, JSONSchema } from './types.js';

export class SpecAnalyzer {
  constructor(private config: SpecAnalyzerConfig) {}

  /**
   * 提取所有 API 端點資訊
   */
  extractEndpoints(): EndpointInfo[] {
    const endpoints: EndpointInfo[] = [];
    const paths = this.config.spec.paths || {};

    for (const [path, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      for (const [method, operation] of Object.entries(pathItem)) {
        if (typeof operation !== 'object' || !operation) continue;

        const op = operation as {
          operationId?: string;
          summary?: string;
          description?: string;
          parameters?: unknown[];
          requestBody?: unknown;
          responses?: Record<string, unknown>;
          security?: Array<Record<string, string[]>>;
        };

        // 只處理 HTTP 方法，跳過 parameters, servers 等
        const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
        if (!httpMethods.includes(method.toLowerCase())) continue;

        // 如果沒有 operationId，自動生成一個
        const operationId = op.operationId || this.generateOperationId(method, path);

        endpoints.push({
          path,
          method: method.toUpperCase(),
          operationId,
          summary: op.summary,
          description: op.description,
          requestSchema: this.extractRequestSchema(op.requestBody),
          responseSchemas: this.extractResponseSchemas(op.responses || {}),
          security: op.security,
          examples: this.extractExamples(op.requestBody),
        });
      }
    }

    return endpoints;
  }

  /**
   * 自動產生 operationId
   * 例如: POST /api/users -> createApiUsers
   */
  private generateOperationId(method: string, path: string): string {
    // 移除路徑參數並轉換為駝峰命名
    const segments = path
      .split('/')
      .filter(Boolean)
      .map(seg => seg.replace(/\{.*?\}/g, '')) // 移除 {id} 等參數
      .filter(Boolean)
      .map((seg) => {
        // 每個 segment 都首字母大寫
        return seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase();
      });

    const methodPrefix = this.getMethodPrefix(method);
    return methodPrefix + segments.join('');
  }

  /**
   * 取得方法前綴
   */
  private getMethodPrefix(method: string): string {
    const prefixMap: Record<string, string> = {
      get: 'get',
      post: 'create',
      put: 'update',
      patch: 'patch',
      delete: 'delete',
    };
    return prefixMap[method.toLowerCase()] || method.toLowerCase();
  }

  /**
   * 分析端點依賴關係
   */
  analyzeDependencies(): DependencyGraph {
    const endpoints = this.extractEndpoints();
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];

    // 建立節點映射
    const nodeMap = new Map<string, DependencyNode>();

    for (const endpoint of endpoints) {
      const resourceType = this.extractResourceType(endpoint.path);
      const node: DependencyNode = {
        operationId: endpoint.operationId,
        endpoint,
        resourceType,
      };
      nodes.push(node);
      nodeMap.set(endpoint.operationId, node);
    }

    // 分析依賴邊
    for (const endpoint of endpoints) {
      const resourceType = this.extractResourceType(endpoint.path);

      // POST 端點建立資源
      if (endpoint.method === 'POST' && !endpoint.path.includes('{')) {
        // 尋找相關的讀取/更新/刪除端點
        for (const relatedEndpoint of endpoints) {
          if (relatedEndpoint.operationId === endpoint.operationId) continue;

          const relatedResourceType = this.extractResourceType(relatedEndpoint.path);

          if (relatedResourceType === resourceType) {
            if (relatedEndpoint.method === 'GET' && relatedEndpoint.path.includes('{')) {
              edges.push({
                from: endpoint.operationId,
                to: relatedEndpoint.operationId,
                type: 'creates',
                variable: 'id',
              });
            } else if (relatedEndpoint.method === 'PUT' || relatedEndpoint.method === 'PATCH') {
              edges.push({
                from: endpoint.operationId,
                to: relatedEndpoint.operationId,
                type: 'modifies',
                variable: 'id',
              });
            } else if (relatedEndpoint.method === 'DELETE') {
              edges.push({
                from: endpoint.operationId,
                to: relatedEndpoint.operationId,
                type: 'deletes',
                variable: 'id',
              });
            }
          }
        }
      }

      // 分析路徑參數依賴
      const pathParams = this.extractPathParameters(endpoint.path);
      if (pathParams.length > 0) {
        // 此端點需要其他端點提供的資源 ID
        for (const relatedEndpoint of endpoints) {
          if (relatedEndpoint.operationId === endpoint.operationId) continue;

          const relatedResourceType = this.extractResourceType(relatedEndpoint.path);

          if (relatedResourceType === resourceType && relatedEndpoint.method === 'POST') {
            edges.push({
              from: relatedEndpoint.operationId,
              to: endpoint.operationId,
              type: 'requires',
              variable: pathParams[0],
            });
          }
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * 提取資源類型
   */
  private extractResourceType(path: string): string {
    const segments = path.split('/').filter(Boolean);
    // 取第一個非參數的路徑段作為資源類型
    for (const segment of segments) {
      if (!segment.startsWith('{')) {
        return segment;
      }
    }
    return 'unknown';
  }

  /**
   * 提取路徑參數
   */
  private extractPathParameters(path: string): string[] {
    const params: string[] = [];
    const matches = path.matchAll(/\{(\w+)\}/g);
    for (const match of matches) {
      params.push(match[1]);
    }
    return params;
  }

  /**
   * 識別認證需求
   */
  getAuthenticationFlow(): AuthFlowInfo | null {
    const endpoints = this.extractEndpoints();

    // 尋找登入端點
    const loginEndpoint = endpoints.find(
      (ep) =>
        ep.operationId.toLowerCase().includes('login') ||
        ep.operationId.toLowerCase().includes('signin') ||
        ep.operationId.toLowerCase().includes('auth') ||
        ep.summary?.toLowerCase().includes('登入') ||
        ep.summary?.toLowerCase().includes('login') ||
        ep.path.toLowerCase().includes('/auth/') ||
        ep.path.toLowerCase().includes('/login')
    );

    if (!loginEndpoint) {
      return null;
    }

    // 從 requestSchema 提取認證欄位
    const credentialFields = this.extractCredentialFields(loginEndpoint.requestSchema);

    // 從 responseSchema 提取 token 欄位
    const tokenField = this.extractTokenField(loginEndpoint.responseSchemas[200]);

    return {
      operationId: loginEndpoint.operationId,
      endpoint: loginEndpoint,
      credentialFields,
      tokenField,
    };
  }

  /**
   * 提取認證欄位
   */
  private extractCredentialFields(schema?: JSONSchema): string[] {
    if (!schema || !schema.properties) {
      return ['username', 'password']; // 預設值
    }

    const fields: string[] = [];
    const properties = schema.properties;

    // 常見的認證欄位名稱
    const commonFields = [
      'username',
      'email',
      'password',
      'user',
      'login',
      'account',
      'credential',
    ];

    for (const field of commonFields) {
      if (field in properties) {
        fields.push(field);
      }
    }

    // 如果沒找到，使用 required 欄位
    if (fields.length === 0 && schema.required) {
      fields.push(...schema.required);
    }

    return fields.length > 0 ? fields : ['username', 'password'];
  }

  /**
   * 提取 token 欄位
   */
  private extractTokenField(schema?: JSONSchema): string {
    if (!schema || !schema.properties) {
      return 'token'; // 預設值
    }

    const properties = schema.properties;

    // 常見的 token 欄位名稱
    const tokenFields = [
      'token',
      'accessToken',
      'access_token',
      'authToken',
      'auth_token',
      'jwt',
      'bearer',
    ];

    for (const field of tokenFields) {
      if (field in properties) {
        return field;
      }
    }

    return 'token';
  }

  /**
   * 提取請求 Schema
   */
  private extractRequestSchema(requestBody: unknown): JSONSchema | undefined {
    if (!requestBody || typeof requestBody !== 'object') {
      return undefined;
    }

    const body = requestBody as {
      content?: Record<string, { schema?: JSONSchema }>;
    };

    const jsonContent = body.content?.['application/json'];
    return jsonContent?.schema;
  }

  /**
   * 提取回應 Schema
   */
  private extractResponseSchemas(responses: Record<string, unknown>): Record<number, JSONSchema> {
    const schemas: Record<number, JSONSchema> = {};

    for (const [statusCode, response] of Object.entries(responses)) {
      if (typeof response === 'object' && response) {
        const resp = response as {
          content?: Record<string, { schema?: JSONSchema }>;
        };

        const jsonContent = resp.content?.['application/json'];
        if (jsonContent?.schema) {
          schemas[parseInt(statusCode, 10)] = jsonContent.schema;
        }
      }
    }

    return schemas;
  }

  /**
   * 提取範例資料
   */
  private extractExamples(requestBody: unknown): Record<string, unknown> | undefined {
    if (!requestBody || typeof requestBody !== 'object') {
      return undefined;
    }

    const body = requestBody as {
      content?: Record<string, { examples?: Record<string, unknown> }>;
    };

    return body.content?.['application/json']?.examples;
  }
}
