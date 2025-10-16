import type { StructuredLogger } from '@specpilot/shared';
import type { HttpResponse } from '@specpilot/http-runner';
import type { FlowStep, FlowExpectations } from '@specpilot/flow-parser';

/**
 * JSON Schema 定義
 */
export interface JsonSchema {
  [key: string]: unknown;
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
}

/**
 * 驗證問題類別
 */
export type ValidationCategory = 'status' | 'schema' | 'custom';

/**
 * 驗證問題嚴重程度
 */
export type ValidationSeverity = 'error' | 'warning';

/**
 * 驗證問題
 */
export interface ValidationIssue {
  category: ValidationCategory;
  severity: ValidationSeverity;
  message: string;
  field?: string;
  expected?: unknown;
  actual?: unknown;
  ruleName?: string;
}

/**
 * 驗證日誌項目
 */
export interface ValidationLogEntry {
  executionId: string;
  component: string;
  stepName: string;
  validator: string;
  rule?: string;
  status: 'success' | 'failure';
  message: string;
  durationMs: number;
  details?: Record<string, unknown>;
}

/**
 * 步驟結果修補
 */
export interface StepResultPatch {
  success?: boolean;
  customChecks?: Array<{
    rule: string;
    field: string;
    success: boolean;
    message?: string;
  }>;
}

/**
 * 驗證結果
 */
export interface ValidationOutcome {
  status: 'success' | 'partial' | 'failed';
  issues: ValidationIssue[];
  stepResultPatch: StepResultPatch;
  logs: ValidationLogEntry[];
}

/**
 * 驗證執行上下文
 */
export interface RunContext {
  executionId: string;
  flowId: string;
  timestamp: Date;
  [key: string]: unknown;
}

/**
 * 驗證輸入
 */
export interface ValidationInput {
  step: FlowStep;
  response: HttpResponse;
  expectations: FlowExpectations;
  schemas: Record<string, JsonSchema>;
  logger: StructuredLogger;
  executionId: string;
  runContext: RunContext;
}

/**
 * 驗證器上下文
 */
export interface ValidationContext {
  step: FlowStep;
  response: HttpResponse;
  expectations: FlowExpectations;
  schemas: Record<string, JsonSchema>;
  logger: StructuredLogger;
  executionId: string;
  runContext: RunContext;
}

/**
 * 驗證器結果
 */
export interface ValidatorResult {
  isValid: boolean;
  issues: ValidationIssue[];
  telemetry: {
    durationMs: number;
    details?: Record<string, unknown>;
  };
}

/**
 * 驗證器介面
 */
export interface Validator {
  validate(ctx: ValidationContext): Promise<ValidatorResult>;
}

/**
 * 自訂規則處理器上下文
 */
export interface CustomRuleContext {
  payload: unknown;
  ruleName: string;
  ruleOptions: Record<string, unknown>;
  schemas: Record<string, JsonSchema>;
  field: string;
  logger: StructuredLogger;
  executionId: string;
}

/**
 * 自訂規則處理器結果
 */
export interface CustomRuleResult {
  isValid: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * 自訂規則處理器
 */
export interface CustomRuleHandler {
  (input: CustomRuleContext): Promise<CustomRuleResult> | CustomRuleResult;
}

/**
 * 狀態碼驗證選項
 */
export interface StatusValidationOptions {
  expected: number | number[] | string;
  actual: number;
}

/**
 * Schema 驗證選項
 */
export interface SchemaValidationOptions {
  schemaName: string;
  data: unknown;
  schemas: Record<string, JsonSchema>;
}

/**
 * 自訂規則驗證選項
 */
export interface CustomRuleValidationOptions {
  rules: Array<{
    rule: string;
    path: string;
    options?: Record<string, unknown>;
  }>;
  data: unknown;
}