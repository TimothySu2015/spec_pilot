import { z } from 'zod';
import { GlobalAuthSchema } from './auth-schema';

/**
 * HTTP Headers Schema
 */
export const HeadersSchema = z.record(z.string());

/**
 * 重試策略設定
 */
export const RetryPolicySchema = z.object({
  maxRetries: z.number().int().min(0).max(5).optional(),
  delayMs: z.number().int().positive().optional(),
  backoffMultiplier: z.number().positive().optional(),
});

/**
 * Flow 全域設定
 */
export const GlobalsSchema = z.object({
  baseUrl: z.string().url('必須是有效的 URL').optional(),
  headers: HeadersSchema.optional(),
  auth: GlobalAuthSchema.optional(),
  retryPolicy: RetryPolicySchema.optional(),
});

export type IGlobals = z.infer<typeof GlobalsSchema>;
export type IRetryPolicy = z.infer<typeof RetryPolicySchema>;
