import type {
  Validator,
  ValidationContext,
  ValidatorResult,
  ValidationIssue
} from './types.js';

/**
 * Body 深度比對驗證器
 *
 * 驗證實際回應的 body 是否符合預期的 JSON 結構
 * 使用深度比對策略：預期值必須完全包含在實際值中
 */
export class BodyValidator implements Validator {
  async validate(ctx: ValidationContext): Promise<ValidatorResult> {
    const startTime = Date.now();
    const { response, expectations, logger, executionId, step } = ctx;

    logger.debug('VALIDATION_START', {
      executionId,
      component: 'validation-engine',
      stepName: step.name,
      validator: 'body',
      hasExpectedBody: expectations.body !== undefined,
    });

    const issues: ValidationIssue[] = [];
    let isValid = true;

    if (expectations.body !== undefined) {
      try {
        const actualBody = response.data;
        const expectedBody = expectations.body;

        const comparisonResult = this.deepCompare(
          expectedBody,
          actualBody,
          'response.data'
        );

        if (!comparisonResult.isMatch) {
          isValid = false;
          issues.push(...comparisonResult.issues);
        }

        logger.debug('BODY_VALIDATION_COMPLETE', {
          executionId,
          component: 'validation-engine',
          stepName: step.name,
          isMatch: comparisonResult.isMatch,
          issueCount: comparisonResult.issues.length,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知錯誤';
        issues.push({
          category: 'custom',
          severity: 'error',
          message: `Body 驗證執行失敗：${errorMessage}`,
          ruleName: 'body-validation-error',
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
      validator: 'body',
      status,
      message: isValid ? 'Body 深度比對驗證通過' : 'Body 深度比對驗證失敗',
      durationMs,
    });

    return {
      isValid,
      issues,
      telemetry: {
        durationMs,
        details: {
          hasExpectedBody: expectations.body !== undefined,
          issueCount: issues.length,
        },
      },
    };
  }

  /**
   * 深度比對兩個值
   *
   * 策略：
   * - 預期值中的所有欄位都必須存在於實際值中
   * - 實際值可以有額外的欄位（部分比對）
   * - 巢狀物件遞迴驗證
   * - 陣列必須長度相同且元素一一對應
   */
  private deepCompare(
    expected: unknown,
    actual: unknown,
    path: string
  ): {
    isMatch: boolean;
    issues: ValidationIssue[];
  } {
    const issues: ValidationIssue[] = [];

    // 1. 型別檢查
    const expectedType = this.getType(expected);
    const actualType = this.getType(actual);

    if (expectedType !== actualType) {
      issues.push({
        category: 'custom',
        severity: 'error',
        message: `${path} 型別不符：預期 ${expectedType}，實際 ${actualType}`,
        field: path,
        expected: expectedType,
        actual: actualType,
        ruleName: 'body-type-mismatch',
      });
      return { isMatch: false, issues };
    }

    // 2. null 或 undefined 比對
    if (expected === null || expected === undefined) {
      if (expected !== actual) {
        issues.push({
          category: 'custom',
          severity: 'error',
          message: `${path} 值不符：預期 ${expected}，實際 ${actual}`,
          field: path,
          expected,
          actual,
          ruleName: 'body-value-mismatch',
        });
        return { isMatch: false, issues };
      }
      return { isMatch: true, issues: [] };
    }

    // 3. 基本型別比對（string, number, boolean）
    if (expectedType === 'string' || expectedType === 'number' || expectedType === 'boolean') {
      if (expected !== actual) {
        issues.push({
          category: 'custom',
          severity: 'error',
          message: `${path} 值不符：預期 ${JSON.stringify(expected)}，實際 ${JSON.stringify(actual)}`,
          field: path,
          expected,
          actual,
          ruleName: 'body-value-mismatch',
        });
        return { isMatch: false, issues };
      }
      return { isMatch: true, issues: [] };
    }

    // 4. 陣列比對
    if (expectedType === 'array') {
      const expectedArray = expected as unknown[];
      const actualArray = actual as unknown[];

      if (expectedArray.length !== actualArray.length) {
        issues.push({
          category: 'custom',
          severity: 'error',
          message: `${path} 陣列長度不符：預期 ${expectedArray.length} 個元素，實際 ${actualArray.length} 個元素`,
          field: path,
          expected: expectedArray.length,
          actual: actualArray.length,
          ruleName: 'body-array-length-mismatch',
        });
        return { isMatch: false, issues };
      }

      // 逐一比對陣列元素
      for (let i = 0; i < expectedArray.length; i++) {
        const elementResult = this.deepCompare(
          expectedArray[i],
          actualArray[i],
          `${path}[${i}]`
        );
        issues.push(...elementResult.issues);
      }

      return { isMatch: issues.length === 0, issues };
    }

    // 5. 物件比對
    if (expectedType === 'object') {
      const expectedObj = expected as Record<string, unknown>;
      const actualObj = actual as Record<string, unknown>;

      // 檢查預期物件的所有欄位
      for (const key of Object.keys(expectedObj)) {
        const newPath = `${path}.${key}`;

        // 檢查欄位是否存在
        if (!(key in actualObj)) {
          issues.push({
            category: 'custom',
            severity: 'error',
            message: `${newPath} 欄位不存在：預期存在，實際缺少`,
            field: newPath,
            expected: expectedObj[key],
            actual: undefined,
            ruleName: 'body-field-missing',
          });
          continue;
        }

        // 遞迴比對欄位值
        const fieldResult = this.deepCompare(
          expectedObj[key],
          actualObj[key],
          newPath
        );
        issues.push(...fieldResult.issues);
      }

      return { isMatch: issues.length === 0, issues };
    }

    // 6. 其他型別（Date, RegExp 等）使用 JSON 序列化比對
    try {
      const expectedJson = JSON.stringify(expected);
      const actualJson = JSON.stringify(actual);

      if (expectedJson !== actualJson) {
        issues.push({
          category: 'custom',
          severity: 'error',
          message: `${path} 值不符：預期 ${expectedJson}，實際 ${actualJson}`,
          field: path,
          expected,
          actual,
          ruleName: 'body-value-mismatch',
        });
        return { isMatch: false, issues };
      }
      return { isMatch: true, issues: [] };
    } catch {
      // JSON 序列化失敗，視為不匹配
      issues.push({
        category: 'custom',
        severity: 'error',
        message: `${path} 無法進行 JSON 序列化比對`,
        field: path,
        expected,
        actual,
        ruleName: 'body-serialization-error',
      });
      return { isMatch: false, issues };
    }
  }

  /**
   * 取得值的精確型別
   */
  private getType(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }
}
