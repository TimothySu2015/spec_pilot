# 驗證規則統一管理分析報告

**分析日期**: 2025-10-20
**分析範圍**: SpecPilot 專案中的所有驗證規則定義與使用

---

## 執行摘要

### 問題發現

1. **規則定義與實作不一致** ⚠️
   - Schema 只定義 3 個規則：`notNull`, `regex`, `contains`
   - Validation 實作 3 個規則：`notNull`, `regex`, `contains`
   - Flow YAML 中使用 2 個**未定義**的規則：`equals`, `notContains`

2. **規則命名不統一** ⚠️
   - `customRules[].rule` (新格式，step-schema.ts)
   - `validation[].rule` (舊格式，flows 中使用)
   - `custom[].type` (另一種舊格式)

3. **缺少統一的規則註冊中心** ⚠️
   - 規則定義分散在多個檔案
   - 沒有單一權威來源 (SSOT)

---

## 詳細分析

### 1. Schema 定義 (packages/schemas/src/validation-schema.ts)

**檔案位置**: `packages/schemas/src/validation-schema.ts`

**已定義規則** (3 個):

```typescript
// ✅ notNull - 檢查值是否不為 null/undefined
export const NotNullRuleSchema = ValidationRuleBaseSchema.extend({
  rule: z.literal('notNull'),
});

// ✅ regex - 使用正則表達式驗證
export const RegexRuleSchema = ValidationRuleBaseSchema.extend({
  rule: z.literal('regex'),
  value: z.string().min(1, '正則表達式不可為空'),
});

// ✅ contains - 檢查是否包含特定值
export const ContainsRuleSchema = ValidationRuleBaseSchema.extend({
  rule: z.literal('contains'),
  value: z.union([z.string(), z.number()]),
});
```

**聯合型別**:
```typescript
export const ValidationRuleSchema = z.discriminatedUnion('rule', [
  NotNullRuleSchema,
  RegexRuleSchema,
  ContainsRuleSchema,
]);
```

---

### 2. Validation 實作 (packages/validation/src/custom-validator.ts)

**檔案位置**: `packages/validation/src/custom-validator.ts` (251-319 行)

**已實作規則** (3 個):

```typescript
// ✅ notNull (253-263 行)
this.registerRule('notNull', (context) => {
  const value = this.getValueByPath(context.payload, context.field);
  const isValid = value !== null && value !== undefined;
  return {
    isValid,
    message: isValid ?
      `欄位 ${context.field} 非空值驗證通過` :
      `欄位 ${context.field} 不能為空值`,
  };
});

// ✅ regex (266-294 行)
this.registerRule('regex', (context) => {
  const value = this.getValueByPath(context.payload, context.field);
  const pattern = context.ruleOptions.value;
  // ... 正規表達式驗證邏輯
});

// ✅ contains (297-318 行)
this.registerRule('contains', (context) => {
  const value = this.getValueByPath(context.payload, context.field);
  const searchValue = context.ruleOptions.value;
  const stringValue = String(value);
  const searchString = String(searchValue);
  const isValid = stringValue.includes(searchString);
  // ...
});
```

---

### 3. Flow 檔案中使用的規則

**分析來源**: `flows/*.yaml` (所有測試流程檔案)

**使用的規則** (5 個):

| 規則名稱 | 使用次數 | Schema 定義 | Validation 實作 | 狀態 |
|---------|---------|------------|----------------|------|
| `notNull` | 20+ | ✅ | ✅ | ✅ 正常 |
| `contains` | 25+ | ✅ | ✅ | ✅ 正常 |
| `regex` | 2 | ✅ | ✅ | ✅ 正常 |
| **`equals`** | 4 | ❌ | ❌ | ⚠️ **未定義** |
| **`notContains`** | 1 | ❌ | ❌ | ⚠️ **未定義** |

**使用範例**:

