import { z } from 'zod';

/**
 * HTTP 方法列舉
 */
export const HTTPMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

/**
 * 變數定義 Schema (支援字串、數字、布林值)
 */
export const VariablesSchema = z.record(z.union([z.string(), z.number(), z.boolean()]));

/**
 * Flow 選項 Schema
 */
export const FlowOptionsSchema = z.object({
  timeout: z.number().int().positive().optional(),
  retryCount: z.number().int().min(0).max(5).optional(),
  failFast: z.boolean().optional(),
}).optional();

/**
 * 報表選項 Schema
 */
export const ReportingOptionsSchema = z.object({
  outputPath: z.string().optional(),
  format: z.enum(['json', 'html', 'markdown']).optional(),
  verbose: z.boolean().optional(),
}).optional();

/**
 * Flow 定義 Schema
 * 注意: steps 欄位需要匯入 FlowStepSchema
 */
export const FlowDefinitionSchema = z.object({
  $schema: z.string().optional(),
  name: z.string().min(1, '名稱不可為空'),
  description: z.string().optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, '版本號必須符合 semver 格式').optional(),
  baseUrl: z.string().url('必須是有效的 URL').or(z.string().regex(/^{{[^}]+}}$/, '必須是有效的 URL 或變數')),
  variables: VariablesSchema.optional(),
  options: FlowOptionsSchema,
  reporting: ReportingOptionsSchema,
  steps: z.array(z.any()).min(1, '至少需要一個測試步驟'),
});

export type IFlowDefinition = z.infer<typeof FlowDefinitionSchema>;
export type HTTPMethod = z.infer<typeof HTTPMethodSchema>;
