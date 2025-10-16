/**
 * CRUD Generator - CRUD 測試產生器
 * 產生基本 CRUD 操作的成功測試案例
 */

import type { FlowStep, HttpMethod } from '@specpilot/flow-parser';
import type { EndpointInfo, CRUDGeneratorConfig, JSONSchema } from './types.js';
import { DataSynthesizer } from './data-synthesizer.js';

export class CRUDGenerator {
  private dataSynthesizer: DataSynthesizer;

  constructor(private config: CRUDGeneratorConfig = {}) {
    this.dataSynthesizer = new DataSynthesizer({
      useExamples: config.useExamples ?? true,
      useDefaults: true,
      useEnums: true,
    });
  }

  /**
   * 產生基本 CRUD 成功案例
   */
  generateSuccessCases(endpoint: EndpointInfo): FlowStep[] {
    const steps: FlowStep[] = [];
    const expectedStatus = this.getExpectedStatusCode(endpoint);

    const step: FlowStep = {
      name: `${endpoint.summary || endpoint.operationId} - 成功案例`,
      request: {
        method: endpoint.method.toUpperCase() as HttpMethod,
        path: endpoint.path,
      },
      expectations: {
        status: expectedStatus,
      },
    };

    // 產生測試資料
    if (endpoint.requestSchema) {
      const testData = this.synthesizeTestData(endpoint.requestSchema, endpoint.examples);

      if (endpoint.method === 'POST' || endpoint.method === 'PUT' || endpoint.method === 'PATCH') {
        step.request.body = testData;
      }
    }

    steps.push(step);
    return steps;
  }

  /**
   * 使用 OpenAPI examples 或根據 schema 產生測試資料
   */
  synthesizeTestData(schema: JSONSchema, examples?: Record<string, unknown>): unknown {
    return this.dataSynthesizer.synthesize(schema, examples);
  }

  /**
   * 取得預期的狀態碼 (從 OpenAPI 規格中讀取)
   */
  private getExpectedStatusCode(endpoint: EndpointInfo): number {
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
    const statusCodeMap: Record<string, number> = {
      GET: 200,
      POST: 201,
      PUT: 200,
      PATCH: 200,
      DELETE: 204,
    };

    return statusCodeMap[endpoint.method.toUpperCase()] || 200;
  }

  /**
   * 產生步驟 ID
   */
  private generateStepId(operationId: string): string {
    return operationId.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/^_/, '');
  }
}
