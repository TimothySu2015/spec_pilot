import type {
  Validator,
  ValidationContext,
  ValidatorResult,
  ValidationIssue
} from './types.js';

/**
 * 狀態碼驗證器
 */
export class StatusValidator implements Validator {
  async validate(ctx: ValidationContext): Promise<ValidatorResult> {
    const startTime = Date.now();
    const { response, expectations, logger, executionId, step } = ctx;

    logger.debug('VALIDATION_START', {
      executionId,
      component: 'validation-engine',
      stepName: step.name,
      validator: 'status',
      expectedStatus: expectations.status,
      actualStatus: response.status,
    });

    const issues: ValidationIssue[] = [];
    let isValid = true;

    if (expectations.status !== undefined) {
      isValid = this.validateStatus(expectations.status, response.status);

      if (!isValid) {
        issues.push({
          category: 'status',
          severity: 'error',
          message: `狀態碼驗證失敗：期望 ${expectations.status}，實際收到 ${response.status}`,
          expected: expectations.status,
          actual: response.status,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    const status = isValid ? 'success' : 'failure';

    logger.info(isValid ? 'VALIDATION_SUCCESS' : 'VALIDATION_FAILURE', {
      executionId,
      component: 'validation-engine',
      stepName: step.name,
      validator: 'status',
      status,
      message: isValid ? '狀態碼驗證通過' : `狀態碼驗證失敗：期望 ${expectations.status}，實際收到 ${response.status}`,
      durationMs,
    });

    return {
      isValid,
      issues,
      telemetry: {
        durationMs,
        details: {
          expectedStatus: expectations.status,
          actualStatus: response.status,
        },
      },
    };
  }

  /**
   * 驗證狀態碼
   */
  private validateStatus(expected: number | number[] | string, actual: number): boolean {
    // 處理單一狀態碼
    if (typeof expected === 'number') {
      return actual === expected;
    }

    // 處理狀態碼陣列
    if (Array.isArray(expected)) {
      return expected.includes(actual);
    }

    // 處理範圍表示法（如 2xx, 3xx）
    if (typeof expected === 'string') {
      return this.validateStatusRange(expected, actual);
    }

    return false;
  }

  /**
   * 驗證狀態碼範圍
   */
  private validateStatusRange(range: string, actual: number): boolean {
    // 支援 2xx, 3xx, 4xx, 5xx 格式
    const match = range.match(/^([1-5])xx$/i);
    if (match) {
      const prefix = parseInt(match[1], 10);
      return Math.floor(actual / 100) === prefix;
    }

    // 支援具體範圍如 200-299
    const rangeMatch = range.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const min = parseInt(rangeMatch[1], 10);
      const max = parseInt(rangeMatch[2], 10);
      return actual >= min && actual <= max;
    }

    // 如果是純數字字串，轉為數字比對
    const numericValue = parseInt(range, 10);
    if (!isNaN(numericValue)) {
      return actual === numericValue;
    }

    return false;
  }
}