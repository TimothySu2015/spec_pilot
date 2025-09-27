import Ajv from 'ajv';
import type {
  Validator,
  ValidationContext,
  ValidatorResult,
  ValidationIssue,
  CustomRuleHandler,
  CustomRuleContext,
  CustomRuleResult,
  IStructuredLogger
} from './types.js';

/**
 * 自訂驗證器
 */
export class CustomValidator implements Validator {
  private readonly ajv: Ajv;
  private readonly ruleHandlers = new Map<string, CustomRuleHandler>();

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
    });

    // 註冊內建規則
    this.registerBuiltinRules();
  }

  async validate(ctx: ValidationContext): Promise<ValidatorResult> {
    const startTime = Date.now();
    const { response, expectations, schemas, logger, executionId, step } = ctx;

    logger.debug('VALIDATION_START', {
      executionId,
      component: 'validation-engine',
      stepName: step.name,
      validator: 'custom',
      ruleCount: expectations.custom?.length || 0,
    });

    const issues: ValidationIssue[] = [];
    let isValid = true;

    if (expectations.custom && expectations.custom.length > 0) {
      for (const rule of expectations.custom) {
        const startRuleTime = Date.now();

        try {
          const ruleResult = await this.executeRule({
            payload: response.data,
            ruleName: rule.type,
            ruleOptions: { value: rule.value, message: rule.message },
            schemas,
            field: rule.field,
            logger,
            executionId,
          });

          if (!ruleResult.isValid) {
            isValid = false;
            issues.push({
              category: 'custom',
              severity: 'error',
              message: ruleResult.message || `自訂規則 ${rule.type} 驗證失敗`,
              field: rule.field,
              expected: rule.value,
              actual: this.getValueByPath(response.data, rule.field),
              ruleName: rule.type,
            });
          }

          const ruleDurationMs = Date.now() - startRuleTime;
          logger.debug('CUSTOM_RULE_APPLIED', {
            executionId,
            component: 'validation-engine',
            stepName: step.name,
            validator: 'custom',
            rule: rule.type,
            field: rule.field,
            status: ruleResult.isValid ? 'success' : 'failure',
            message: ruleResult.message || (ruleResult.isValid ? '規則驗證通過' : '規則驗證失敗'),
            durationMs: ruleDurationMs,
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '未知錯誤';
          isValid = false;
          issues.push({
            category: 'custom',
            severity: 'error',
            message: `執行自訂規則 ${rule.type} 時發生錯誤：${errorMessage}`,
            field: rule.field,
            ruleName: rule.type,
          });

          logger.error('VALIDATION_FAILURE', {
            executionId,
            component: 'validation-engine',
            stepName: step.name,
            validator: 'custom',
            rule: rule.type,
            status: 'failure',
            message: `規則執行失敗：${errorMessage}`,
            durationMs: Date.now() - startRuleTime,
          });
        }
      }
    }

    const durationMs = Date.now() - startTime;
    const status = isValid ? 'success' : 'failure';

    logger.info(isValid ? 'VALIDATION_SUCCESS' : 'VALIDATION_FAILURE', {
      executionId,
      component: 'validation-engine',
      stepName: step.name,
      validator: 'custom',
      status,
      message: isValid ? '自訂規則驗證通過' : '自訂規則驗證失敗',
      durationMs,
    });

    return {
      isValid,
      issues,
      telemetry: {
        durationMs,
        details: {
          ruleCount: expectations.custom?.length || 0,
        },
      },
    };
  }

  /**
   * 註冊自訂規則
   */
  registerRule(name: string, handler: CustomRuleHandler): void {
    this.ruleHandlers.set(name, handler);

    // 檢查是否已經註冊過這個關鍵字
    if (!this.ajv.getKeyword(name)) {
      // 同時註冊為 AJV 自訂關鍵字
      this.ajv.addKeyword({
        keyword: name,
        compile: (schema: unknown) => {
          return (data: unknown): boolean => {
            try {
              const result = handler({
                payload: data,
                ruleName: name,
                ruleOptions: typeof schema === 'object' && schema !== null ? schema as Record<string, unknown> : {},
                schemas: {},
                field: '',
                logger: console as unknown as IStructuredLogger, // fallback logger
                executionId: '',
              });
              return result instanceof Promise ? false : result.isValid;
            } catch {
              return false;
            }
          };
        },
      });
    }
  }

  /**
   * 取得所有可用規則
   */
  listRules(): string[] {
    return Array.from(this.ruleHandlers.keys());
  }

  /**
   * 執行單一規則
   */
  private async executeRule(context: CustomRuleContext): Promise<CustomRuleResult> {
    const handler = this.ruleHandlers.get(context.ruleName);
    if (!handler) {
      throw new Error(`未知的自訂規則：${context.ruleName}`);
    }

    const result = await handler(context);
    return result;
  }

  /**
   * 根據路徑取得值（支援 JSON Path 語法）
   */
  private getValueByPath(obj: unknown, path: string): unknown {
    if (!path || path === '' || path === '$') {
      return obj;
    }

    // 移除開頭的 $ 符號
    const normalizedPath = path.startsWith('$.') ? path.slice(2) :
                          path.startsWith('$') ? path.slice(1) : path;

    // 如果路徑為空字串，返回根物件
    if (!normalizedPath) {
      return obj;
    }

    const parts = normalizedPath.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // 處理陣列索引 [0], [1] 等
      if (part.includes('[') && part.includes(']')) {
        const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
        if (arrayMatch) {
          const [, arrayKey, indexStr] = arrayMatch;
          const index = parseInt(indexStr, 10);

          if (typeof current === 'object' && arrayKey in (current as Record<string, unknown>)) {
            const arrayValue = (current as Record<string, unknown>)[arrayKey];
            if (Array.isArray(arrayValue) && index >= 0 && index < arrayValue.length) {
              current = arrayValue[index];
            } else {
              return undefined;
            }
          } else {
            return undefined;
          }
        } else {
          return undefined;
        }
      } else {
        // 一般物件屬性存取
        if (typeof current === 'object' && current !== null && part in (current as Record<string, unknown>)) {
          current = (current as Record<string, unknown>)[part];
        } else {
          return undefined;
        }
      }
    }

    return current;
  }

  /**
   * 註冊內建規則
   */
  private registerBuiltinRules(): void {
    // notNull 規則
    this.registerRule('notNull', (context: CustomRuleContext): CustomRuleResult => {
      const value = this.getValueByPath(context.payload, context.field);
      const isValid = value !== null && value !== undefined;

      return {
        isValid,
        message: isValid ?
          `欄位 ${context.field} 非空值驗證通過` :
          `欄位 ${context.field} 不能為空值`,
      };
    });

    // regex 規則
    this.registerRule('regex', (context: CustomRuleContext): CustomRuleResult => {
      const value = this.getValueByPath(context.payload, context.field);
      const pattern = context.ruleOptions.value;

      if (typeof pattern !== 'string') {
        return {
          isValid: false,
          message: 'regex 規則需要提供字串型態的正規表達式',
        };
      }

      try {
        const regex = new RegExp(pattern);
        const stringValue = String(value);
        const isValid = regex.test(stringValue);

        return {
          isValid,
          message: isValid ?
            `欄位 ${context.field} 符合正規表達式 ${pattern}` :
            `欄位 ${context.field} 不符合正規表達式 ${pattern}`,
        };
      } catch (error) {
        return {
          isValid: false,
          message: `正規表達式 ${pattern} 格式錯誤：${error instanceof Error ? error.message : '未知錯誤'}`,
        };
      }
    });

    // contains 規則
    this.registerRule('contains', (context: CustomRuleContext): CustomRuleResult => {
      const value = this.getValueByPath(context.payload, context.field);
      const searchValue = context.ruleOptions.value;

      if (searchValue === undefined) {
        return {
          isValid: false,
          message: 'contains 規則需要提供搜尋值',
        };
      }

      const stringValue = String(value);
      const searchString = String(searchValue);
      const isValid = stringValue.includes(searchString);

      return {
        isValid,
        message: isValid ?
          `欄位 ${context.field} 包含 "${searchString}"` :
          `欄位 ${context.field} 未包含 "${searchString}"`,
      };
    });
  }
}