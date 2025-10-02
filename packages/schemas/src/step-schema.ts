import { z } from 'zod';
import { HTTPMethodSchema } from './flow-schema';
import { ValidationRuleSchema } from './validation-schema';

/**
 * HTTP Headers Schema (支援變數插值)
 */
export const HeadersSchema = z.record(z.string());

/**
 * Request Body Schema (支援任意 JSON 結構)
 */
export const RequestBodySchema = z.any().optional();

/**
 * HTTP 請求定義 Schema
 */
export const FlowRequestSchema = z.object({
  method: HTTPMethodSchema,
  path: z.string().min(1, 'path 不可為空'),
  headers: HeadersSchema.optional(),
  body: RequestBodySchema,
});

/**
 * Expect Body 欄位 Schema (用於 Table 模式)
 */
export const ExpectBodyFieldSchema = z.object({
  fieldName: z.string().min(1, '欄位名稱不可為空'),
  expectedValue: z.string().optional(), // 空字串表示「存在即可」
  validationMode: z.enum(['any', 'exact']).default('any'),
});

/**
 * 預期回應定義 Schema
 */
export const FlowExpectSchema = z.object({
  statusCode: z.number().int().min(100).max(599),
  bodyFields: z.array(ExpectBodyFieldSchema).optional(),
  body: z.any().optional(), // 保留原始 JSON 驗證方式 (進階用途)
});

/**
 * 變數擷取定義 Schema
 */
export const CaptureSchema = z.object({
  variableName: z.string().min(1, '變數名稱不可為空'),
  path: z.string().min(1, 'path 不可為空'),
});

/**
 * 測試步驟定義 Schema
 */
export const FlowStepSchema = z.object({
  name: z.string().min(1, '步驟名稱不可為空'),
  description: z.string().optional(),
  request: FlowRequestSchema,
  expect: FlowExpectSchema,
  validation: z.array(ValidationRuleSchema).optional(),
  capture: z.array(CaptureSchema).optional(),
});

export type IFlowStep = z.infer<typeof FlowStepSchema>;
export type IFlowRequest = z.infer<typeof FlowRequestSchema>;
export type IFlowExpect = z.infer<typeof FlowExpectSchema>;
export type IExpectBodyField = z.infer<typeof ExpectBodyFieldSchema>;
export type ICapture = z.infer<typeof CaptureSchema>;
