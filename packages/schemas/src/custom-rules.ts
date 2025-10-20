import { z } from 'zod';

/**
 * 自訂驗證規則基礎屬性定義
 * 支援 `field` 與 `path` 兩種欄位名稱（向後相容）
 */
const baseFieldSchema = z.object({
  field: z.string().optional(),
  path: z.string().optional(),
  message: z.string().optional(),
});

/**
 * notNull 規則 - 檢查值是否不為 null/undefined
 *
 * @remarks
 * 支援 `field` 或 `path` 參數（向後相容）
 * - `field`: 推薦使用，語義化的欄位名稱
 * - `path`: 向後相容，與 ValidationRuleSchema 保持一致
 */
export const NotNullRuleSchema = baseFieldSchema.extend({
  rule: z.literal('notNull'),
}).refine(
  data => Boolean(data.field || data.path),
  { message: 'field 或 path 至少需提供一個' }
);

/**
 * regex 規則 - 使用正則表達式驗證
 */
export const RegexRuleSchema = baseFieldSchema.extend({
  rule: z.literal('regex'),
  value: z.string().min(1, '正則表達式不可為空'),
}).refine(
  data => Boolean(data.field || data.path),
  { message: 'field 或 path 至少需提供一個' }
);

/**
 * contains 規則 - 檢查字串/陣列是否包含特定值
 */
export const ContainsRuleSchema = baseFieldSchema.extend({
  rule: z.literal('contains'),
  value: z.union([z.string(), z.number(), z.any()]),
}).refine(
  data => Boolean(data.field || data.path),
  { message: 'field 或 path 至少需提供一個' }
);

/**
 * equals 規則 - 檢查值是否等於預期值
 * 用於精確值比對，支援字串、數字、布林值、null
 */
export const EqualsRuleSchema = baseFieldSchema.extend({
  rule: z.literal('equals'),
  expected: z.union([z.string(), z.number(), z.boolean(), z.null()]),
}).refine(
  data => Boolean(data.field || data.path),
  { message: 'field 或 path 至少需提供一個' }
);

/**
 * notContains 規則 - 檢查陣列不包含特定物件
 * 支援物件屬性比對，用於驗證刪除操作後資料不存在
 */
export const NotContainsRuleSchema = baseFieldSchema.extend({
  rule: z.literal('notContains'),
  expected: z.any(), // 支援物件、字串、數字等
}).refine(
  data => Boolean(data.field || data.path),
  { message: 'field 或 path 至少需提供一個' }
);

/**
 * greaterThan 規則 - 數值大於
 * 用於數值範圍驗證
 */
export const GreaterThanRuleSchema = baseFieldSchema.extend({
  rule: z.literal('greaterThan'),
  value: z.number(),
}).refine(
  data => Boolean(data.field || data.path),
  { message: 'field 或 path 至少需提供一個' }
);

/**
 * lessThan 規則 - 數值小於
 * 用於數值範圍驗證
 */
export const LessThanRuleSchema = baseFieldSchema.extend({
  rule: z.literal('lessThan'),
  value: z.number(),
}).refine(
  data => Boolean(data.field || data.path),
  { message: 'field 或 path 至少需提供一個' }
);

/**
 * length 規則 - 字串/陣列長度驗證
 * 可指定最小長度、最大長度或兩者
 */
export const LengthRuleSchema = baseFieldSchema.extend({
  rule: z.literal('length'),
  min: z.number().int().nonnegative().optional(),
  max: z.number().int().nonnegative().optional(),
}).refine(
  (data) => Boolean(data.field || data.path),
  { message: 'field 或 path 至少需提供一個' }
).refine(
  (data) => data.min !== undefined || data.max !== undefined,
  { message: 'min 或 max 至少需要指定一個' }
);

/**
 * 自訂規則聯合型別
 *
 * @remarks
 * Phase 11 更新: 因為加入了 `refine()` 驗證，discriminatedUnion 無法正常運作
 * 改用一般 union，仍保有型別安全但效能略低
 */
export const CustomRuleSchema = z.union([
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
