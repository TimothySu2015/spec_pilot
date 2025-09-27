import type { IStructuredLogger } from '@specpilot/shared';
import type { IHttpResponse } from '@specpilot/http-runner';
import type { IFlowStep, IFlowExpectations } from '@specpilot/flow-parser';

/**
 * JSON Schema 定義
 */
export interface IJsonSchema {
  [key: string]: unknown;
  type?: string;
  properties?: Record<string, IJsonSchema>;
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
export interface IValidationIssue {
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
export interface IValidationLogEntry {
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
export interface IStepResultPatch {
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
export interface IValidationOutcome {
  status: 'success' | 'partial' | 'failed';
  issues: IValidationIssue[];
  stepResultPatch: IStepResultPatch;
  logs: IValidationLogEntry[];
}

/**
 * 驗證執行上下文
 */
export interface IRunContext {
  executionId: string;
  flowId: string;
  timestamp: Date;
  [key: string]: unknown;
}

/**
 * 驗證輸入
 */
export interface IValidationInput {
  step: IFlowStep;
  response: IHttpResponse;
  expectations: IFlowExpectations;
  schemas: Record<string, IJsonSchema>;
  logger: IStructuredLogger;
  executionId: string;
  runContext: IRunContext;
}

/**
 * 驗證器上下文
 */
export interface IValidationContext {
  step: IFlowStep;
  response: IHttpResponse;
  expectations: IFlowExpectations;
  schemas: Record<string, IJsonSchema>;
  logger: IStructuredLogger;
  executionId: string;
  runContext: IRunContext;
}

/**
 * 驗證器結果
 */
export interface IValidatorResult {
  isValid: boolean;
  issues: IValidationIssue[];
  telemetry: {
    durationMs: number;
    details?: Record<string, unknown>;
  };
}

/**
 * 驗證器介面
 */
export interface IValidator {
  validate(ctx: IValidationContext): Promise<IValidatorResult>;
}

/**
 * 自訂規則處理器上下文
 */
export interface ICustomRuleContext {
  payload: unknown;
  ruleName: string;
  ruleOptions: Record<string, unknown>;
  schemas: Record<string, IJsonSchema>;
  field: string;
  logger: IStructuredLogger;
  executionId: string;
}

/**
 * 自訂規則處理器結果
 */
export interface ICustomRuleResult {
  isValid: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

/**
 * 自訂規則處理器
 */
export interface ICustomRuleHandler {
  (input: ICustomRuleContext): Promise<ICustomRuleResult> | ICustomRuleResult;
}

/**
 * 狀態碼驗證選項
 */
export interface IStatusValidationOptions {
  expected: number | number[] | string;
  actual: number;
}

/**
 * Schema 驗證選項
 */
export interface ISchemaValidationOptions {
  schemaName: string;
  data: unknown;
  schemas: Record<string, IJsonSchema>;
}

/**
 * 自訂規則驗證選項
 */
export interface ICustomRuleValidationOptions {
  rules: Array<{
    rule: string;
    path: string;
    options?: Record<string, unknown>;
  }>;
  data: unknown;
}