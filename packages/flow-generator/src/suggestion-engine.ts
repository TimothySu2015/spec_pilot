/**
 * Suggestion Engine - 智能建議引擎
 * 根據當前步驟與 OpenAPI 規格提供智能建議
 */

import type { FlowStep } from '@specpilot/flow-parser';
import type { EndpointInfo, Suggestion } from './types.js';

export class SuggestionEngine {
  /**
   * 根據當前步驟提供智能建議
   */
  getSuggestions(currentStep: Partial<FlowStep>, endpoint: EndpointInfo): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // 1. 檢查必填欄位
    const missingRequired = this.findMissingRequiredFields(currentStep, endpoint);
    if (missingRequired.length > 0) {
      suggestions.push({
        type: 'missing_required',
        message: `缺少必填欄位: ${missingRequired.join(', ')}`,
        action: 'prompt_for_values',
        data: { fields: missingRequired },
      });
    }

    // 2. 檢查認證需求
    if (endpoint.security && endpoint.security.length > 0) {
      suggestions.push({
        type: 'auth_required',
        message: '此端點需要認證，請確保已設定 token 或執行登入流程',
        action: 'check_auth',
      });
    }

    // 3. 推薦驗證條件
    suggestions.push({
      type: 'validation_suggestion',
      message: '建議新增驗證: 檢查回應狀態碼',
      action: 'add_validation',
      data: {
        field: 'status',
        rule: 'equals',
        value: this.getExpectedStatusCode(endpoint.method),
      },
    });

    return suggestions;
  }

  /**
   * 尋找缺少的必填欄位
   */
  private findMissingRequiredFields(
    currentStep: Partial<FlowStep>,
    endpoint: EndpointInfo
  ): string[] {
    const missing: string[] = [];

    // 檢查 requestBody 必填欄位
    if (endpoint.requestBody?.required && endpoint.requestBody.content) {
      const jsonContent = endpoint.requestBody.content['application/json'];
      if (jsonContent?.schema && typeof jsonContent.schema === 'object') {
        const schema = jsonContent.schema as {
          required?: string[];
          properties?: Record<string, unknown>;
        };

        const requiredFields = schema.required || [];
        const currentBody = (currentStep.request?.body || {}) as Record<string, unknown>;

        for (const field of requiredFields) {
          if (!(field in currentBody)) {
            missing.push(field);
          }
        }
      }
    }

    // 檢查路徑參數
    if (endpoint.parameters) {
      for (const param of endpoint.parameters) {
        if (param.required && param.in === 'path') {
          const currentParams = (currentStep.request?.params || {}) as Record<string, unknown>;
          if (!(param.name in currentParams)) {
            missing.push(param.name);
          }
        }
      }
    }

    return missing;
  }

  /**
   * 取得預期的狀態碼
   */
  private getExpectedStatusCode(method: string): number {
    const statusCodeMap: Record<string, number> = {
      GET: 200,
      POST: 201,
      PUT: 200,
      PATCH: 200,
      DELETE: 204,
    };

    return statusCodeMap[method.toUpperCase()] || 200;
  }

  /**
   * 推薦可用變數
   */
  getAvailableVariables(allSteps: FlowStep[]): string[] {
    const variables: string[] = [];

    for (const step of allSteps) {
      if (step.extract) {
        variables.push(...Object.keys(step.extract));
      }
    }

    return variables;
  }
}
