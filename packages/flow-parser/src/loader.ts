/**
 * Flow YAML 檔案載入邏輯
 */

import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { createStructuredLogger, IStructuredLogger } from '@specpilot/shared';
import { FlowParseError, FlowValidationError } from './errors.js';
import {
  IFlowDefinition,
  HttpMethod
} from './types.js';
import { AuthParser, AuthConfigValidationError } from './auth-parser.js';
import { resolve } from 'path';

/**
 * Flow YAML 載入器類別
 */
export class FlowLoader {
  private logger: IStructuredLogger;

  constructor(logger?: IStructuredLogger) {
    this.logger = logger || createStructuredLogger('flow-parser');
  }

  /**
   * 從檔案載入 Flow
   */
  async loadFlowFromFile(filePath: string, executionId?: string): Promise<IFlowDefinition> {
    this.logger.info('FLOW_LOAD_START', '開始載入 Flow 檔案', {
      filePath,
      executionId,
      component: 'flow-parser'
    });

    try {
      // 檢查檔案存在
      let content: string;
      try {
        const resolvedPath = resolve(filePath);
        content = readFileSync(resolvedPath, 'utf-8');
      } catch (error) {
        throw FlowParseError.fileNotFound(filePath, executionId);
      }

      // 檢查內容是否為空
      if (!content.trim()) {
        throw FlowParseError.emptyContent(executionId);
      }

      return await this.loadFlowFromContent(content, executionId);
    } catch (error) {
      this.logger.error('FLOW_LOAD_FAILURE', 'Flow 檔案載入失敗', {
        filePath,
        error: error instanceof Error ? error.message : String(error),
        executionId,
        component: 'flow-parser'
      });
      throw error;
    }
  }

  /**
   * 從內容載入 Flow
   */
  async loadFlowFromContent(content: string, executionId?: string): Promise<IFlowDefinition> {
    this.logger.info('FLOW_LOAD_START', '開始載入 Flow 內容', {
      contentLength: content.length,
      executionId,
      component: 'flow-parser'
    });

    try {
      // 解析 YAML
      let flowData: unknown;
      try {
        flowData = parseYaml(content);
      } catch (error) {
        throw FlowParseError.yamlFormatError(error as Error, executionId);
      }

      // 驗證結構
      const validatedFlow = this.validateFlowStructure(flowData, executionId);

      // 建立 Flow 定義
      const flowDefinition: IFlowDefinition = {
        id: validatedFlow.id || 'unnamed-flow',
        rawContent: content,
        steps: validatedFlow.steps,
        globals: validatedFlow.globals
      };

      this.logger.info('FLOW_LOAD_SUCCESS', 'Flow 載入成功', {
        flowId: flowDefinition.id,
        stepCount: flowDefinition.steps.length,
        hasGlobals: !!flowDefinition.globals,
        executionId,
        component: 'flow-parser'
      });

      return flowDefinition;
    } catch (error) {
      this.logger.error('FLOW_LOAD_FAILURE', 'Flow 內容載入失敗', {
        contentLength: content.length,
        error: error instanceof Error ? error.message : String(error),
        executionId,
        component: 'flow-parser'
      });
      throw error;
    }
  }

  /**
   * 驗證 Flow 結構
   */
  private validateFlowStructure(flowData: unknown, executionId?: string): Record<string, unknown> {
    if (!flowData || typeof flowData !== 'object') {
      throw new FlowValidationError(
        'Flow 內容必須為有效的物件',
        { type: typeof flowData },
        '請確保 YAML 檔案包含有效的物件結構',
        { executionId, component: 'flow-parser' }
      );
    }

    const flow = flowData as Record<string, unknown>;

    // 檢查步驟列表
    if (!flow.steps || !Array.isArray(flow.steps)) {
      throw FlowValidationError.missingRequiredField('steps', executionId);
    }

    if (flow.steps.length === 0) {
      throw FlowValidationError.emptySteps(executionId);
    }

    // 驗證每個步驟
    (flow.steps as unknown[]).forEach((step: unknown, index: number) => {
      this.validateStep(step, index, executionId);
    });

    // 驗證全域認證設定（可選）
    if (flow.globals && typeof flow.globals === 'object') {
      const globals = flow.globals as Record<string, unknown>;
      if (globals.auth && typeof globals.auth === 'object') {
        const authConfig = globals.auth as Record<string, unknown>;
        if (authConfig.static) {
          try {
            AuthParser.parseGlobalStaticAuth(authConfig.static);
          } catch (error) {
            if (error instanceof AuthConfigValidationError) {
              throw new FlowValidationError(
                `全域認證設定錯誤：${error.message}`,
                error.details,
                '請檢查 globals.auth.static 設定格式是否正確',
                { executionId, component: 'flow-parser' }
              );
            }
            throw error;
          }
        }
      }
    }

    return flow;
  }

