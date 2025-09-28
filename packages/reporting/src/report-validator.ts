import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { createStructuredLogger } from '@specpilot/shared';
import { ExecutionReport } from './execution-report.js';
import executionReportSchema from './schemas/execution-report.schema.json' with { type: 'json' };

const logger = createStructuredLogger('report-validator');

/**
 * 驗證錯誤詳情
 */
export interface IValidationError {
  path: string;
  message: string;
  value: unknown;
}

/**
 * 驗證結果
 */
export interface IValidationResult {
  valid: boolean;
  errors: IValidationError[];
}

/**
 * 報表驗證器類別
 */
export class ReportValidator {
  private ajv: Ajv;
  private validateExecutionReport: ValidateFunction;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
    });

    // 加入格式驗證器（date-time, uri 等）
    addFormats(this.ajv);

    // 編譯 ExecutionReport 的 schema
    this.validateExecutionReport = this.ajv.compile(executionReportSchema);

    logger.info('報表驗證器初始化完成', {
      schemaId: executionReportSchema.$id,
    });
  }

  /**
   * 驗證執行報表
   */
  validateReport(report: unknown): ValidationResult {
    logger.debug('開始驗證執行報表', {
      reportType: typeof report,
    });

    const valid = this.validateExecutionReport(report);
    const errors: ValidationError[] = [];

    if (!valid && this.validateExecutionReport.errors) {
      for (const error of this.validateExecutionReport.errors) {
        errors.push({
          path: error.instancePath || error.schemaPath,
          message: error.message || '驗證失敗',
          value: error.data,
        });
      }
    }

    const result: ValidationResult = {
      valid,
      errors,
    };

    if (!valid) {
      logger.warn('執行報表驗證失敗', {
        errorCount: errors.length,
        errors: errors.slice(0, 5), // 只記錄前 5 個錯誤
      });
    } else {
      logger.debug('執行報表驗證成功');
    }

    return result;
  }

  /**
   * 驗證並型別斷言執行報表
   */
  validateAndAssertReport(report: unknown): ExecutionReport {
    const result = this.validateReport(report);

    if (!result.valid) {
      const errorMessages = result.errors.map(e => `${e.path}: ${e.message}`);
      const errorMessage = `報表格式驗證失敗：\n${errorMessages.join('\n')}`;

      logger.error('報表驗證失敗，無法繼續處理', {
        errors: result.errors,
      });

      throw new Error(errorMessage);
    }

    return report as ExecutionReport;
  }

  /**
   * 取得 JSON Schema
   */
  getExecutionReportSchema(): object {
    return executionReportSchema;
  }

  /**
   * 驗證步驟結果格式
   */
  validateStepResult(stepResult: unknown): ValidationResult {
    const stepSchema = executionReportSchema.definitions?.StepResult;

    if (!stepSchema) {
      logger.error('找不到 StepResult 的 schema 定義');
      return {
        valid: false,
        errors: [{
          path: '',
          message: '找不到 StepResult 的 schema 定義',
          value: stepResult,
        }],
      };
    }

    const validateStep = this.ajv.compile(stepSchema);
    const valid = validateStep(stepResult);
    const errors: ValidationError[] = [];

    if (!valid && validateStep.errors) {
      for (const error of validateStep.errors) {
        errors.push({
          path: error.instancePath || error.schemaPath,
          message: error.message || '驗證失敗',
          value: error.data,
        });
      }
    }

    return { valid, errors };
  }
}