import { ERROR_CODES } from '@specpilot/shared';
import { StatusValidator } from './status-validator.js';
import { SchemaValidator } from './schema-validator.js';
import { CustomValidator } from './custom-validator.js';
import type {
  ValidationInput,
  ValidationOutcome,
  ValidationIssue,
  ValidationLogEntry,
  StepResultPatch
} from './types.js';

/**
 * 驗證引擎錯誤
 */
export class ValidationError extends Error {
  public readonly code: number;
  public readonly expectationKey?: string;

  constructor(message: string, expectationKey?: string) {
    super(message);
    this.name = 'ValidationError';
    this.code = ERROR_CODES.VALIDATION_ERROR;
    this.expectationKey = expectationKey;
  }
}

/**
 * 驗證引擎主類別
 */
export class ValidationEngine {
  private readonly statusValidator: StatusValidator;
  private readonly schemaValidator: SchemaValidator;
  private readonly customValidator: CustomValidator;

  constructor() {
    this.statusValidator = new StatusValidator();
    this.schemaValidator = new SchemaValidator();
    this.customValidator = new CustomValidator();
  }

  /**
   * 驗證回應的唯一公開入口
   */
  async validateResponse(input: ValidationInput): Promise<ValidationOutcome> {
    const { step, response, expectations, schemas, logger, executionId, runContext } = input;
    const startTime = Date.now();

    logger.info('VALIDATION_START', {
      executionId,
      component: 'validation-engine',
      stepName: step.name,
      hasStatusCheck: expectations.status !== undefined,
      hasSchemaCheck: !!expectations.schema,
      hasCustomChecks: !!(expectations.custom && expectations.custom.length > 0),
    });

    const allIssues: ValidationIssue[] = [];
    const logs: ValidationLogEntry[] = [];
    let overallStatus: 'success' | 'partial' | 'failed' = 'success';

    try {
      const validationContext = {
        step,
        response,
        expectations,
        schemas,
        logger,
        executionId,
        runContext,
      };

      // 1. 狀態碼驗證
      if (expectations.status !== undefined) {
        const statusResult = await this.statusValidator.validate(validationContext);
        if (!statusResult.isValid) {
          overallStatus = 'failed';
          allIssues.push(...statusResult.issues);
        }
        logs.push({
          executionId,
          component: 'validation-engine',
          stepName: step.name,
          validator: 'status',
          status: statusResult.isValid ? 'success' : 'failure',
          message: statusResult.isValid ? '狀態碼驗證通過' : '狀態碼驗證失敗',
          durationMs: statusResult.telemetry.durationMs,
          details: statusResult.telemetry.details,
        });
      }

      // 2. Schema 驗證
      if (expectations.schema) {
        const schemaResult = await this.schemaValidator.validate(validationContext);
        if (!schemaResult.isValid) {
          if (overallStatus === 'success') {
            overallStatus = 'failed';
          }
          allIssues.push(...schemaResult.issues);
        }
        logs.push({
          executionId,
          component: 'validation-engine',
          stepName: step.name,
          validator: 'schema',
          rule: expectations.schema,
          status: schemaResult.isValid ? 'success' : 'failure',
          message: schemaResult.isValid ? 'Schema 驗證通過' : 'Schema 驗證失敗',
          durationMs: schemaResult.telemetry.durationMs,
          details: schemaResult.telemetry.details,
        });
      }

      // 3. 自訂規則驗證
      if (expectations.custom && expectations.custom.length > 0) {
        const customResult = await this.customValidator.validate(validationContext);
        if (!customResult.isValid) {
          if (overallStatus === 'success') {
            overallStatus = 'failed';
          }
          allIssues.push(...customResult.issues);
        }
        logs.push({
          executionId,
          component: 'validation-engine',
          stepName: step.name,
          validator: 'custom',
          status: customResult.isValid ? 'success' : 'failure',
          message: customResult.isValid ? '自訂規則驗證通過' : '自訂規則驗證失敗',
          durationMs: customResult.telemetry.durationMs,
          details: customResult.telemetry.details,
        });
      }

      // 建立步驟結果修補
      const stepResultPatch: StepResultPatch = {
        success: overallStatus === 'success',
        customChecks: this.buildCustomChecks(expectations, allIssues),
      };

      const totalDurationMs = Date.now() - startTime;

      // 記錄最終結果
      logger.info(overallStatus === 'success' ? 'VALIDATION_SUCCESS' : 'VALIDATION_FAILURE', {
        executionId,
        component: 'validation-engine',
        stepName: step.name,
        status: overallStatus,
        message: `驗證完成：${overallStatus}`,
        durationMs: totalDurationMs,
        issueCount: allIssues.length,
        errorCount: allIssues.filter(i => i.severity === 'error').length,
        warningCount: allIssues.filter(i => i.severity === 'warning').length,
      });

      return {
        status: overallStatus,
        issues: allIssues,
        stepResultPatch,
        logs,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      const totalDurationMs = Date.now() - startTime;

      logger.error('VALIDATION_FAILURE', {
        executionId,
        component: 'validation-engine',
        stepName: step.name,
        status: 'failure',
        message: `驗證引擎執行失敗：${errorMessage}`,
        durationMs: totalDurationMs,
        error: errorMessage,
      });

      // 拋出分類過的錯誤
      throw new ValidationError(`驗證引擎執行失敗：${errorMessage}`);
    }
  }

  /**
   * 建立自訂檢查結果
   */
  private buildCustomChecks(
    expectations: Record<string, unknown>,
    issues: ValidationIssue[]
  ): Array<{ rule: string; field: string; success: boolean; message?: string }> {
    const customChecks: Array<{ rule: string; field: string; success: boolean; message?: string }> = [];

    // 狀態碼檢查
    if (expectations.status !== undefined) {
      const statusIssues = issues.filter(i => i.category === 'status');
      customChecks.push({
        rule: 'status',
        field: 'response.status',
        success: statusIssues.length === 0,
        message: statusIssues.length > 0 ? statusIssues[0].message : '狀態碼驗證通過',
      });
    }

    // Schema 檢查
    if (expectations.schema) {
      const schemaIssues = issues.filter(i => i.category === 'schema');
      customChecks.push({
        rule: 'schema',
        field: 'response.data',
        success: schemaIssues.length === 0,
        message: schemaIssues.length > 0 ?
          `Schema 驗證失敗 (${schemaIssues.length} 個問題)` :
          'Schema 驗證通過',
      });
    }

    // 自訂規則檢查
    if (expectations.custom && expectations.custom.length > 0) {
      for (const rule of expectations.custom) {
        const ruleIssues = issues.filter(i =>
          i.category === 'custom' &&
          i.ruleName === rule.type &&
          i.field === rule.field
        );

        customChecks.push({
          rule: rule.type,
          field: rule.field,
          success: ruleIssues.length === 0,
          message: ruleIssues.length > 0 ? ruleIssues[0].message : `${rule.type} 規則驗證通過`,
        });
      }
    }

    return customChecks;
  }

  /**
   * 取得自訂驗證器參考（用於註冊額外規則）
   */
  getCustomValidator(): CustomValidator {
    return this.customValidator;
  }

  /**
   * 取得 Schema 驗證器參考（用於快取管理）
   */
  getSchemaValidator(): SchemaValidator {
    return this.schemaValidator;
  }

  /**
   * 清除所有快取
   */
  clearCaches(): void {
    this.schemaValidator.clearCache();
  }

  /**
   * 取得驗證引擎統計資訊
   */
  getStats(): {
    availableCustomRules: string[];
    schemaCacheStats: { size: number; schemas: string[] };
  } {
    return {
      availableCustomRules: this.customValidator.listRules(),
      schemaCacheStats: this.schemaValidator.getCacheStats(),
    };
  }
}