  /**
   * 驗證單個步驟
   */
  private validateStep(step: unknown, index: number, executionId?: string): void {
    if (!step || typeof step !== 'object') {
      throw new FlowValidationError(
        `步驟 ${index + 1} 必須為有效的物件`,
        { step, index },
        '請確保每個步驟都是有效的物件格式',
        { executionId, component: 'flow-parser' }
      );
    }

    const stepData = step as Record<string, unknown>;

    // 驗證步驟名稱
    if (!stepData.name || typeof stepData.name !== 'string') {
      throw FlowValidationError.missingRequiredField(
        `steps[${index}].name`,
        executionId
      );
    }

    // 驗證請求設定
    if (!stepData.request || typeof stepData.request !== 'object') {
      throw FlowValidationError.missingRequiredField(
        `steps[${index}].request`,
        executionId
      );
    }

    const requestData = stepData.request as Record<string, unknown>;

    // 驗證 HTTP 方法
    if (!requestData.method || typeof requestData.method !== 'string') {
      throw FlowValidationError.missingRequiredField(
        `steps[${index}].request.method`,
        executionId
      );
    }

    const method = requestData.method.toUpperCase();
    const validMethods = Object.values(HttpMethod);
    if (!validMethods.includes(method as HttpMethod)) {
      throw FlowValidationError.invalidHttpMethod(
        requestData.method as string,
        stepData.name as string,
        executionId
      );
    }

    // 驗證請求路徑
    if (!requestData.path || typeof requestData.path !== 'string') {
      throw FlowValidationError.missingRequiredField(
        `steps[${index}].request.path`,
        executionId
      );
    }

    // 驗證期望設定（可選但如果存在必須格式正確）
    if (stepData.expectations) {
      this.validateExpectations(stepData.expectations, stepData.name as string, executionId);
    }

    // 驗證認證設定（可選但如果存在必須格式正確）
    if (stepData.auth) {
      try {
        AuthParser.parseStepAuth(stepData.auth, stepData.name as string);
      } catch (error) {
        if (error instanceof AuthConfigValidationError) {
          throw new FlowValidationError(
            error.message,
            error.details,
            '請檢查認證設定格式是否正確',
            { executionId, component: 'flow-parser' }
          );
        }
        throw error;
      }
    }
  }

  /**
   * 驗證期望設定
   */
  private validateExpectations(expectations: unknown, stepName: string, executionId?: string): void {
    if (!expectations || typeof expectations !== 'object') {
      throw FlowValidationError.invalidExpectation(
        '期望設定必須為物件',
        stepName,
        executionId
      );
    }

    const expectationData = expectations as Record<string, unknown>;

    // 驗證狀態碼
    if (expectationData.status !== undefined) {
      if (typeof expectationData.status !== 'number' || 
          expectationData.status < 100 || expectationData.status > 599) {
        throw FlowValidationError.invalidExpectation(
          '狀態碼必須為 100-599 之間的數字',
          stepName,
          executionId
        );
      }
    }

    // 驗證自訂規則
    if (expectationData.custom && Array.isArray(expectationData.custom)) {
      (expectationData.custom as unknown[]).forEach((rule: unknown, index: number) => {
        this.validateCustomRule(rule, index, stepName, executionId);
      });
    }
  }

  /**
   * 驗證自訂規則
   */
  private validateCustomRule(
    rule: unknown, 
    index: number, 
    stepName: string, 
    executionId?: string
  ): void {
    if (!rule || typeof rule !== 'object') {
      throw FlowValidationError.invalidExpectation(
        `自訂規則 ${index + 1} 必須為有效的物件`,
        stepName,
        executionId
      );
    }

    const ruleData = rule as Record<string, unknown>;
    const validTypes = ['notNull', 'regex', 'contains'];
    
    if (!ruleData.type || !validTypes.includes(ruleData.type as string)) {
      throw FlowValidationError.invalidExpectation(
        `自訂規則 ${index + 1} 的類型無效，必須為: ${validTypes.join(', ')}`,
        stepName,
        executionId
      );
    }

    if (!ruleData.field || typeof ruleData.field !== 'string') {
      throw FlowValidationError.invalidExpectation(
        `自訂規則 ${index + 1} 缺少 field 欄位`,
        stepName,
        executionId
      );
    }

    // regex 和 contains 類型需要 value
    if ((ruleData.type === 'regex' || ruleData.type === 'contains') && ruleData.value === undefined) {
      throw FlowValidationError.invalidExpectation(
        `自訂規則 ${index + 1} (${ruleData.type}) 需要 value 欄位`,
        stepName,
        executionId
      );
    }
  }

  /**
   * 遮罩敏感資訊
   */
  private maskSensitiveData(obj: unknown): unknown {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const objData = obj as Record<string, unknown>;
    const sensitiveKeys = ['token', 'auth', 'authorization', 'password', 'secret', 'key'];
    const masked = { ...objData };

    Object.keys(masked).forEach(key => {
      if (sensitiveKeys.some(sensitive => 
        key.toLowerCase().includes(sensitive.toLowerCase())
      )) {
        masked[key] = '***';
      } else if (typeof masked[key] === 'object') {
        masked[key] = this.maskSensitiveData(masked[key]);
      }
    });

    return masked;
  }
}