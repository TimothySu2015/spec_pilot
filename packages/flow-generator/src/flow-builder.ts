/**
 * Flow Builder - Flow 建構器
 * 建構符合 SpecPilot 規範的 Flow 定義
 */

import type { FlowDefinition, FlowStep } from '@specpilot/flow-parser';
import type { FlowStepConfig } from './types.js';

export class FlowBuilder {
  private flow: Partial<FlowDefinition> = { steps: [] };
  private stepCounter = 0;

  /**
   * 設定 Flow 名稱
   */
  setName(name: string): this {
    this.flow.name = name;
    return this;
  }

  /**
   * 設定 Flow 描述
   */
  setDescription(description: string): this {
    this.flow.description = description;
    return this;
  }

  /**
   * 新增測試步驟
   */
  addStep(stepConfig: FlowStepConfig): this {
    const step: FlowStep = {
      name: stepConfig.name || stepConfig.operationId || `步驟 ${this.stepCounter + 1}`,
      request: {
        method: stepConfig.method || 'GET',
        path: stepConfig.path,
      },
      expectations: {
        status: stepConfig.expectedStatusCode || 200,
      },
    };

    // 設定描述
    if (stepConfig.description) {
      step.description = stepConfig.description;
    }

    // 設定請求參數
    if (stepConfig.parameters) {
      if (stepConfig.parameters.body) {
        step.request.body = stepConfig.parameters.body;
      }
      if (stepConfig.parameters.query) {
        step.request.query = stepConfig.parameters.query;
      }
      if (stepConfig.parameters.headers) {
        step.request.headers = stepConfig.parameters.headers;
      }
    }

    // 設定變數提取 (使用新的 capture 格式)
    if (stepConfig.extractVariables) {
      step.capture = Object.entries(stepConfig.extractVariables).map(([variableName, path]) => ({
        variableName,
        path,
      }));
    }

    // 設定驗證規則 (使用新的 validation 格式)
    if (stepConfig.validations && stepConfig.validations.length > 0) {
      step.validation = stepConfig.validations.map((v) => ({
        field: v.field,
        rule: v.rule,
        value: v.value,
      }));
    }

    this.flow.steps?.push(step);
    this.stepCounter++;
    return this;
  }

  /**
   * 取得當前步驟
   */
  getCurrentStep(): FlowStep | undefined {
    const steps = this.flow.steps || [];
    return steps[steps.length - 1];
  }

  /**
   * 設定全域配置
   */
  setGlobals(globals: FlowDefinition['globals']): this {
    this.flow.globals = globals;
    return this;
  }

  /**
   * 建構最終 Flow 定義
   */
  build(): FlowDefinition {
    if (!this.flow.name) {
      this.flow.name = '自動產生的測試流程';
    }

    if (!this.flow.steps || this.flow.steps.length === 0) {
      throw new Error('Flow 必須至少包含一個步驟');
    }

    return this.flow as FlowDefinition;
  }

  /**
   * 產生步驟 ID
   */
  private generateStepId(operationId: string): string {
    const baseId = operationId.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`).replace(/^_/, '');
    return `${baseId}_${this.stepCounter + 1}`;
  }

  /**
   * 重置建構器
   */
  reset(): this {
    this.flow = { steps: [] };
    this.stepCounter = 0;
    return this;
  }
}
