/**
 * Validation Engine - 回應驗證與自訂規則
 *
 * 提供狀態碼、Schema 與自訂條件驗證功能，整合 ajv 進行 JSON Schema 驗證，
 * 支援可擴充的自訂驗證規則系統，記錄詳細的驗證結果與錯誤訊息。
 */

// 匯出主要類別
export { ValidationEngine, ValidationError } from './validation-engine.js';
export { StatusValidator } from './status-validator.js';
export { SchemaValidator } from './schema-validator.js';
export { CustomValidator } from './custom-validator.js';

// 匯出設定相關
export {
  getValidationConfig,
  getValidationFactoryConfig,
  DEFAULT_VALIDATION_CONFIG,
  type ValidationConfig,
  type ValidationFactoryConfig,
} from './config.js';

// 匯出所有類型定義
export type {
  JsonSchema,
  ValidationCategory,
  ValidationSeverity,
  ValidationIssue,
  ValidationLogEntry,
  StepResultPatch,
  ValidationOutcome,
  RunContext,
  ValidationInput,
  ValidationContext,
  ValidatorResult,
  Validator,
  CustomRuleContext,
  CustomRuleResult,
  CustomRuleHandler,
  StatusValidationOptions,
  SchemaValidationOptions,
  CustomRuleValidationOptions,
} from './types.js';

// 便利工廠函式
import { ValidationEngine } from './validation-engine.js';
// import { getValidationFactoryConfig } from './config.js'; // 暫時未使用

/**
 * 建立已設定的驗證引擎實例
 */
export function createValidationEngine(): ValidationEngine {
  // const config = getValidationFactoryConfig(); // 暫時未使用
  return new ValidationEngine();
}

/**
 * 建立具有依賴注入的驗證引擎實例
 */
export function createConfiguredValidationEngine(_dependencies?: {
  config?: unknown;
}): ValidationEngine {
  // 未來可在此處注入額外的依賴項
  return new ValidationEngine();
}