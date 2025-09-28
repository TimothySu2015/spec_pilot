import { ReportValidator } from '@specpilot/reporting';
import { LogValidator } from './log-validator.js';
import { createStructuredLogger } from './logger.js';
import type { StructuredLogEntry } from './structured-log-types.js';
import type { ExecutionReport } from '@specpilot/reporting';

const logger = createStructuredLogger('schema-validator');

/**
 * 統一的 Schema 驗證器
 */
export class SchemaValidator {
  private reportValidator: ReportValidator;
  private logValidator: LogValidator;

  constructor() {
    this.reportValidator = new ReportValidator();
    this.logValidator = new LogValidator();

    logger.info('統一 Schema 驗證器初始化完成');
  }

  /**
   * 驗證執行報表
   */
  validateExecutionReport(report: unknown): ExecutionReport {
    logger.debug('驗證執行報表');
    return this.reportValidator.validateAndAssertReport(report);
  }

  /**
   * 驗證結構化日誌項目
   */
  validateStructuredLogEntry(logEntry: unknown): StructuredLogEntry {
    logger.debug('驗證結構化日誌項目');
    return this.logValidator.validateAndAssertLogEntry(logEntry);
  }

  /**
   * 批次驗證多個日誌項目
   */
  validateLogEntries(logEntries: unknown[]): unknown[] {
    logger.debug('批次驗證日誌項目', { count: logEntries.length });
    return this.logValidator.validateLogEntries(logEntries);
  }

  /**
   * 驗證 JSON Lines 格式的日誌檔案
   */
  validateJsonLinesLog(jsonLinesContent: string): {
    validEntries: StructuredLogEntry[];
    invalidLines: Array<{
      lineNumber: number;
      content: string;
      error: string;
    }>;
  } {
    const lines = jsonLinesContent.split('\n').filter(line => line.trim());
    const validEntries: StructuredLogEntry[] = [];
    const invalidLines: Array<{
      lineNumber: number;
      content: string;
      error: string;
    }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      try {
        const parsed = JSON.parse(line);
        const result = this.logValidator.validateLogEntry(parsed);

        if (result.valid) {
          validEntries.push(parsed as StructuredLogEntry);
        } else {
          const errorMessages = result.errors.map(e => `${e.path}: ${e.message}`);
          invalidLines.push({
            lineNumber,
            content: line,
            error: errorMessages.join('; '),
          });
        }
      } catch (parseError) {
        invalidLines.push({
          lineNumber,
          content: line,
          error: `JSON 解析失敗: ${parseError instanceof Error ? parseError.message : '未知錯誤'}`,
        });
      }
    }

    logger.info('JSON Lines 日誌驗證完成', {
      totalLines: lines.length,
      validCount: validEntries.length,
      invalidCount: invalidLines.length,
    });

    return {
      validEntries,
      invalidLines,
    };
  }

  /**
   * 取得所有 Schema
   */
  getAllSchemas(): {
    executionReport: object;
    structuredLog: object;
  } {
    return {
      executionReport: this.reportValidator.getExecutionReportSchema(),
      structuredLog: this.logValidator.getStructuredLogSchema(),
    };
  }

  /**
   * 驗證完整的報表檔案（包含格式檢查）
   */
  validateReportFile(reportContent: string): ExecutionReport {
    logger.debug('驗證報表檔案');

    try {
      const parsed = JSON.parse(reportContent);
      return this.validateExecutionReport(parsed);
    } catch (parseError) {
      const errorMessage = `報表檔案 JSON 解析失敗: ${parseError instanceof Error ? parseError.message : '未知錯誤'}`;
      logger.error('報表檔案格式錯誤', { error: errorMessage });
      throw new Error(errorMessage);
    }
  }

  /**
   * 產生驗證報告
   */
  generateValidationReport(
    reportValidation: { valid: boolean; errors?: unknown[] },
    logValidation: { validCount: number; invalidCount: number; errors?: unknown[] }
  ): {
    summary: {
      reportValid: boolean;
      logEntriesValid: number;
      logEntriesInvalid: number;
      overallValid: boolean;
    };
    details: {
      reportErrors: unknown[];
      logErrors: unknown[];
    };
  } {
    const overallValid = reportValidation.valid && logValidation.invalidCount === 0;

    const validationReport = {
      summary: {
        reportValid: reportValidation.valid,
        logEntriesValid: logValidation.validCount,
        logEntriesInvalid: logValidation.invalidCount,
        overallValid,
      },
      details: {
        reportErrors: reportValidation.errors || [],
        logErrors: logValidation.errors || [],
      },
    };

    logger.info('產生驗證報告', {
      overallValid,
      reportValid: reportValidation.valid,
      logEntriesValid: logValidation.validCount,
      logEntriesInvalid: logValidation.invalidCount,
    });

    return validationReport;
  }
}