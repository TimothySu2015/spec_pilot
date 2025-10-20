import { z } from 'zod';

/**
 * 自訂驗證規則基礎 Schema
 * 定義所有自訂規則的共同屬性
 */
const CustomRuleBaseSchema = z.object({
  field: z.string().min(1, 'field 不可為空'),
  message: z.string().optional(),
});

/**
 * notNull 規則 - 檢查值是否不為 null/undefined
 */
export const NotNullRuleSchema = CustomRuleBaseSchema.extend({
  rule: z.literal('notNull'),
});

/**
 * regex 規則 - 使用正則表達式驗證
 */
export const RegexRuleSchema = CustomRuleBaseSchema.extend({
  rule: z.literal('regex'),
  value: z.string().min(1, '正則表達式不可為空'),
});

/**
 * contains 規則 - 檢查字串/陣列是否包含特定值
 */
export const ContainsRuleSchema = CustomRuleBaseSchema.extend({
  rule: z.literal('contains'),
  value: z.union([z.string(), z.number(), z.any()]),
});

/**
 * equals 規則 - 檢查值是否等於預期值
 * 用於精確值比對，支援字串、數字、布林值、null
 */
export const EqualsRuleSchema = CustomRuleBaseSchema.extend({
  rule: z.literal('equals'),
  expected: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

/**
 * notContains 規則 - 檢查陣列不包含特定物件
 * 支援物件屬性比對，用於驗證刪除操作後資料不存在
 */
export const NotContainsRuleSchema = CustomRuleBaseSchema.extend({
  rule: z.literal('notContains'),
  expected: z.any(), // 支援物件、字串、數字等
});

/**
 * greaterThan 規則 - 數值大於
 * 用於數值範圍驗證
 */
export const GreaterThanRuleSchema = CustomRuleBaseSchema.extend({
  rule: z.literal('greaterThan'),
  value: z.number(),
});

/**
 * lessThan 規則 - 數值小於
 * 用於數值範圍驗證
 */
export const LessThanRuleSchema = CustomRuleBaseSchema.extend({
  rule: z.literal('lessThan'),
  value: z.number(),
});

/**
 * length 規則 - 字串/陣列長度驗證
 * 可指定最小長度、最大長度或兩者
 */
export const LengthRuleSchema = CustomRuleBaseSchema.extend({
  rule: z.literal('length'),
  min: z.number().int().nonnegative().optional(),
  max: z.number().int().nonnegative().optional(),
}).refine(
  (data) => data.min !== undefined || data.max !== undefined,
  {
    message: 'min 或 max 至少需要指定一個',
  }
);

/**
 * 自訂規則聯合型別
 * 使用 discriminatedUnion 提供更好的型別推斷與驗證效能
 */
export const CustomRuleSchema = z.discriminatedUnion('rule', [
  NotNullRuleSchema,
  RegexRuleSchema,
  ContainsRuleSchema,
  EqualsRuleSchema,       // NEW - Phase 10
  NotContainsRuleSchema,  // NEW - Phase 10
  GreaterThanRuleSchema,  // NEW - Phase 10
  LessThanRuleSchema,     // NEW - Phase 10
  LengthRuleSchema,       // NEW - Phase 10
]);

/**
 * TypeScript 型別匯出
 */
export type CustomRule = z.infer<typeof CustomRuleSchema>;
export type NotNullRule = z.infer<typeof NotNullRuleSchema>;
export type RegexRule = z.infer<typeof RegexRuleSchema>;
export type ContainsRule = z.infer<typeof ContainsRuleSchema>;
export type EqualsRule = z.infer<typeof EqualsRuleSchema>;
export type NotContainsRule = z.infer<typeof NotContainsRuleSchema>;
export type GreaterThanRule = z.infer<typeof GreaterThanRuleSchema>;
export type LessThanRule = z.infer<typeof LessThanRuleSchema>;
export type LengthRule = z.infer<typeof LengthRuleSchema>;

/**
 * 規則清單常數（用於文件與驗證）
 */
export const AVAILABLE_RULES = [
  'notNull',
  'regex',
  'contains',
  'equals',
  'notContains',
  'greaterThan',
  'lessThan',
  'length',
] as const;

export type RuleName = typeof AVAILABLE_RULES[number];

/**
 * 規則描述對照表（用於文件與錯誤訊息）
 */
export const RULE_DESCRIPTIONS: Record<RuleName, string> = {
  notNull: '檢查值是否不為 null/undefined',
  regex: '使用正則表達式驗證字串格式',
  contains: '檢查字串/陣列是否包含特定值',
  equals: '檢查值是否等於預期值',
  notContains: '檢查陣列不包含特定物件',
  greaterThan: '檢查數值是否大於指定值',
  lessThan: '檢查數值是否小於指定值',
  length: '檢查字串/陣列長度是否符合範圍',
};