```yaml
# ✅ 已定義的規則
customRules:
  - field: id
    rule: notNull  # ✅ OK

  - field: email
    rule: regex    # ✅ OK
    value: "^[^@]+@[^@]+\\.[^@]+$"

  - field: name
    rule: contains # ✅ OK
    value: "測試"

# ⚠️ 未定義的規則
customRules:
  - field: id
    rule: equals       # ❌ Schema 沒定義
    expected: 2

  - field: users
    rule: notContains  # ❌ Schema 沒定義
    expected:
      id: 2
```

---

### 4. Test Suite Generator 的規則使用

**檔案分析**: `packages/test-suite-generator/src/*`

**發現**: ✅ **完全沒有直接使用自訂規則**

- CRUDGenerator: 不產生 customRules
- ErrorCaseGenerator: 不產生 customRules
- EdgeCaseGenerator: 不產生 customRules
- DependencyResolver: 不產生 customRules

**原因**: Test Suite Generator 主要產生基本的 HTTP 測試步驟，不包含複雜的自訂驗證規則。

---

## 問題總結

### ❌ 問題 1: 缺少 `equals` 規則定義

**影響檔案**:
- `flows/login-and-get-user-by-id.yaml` (36 行)
- `flows/login-query-delete-verify-user.yaml` (36, 52 行)
- `flows/user-management-complete-tests.yaml` (124, 158 行)

**使用範例**:
```yaml
customRules:
  - field: id
    rule: equals
    expected: 2
```

**現狀**: ❌ Schema 無定義、Validation 無實作

---

### ❌ 問題 2: 缺少 `notContains` 規則定義

**影響檔案**:
- `flows/login-query-delete-verify-user.yaml` (68 行)

**使用範例**:
```yaml
customRules:
  - field: users
    rule: notContains
    expected:
      id: 2
```

**現狀**: ❌ Schema 無定義、Validation 無實作

---

### ⚠️ 問題 3: 命名格式不一致

**發現的格式變體**:

1. **`customRules` + `rule`** (新標準，step-schema.ts)
   ```yaml
   customRules:
     - field: id
       rule: equals
       expected: 2
   ```

2. **`validation` + `rule`** (舊格式)
   ```yaml
   validation:
     - rule: notNull
       path: token
   ```

3. **`custom` + `type`** (另一種舊格式)
   ```yaml
   expect:
     custom:
       - type: notNull
         field: verificationId
   ```

---

## 建議方案

### 🎯 方案 A: 統一規則管理 (推薦)

**建立統一的規則定義檔案**

#### 1. 建立 `packages/schemas/src/custom-rules.ts`

```typescript
import { z } from 'zod';

/**
 * 規則基礎 Schema
 */
const CustomRuleBaseSchema = z.object({
  field: z.string().min(1, 'field 不可為空'),
  message: z.string().optional(),
});

/**
 * notNull - 檢查值是否不為 null/undefined
 */
export const NotNullRuleSchema = CustomRuleBaseSchema.extend({
  rule: z.literal('notNull'),
});

/**
 * regex - 使用正則表達式驗證
 */
export const RegexRuleSchema = CustomRuleBaseSchema.extend({
  rule: z.literal('regex'),
  value: z.string().min(1, '正則表達式不可為空'),
});

/**
 * contains - 檢查字串/陣列是否包含特定值
 */
export const ContainsRuleSchema = CustomRuleBaseSchema.extend({
  rule: z.literal('contains'),
  value: z.union([z.string(), z.number(), z.any()]),
});

/**
 * equals - 檢查值是否等於預期值 (NEW)
 */
export const EqualsRuleSchema = CustomRuleBaseSchema.extend({
  rule: z.literal('equals'),
  expected: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

/**
 * notContains - 檢查陣列不包含特定物件 (NEW)
 */
export const NotContainsRuleSchema = CustomRuleBaseSchema.extend({
  rule: z.literal('notContains'),
  expected: z.any(), // 支援物件、字串、數字等
});

/**
 * greaterThan - 數值大於 (NEW)
 */
export const GreaterThanRuleSchema = CustomRuleBaseSchema.extend({
  rule: z.literal('greaterThan'),
  value: z.number(),
});

/**
 * lessThan - 數值小於 (NEW)
 */
export const LessThanRuleSchema = CustomRuleBaseSchema.extend({
  rule: z.literal('lessThan'),
  value: z.number(),
});

/**
 * length - 字串/陣列長度驗證 (NEW)
 */
export const LengthRuleSchema = CustomRuleBaseSchema.extend({
  rule: z.literal('length'),
  min: z.number().optional(),
  max: z.number().optional(),
});

/**
 * 自訂規則聯合型別
 */
export const CustomRuleSchema = z.discriminatedUnion('rule', [
  NotNullRuleSchema,
  RegexRuleSchema,
  ContainsRuleSchema,
  EqualsRuleSchema,       // NEW
  NotContainsRuleSchema,  // NEW
  GreaterThanRuleSchema,  // NEW
  LessThanRuleSchema,     // NEW
  LengthRuleSchema,       // NEW
]);

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
```

