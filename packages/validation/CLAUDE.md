# @specpilot/validation - Schema 與自訂驗證引擎

## 模組概述

`@specpilot/validation` 是 SpecPilot 的驗證引擎模組，負責驗證 API 回應是否符合 OpenAPI Schema 定義，以及執行自訂驗證規則 (notNull、regex、contains 等)。使用 ajv 作為核心驗證引擎。

## 核心職責

1. **JSON Schema 驗證**: 驗證回應是否符合 OpenAPI Schema
2. **自訂規則驗證**: 執行 notNull、regex、contains 等自訂規則
3. **狀態碼驗證**: 驗證 HTTP 狀態碼是否符合預期
4. **巢狀物件驗證**: 支援深層物件結構驗證
5. **陣列驗證**: 驗證陣列元素與陣列長度
6. **格式驗證**: 驗證 email、url、date 等格式

## 技術堆疊

### 核心依賴
- `ajv` (^8.12.0) - JSON Schema 驗證引擎
- `ajv-formats` (^3.0.1) - 格式驗證器 (email, url, date 等)
- `@specpilot/config` - 讀取驗證組態
- `@specpilot/shared` - 共用工具與錯誤類別

## 核心元件

### ValidationEngine
主要驗證引擎：

```typescript
import { ValidationEngine } from '@specpilot/validation';

const engine = new ValidationEngine({
  schemas: openApiSchemas,  // 從 spec-loader 取得
  strictMode: true
});

// 驗證回應
const result = engine.validate({
  data: response.body,
  schema: '#/components/schemas/User',
  customRules: [
    { field: 'id', rule: 'notNull' },
    { field: 'email', rule: 'regex', pattern: '^[^@]+@[^@]+\\.[^@]+$' }
  ]
});

if (!result.valid) {
  console.error('驗證失敗:', result.errors);
}
```

### SchemaValidator
JSON Schema 驗證器：

```typescript
class SchemaValidator {
  // 驗證資料是否符合 Schema
  validate(data: any, schema: JSONSchema): ValidationResult;

  // 編譯 Schema (提升效能)
  compile(schema: JSONSchema): ValidateFunction;

  // 取得 Schema 參照
  getSchema(ref: string): JSONSchema | undefined;
}
```

### CustomRuleValidator
自訂規則驗證器：

```typescript
class CustomRuleValidator {
  // 註冊自訂規則
  registerRule(name: string, validator: RuleValidator): void;

  // 執行自訂規則
  validate(data: any, rules: ValidationRule[]): ValidationResult;

  // 內建規則 (Phase 10 更新):
  // - notNull, regex, contains (v0.1.0)
  // - equals, notContains, greaterThan, lessThan, length (v0.2.0 - Phase 10)
}
```

## 驗證類型

### 1. JSON Schema 驗證

```typescript
// 驗證回應是否符合 OpenAPI Schema
const result = engine.validateSchema({
  data: {
    id: 1,
    name: '張小明',
    email: 'zhang@example.com'
  },
  schemaRef: '#/components/schemas/User'
});

// Schema 定義
{
  "type": "object",
  "properties": {
    "id": { "type": "integer" },
    "name": { "type": "string", "minLength": 1 },
    "email": { "type": "string", "format": "email" }
  },
  "required": ["id", "name", "email"]
}
```

### 2. 自訂規則驗證

#### notNull 規則

```typescript
// 驗證欄位不為 null 或 undefined
{
  field: 'id',
  rule: 'notNull'
}

// ✅ 通過
{ id: 1 }

// ❌ 失敗
{ id: null }
{ id: undefined }
{}
```

#### regex 規則

```typescript
// 驗證欄位符合正規表示式
{
  field: 'email',
  rule: 'regex',
  pattern: '^[^@]+@[^@]+\\.[^@]+$'
}

// ✅ 通過
{ email: 'test@example.com' }

// ❌ 失敗
{ email: 'invalid-email' }
```

#### contains 規則

```typescript
// 驗證字串或陣列包含特定值
{
  field: 'tags',
  rule: 'contains',
  value: 'important'
}

// ✅ 通過
{ tags: ['urgent', 'important', 'todo'] }

// ❌ 失敗
{ tags: ['urgent', 'todo'] }
```

#### equals 規則 (Phase 10 - 新增)

