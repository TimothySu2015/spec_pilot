# @specpilot/schemas - Schema 定義模組

## 模組概述

`@specpilot/schemas` 是 SpecPilot 的中央 Schema 定義模組，使用 Zod 定義所有資料結構的型別與驗證規則，確保整個專案的型別安全與資料一致性。

## 核心職責

1. **統一 Schema 定義**: 集中管理所有資料結構定義
2. **型別安全**: 提供 TypeScript 型別推導
3. **執行時驗證**: 使用 Zod 進行執行時資料驗證
4. **JSON Schema 產生**: 轉換 Zod Schema 為 JSON Schema
5. **YAML Schema 匯出**: 支援 YAML 格式的 Schema 定義

## 技術堆疊

- `zod` (~3.25.76) - TypeScript 型別驗證函式庫
- `zod-to-json-schema` (^3.23.5) - Zod 轉 JSON Schema
- `yaml` (^2.4.3) - YAML 序列化

## 主要 Schema 定義

### 1. Flow Schema (測試流程)

```typescript
import { z } from 'zod';

export const FlowStepSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']),
  path: z.string().startsWith('/'),
  headers: z.record(z.string()).optional(),
  query: z.record(z.any()).optional(),
  body: z.any().optional(),
  expect: z.object({
    status: z.union([z.number(), z.array(z.number())]).optional(),
    schema: z.string().optional(),
    body: z.record(z.any()).optional(),
    custom: z.array(z.object({
      field: z.string(),
      rule: z.string(),
      pattern: z.string().optional(),
      value: z.any().optional()
    })).optional()
  }).optional(),
  saveAs: z.string().optional()
});

export const FlowDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string().optional(),
  config: z.object({
    baseUrl: z.string().url().optional(),
    timeout: z.number().positive().optional(),
    headers: z.record(z.string()).optional()
  }).optional(),
  steps: z.array(FlowStepSchema).min(1)
});

export type FlowDefinition = z.infer<typeof FlowDefinitionSchema>;
export type FlowStep = z.infer<typeof FlowStepSchema>;
```

### 2. Report Schema (測試報表)

```typescript
export const StepResultSchema = z.object({
  stepName: z.string(),
  status: z.enum(['passed', 'failed', 'skipped']),
  duration: z.number(),
  request: z.object({
    method: z.string(),
    url: z.string(),
    headers: z.record(z.string()),
    body: z.any().optional()
  }),
  response: z.object({
    status: z.number(),
    headers: z.record(z.string()),
    body: z.any(),
    duration: z.number()
  }).optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional()
  }).optional()
});

export const ExecutionReportSchema = z.object({
  executionId: z.string().uuid(),
  timestamp: z.string().datetime(),
  duration: z.number(),
  flowName: z.string(),
  success: z.boolean(),
  summary: z.object({
    totalSteps: z.number(),
    passedSteps: z.number(),
    failedSteps: z.number(),
    skippedSteps: z.number()
  }),
  steps: z.array(StepResultSchema)
});

export type ExecutionReport = z.infer<typeof ExecutionReportSchema>;
export type StepResult = z.infer<typeof StepResultSchema>;
```

### 3. Config Schema (組態設定)

```typescript
export const ConfigSchema = z.object({
  baseUrl: z.string().url(),
  port: z.number().int().min(1).max(65535).optional(),
  token: z.string().optional(),
  timeout: z.number().positive().default(5000),
  retryCount: z.number().int().min(0).max(10).default(3),
  retryDelay: z.number().positive().default(500),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

export type Config = z.infer<typeof ConfigSchema>;
```

### 4. Validation Schema (驗證規則)

```typescript
export const ValidationRuleSchema = z.object({
  field: z.string(),
  rule: z.enum(['notNull', 'regex', 'contains', 'range', 'length']),
  pattern: z.string().optional(),
  value: z.any().optional(),
  min: z.number().optional(),
  max: z.number().optional()
});

export const ValidationResultSchema = z.object({
  valid: z.boolean(),
  field: z.string().optional(),
  rule: z.string().optional(),
  message: z.string(),
  expected: z.any().optional(),
  actual: z.any().optional()
});

export type ValidationRule = z.infer<typeof ValidationRuleSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
```