#### 2. 更新 `packages/validation/src/custom-validator.ts`

新增缺失的規則實作：

```typescript
private registerBuiltinRules(): void {
  // ... 現有的 notNull, regex, contains ...

  // ✅ NEW: equals 規則
  this.registerRule('equals', (context: CustomRuleContext): CustomRuleResult => {
    const value = this.getValueByPath(context.payload, context.field);
    const expected = context.ruleOptions.expected;
    const isValid = value === expected;

    return {
      isValid,
      message: isValid ?
        `欄位 ${context.field} 等於預期值 ${expected}` :
        `欄位 ${context.field} 值為 ${value}，預期為 ${expected}`,
    };
  });

  // ✅ NEW: notContains 規則
  this.registerRule('notContains', (context: CustomRuleContext): CustomRuleResult => {
    const value = this.getValueByPath(context.payload, context.field);
    const expected = context.ruleOptions.expected;

    if (!Array.isArray(value)) {
      return {
        isValid: false,
        message: `欄位 ${context.field} 必須是陣列類型`,
      };
    }

    // 檢查陣列中是否包含符合條件的物件
    const contains = value.some(item => {
      if (typeof expected === 'object' && expected !== null) {
        // 物件比對：檢查所有指定的屬性是否匹配
        return Object.keys(expected).every(key => item[key] === expected[key]);
      } else {
        // 基本型別比對
        return item === expected;
      }
    });

    const isValid = !contains;

    return {
      isValid,
      message: isValid ?
        `欄位 ${context.field} 不包含指定值` :
        `欄位 ${context.field} 包含不應存在的值`,
    };
  });

  // ✅ NEW: greaterThan 規則
  this.registerRule('greaterThan', (context: CustomRuleContext): CustomRuleResult => {
    const value = this.getValueByPath(context.payload, context.field);
    const threshold = context.ruleOptions.value;

    if (typeof value !== 'number' || typeof threshold !== 'number') {
      return {
        isValid: false,
        message: `greaterThan 規則需要數值型態`,
      };
    }

    const isValid = value > threshold;

    return {
      isValid,
      message: isValid ?
        `欄位 ${context.field} 值 ${value} 大於 ${threshold}` :
        `欄位 ${context.field} 值 ${value} 未大於 ${threshold}`,
    };
  });

  // ✅ NEW: lessThan 規則
  this.registerRule('lessThan', (context: CustomRuleContext): CustomRuleResult => {
    const value = this.getValueByPath(context.payload, context.field);
    const threshold = context.ruleOptions.value;

    if (typeof value !== 'number' || typeof threshold !== 'number') {
      return {
        isValid: false,
        message: `lessThan 規則需要數值型態`,
      };
    }

    const isValid = value < threshold;

    return {
      isValid,
      message: isValid ?
        `欄位 ${context.field} 值 ${value} 小於 ${threshold}` :
        `欄位 ${context.field} 值 ${value} 未小於 ${threshold}`,
    };
  });

  // ✅ NEW: length 規則
  this.registerRule('length', (context: CustomRuleContext): CustomRuleResult => {
    const value = this.getValueByPath(context.payload, context.field);
    const min = context.ruleOptions.min;
    const max = context.ruleOptions.max;

    let length: number;
    if (typeof value === 'string' || Array.isArray(value)) {
      length = value.length;
    } else {
      return {
        isValid: false,
        message: `length 規則僅適用於字串或陣列`,
      };
    }

    const isValid =
      (min === undefined || length >= min) &&
      (max === undefined || length <= max);

    return {
      isValid,
      message: isValid ?
        `欄位 ${context.field} 長度 ${length} 符合範圍` :
        `欄位 ${context.field} 長度 ${length} 不在範圍內 (min: ${min}, max: ${max})`,
    };
  });
}
```