```typescript
// 驗證值是否等於預期值
{
  field: 'id',
  rule: 'equals',
  expected: 2
}

// ✅ 通過
{ id: 2 }

// ❌ 失敗
{ id: 1 }
```

#### notContains 規則 (Phase 10 - 新增)

```typescript
// 驗證陣列不包含特定物件(用於驗證刪除操作)
{
  field: 'users',
  rule: 'notContains',
  expected: { id: 2 }
}

// ✅ 通過
{ users: [{ id: 1 }, { id: 3 }] }

// ❌ 失敗
{ users: [{ id: 1 }, { id: 2 }] }
```

#### greaterThan 規則 (Phase 10 - 新增)

```typescript
// 驗證數值大於指定值
{
  field: 'count',
  rule: 'greaterThan',
  value: 5
}

// ✅ 通過
{ count: 10 }

// ❌ 失敗
{ count: 3 }
```

#### lessThan 規則 (Phase 10 - 新增)

```typescript
// 驗證數值小於指定值
{
  field: 'count',
  rule: 'lessThan',
  value: 100
}

// ✅ 通過
{ count: 50 }

// ❌ 失敗
{ count: 150 }
```

#### length 規則 (Phase 10 - 新增)

```typescript
// 驗證字串或陣列長度
{
  field: 'name',
  rule: 'length',
  min: 1,
  max: 100
}

// ✅ 通過
{ name: '張小明' }

// ❌ 失敗
{ name: '' }  // 太短
{ name: 'A'.repeat(101) }  // 太長
```

### 3. 狀態碼驗證

```typescript
// 驗證單一狀態碼
engine.validateStatus(response.status, 200);

// 驗證多個可接受的狀態碼
engine.validateStatus(response.status, [200, 201]);

// 驗證範圍
engine.validateStatus(response.status, {
  min: 200,
  max: 299
});
```

## 驗證結果

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  field?: string;
  rule?: string;
  message: string;
  expected?: any;
  actual?: any;
  path?: string;  // JSON 路徑 (例如: data.users[0].email)
}
```

### 範例輸出

```typescript
{
  valid: false,
  errors: [
    {
      field: 'email',
      rule: 'schema',
      message: '必須符合 email 格式',
      expected: 'string(email)',
      actual: 'invalid-email',
      path: 'data.email'
    },
    {
      field: 'age',
      rule: 'range',
      message: '數值超出範圍',
      expected: { min: 0, max: 150 },
      actual: 200,
      path: 'data.age'
    }
  ]
}
```

## 使用範例

### 基本驗證

```typescript
import { ValidationEngine } from '@specpilot/validation';

const engine = new ValidationEngine({
  schemas: openApiSchemas
});

// 驗證 HTTP 回應
const response = await httpRunner.get('/users/1');

const result = engine.validate({
  data: response.body,
  schema: '#/components/schemas/User',
  expect: {
    status: 200,
    custom: [
      { field: 'id', rule: 'notNull' },
      { field: 'email', rule: 'regex', pattern: '^[^@]+@[^@]+\\.[^@]+$' }
    ]
  }
});

if (!result.valid) {
  result.errors.forEach(error => {
    console.error(`❌ ${error.field}: ${error.message}`);
  });
}
```

### 批次驗證

```typescript
// 驗證多個回應
const responses = [response1, response2, response3];

const results = responses.map(res =>
  engine.validate({
    data: res.body,
    schema: '#/components/schemas/User'
  })
);

const allValid = results.every(r => r.valid);
```

### 巢狀物件驗證

```typescript
// 驗證巢狀結構
const result = engine.validate({
  data: {
    user: {
      id: 1,
      profile: {
        email: 'test@example.com',
        address: {
          city: 'Taipei'
        }
      }
    }
  },
  schema: '#/components/schemas/UserWithProfile',
  custom: [
    { field: 'user.profile.email', rule: 'notNull' },
    { field: 'user.profile.address.city', rule: 'notNull' }
  ]
});
```

### 陣列驗證

```typescript
// 驗證陣列回應
const result = engine.validate({
  data: [
    { id: 1, name: '使用者1' },
    { id: 2, name: '使用者2' }
  ],
  schema: {
    type: 'array',
    items: { $ref: '#/components/schemas/User' },
    minItems: 1,
    maxItems: 100
  }
});
```

## 擴充自訂規則

### 註冊新規則

```typescript
// 註冊自訂驗證規則
engine.registerCustomRule({
  name: 'phoneNumber',
  validate: (value: any) => {
    const phoneRegex = /^09\d{8}$/;
    return {
      valid: phoneRegex.test(value),
      message: value ? '無效的手機號碼格式' : '手機號碼為必填'
    };
  }
});

