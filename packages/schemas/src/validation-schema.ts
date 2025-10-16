import { z } from 'zod';

/**
 * 驗證規則基礎 Schema
 */
const ValidationRuleBaseSchema = z.object({
  path: z.string().min(1, 'path 不可為空'),
});

/**
 * notNull 規則 - 檢查值是否不為 null/undefined
 */
export const NotNullRuleSchema = ValidationRuleBaseSchema.extend({
  rule: z.literal('notNull'),
});

/**
 * regex 規則 - 使用正則表達式驗證
 */
export const RegexRuleSchema = ValidationRuleBaseSchema.extend({
  rule: z.literal('regex'),
  value: z.string().min(1, '正則表達式不可為空'),
});

/**
 * contains 規則 - 檢查是否包含特定值
 */
export const ContainsRuleSchema = ValidationRuleBaseSchema.extend({
  rule: z.literal('contains'),
  value: z.union([z.string(), z.number()]),
});

/**
 * 驗證規則聯合型別 (使用 discriminatedUnion 提供更好的型別推斷)
 */
export const ValidationRuleSchema = z.discriminatedUnion('rule', [
  NotNullRuleSchema,
  RegexRuleSchema,
  ContainsRuleSchema,
]);

export type ValidationRule = z.infer<typeof ValidationRuleSchema>;
export type NotNullRule = z.infer<typeof NotNullRuleSchema>;
export type RegexRule = z.infer<typeof RegexRuleSchema>;
export type ContainsRule = z.infer<typeof ContainsRuleSchema>;