## 使用方式

### 驗證資料

```typescript
import { FlowDefinitionSchema } from '@specpilot/schemas';

// 驗證流程定義
try {
  const validatedFlow = FlowDefinitionSchema.parse(rawFlowData);
  console.log('✅ 流程定義有效');
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ 驗證失敗:', error.errors);
  }
}

// 安全解析 (不拋出錯誤)
const result = FlowDefinitionSchema.safeParse(rawFlowData);
if (result.success) {
  console.log('資料:', result.data);
} else {
  console.error('錯誤:', result.error);
}
```

### 型別推導

```typescript
import { FlowDefinition, FlowStep } from '@specpilot/schemas';

// TypeScript 自動推導型別
function processFlow(flow: FlowDefinition) {
  flow.steps.forEach((step: FlowStep) => {
    console.log(`執行步驟: ${step.name}`);
  });
}
```

### 產生 JSON Schema

```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';
import { FlowDefinitionSchema } from '@specpilot/schemas';

// 轉換為 JSON Schema
const jsonSchema = zodToJsonSchema(FlowDefinitionSchema, {
  name: 'FlowDefinition',
  $refStrategy: 'root'
});

// 可用於外部驗證工具或文件產生
console.log(JSON.stringify(jsonSchema, null, 2));
```

## Schema 組織結構

```
schemas/
  ├── src/
  │   ├── flow.schema.ts           # 流程相關 Schema
  │   ├── report.schema.ts         # 報表相關 Schema
  │   ├── config.schema.ts         # 組態相關 Schema
  │   ├── validation.schema.ts     # 驗證相關 Schema
  │   ├── error.schema.ts          # 錯誤相關 Schema
  │   └── index.ts                 # 統一匯出
  └── __tests__/
      └── schemas.test.ts          # Schema 測試
```

## 開發指令

```bash
# 編譯模組
pnpm run build

# 執行測試
pnpm run test
```

## 架構設計原則

1. **單一真相來源**: 所有型別定義集中於此模組
2. **執行時安全**: Zod 提供執行時型別檢查
3. **編譯時安全**: TypeScript 提供編譯時型別檢查
4. **可讀性**: Schema 定義即文件
5. **可維護性**: 集中管理易於更新

## 依賴關係

### 被依賴於
- 幾乎所有其他 packages
- 提供統一的型別定義

### 依賴於
- 無 (基礎模組)

## 最佳實踐

### 1. Schema 定義

```typescript
// ✅ 好的 Schema 定義
export const UserSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).max(150).optional(),
  createdAt: z.string().datetime()
});

// ❌ 避免過於寬鬆的定義
export const BadUserSchema = z.object({
  id: z.any(),  // 太寬鬆
  name: z.string(),  // 缺少限制
  email: z.string()  // 未驗證格式
});
```

### 2. 可選欄位處理

```typescript
// 使用 optional() 表示可選
const OptionalFieldSchema = z.object({
  required: z.string(),
  optional: z.string().optional()
});

// 使用 default() 提供預設值
const WithDefaultSchema = z.object({
  timeout: z.number().default(5000)
});
```

### 3. Schema 組合

```typescript
// 基礎 Schema
const BaseSchema = z.object({
  id: z.string(),
  createdAt: z.string().datetime()
});

// 擴充 Schema
const ExtendedSchema = BaseSchema.extend({
  name: z.string(),
  email: z.string().email()
});

// Schema 組合
const CombinedSchema = z.intersection(SchemaA, SchemaB);
```

## 自訂驗證規則 (Phase 10 - 新增)

### 概述

`custom-rules.ts` 提供統一的自訂驗證規則定義,作為單一權威來源 (SSOT) 管理所有驗證規則。

### 可用規則

