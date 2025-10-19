/**
 * Error Case Generator - 錯誤案例產生器
 * 產生參數驗證失敗、認證錯誤等錯誤測試案例
 */

import type { FlowStep, HttpMethod } from '@specpilot/flow-parser';
import type { EndpointInfo, ErrorCaseGeneratorConfig, JSONSchema } from './types.js';
import { DataSynthesizer } from './data-synthesizer.js';

export class ErrorCaseGenerator {
  private dataSynthesizer: DataSynthesizer;

  constructor(private config: ErrorCaseGeneratorConfig = {}) {
    this.config.includeMissingFields = config.includeMissingFields ?? true;
    this.config.includeInvalidFormats = config.includeInvalidFormats ?? true;
    this.config.includeAuthErrors = config.includeAuthErrors ?? true;

    this.dataSynthesizer = new DataSynthesizer({
      useExamples: false,
      useDefaults: true,
    });
  }

  /**
   * 產生必填欄位缺失測試
   */
  generateMissingFieldCases(endpoint: EndpointInfo): FlowStep[] {
    if (!this.config.includeMissingFields || !endpoint.requestSchema) {
      return [];
    }

    const steps: FlowStep[] = [];
    const required = endpoint.requestSchema.required || [];

    for (const field of required) {
      const testData = this.generateTestDataWithoutField(endpoint.requestSchema, field);

      steps.push({
        name: `${endpoint.summary || endpoint.operationId} - 缺少 ${field}`,
        request: {
          method: endpoint.method.toUpperCase() as HttpMethod,
          path: endpoint.path,
          body: testData,
        },
        expectations: {
          status: 400,
        },
      });
    }

    return steps;
  }

  /**
   * 產生格式驗證錯誤測試
   */
  generateFormatValidationCases(endpoint: EndpointInfo): FlowStep[] {
    if (!this.config.includeInvalidFormats || !endpoint.requestSchema) {
      return [];
    }

    const steps: FlowStep[] = [];
    const properties = endpoint.requestSchema.properties || {};

    for (const [field, schema] of Object.entries(properties)) {
      const invalidValue = this.generateInvalidValue(schema);

      if (invalidValue !== null) {
        const testData = this.generateTestDataWithInvalidField(
          endpoint.requestSchema,
          field,
          invalidValue
        );

        steps.push({
          name: `${endpoint.summary || endpoint.operationId} - 無效 ${field} 格式`,
          request: {
            method: endpoint.method.toUpperCase() as HttpMethod,
            path: endpoint.path,
            body: testData,
          },
          expectations: {
            status: 400,
          },
        });
      }
    }

    return steps;
  }

  /**
   * 產生認證錯誤測試
   */
  generateAuthErrorCases(endpoint: EndpointInfo): FlowStep[] {
    if (!this.config.includeAuthErrors || !endpoint.security || endpoint.security.length === 0) {
      return [];
    }

    return [
      {
        name: `${endpoint.summary || endpoint.operationId} - 無認證`,
        request: {
          method: endpoint.method.toUpperCase() as HttpMethod,
          path: endpoint.path,
        },
        expectations: {
          status: 401,
        },
      },
    ];
  }

  /**
   * 產生缺少指定欄位的測試資料
   */
  private generateTestDataWithoutField(schema: JSONSchema, fieldToExclude: string): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    const properties = schema.properties || {};

    for (const [field, propSchema] of Object.entries(properties)) {
      if (field !== fieldToExclude) {
        data[field] = this.generateValidValue(propSchema);
      }
    }

    return data;
  }

  /**
   * 產生包含無效欄位的測試資料
   */
  private generateTestDataWithInvalidField(
    schema: JSONSchema,
    invalidField: string,
    invalidValue: unknown
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    const properties = schema.properties || {};

    for (const [field, propSchema] of Object.entries(properties)) {
      if (field === invalidField) {
        data[field] = invalidValue;
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
   * 產生無效值
   */
  private generateInvalidValue(schema: JSONSchema): unknown {
    return this.dataSynthesizer.synthesizeInvalid(schema);
  }

  /**
   * 產生步驟 ID
   */
  private generateStepId(operationId: string): string {
    return operationId.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/^_/, '');
  }
}
