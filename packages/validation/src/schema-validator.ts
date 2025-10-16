import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import type {
  Validator,
  ValidationContext,
  ValidatorResult,
  ValidationIssue,
  JsonSchema
} from './types.js';

/**
 * Schema 驗證器
 */
export class SchemaValidator implements Validator {
  private readonly ajv: Ajv;
  private readonly schemaCache = new Map<string, object>();
  private readonly compiledValidators = new Map<string, ValidateFunction>();

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false, // 允許額外屬性
    });

    // 添加格式支援（如 email, date, uri 等）
    addFormats(this.ajv);

    // 添加自訂關鍵字
    this.registerCustomKeywords();
  }

  /**
   * 註冊自訂 Ajv 關鍵字
   */
  private registerCustomKeywords(): void {
    // 自訂關鍵字: notNull - 驗證值不為 null
    this.ajv.addKeyword({
      keyword: 'notNull',
      validate: (schema: boolean, data: unknown) => {
        if (!schema) return true; // 如果 notNull: false，則不驗證
        return data !== null;
       },
      errors: false,
    });

    // 自訂關鍵字: stringContains - 驗證字串包含指定子字串
    // 注意: 'contains' 是 Ajv 內建關鍵字用於陣列，所以使用 'stringContains'
    this.ajv.addKeyword({
      keyword: 'stringContains',
      type: 'string',
      validate: (schema: string, data: string) => {
        return data.includes(schema);
      },
      errors: false,
    });

    // 自訂關鍵字: regex - 驗證字串符合正規表示式（比 pattern 更靈活）
    this.ajv.addKeyword({
      keyword: 'regex',
      type: 'string',
      validate: (schema: string, data: string) => {
        try {
          const regex = new RegExp(schema);
          return regex.test(data);
        } catch {
          return false; // 如果正規表示式無效，回傳 false
        }
      },
      errors: false,
    });
  }

  async validate(ctx: ValidationContext): Promise<ValidatorResult> {
    const startTime = Date.now();
    const { response, expectations, schemas, logger, executionId, step } = ctx;

    logger.debug('VALIDATION_START', {
      executionId,
      component: 'validation-engine',
      stepName: step.name,
      validator: 'schema',
      schemaName: expectations.schema,
    });

    const issues: ValidationIssue[] = [];
    let isValid = true;

    if (expectations.schema) {
      try {
        const schema = this.getSchema(expectations.schema, schemas);
        if (!schema) {
          issues.push({
            category: 'schema',
            severity: 'error',
            message: `找不到 Schema 定義：${expectations.schema}`,
            ruleName: 'schema-not-found',
          });
          isValid = false;
        } else {
          const validationResult = this.validateData(response.data, schema, expectations.schema);
          if (!validationResult.isValid) {
            isValid = false;
            issues.push(...validationResult.issues);
          }

          logger.debug('SCHEMA_LOADED', {
            executionId,
            component: 'validation-engine',
            stepName: step.name,
            schemaName: expectations.schema,
            status: 'success',
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知錯誤';
        issues.push({
          category: 'schema',
          severity: 'error',
          message: `Schema 驗證執行失敗：${errorMessage}`,
          ruleName: 'schema-execution-error',
        });
        isValid = false;
      }
    }

    const durationMs = Date.now() - startTime;
    const status = isValid ? 'success' : 'failure';

    logger.info(isValid ? 'VALIDATION_SUCCESS' : 'VALIDATION_FAILURE', {
      executionId,
      component: 'validation-engine',
      stepName: step.name,
      validator: 'schema',
      rule: expectations.schema,
      status,
      message: isValid ? 'Schema 驗證通過' : `Schema 驗證失敗`,
      durationMs,
    });

    return {
      isValid,
      issues,
      telemetry: {
        durationMs,
        details: {
          schemaName: expectations.schema,
          schemaExists: !!schemas[expectations.schema || ''],
        },
      },
    };
  }

  /**
   * 取得 Schema 定義
   */
  private getSchema(schemaName: string, schemas: Record<string, JsonSchema>): object | null {
    // 檢查快取
    if (this.schemaCache.has(schemaName)) {
      return this.schemaCache.get(schemaName)!;
    }

    // 從提供的 schemas 中尋找
    const schema = schemas[schemaName];
    if (schema) {
      const compiledSchema = schema as object;
      this.schemaCache.set(schemaName, compiledSchema);
      return compiledSchema;
    }

    return null;
  }

  /**
   * 驗證資料
   */
  private validateData(data: unknown, schema: object, schemaName: string): {
    isValid: boolean;
    issues: ValidationIssue[];
  } {
    try {
      // 檢查快取中是否有編譯後的驗證函式
      let validate = this.compiledValidators.get(schemaName);

      if (!validate) {
        // 編譯 schema 並快取驗證函式
        validate = this.ajv.compile(schema);
        this.compiledValidators.set(schemaName, validate);
      }

      const isValid = validate(data);

      if (!isValid && validate.errors) {
        const issues: ValidationIssue[] = validate.errors.map(error => ({
          category: 'schema' as const,
          severity: 'error' as const,
          message: this.formatAjvError(error),
          field: error.instancePath || error.schemaPath,
          expected: error.schema,
          actual: error.data,
          ruleName: 'schema-validation',
        }));

        return { isValid: false, issues };
      }

      return { isValid: true, issues: [] };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      return {
        isValid: false,
        issues: [{
          category: 'schema',
          severity: 'error',
          message: `Schema 編譯失敗：${errorMessage}`,
          ruleName: 'schema-compilation-error',
        }],
      };
    }
  }

  /**
   * 格式化 AJV 錯誤訊息
   */
  private formatAjvError(error: Record<string, unknown>): string {
    const path = error.instancePath || '根物件';
    const keyword = error.keyword;
    const message = error.message;

    switch (keyword) {
      case 'required':
        return `${path} 缺少必要欄位：${error.params?.missingProperty}`;
      case 'type':
        return `${path} 類型錯誤：期望 ${error.schema}，實際為 ${typeof error.data}`;
      case 'format':
        return `${path} 格式錯誤：${message}`;
      case 'enum':
        return `${path} 值不在允許範圍內：${error.schema.join(', ')}`;
      case 'minimum':
        return `${path} 值太小：最小值為 ${error.schema}`;
      case 'maximum':
        return `${path} 值太大：最大值為 ${error.schema}`;
      case 'minLength':
        return `${path} 字串太短：最小長度為 ${error.schema}`;
      case 'maxLength':
        return `${path} 字串太長：最大長度為 ${error.schema}`;
      case 'pattern':
        return `${path} 不符合格式規則：${error.schema}`;
      default:
        return `${path} 驗證失敗：${message}`;
    }
  }

  /**
   * 清除 Schema 快取
   */
  clearCache(): void {
    this.schemaCache.clear();
    this.compiledValidators.clear();
  }

  /**
   * 取得快取統計
   */
  getCacheStats(): { size: number; schemas: string[]; compiledValidators: number } {
    return {
      size: this.schemaCache.size,
      schemas: Array.from(this.schemaCache.keys()),
      compiledValidators: this.compiledValidators.size,
    };
  }
}