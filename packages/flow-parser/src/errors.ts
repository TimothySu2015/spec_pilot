/**
 * Flow Parser 錯誤類別定義
 */

import { BaseError } from '@specpilot/shared';

/**
 * Flow 解析錯誤 - 當 YAML 格式有問題時使用
 */
export class FlowParseError extends BaseError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    hint?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 1503, details, hint, context);
  }

  /**
   * 建立檔案不存在錯誤
   */
  static fileNotFound(filePath: string, executionId?: string): FlowParseError {
    return new FlowParseError(
      `Flow 檔案不存在: ${filePath}`,
      { filePath },
      '請檢查檔案路徑是否正確，或使用 content 參數直接傳入內容',
      { executionId, component: 'flow-parser' }
    );
  }

  /**
   * 建立 YAML 格式錯誤
   */
  static yamlFormatError(originalError: Error, executionId?: string): FlowParseError {
    return new FlowParseError(
      `YAML 格式錯誤: ${originalError.message}`,
      { originalError: originalError.message },
      '請檢查 YAML 檔案語法，注意縮排和特殊字元',
      { executionId, component: 'flow-parser' }
    );
  }

  /**
   * 建立空內容錯誤
   */
  static emptyContent(executionId?: string): FlowParseError {
    return new FlowParseError(
      'Flow 內容為空',
      {},
      '請確保檔案包含有效的 Flow 定義',
      { executionId, component: 'flow-parser' }
    );
  }
}

/**
 * Flow 驗證錯誤 - 當欄位驗證失敗時使用
 */
export class FlowValidationError extends BaseError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    hint?: string,
    context?: Record<string, unknown>
  ) {
    super(message, 1503, details, hint, context);
  }

  /**
   * 建立缺少必要欄位錯誤
   */
  static missingRequiredField(fieldPath: string, executionId?: string): FlowValidationError {
    return new FlowValidationError(
      `缺少必要欄位: ${fieldPath}`,
      { fieldPath },
      `請在 Flow 定義中加入 ${fieldPath} 欄位`,
      { executionId, component: 'flow-parser' }
    );
  }

  /**
   * 建立無效 HTTP 方法錯誤
   */
  static invalidHttpMethod(method: string, stepName?: string, executionId?: string): FlowValidationError {
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
    return new FlowValidationError(
      `無效的 HTTP 方法: ${method}${stepName ? ` (步驟: ${stepName})` : ''}`,
      { method, stepName, validMethods },
      `請使用有效的 HTTP 方法: ${validMethods.join(', ')}`,
      { executionId, component: 'flow-parser' }
    );
  }

  /**
   * 建立無效期望設定錯誤
   */
  static invalidExpectation(reason: string, stepName?: string, executionId?: string): FlowValidationError {
    return new FlowValidationError(
      `無效的期望設定: ${reason}${stepName ? ` (步驟: ${stepName})` : ''}`,
      { reason, stepName },
      '請檢查期望設定的格式和內容',
      { executionId, component: 'flow-parser' }
    );
  }

  /**
   * 建立步驟列表為空錯誤
   */
  static emptySteps(executionId?: string): FlowValidationError {
    return new FlowValidationError(
      'Flow 必須包含至少一個步驟',
      {},
      '請在 steps 陣列中定義至少一個步驟',
      { executionId, component: 'flow-parser' }
    );
  }
}