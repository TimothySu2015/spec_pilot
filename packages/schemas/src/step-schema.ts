import { z } from 'zod';
import { StepAuthSchema } from './auth-schema';
import { HeadersSchema, RetryPolicySchema } from './globals-schema';
import { ValidationRuleSchema } from './validation-schema';

/**
 * HTTP 方法列舉
 */
export const HTTPMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

/**
 * Request Body Schema（允許任意 JSON 結構）
 */
export const RequestBodySchema = z.any().optional();

/**
 * HTTP 請求設定 Schema
 */
export const FlowRequestSchema = z.object({
  method: HTTPMethodSchema,
  path: z.string().min(1, 'path 不可為空').optional(),
  url: z.string().url('必須是有效的 URL').optional(),
  query: z.record(z.string()).optional(),
  headers: HeadersSchema.optional(),
  body: RequestBodySchema,
}).refine(
  data => Boolean(data.path || data.url),
  { message: 'path 或 url 至少需提供一個' }
);

/**
 * Expect Body 欄位 Schema（提供表格式設定）
 */
export const ExpectBodyFieldSchema = z.object({
  fieldName: z.string().min(1, '欄位名稱不可為空'),
  expectedValue: z.string().optional(),
  validationMode: z.enum(['any', 'exact']).default('any'),
});

/**
 * 回應預期設定 Schema
 */
export const FlowExpectSchema = z.object({
  statusCode: z.number().int().min(100).max(599),
  bodyFields: z.array(ExpectBodyFieldSchema).optional(),
  body: z.any().optional(),
});

/**
 * Capture 設定 Schema
 */
export const CaptureSchema = z.object({
  variableName: z.string().min(1, '變數名稱不可為空'),
  path: z.string().min(1, 'path 不可為空'),
});

/**
 * Flow Step Schema
 */
export const FlowStepSchema = z.object({
  name: z.string().min(1, '步驟名稱不可為空'),
  description: z.string().optional(),
  request: FlowRequestSchema,
  expect: FlowExpectSchema,
  validation: z.array(ValidationRuleSchema).optional(),
  capture: z.array(CaptureSchema).optional(),
  auth: StepAuthSchema.optional(),
  retryPolicy: RetryPolicySchema.optional(),
});

export type IFlowStep = z.infer<typeof FlowStepSchema>;
export type IFlowRequest = z.infer<typeof FlowRequestSchema>;
export type IFlowExpect = z.infer<typeof FlowExpectSchema>;
export type IExpectBodyField = z.infer<typeof ExpectBodyFieldSchema>;
export type ICapture = z.infer<typeof CaptureSchema>;
export type ICaptureVariable = ICapture;
export type HTTPMethod = z.infer<typeof HTTPMethodSchema>;
