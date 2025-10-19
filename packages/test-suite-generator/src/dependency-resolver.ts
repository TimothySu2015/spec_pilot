/**
 * Dependency Resolver - 依賴解析器
 * 分析資源依賴關係並產生流程串接
 */

import type { FlowStep, HttpMethod } from '@specpilot/flow-parser';
import type { EndpointInfo, DependencyGraph, DependencyNode, DependencyEdge } from './types.js';
import { DataSynthesizer } from './data-synthesizer.js';

export class DependencyResolver {
  private dataSynthesizer: DataSynthesizer;

  constructor() {
    this.dataSynthesizer = new DataSynthesizer();
  }

  /**
   * 分析資源依賴，產生串接流程
   * 例如: POST /users -> GET /users/{id} -> DELETE /users/{id}
   */
  resolveExecutionOrder(endpoints: EndpointInfo[]): FlowStep[] {
    const steps: FlowStep[] = [];
    const dependencies = this.analyzeDependencies(endpoints);

    // 按資源類型分組
    const resourceGroups = this.groupByResource(dependencies.nodes);

    for (const [_resourceType, nodes] of resourceGroups.entries()) {
      // 找到建立資源的端點 (POST)
      const createNode = nodes.find((n) => n.endpoint.method === 'POST' && !n.endpoint.path.includes('{'));

      if (!createNode) continue;

      // 1. 建立資源步驟
      const createStep = this.createResourceCreationStep(createNode);
      steps.push(createStep);

      // 2. 找到相關的讀取端點 (GET with id)
      const readNode = nodes.find(
        (n) => n.endpoint.method === 'GET' && n.endpoint.path.includes('{') && n.operationId !== createNode.operationId
      );

      if (readNode) {
        const readStep = this.createDependentStep(readNode, 'resourceId');
        steps.push(readStep);
      }

      // 3. 找到更新端點 (PUT/PATCH)
      const updateNode = nodes.find(
        (n) =>
          (n.endpoint.method === 'PUT' || n.endpoint.method === 'PATCH') &&
          n.endpoint.path.includes('{') &&
          n.operationId !== createNode.operationId
      );

      if (updateNode) {
        const updateStep = this.createDependentStep(updateNode, 'resourceId', {
          body: this.dataSynthesizer.synthesize(updateNode.endpoint.requestSchema || {}),
        });
        steps.push(updateStep);
      }

      // 4. 找到刪除端點 (DELETE)
      const deleteNode = nodes.find(
        (n) => n.endpoint.method === 'DELETE' && n.endpoint.path.includes('{') && n.operationId !== createNode.operationId
      );

      if (deleteNode) {
        const deleteStep = this.createDependentStep(deleteNode, 'resourceId');
        steps.push(deleteStep);
      }
    }

    return steps;
  }

  /**
   * 分析依賴關係
   */
  analyzeDependencies(endpoints: EndpointInfo[]): DependencyGraph {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];

    // 建立節點
    for (const endpoint of endpoints) {
      const resourceType = this.extractResourceType(endpoint.path);
      nodes.push({
        operationId: endpoint.operationId,
        endpoint,
        resourceType,
      });
    }