// 使用自訂規則
const result = engine.validate({
  data: { phone: '0912345678' },
  custom: [
    { field: 'phone', rule: 'phoneNumber' }
  ]
});
```

### 非同步驗證規則

```typescript
// 註冊非同步驗證規則 (例如檢查資料庫)
engine.registerCustomRule({
  name: 'uniqueEmail',
  async: true,
  validate: async (value: any) => {
    const exists = await database.checkEmailExists(value);
    return {
      valid: !exists,
      message: 'Email 已被使用'
    };
  }
});
```

## 效能優化

### Schema 編譯快取

```typescript
// ajv 會自動快取已編譯的 Schema
// 相同 Schema 不會重複編譯

// 手動預編譯常用 Schema
engine.precompileSchemas([
  '#/components/schemas/User',
  '#/components/schemas/Product',
  '#/components/schemas/Order'
]);
```

### 批次驗證優化

```typescript
// 使用批次驗證模式提升效能
const batchResult = engine.validateBatch(
  dataArray,
  schema,
  { parallel: true }
);
```

## 開發指令

```bash
# 編譯模組
pnpm run build

# 開發模式 (watch)
pnpm run dev

# 執行測試
pnpm run test

# 測試覆蓋率
pnpm run test:coverage
```

## 架構設計原則

1. **標準化**: 基於 JSON Schema 標準
2. **可擴充**: 易於新增自訂驗證規則
3. **效能優先**: Schema 編譯快取與批次優化
4. **友善錯誤**: 提供清楚的錯誤訊息與位置
5. **型別安全**: 完整的 TypeScript 型別定義

## 依賴關係

### 被依賴於
- `@specpilot/core-flow` - 驗證步驟回應
- `@specpilot/flow-validator` - 驗證流程定義

### 依賴於
- `@specpilot/config` - 讀取驗證組態
- `@specpilot/shared` - 共用工具

## 錯誤碼

- `1506` - 驗證錯誤基礎碼
- `1561` - Schema 驗證失敗
- `1562` - 自訂規則驗證失敗
- `1563` - 狀態碼驗證失敗
- `1564` - 格式驗證失敗

## 未來擴充方向

1. 支援更多自訂規則 (creditCard、isbn 等)
2. 視覺化驗證錯誤報告
3. 驗證規則市集
4. AI 輔助的驗證規則推薦
5. 效能監控與優化建議
6. 多語言錯誤訊息
7. 驗證規則組合器
8. 差異化驗證 (比較兩個版本的資料)
9. 部分驗證 (只驗證特定欄位)
10. 條件式驗證 (if-then-else)

## 版本歷史

### v0.3.0 (Phase 11 - 2025-10-20)

**重大更新**: 統一欄位路徑處理

- ✅ 新增 `getFieldPath()` 方法統一處理 `field` 與 `path` 參數
- ✅ 優先使用 `field`，若無則使用 `path`（向後相容）
- ✅ 所有自訂驗證規則支援雙參數
- ✅ 89 個測試通過

**技術細節**:
```typescript
private getFieldPath(ruleOptions: Record<string, unknown>): string {
  const field = ruleOptions.field as string | undefined;
  const path = ruleOptions.path as string | undefined;
  return field || path || '';
}
```

### v0.2.0 (Phase 10 - 2025-10-20)

**重大更新**: 新增 5 個驗證規則

- ✅ `equals` - 精確值比對
- ✅ `notContains` - 陣列不包含驗證
- ✅ `greaterThan` - 數值大於
- ✅ `lessThan` - 數值小於
- ✅ `length` - 長度驗證

### v0.1.0 (初始版本)

- ValidationEngine 核心引擎
- CustomValidator 自訂規則驗證器
- SchemaValidator JSON Schema 驗證器
- 3 個基本驗證規則: `notNull`, `regex`, `contains`
