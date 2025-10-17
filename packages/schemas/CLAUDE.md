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

## 未來擴充方向

1. 自動產生 API 文件
2. Schema 版本管理與相容性檢查
3. 自訂驗證器擴充
4. Schema 視覺化工具
5. 多語言錯誤訊息
6. Schema 效能優化
7. GraphQL Schema 產生
8. Protobuf Schema 轉換
