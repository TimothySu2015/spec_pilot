/**
 * Edge Case Generator - 邊界測試產生器
 * 產生邊界值測試（最大長度、空值等）
 */

import type { FlowStep } from '@specpilot/flow-parser';
import type { EndpointInfo, JSONSchema } from './types.js';
import { DataSynthesizer } from './data-synthesizer.js';

export class EdgeCaseGenerator {
  private dataSynthesizer: DataSynthesizer;

  constructor() {
    this.dataSynthesizer = new DataSynthesizer();
  }
  /**
   * 產生邊界值測試案例
   */
  generateEdgeCases(endpoint: EndpointInfo): FlowStep[] {
    if (!endpoint.requestSchema) {
      return [];
    }

    const steps: FlowStep[] = [];
    const properties = endpoint.requestSchema.properties || {};

    for (const [field, schema] of Object.entries(properties)) {
      const edgeCases = this.generateFieldEdgeCases(schema);

      for (const edgeCase of edgeCases) {
        const testData = this.generateTestDataWithEdgeValue(
          endpoint.requestSchema,
          field,
          edgeCase.value
        );

        steps.push({
          id: `${this.generateStepId(endpoint.operationId)}_edge_${field}_${edgeCase.name}`,
          name: `${endpoint.summary || endpoint.operationId} - ${field} ${edgeCase.name}`,
          operationId: endpoint.operationId,
          request: {
            body: testData,
          },
          expectations: {
            status: edgeCase.expectedStatus,
          },
        });
      }
    }

    return steps;
  }

  /**
   * 產生欄位的邊界測試案例
   */
  private generateFieldEdgeCases(schema: JSONSchema): Array<{
    name: string;
    value: unknown;
    expectedStatus: number;
  }> {
    const cases: Array<{ name: string; value: unknown; expectedStatus: number }> = [];

    if (schema.type === 'string') {
      // 最大長度
      if (schema.maxLength !== undefined) {
        cases.push({
          name: '最大長度',
          value: 'x'.repeat(schema.maxLength),
          expectedStatus: 200,
        });
        cases.push({
          name: '超過最大長度',
          value: 'x'.repeat(schema.maxLength + 1),
          expectedStatus: 400,
        });
      }

      // 最小長度
      if (schema.minLength !== undefined) {
        cases.push({
          name: '最小長度',
          value: 'x'.repeat(schema.minLength),
          expectedStatus: 200,
        });
      }
    }

    if (schema.type === 'number' || schema.type === 'integer') {
      // 最小值
      if (schema.minimum !== undefined) {
        cases.push({
          name: '最小值',
          value: schema.minimum,
          expectedStatus: 200,
        });
      }

      // 最大值
      if (schema.maximum !== undefined) {
        cases.push({
          name: '最大值',
          value: schema.maximum,
          expectedStatus: 200,
        });
      }
    }

    return cases;
  }

  /**
   * 產生包含邊界值的測試資料
   */
  private generateTestDataWithEdgeValue(
    schema: JSONSchema,
    edgeField: string,
    edgeValue: unknown
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    const properties = schema.properties || {};

    for (const [field, propSchema] of Object.entries(properties)) {
      if (field === edgeField) {
        data[field] = edgeValue;
      } else {
        data[field] = this.generateValidValue(propSchema);
      }
    }

    return data;
  }

  /**
   * 產生有效值
   */
  private generateValidValue(schema: JSONSchema): unknown {
    return this.dataSynthesizer.synthesize(schema);
  }

  /**
   * 產生步驟 ID
   */
  private generateStepId(operationId: string): string {
    return operationId.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/^_/, '');
  }
}
