import { createStructuredLogger } from '@specpilot/shared';
import Ajv from 'ajv';

const logger = createStructuredLogger('validation');

/**
 * 驗證結果
 */
export interface IValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
    value?: unknown;
  }>;
}

/**
 * 自訂驗證規則
 */
export interface ICustomValidationRule {
  name: string;
  path: string;
  rule: 'notNull' | 'regex' | 'contains' | 'custom';
  value?: string | RegExp | unknown;
  message?: string;
}

/**
 * 驗證引擎
 */
export class ValidationEngine {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
    });

    // 註冊自訂關鍵字
    this.registerCustomKeywords();
  }

  /**
   * 使用 JSON Schema 驗證資料
   */
  validateSchema(data: unknown, schema: object): IValidationResult {
    logger.debug('執行 Schema 驗證');

    try {
      const validate = this.ajv.compile(schema);
      const valid = validate(data);

      if (!valid && validate.errors) {
        const errors = validate.errors.map(err => ({
          path: err.instancePath || err.schemaPath,
          message: err.message || '驗證失敗',
          value: err.data,
        }));

        logger.info('Schema 驗證失敗', { errorCount: errors.length, errors });

        return {
          valid: false,
          errors,
        };
      }

      logger.debug('Schema 驗證通過');
      return { valid: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      logger.error('Schema 驗證執行失敗', { error: errorMessage });

      return {
        valid: false,
        errors: [{
          path: 'schema',
          message: `Schema 驗證執行失敗: ${errorMessage}`,
        }],
      };
    }
  }

  /**
   * 執行自訂驗證規則
   */
  validateCustomRules(data: unknown, rules: ICustomValidationRule[]): IValidationResult {
    logger.debug('執行自訂驗證規則', { ruleCount: rules.length });

    const errors: Array<{
      path: string;
      message: string;
      value?: unknown;
    }> = [];

    for (const rule of rules) {
      const result = this.executeCustomRule(data, rule);
      if (!result.valid && result.errors) {
        errors.push(...result.errors);
      }
    }

    const valid = errors.length === 0;

    if (!valid) {
      logger.info('自訂驗證規則失敗', { errorCount: errors.length, errors });
    } else {
      logger.debug('自訂驗證規則通過');
    }

    return {
      valid,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * 執行單一自訂規則
   */
  private executeCustomRule(data: unknown, rule: ICustomValidationRule): IValidationResult {
    try {
      const value = this.getValueByPath(data, rule.path);

      switch (rule.rule) {
        case 'notNull':
          if (value === null || value === undefined) {
            return {
              valid: false,
              errors: [{
                path: rule.path,
                message: rule.message || `${rule.path} 不能為空`,
                value,
              }],
            };
          }
          break;

        case 'regex':
          if (rule.value instanceof RegExp) {
            const stringValue = String(value);
            if (!rule.value.test(stringValue)) {
              return {
                valid: false,
                errors: [{
                  path: rule.path,
                  message: rule.message || `${rule.path} 不符合正規表達式 ${rule.value}`,
                  value,
                }],
              };
            }
          }
          break;

        case 'contains':
          const stringValue = String(value);
          const searchValue = String(rule.value);
          if (!stringValue.includes(searchValue)) {
            return {
              valid: false,
              errors: [{
                path: rule.path,
                message: rule.message || `${rule.path} 必須包含 "${searchValue}"`,
                value,
              }],
            };
          }
          break;

        case 'custom':
          // TODO: 實作自訂驗證邏輯
          logger.warn('自訂驗證規則尚未完全實作', { ruleName: rule.name });
          break;

        default:
          logger.error('未知的驗證規則', { rule: rule.rule });
          return {
            valid: false,
            errors: [{
              path: rule.path,
              message: `未知的驗證規則: ${rule.rule}`,
            }],
          };
      }

      return { valid: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      logger.error('執行自訂規則失敗', { ruleName: rule.name, error: errorMessage });

      return {
        valid: false,
        errors: [{
          path: rule.path,
          message: `規則執行失敗: ${errorMessage}`,
        }],
      };
    }
  }

  /**
   * 根據路徑取得值
   */
  private getValueByPath(obj: unknown, path: string): unknown {
    if (!path || path === '') {
      return obj;
    }

    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (typeof current === 'object' && part in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * 註冊自訂關鍵字
   */
  private registerCustomKeywords(): void {
    // 註冊 notNull 關鍵字
    this.ajv.addKeyword({
      keyword: 'notNull',
      type: 'object',
      schemaType: 'boolean',
      compile(schema: boolean) {
        return function validate(data: unknown): boolean {
          if (schema) {
            return data !== null && data !== undefined;
          }
          return true;
        };
      },
    });

    logger.debug('註冊自訂關鍵字完成');
  }
}