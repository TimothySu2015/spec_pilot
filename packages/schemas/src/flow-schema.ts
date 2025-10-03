import { z } from 'zod';
import { FlowStepSchema, HTTPMethodSchema, type HTTPMethod } from './step-schema';
import { GlobalsSchema } from './globals-schema';

/**
 * 變數定義 Schema（允許字串/數字/布林值）
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
 * 報告設定 Schema
 */
export const ReportingOptionsSchema = z.object({
  outputPath: z.string().optional(),
  format: z.enum(['json', 'html', 'markdown']).optional(),
  verbose: z.boolean().optional(),
}).optional();

/**
 * Flow 定義 Schema
 */
export const FlowDefinitionSchema = z.object({
  $schema: z.string().optional(),
  name: z.string().min(1, '名稱不可為空'),
  description: z.string().optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, '版本格式需符合 semver').optional(),
  baseUrl: z.string().url('必須是有效的 URL')
    .or(z.string().regex(/^\{\{[^}]+\}\}$/, '必須是有效的 URL 或變數'))
    .optional(),
  variables: VariablesSchema.optional(),
  options: FlowOptionsSchema,
  reporting: ReportingOptionsSchema,
  globals: GlobalsSchema.optional(),
  steps: z.array(FlowStepSchema).min(1, '至少需要一個流程步驟'),
});

export type IFlowDefinition = z.infer<typeof FlowDefinitionSchema>;
export type { HTTPMethod };
export { HTTPMethodSchema };
