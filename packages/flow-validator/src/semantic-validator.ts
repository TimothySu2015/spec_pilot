/**
 * Semantic Validator - 語意驗證器
 * 驗證 Flow 的語意正確性（operationId 存在、變數引用有效等）
 */

import type { FlowDefinition } from '@specpilot/flow-parser';
import type { OpenAPIDocument } from '@specpilot/spec-loader';
import type { ValidationError, ValidationWarning, SemanticValidationOptions } from './types.js';

export class SemanticValidator {
  constructor(
    private spec: OpenAPIDocument,
    private options: SemanticValidationOptions = {}
  ) {
    this.options.checkOperationIds = options.checkOperationIds ?? true;
    this.options.checkVariableReferences = options.checkVariableReferences ?? true;
    this.options.checkAuthFlow = options.checkAuthFlow ?? true;
  }

  /**
   * 驗證語意正確性
   */
  validate(flow: FlowDefinition): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 1. 驗證 operationId 存在於 OpenAPI 規格中
    if (this.options.checkOperationIds) {
      errors.push(...this.validateOperationIds(flow));
    }

    // 2. 驗證變數引用有效
    if (this.options.checkVariableReferences) {
      errors.push(...this.validateVariableReferences(flow));
    }

    // 3. 檢查認證流程
    if (this.options.checkAuthFlow) {
      warnings.push(...this.checkAuthFlow(flow));
    }

    return { errors, warnings };
  }

  /**
   * 驗證 operationId 存在（如果有提供）
   */
  private validateOperationIds(flow: FlowDefinition): ValidationError[] {
    const errors: ValidationError[] = [];
    const validOperationIds = this.extractOperationIds();

    flow.steps.forEach((step, index) => {
      // operationId 在新的 Schema 中是可選的
      // 如果步驟有 operationId，才檢查它是否存在於 OpenAPI 規格中
      const stepWithOp = step as { operationId?: string };
      if (stepWithOp.operationId && !validOperationIds.has(stepWithOp.operationId)) {
        errors.push({
          type: 'semantic',
          message: `operationId "${stepWithOp.operationId}" 在 OpenAPI 規格中不存在`,
          path: `steps[${index}].operationId`,
        });
      }
    });

    return errors;
  }

  /**
   * 驗證變數引用有效
   */
  private validateVariableReferences(flow: FlowDefinition): ValidationError[] {
    const errors: ValidationError[] = [];
    const definedVariables = new Set<string>();

    // 全域變數
    if (flow.variables) {
      for (const varName of Object.keys(flow.variables)) {
        definedVariables.add(varName);
      }
    }

    flow.steps.forEach((step, index) => {
      // 檢查步驟中使用的變數
      const usedVariables = this.extractUsedVariables(step.request);

      for (const variable of usedVariables) {
        if (!definedVariables.has(variable)) {
          errors.push({
            type: 'reference',
            message: `變數 "${variable}" 未定義或在此步驟之前未提取`,
            path: `steps[${index}].request`,
            details: { variable },
          });
        }
      }

      // 記錄此步驟定義的變數（支援新舊兩種格式）
      const stepWithExtract = step as { extract?: Record<string, string>; capture?: Array<{ variableName: string }> };

      if (stepWithExtract.extract) {
        for (const varName of Object.keys(stepWithExtract.extract)) {
          definedVariables.add(varName);
        }
      }

      if (stepWithExtract.capture) {
        for (const captureItem of stepWithExtract.capture) {
          definedVariables.add(captureItem.variableName);
        }
      }
    });

    return errors;
  }

  /**
   * 檢查認證流程
   */
  private checkAuthFlow(flow: FlowDefinition): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // 檢查是否有需要認證的端點但沒有登入步驟
    const hasSecureEndpoints = flow.steps.some((step) => {
      const stepWithOp = step as { operationId?: string };
      return stepWithOp.operationId && this.isSecureEndpoint(stepWithOp.operationId);
    });

    const hasLoginStep = flow.steps.some((step) => {
      const stepWithOp = step as { operationId?: string };
      return stepWithOp.operationId && (
        stepWithOp.operationId.toLowerCase().includes('login') ||
        stepWithOp.operationId.toLowerCase().includes('auth')
      );
    });

    if (hasSecureEndpoints && !hasLoginStep && !flow.globals?.auth) {
      warnings.push({
        type: 'suggestion',
        message: 'Flow 包含需要認證的端點，建議新增登入步驟或設定全域認證',
      });
    }

    return warnings;
  }

  /**
   * 提取所有有效的 operationId
   */
  private extractOperationIds(): Set<string> {
    const operationIds = new Set<string>();
    const paths = this.spec.paths || {};

    for (const pathItem of Object.values(paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      for (const operation of Object.values(pathItem)) {
        if (typeof operation === 'object' && operation && 'operationId' in operation) {
          const op = operation as { operationId?: string };
          if (op.operationId) {
            operationIds.add(op.operationId);
          }
        }
      }
    }

    return operationIds;
  }

  /**
   * 提取請求中使用的變數
   */
  private extractUsedVariables(request: unknown): string[] {
    const variables: string[] = [];

    const extractFromValue = (value: unknown): void => {
      if (typeof value === 'string') {
        const matches = value.matchAll(/\$\{\{\s*(\w+)\s*\}\}/g);
        for (const match of matches) {
          variables.push(match[1]);
        }
      } else if (typeof value === 'object' && value !== null) {
        for (const val of Object.values(value)) {
          extractFromValue(val);
        }
      }
    };

    extractFromValue(request);
    return variables;
  }

  /**
   * 檢查端點是否需要認證
   */
  private isSecureEndpoint(operationId: string): boolean {
    const paths = this.spec.paths || {};

    for (const pathItem of Object.values(paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      for (const operation of Object.values(pathItem)) {
        if (typeof operation === 'object' && operation) {
          const op = operation as { operationId?: string; security?: unknown[] };
          if (op.operationId === operationId) {
            return Boolean(op.security && op.security.length > 0);
          }
        }
      }
    }

    return false;
  }
}