    // 建立邊（依賴關係）
    for (const node of nodes) {
      if (node.endpoint.method === 'POST' && !node.endpoint.path.includes('{')) {
        // POST 端點建立資源，其他端點依賴它
        for (const relatedNode of nodes) {
          if (
            relatedNode.resourceType === node.resourceType &&
            relatedNode.operationId !== node.operationId &&
            relatedNode.endpoint.path.includes('{')
          ) {
            edges.push({
              from: node.operationId,
              to: relatedNode.operationId,
              type: this.getEdgeType(relatedNode.endpoint.method),
              variable: this.extractPathParameter(relatedNode.endpoint.path),
            });
          }
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * 建立資源建立步驟
   */
  private createResourceCreationStep(node: DependencyNode): FlowStep {
    // 檢查是否為登入端點
    const isLoginEndpoint = node.endpoint.path.includes('/login') || node.endpoint.path.includes('/auth');

    // 產生步驟名稱 (避免重複文字)
    const methodName = this.getMethodName(node.endpoint.method);
    const stepName = this.generateStepName(node.endpoint.summary, node.operationId, methodName);

    return {
      name: stepName,
      request: {
        method: node.endpoint.method.toUpperCase() as HttpMethod,
        path: node.endpoint.path,
        body: this.dataSynthesizer.synthesize(node.endpoint.requestSchema || {}),
      },
      capture: [
        {
          variableName: isLoginEndpoint ? 'authToken' : 'resourceId',
          path: isLoginEndpoint ? 'token' : 'id',
        },
      ],
      expectations: {
        status: this.getExpectedStatusFromSpec(node.endpoint),
      },
    };
  }

  /**
   * 建立依賴步驟
   */
  private createDependentStep(
    node: DependencyNode,
    variableName: string,
    additionalRequest?: { body?: unknown }
  ): FlowStep {
    const pathParam = this.extractPathParameter(node.endpoint.path);

    // 將路徑中的 {id} 替換為 {{resourceId}}
    let path = node.endpoint.path;
    if (pathParam) {
      path = path.replace(`{${pathParam}}`, `{{${variableName}}}`);
    }

    // 產生步驟名稱 (避免重複文字)
    const methodName = this.getMethodName(node.endpoint.method);
    const stepName = this.generateStepName(node.endpoint.summary, node.operationId, methodName);

    const step: FlowStep = {
      name: stepName,
      request: {
        method: node.endpoint.method.toUpperCase() as HttpMethod,
        path,
        ...additionalRequest,
      },
      expectations: {
        status: this.getExpectedStatusFromSpec(node.endpoint),
      },
    };

    return step;
  }

  /**
   * 按資源類型分組節點
   */
  private groupByResource(nodes: DependencyNode[]): Map<string, DependencyNode[]> {
    const groups = new Map<string, DependencyNode[]>();

    for (const node of nodes) {
      const existing = groups.get(node.resourceType || 'unknown');
      if (existing) {
        existing.push(node);
      } else {
        groups.set(node.resourceType || 'unknown', [node]);
      }
    }

    return groups;
  }

  /**
   * 提取資源類型
   */
  private extractResourceType(path: string): string {
    const segments = path.split('/').filter(Boolean);
    for (const segment of segments) {
      if (!segment.startsWith('{')) {
        return segment;
      }
    }
    return 'unknown';
  }

  /**
   * 從路徑提取資源名稱
   */
  private extractResourceName(path: string): string {
    const segments = path.split('/').filter(Boolean);
    return segments[0] || 'resource';
  }

  /**
   * 提取路徑參數名稱
   */
  private extractPathParameter(path: string): string | undefined {
    const match = path.match(/\{(\w+)\}/);
    return match ? match[1] : undefined;
  }

  /**
   * 取得邊的類型
   */
  private getEdgeType(method: string): 'creates' | 'requires' | 'modifies' | 'deletes' {
    switch (method.toUpperCase()) {
      case 'POST':
        return 'creates';
      case 'GET':
        return 'requires';
      case 'PUT':
      case 'PATCH':
        return 'modifies';
      case 'DELETE':
        return 'deletes';
      default:
        return 'requires';
    }
  }

  /**
   * 取得方法名稱（中文）
   */
  private getMethodName(method: string): string {
    const methodMap: Record<string, string> = {
      GET: '取得',
      POST: '建立',
      PUT: '更新',
      PATCH: '修改',
      DELETE: '刪除',
    };
    return methodMap[method.toUpperCase()] || method;
  }

  /**
   * 產生步驟名稱（避免重複動作詞）
   *
   * @param summary - OpenAPI summary
   * @param operationId - 操作 ID
   * @param actionVerb - 動作詞（如「建立」、「取得」等）
   * @returns 步驟名稱
   *
   * @example
   * generateStepName('建立使用者', 'createUser', '建立') // => '建立使用者'
   * generateStepName('使用者', 'createUser', '建立')   // => '建立使用者'
   * generateStepName(undefined, 'createUser', '建立')  // => '建立createUser'
   */
  private generateStepName(summary: string | undefined, operationId: string, actionVerb: string): string {
    if (!summary) {
      // 沒有 summary，使用 operationId
      return `${actionVerb}${operationId}`;
    }

    // 檢查 summary 是否以動作詞開頭（精確匹配）
    if (summary.startsWith(actionVerb)) {
      // 已經以動作詞開頭，直接使用
      return summary;
    }

    // 檢查 summary 是否包含其他常見動作詞（避免加上錯誤的前綴）
    const commonVerbs = ['建立', '新增', '取得', '查詢', '讀取', '更新', '修改', '刪除', '移除', '登入', '註冊'];
    const hasOtherVerb = commonVerbs.some(verb => summary.startsWith(verb));

    if (hasOtherVerb) {
      // summary 已經以其他動作詞開頭，直接使用
      return summary;
    }

    // summary 不包含動作詞，加上前綴
    return `${actionVerb}${summary}`;
  }

  /**
   * 取得預期狀態碼
   */
  private getExpectedStatus(method: string): number {
    const statusMap: Record<string, number> = {
      GET: 200,
      POST: 201,
      PUT: 200,
      PATCH: 200,
      DELETE: 204,
    };
    return statusMap[method.toUpperCase()] || 200;
  }

  /**
   * 從 OpenAPI 規格中取得預期狀態碼
   */
  private getExpectedStatusFromSpec(endpoint: EndpointInfo): number {
    // 1. 優先從 OpenAPI responses 中找 2xx 狀態碼
    if (endpoint.responses) {
      const successCodes = Object.keys(endpoint.responses)
        .filter(code => code.startsWith('2'))
        .map(code => parseInt(code))
        .sort((a, b) => a - b);

      if (successCodes.length > 0) {
        return successCodes[0];
      }
    }

    // 2. 使用預設狀態碼
    return this.getExpectedStatus(endpoint.method);
  }
}
