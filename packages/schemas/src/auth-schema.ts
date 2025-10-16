import { z } from 'zod';

/**
 * Token 擷取設定
 */
export const TokenExtractionSchema = z.object({
  path: z.string().min(1, 'Token 擷取路徑不可為空'),
  expiresIn: z.number().int().positive().optional(),
  namespace: z.string().optional(),
});

/**
 * 登入型態認證
 */
export const LoginAuthSchema = z.object({
  type: z.literal('login'),
  tokenExtraction: TokenExtractionSchema,
});

/**
 * 靜態認證條目
 */
export const StaticAuthItemSchema = z.object({
  namespace: z.string().min(1, 'Namespace 不可為空'),
  token: z.string().min(1, 'Token 不可為空'),
  expiresInSeconds: z.number().int().positive().optional(),
});

/**
 * Bearer Token 認證
 */
export const BearerAuthSchema = z.object({
  type: z.literal('bearer'),
  token: z.string().min(1, 'Token 不可為空'),
});

/**
 * Step 層級認證（目前僅支援 login 流程）
 */
export const StepAuthSchema = LoginAuthSchema;

/**
 * 全域認證設定（Bearer 或靜態 Token 列表）
 */
export const GlobalAuthSchema = z.union([
  BearerAuthSchema,
  z.object({
    static: z.array(StaticAuthItemSchema),
  }),
]);

export type TokenExtraction = z.infer<typeof TokenExtractionSchema>;
export type StepAuth = z.infer<typeof StepAuthSchema>;
export type GlobalAuth = z.infer<typeof GlobalAuthSchema>;
export type StaticAuthItem = z.infer<typeof StaticAuthItemSchema>;
