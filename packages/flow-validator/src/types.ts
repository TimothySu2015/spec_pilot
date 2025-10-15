/**
 * Flow Validator Types
 * Flow 驗證器的型別定義
 */

import type { FlowDefinition } from '@specpilot/flow-parser';
import type { OpenAPIDocument } from '@specpilot/spec-loader';

/**
 * 驗證結果
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * 驗證錯誤
 */
export interface ValidationError {
  type: 'schema' | 'semantic' | 'reference';
  message: string;
  path?: string;
  details?: unknown;
}

/**
 * 驗證警告
 */
export interface ValidationWarning {
  type: 'best_practice' | 'suggestion';
  message: string;
  path?: string;
}

/**
 * Schema 驗證選項
 */
export interface SchemaValidationOptions {
  strict?: boolean;
}

/**
 * 語意驗證選項
 */
export interface SemanticValidationOptions {
  checkOperationIds?: boolean;
  checkVariableReferences?: boolean;
  checkAuthFlow?: boolean;
}

/**
 * Flow 驗證器配置
 */
export interface FlowValidatorConfig {
  spec: OpenAPIDocument;
  schemaOptions?: SchemaValidationOptions;
  semanticOptions?: SemanticValidationOptions;
}
