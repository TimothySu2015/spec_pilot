/**
 * Flow YAML 載入與轉換器
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';
import { createStructuredLogger, StructuredLogger } from '@specpilot/shared';
import {
  FlowDefinitionSchema as UnifiedFlowDefinitionSchema,
  type FlowDefinition as UnifiedFlowDefinition,
  type FlowStep as UnifiedFlowStep,
  type CaptureVariable,
  type ExpectBodyField,
  type ValidationRule,
} from '@specpilot/schemas';
import { FlowParseError, FlowValidationError } from './errors.js';
import {
  FlowDefinition,
  FlowStep,
  FlowExpectations,
  FlowGlobals,
  HttpMethod,
} from './types.js';
import { AuthParser, AuthConfigValidationError } from './auth-parser.js';

/**
 * Flow YAML 載入器
 */
export class FlowLoader {
  private logger: StructuredLogger;

  constructor(logger?: StructuredLogger) {
    this.logger = logger || createStructuredLogger('flow-parser');
  }

  /**
   * 從檔案載入 Flow 定義
   */
  async loadFlowFromFile(filePath: string, executionId?: string): Promise<FlowDefinition> {
    this.logger.info('FLOW_LOAD_START', '開始載入 Flow 檔案', {
      filePath,
      executionId,
      component: 'flow-parser'
    });

    try {
      let content: string;
      try {
        const resolvedPath = resolve(filePath);
        content = readFileSync(resolvedPath, 'utf-8');
      } catch (error) {
        throw FlowParseError.fileNotFound(filePath, executionId);
      }

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
   * 從字串內容載入 Flow 定義
   */
  async loadFlowFromContent(content: string, executionId?: string): Promise<FlowDefinition> {
    this.logger.info('FLOW_LOAD_START', '開始解析 Flow 內容', {
      contentLength: content.length,
      executionId,
      component: 'flow-parser'
    });

    try {
      let flowData: unknown;
      try {
        flowData = parseYaml(content);
      } catch (error) {
        throw FlowParseError.yamlFormatError(error as Error, executionId);
      }

      const validationResult = UnifiedFlowDefinitionSchema.safeParse(flowData);
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => ({
          path: err.path.join('.') || '<root>',
          message: err.message,
          code: err.code,
        }));

        throw new FlowValidationError(
          'Flow YAML 結構不符合 Schema 定義',
          { errors, raw: this.maskSensitiveData(flowData) },
          '請檢查 Flow YAML 是否符合 @specpilot/schemas 的定義',
          { executionId, component: 'flow-parser' }
        );
      }

      const flowDefinition = this.convertToInternalFormat(validationResult.data, content, executionId);

      this.logger.info('FLOW_LOAD_SUCCESS', 'Flow 解析完成', {
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
   * 將 Schema 結構轉換為核心流程結構
   */
  private convertToInternalFormat(
    schemaData: UnifiedFlowDefinition,
    rawContent: string,
    executionId?: string
  ): FlowDefinition {
    const globals = this.convertGlobals(schemaData, executionId);

    return {
      id: schemaData.name || 'unnamed-flow',
      rawContent,
      steps: schemaData.steps.map(step => this.convertStep(step, executionId)),
      globals,
      variables: schemaData.variables,
      options: schemaData.options,
      reporting: schemaData.reporting,
    };
  }

  /**
   * 轉換單一 Step
   */
  private convertStep(schemaStep: UnifiedFlowStep, executionId?: string): FlowStep {
    const method = this.normalizeHttpMethod(schemaStep.request.method, schemaStep.name, executionId);

    const expectations = this.convertExpectations(schemaStep.expect, schemaStep.validation);
    const capture = this.convertCapture(schemaStep.capture);

    return {
      name: schemaStep.name,
      description: schemaStep.description,
      request: {
        method,
        path: schemaStep.request.path,
        url: schemaStep.request.url,
        headers: schemaStep.request.headers ?? undefined,
        body: schemaStep.request.body,
        query: schemaStep.request.query,
      },
      expectations,
      capture,
      auth: schemaStep.auth,
      retryPolicy: schemaStep.retryPolicy,
    };
  }

  /**
   * 轉換 expectations 結構
   */
  private convertExpectations(
    expect: UnifiedFlowStep['expect'],
    validationRules?: ValidationRule[]
  ): FlowExpectations {
    const expectations: FlowExpectations = {};

    if (expect.statusCode !== undefined) {
      expectations.status = expect.statusCode;
    }

    if (expect.body !== undefined) {
      expectations.body = expect.body;
    }

    const customRules: FlowExpectations['custom'] = [];

    if (expect.bodyFields) {
      for (const field of expect.bodyFields) {
        const rule = this.buildCustomRuleFromBodyField(field);
        if (rule) {
          customRules.push(rule);
        }
      }
    }

    if (validationRules) {
      for (const rule of validationRules) {
        const converted = this.buildCustomRuleFromValidation(rule);
        if (converted) {
          customRules.push(converted);
        }
      }
    }

    if (customRules.length > 0) {
      expectations.custom = customRules;
    }

    return expectations;
  }

  /**
   * 將 bodyFields 轉為自訂驗證
   */
  private buildCustomRuleFromBodyField(field: ExpectBodyField): FlowExpectations['custom'][number] | null {
    if (!field.fieldName) {
      return null;
    }

    if (field.validationMode === 'exact' && field.expectedValue !== undefined) {
      return {
        type: 'contains',
        field: field.fieldName,
        value: field.expectedValue,
      };
    }

    if (field.expectedValue !== undefined) {
      return {
        type: 'contains',
        field: field.fieldName,
        value: field.expectedValue,
      };
    }

    return {
      type: 'notNull',
      field: field.fieldName,
    };
  }

  /**
   * 將 validation 規則轉為自訂驗證
   */
  private buildCustomRuleFromValidation(rule: ValidationRule): FlowExpectations['custom'][number] | null {
    if (!rule || typeof rule !== 'object') {
      return null;
    }

    return {
      type: (rule.rule as 'notNull' | 'regex' | 'contains') || 'unknown',
      field: (rule.path as string) || '',
      value: rule.value as string | number | boolean | undefined,
      message: rule.message as string | undefined,
    };
  }

  /**
   * 轉換 capture 陣列為對應表
   */
  private convertCapture(capture?: CaptureVariable[] | null): Record<string, string> | undefined {
    if (!capture || capture.length === 0) {
      return undefined;
    }

    return capture.reduce<Record<string, string>>((acc, item) => {
      if (item.variableName && item.path) {
        acc[item.variableName] = item.path;
      }
      return acc;
    }, {});
  }

  /**
   * 轉換 Globals，並確保靜態認證設定有效
   */
  private convertGlobals(schemaData: UnifiedFlowDefinition, executionId?: string): FlowGlobals | undefined {
    const baseUrl = schemaData.globals?.baseUrl ?? schemaData.baseUrl;
    const headers = schemaData.globals?.headers;
    const auth = schemaData.globals?.auth;
    const retryPolicy = schemaData.globals?.retryPolicy;

    if (!baseUrl && !headers && !auth && !retryPolicy) {
      return undefined;
    }

    if (auth && 'static' in auth && auth.static) {
      try {
        AuthParser.parseGlobalStaticAuth(auth.static);
      } catch (error) {
        if (error instanceof AuthConfigValidationError) {
          throw new FlowValidationError(
            `全域認證設定錯誤：${error.message}`,
            error.details,
            '請檢查 globals.auth.static 設定是否符合規範',
            { executionId, component: 'flow-parser' }
          );
        }
        throw error;
      }
    }

    return {
      baseUrl,
      headers,
      auth,
      retryPolicy,
    };
  }

  /**
   * 驗證並轉換 HTTP 方法
   */
  private normalizeHttpMethod(method: string, stepName?: string, executionId?: string): HttpMethod {
    const upperMethod = method.toUpperCase();
    const validMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    if (!validMethods.includes(upperMethod as HttpMethod)) {
      throw FlowValidationError.invalidHttpMethod(method, stepName, executionId);
    }
    return upperMethod as HttpMethod;
  }

  /**
   * 遮罩敏感資訊（避免在錯誤紀錄中洩露）
   */
  private maskSensitiveData(obj: unknown): unknown {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const objData = obj as Record<string, unknown>;
    const sensitiveKeys = ['token', 'auth', 'authorization', 'password', 'secret', 'key'];
    const masked = { ...objData };

    Object.keys(masked).forEach(key => {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        masked[key] = '***';
      } else if (typeof masked[key] === 'object') {
        masked[key] = this.maskSensitiveData(masked[key]);
      }
    });

    return masked;
  }
}