#### 3. 更新 `packages/schemas/src/step-schema.ts`

```typescript
import { CustomRuleSchema } from './custom-rules.js';

export const StepExpectSchema = z.object({
  statusCode: z.number().int().min(100).max(599).optional(),
  body: z.any().optional(),
  schema: z.string().optional(),
  customRules: z.array(CustomRuleSchema).optional(),  // 使用統一定義
});
```

---

### 📊 規則統一管理表

| 規則名稱 | Schema 定義 | Validation 實作 | 使用狀態 | 優先級 |
|---------|------------|----------------|---------|--------|
| `notNull` | ✅ | ✅ | ✅ 廣泛使用 | P0 |
| `regex` | ✅ | ✅ | ✅ 使用中 | P0 |
| `contains` | ✅ | ✅ | ✅ 廣泛使用 | P0 |
| `equals` | ❌ → ✅ | ❌ → ✅ | ✅ **需要新增** | **P0** |
| `notContains` | ❌ → ✅ | ❌ → ✅ | ✅ **需要新增** | **P0** |
| `greaterThan` | ❌ → ✅ | ❌ → ✅ | ⚪ 未來可用 | P1 |
| `lessThan` | ❌ → ✅ | ❌ → ✅ | ⚪ 未來可用 | P1 |
| `length` | ❌ → ✅ | ❌ → ✅ | ⚪ 未來可用 | P2 |

---

## 實施步驟

### Phase 1: 建立統一規則定義 (P0 - 必須)

1. ✅ 建立 `packages/schemas/src/custom-rules.ts`
2. ✅ 實作 `equals` 和 `notContains` Schema
3. ✅ 更新 `step-schema.ts` 使用新的 CustomRuleSchema

### Phase 2: 實作缺失規則 (P0 - 必須)

1. ✅ 在 `custom-validator.ts` 實作 `equals` 規則
2. ✅ 在 `custom-validator.ts` 實作 `notContains` 規則
3. ✅ 新增單元測試

### Phase 3: 測試與驗證 (P0 - 必須)

1. ⚪ 執行現有 Flow 檔案測試
2. ⚪ 驗證 `equals` 和 `notContains` 正常運作
3. ⚪ 更新文件

### Phase 4: 擴充規則庫 (P1 - 建議)

1. ⚪ 實作 `greaterThan`, `lessThan`, `length` 規則
2. ⚪ 新增測試案例
3. ⚪ 更新使用者文件

---

## 結論

### 當前狀態

- ✅ 3 個規則完整定義與實作 (`notNull`, `regex`, `contains`)
- ❌ 2 個規則被使用但未定義 (`equals`, `notContains`)
- ⚠️ 缺少統一的規則管理機制

### 建議優先級

1. **P0 (緊急)**: 實作 `equals` 和 `notContains` 規則
2. **P0 (緊急)**: 建立 `custom-rules.ts` 作為單一權威來源
3. **P1 (重要)**: 擴充常用規則 (`greaterThan`, `lessThan`, `length`)
4. **P2 (優化)**: 建立規則文件與最佳實踐指南

### 預期效益

- ✅ 統一規則定義與管理
- ✅ 修復現有 Flow 檔案的驗證問題
- ✅ 提供完整的規則庫供使用者使用
- ✅ 確保 Schema 與實作一致性