| 規則名稱 | 說明 | 參數 | 版本 |
|---------|------|------|------|
| `notNull` | 檢查值是否不為 null/undefined | `field` | v0.1.0 |
| `regex` | 使用正則表達式驗證 | `field`, `value` (pattern) | v0.1.0 |
| `contains` | 檢查字串/陣列是否包含特定值 | `field`, `value` | v0.1.0 |
| **`equals`** | **檢查值是否等於預期值** | `field`, `expected` | **v0.2.0 (Phase 10)** |
| **`notContains`** | **檢查陣列不包含特定物件** | `field`, `expected` | **v0.2.0 (Phase 10)** |
| **`greaterThan`** | **數值大於** | `field`, `value` | **v0.2.0 (Phase 10)** |
| **`lessThan`** | **數值小於** | `field`, `value` | **v0.2.0 (Phase 10)** |
| **`length`** | **字串/陣列長度驗證** | `field`, `min?`, `max?` | **v0.2.0 (Phase 10)** |

### 使用範例

```typescript
import { CustomRuleSchema, AVAILABLE_RULES } from '@specpilot/schemas';

// equals 規則 - 精確值比對
const equalsRule = {
  field: 'id',
  rule: 'equals',
  expected: 2
};

// notContains 規則 - 驗證刪除操作
const notContainsRule = {
  field: 'users',
  rule: 'notContains',
  expected: { id: 2 }  // 物件屬性比對
};

// greaterThan 規則 - 數值範圍驗證
const greaterThanRule = {
  field: 'count',
  rule: 'greaterThan',
  value: 5
};

// length 規則 - 長度驗證
const lengthRule = {
  field: 'name',
  rule: 'length',
  min: 1,
  max: 100
};

// Zod 驗證
const result = CustomRuleSchema.parse(equalsRule);
```

### 在 Flow YAML 中使用

```yaml
steps:
  - name: 查詢使用者
    request:
      method: GET
      path: /users/2
    expect:
      statusCode: 200
      body:
        schema:
          $ref: '#/components/schemas/User'
        customRules:
          - field: id
            rule: equals      # 確認回傳正確的使用者
            expected: 2
          - field: age
            rule: greaterThan # 年齡驗證
            value: 0
          - field: name
            rule: length      # 名稱長度驗證
            min: 1
            max: 100

  - name: 驗證刪除結果
    request:
      method: GET
      path: /users
    expect:
      statusCode: 200
      body:
        customRules:
          - field: users
            rule: notContains # 確認使用者已刪除
            expected:
              id: 2
```

### Schema 定義

```typescript
// custom-rules.ts 定義所有規則
export const EqualsRuleSchema = CustomRuleBaseSchema.extend({
  rule: z.literal('equals'),
  expected: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export const NotContainsRuleSchema = CustomRuleBaseSchema.extend({
  rule: z.literal('notContains'),
  expected: z.any(),
});

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
```

### 規則描述對照表

```typescript
import { RULE_DESCRIPTIONS } from '@specpilot/schemas';

console.log(RULE_DESCRIPTIONS.equals);
// 輸出: "檢查值是否等於預期值"

console.log(RULE_DESCRIPTIONS.notContains);
// 輸出: "檢查陣列不包含特定物件"
```

## 版本歷史

### v0.2.0 (Phase 10 - 2025-10-20)

**重大更新**: 統一驗證規則管理

- ✅ 新增 `custom-rules.ts` 作為規則管理中心
- ✅ 新增 5 個驗證規則:
  - `equals` - 精確值比對
  - `notContains` - 陣列不包含驗證
  - `greaterThan` - 數值大於
  - `lessThan` - 數值小於
  - `length` - 長度驗證
- ✅ 新增 `AVAILABLE_RULES` 常數
- ✅ 新增 `RULE_DESCRIPTIONS` 對照表
- ✅ 更新 `step-schema.ts` 支援 `customRules` 欄位
- ✅ 擴充 `ExpectBodySchema` 結構

### v0.1.0 (初始版本)

- 基礎 Schema 定義
- Flow、Step、Auth、Globals Schema
- 3 個基本驗證規則: `notNull`, `regex`, `contains`

## 未來擴充方向

1. 自動產生 API 文件
2. Schema 版本管理與相容性檢查
3. ~~自訂驗證器擴充~~ ✅ 完成 (Phase 10)
4. Schema 視覺化工具
5. 多語言錯誤訊息
6. Schema 效能優化
7. GraphQL Schema 產生
8. Protobuf Schema 轉換
