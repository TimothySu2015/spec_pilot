import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { createStructuredLogger } from './logger.js';
import type { StructuredLogEntry } from './structured-log-types.js';
import structuredLogSchema from './schemas/structured-log.schema.json' with { type: 'json' };

const logger = createStructuredLogger('log-validator');

/**
 * 驗證錯誤詳情
 */
export interface LogValidationError {
  path: string;
  message: string;
  value: unknown;
}

/**
 * 驗證結果
 */
export interface LogValidationResult {
  valid: boolean;
  errors: LogValidationError[];
}

/**
 * 日誌驗證器類別
 */
export class LogValidator {
  private ajv: Ajv;
  private validateStructuredLog: ValidateFunction;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
    });

    // 加入格式驗證器（date-time, uri 等）
    addFormats(this.ajv);

    // 編譯 StructuredLogEntry 的 schema
    this.validateStructuredLog = this.ajv.compile(structuredLogSchema);

    logger.info('日誌驗證器初始化完成', {
      schemaId: structuredLogSchema.$id,
    });
  }

  /**
   * 驗證結構化日誌項目
   */
  validateLogEntry(logEntry: unknown): LogValidationResult {
    logger.debug('開始驗證日誌項目', {
      logEntryType: typeof logEntry,
    });

    const valid = this.validateStructuredLog(logEntry);
    const errors: LogValidationError[] = [];

    if (!valid && this.validateStructuredLog.errors) {
      for (const error of this.validateStructuredLog.errors) {
        errors.push({
          path: error.instancePath || error.schemaPath,
          message: error.message || '驗證失敗',
          value: error.data,
        });
      }
    }

    const result: LogValidationResult = {
      valid,
      errors,
    };

    if (!valid) {
      logger.warn('日誌項目驗證失敗', {
        errorCount: errors.length,
        errors: errors.slice(0, 3), // 只記錄前 3 個錯誤
      });
    } else {
      logger.debug('日誌項目驗證成功');
    }

    return result;
  }

  /**
   * 驗證並型別斷言日誌項目
   */
  validateAndAssertLogEntry(logEntry: unknown): StructuredLogEntry {
    const result = this.validateLogEntry(logEntry);

    if (!result.valid) {
      const errorMessages = result.errors.map(e => `${e.path}: ${e.message}`);
      const errorMessage = `日誌格式驗證失敗：\n${errorMessages.join('\n')}`;

      logger.error('日誌驗證失敗，無法繼續處理', {
        errors: result.errors,
      });

      throw new Error(errorMessage);
    }

    return logEntry as StructuredLogEntry;
  }

  /**
   * 批次驗證多個日誌項目
   */
  validateLogEntries(logEntries: unknown[]): {
    validEntries: StructuredLogEntry[];
    invalidEntries: Array<{
      index: number;
      entry: unknown;
      errors: LogValidationError[];
    }>;
  } {
    const validEntries: StructuredLogEntry[] = [];
    const invalidEntries: Array<{
      index: number;
      entry: unknown;
      errors: LogValidationError[];
    }> = [];

    for (let i = 0; i < logEntries.length; i++) {
      const entry = logEntries[i];
      const result = this.validateLogEntry(entry);

      if (result.valid) {
        validEntries.push(entry as StructuredLogEntry);
      } else {
        invalidEntries.push({
          index: i,
          entry,
          errors: result.errors,
        });
      }
    }

    logger.info('批次日誌驗證完成', {
      totalEntries: logEntries.length,
      validCount: validEntries.length,
      invalidCount: invalidEntries.length,
    });

    return {
      validEntries,
      invalidEntries,
    };
  }

  /**
   * 取得 JSON Schema
   */
  getStructuredLogSchema(): object {
    return structuredLogSchema;
  }

  /**
   * 驗證事件代碼是否有效
   */
  validateEventCode(eventCode: string, validEventCodes: readonly string[]): boolean {
    const isValid = validEventCodes.includes(eventCode);

    if (!isValid) {
      logger.warn('無效的事件代碼', {
        eventCode,
        validCodes: validEventCodes,
      });
    }

    return isValid;
  }

  /**
   * 驗證日誌級別是否有效
   */
  validateLogLevel(level: string): level is 'debug' | 'info' | 'warn' | 'error' {
    const validLevels = ['debug', 'info', 'warn', 'error'] as const;
    const isValid = validLevels.includes(level as any);

    if (!isValid) {
      logger.warn('無效的日誌級別', {
        level,
        validLevels,
      });
    }

    return isValid;
  }
}