# @specpilot/flow-parser - YAML 流程解析器

## 模組概述

`@specpilot/flow-parser` 是 SpecPilot 的 YAML 測試流程解析模組，負責將 YAML 格式的測試流程定義檔案解析為內部資料結構，並進行語法與語意驗證。

## 核心職責

1. **YAML 解析**: 將 YAML 檔案解析為 JavaScript 物件
2. **語法驗證**: 檢查流程定義的語法正確性
3. **語意驗證**: 驗證流程定義的邏輯合理性
4. **型別轉換**: 將解析結果轉換為型別安全的資料結構
5. **錯誤定位**: 提供精確的錯誤位置資訊

## 技術堆疊

### 核心依賴
- `yaml` (^2.4.3) - YAML 解析器
- `@specpilot/schemas` - Flow Schema 定義
- `@specpilot/shared` - 共用工具與型別

## Flow 定義格式

### 基本結構

```yaml
name: "測試流程名稱"
description: "流程描述 (選填)"
version: "1.0.0"

# 全域組態 (選填)
config:
  baseUrl: "http://localhost:3000"
  timeout: 5000
  headers:
    Content-Type: "application/json"

# 測試步驟
steps:
  - name: "步驟名稱"
    description: "步驟描述 (選填)"
    method: GET
    path: /api/users
    expect:
      status: 200
```

### 完整範例

```yaml
name: "使用者 CRUD 測試"
description: "測試使用者的建立、讀取、更新、刪除功能"
version: "1.0.0"

config:
  baseUrl: "http://localhost:3000"
  timeout: 10000

steps:
  # 步驟 1: 建立使用者
  - name: "建立新使用者"
    method: POST
    path: /users
    headers:
      Content-Type: "application/json"
    body:
      name: "測試使用者"
      email: "test@example.com"
      age: 25
    expect:
      status: 201
      schema: "#/components/schemas/User"
      custom:
        - field: "id"
          rule: "notNull"
        - field: "email"
          rule: "regex"
          pattern: "^[^@]+@[^@]+\\.[^@]+$"
    saveAs: createdUser

  # 步驟 2: 讀取使用者
  - name: "讀取建立的使用者"
    method: GET
    path: /users/${createdUser.id}
    expect:
      status: 200
      body:
        email: "test@example.com"

  # 步驟 3: 更新使用者
  - name: "更新使用者資料"
    method: PUT
    path: /users/${createdUser.id}
    body:
      name: "更新後的名稱"
    expect:
      status: 200

  # 步驟 4: 刪除使用者
  - name: "刪除使用者"
    method: DELETE
    path: /users/${createdUser.id}
    expect:
      status: 204
```

## 核心元件

### FlowParser
主要解析器類別：

```typescript
import { FlowParser } from '@specpilot/flow-parser';

const parser = new FlowParser();

// 從檔案解析
const flow = await parser.parseFile('flows/user-crud.yaml');

// 從字串解析
const flowFromString = await parser.parse(yamlContent);

// 從物件解析 (已解析的 YAML)
const flowFromObject = parser.parseObject(yamlObject);
```

### ValidationEngine
驗證引擎，檢查流程定義的正確性：

```typescript
class ValidationEngine {
  // 驗證語法
  validateSyntax(flow: unknown): ValidationResult;

  // 驗證語意
  validateSemantics(flow: FlowDefinition): ValidationResult;

  // 驗證變數引用
  validateVariableReferences(flow: FlowDefinition): ValidationResult;
}
```

### VariableResolver
變數解析器，處理變數引用：

```typescript
class VariableResolver {
  // 解析變數引用
  resolveReferences(template: string, context: Record<string, any>): string;

  // 檢查變數引用的有效性
  validateReferences(flow: FlowDefinition): string[];
}
```

## 支援的 HTTP 方法

- `GET` - 讀取資源
- `POST` - 建立資源
- `PUT` - 完整更新資源
- `PATCH` - 部分更新資源
- `DELETE` - 刪除資源
- `HEAD` - 取得 Header 資訊
- `OPTIONS` - 取得支援的方法

## 變數系統

### 儲存變數

```yaml
steps:
  - name: "建立使用者"
    method: POST
    path: /users
    body: { name: "測試" }
    saveAs: user  # 儲存整個回應
```

### 引用變數

```yaml
steps:
  - name: "使用儲存的變數"
    method: GET
    path: /users/${user.id}          # 引用 user.id
    headers:
      Authorization: "Bearer ${user.token}"  # 引用 user.token
```

### 支援的變數路徑

- `${varName}` - 取得整個變數
- `${varName.field}` - 取得物件欄位
- `${varName.nested.field}` - 支援巢狀路徑
- `${varName[0]}` - 取得陣列元素
- `${varName[0].field}` - 陣列元素的欄位

## 驗證規則

### 狀態碼驗證

```yaml
expect:
  status: 200           # 期望 200
  status: [200, 201]    # 期望 200 或 201
```

### Schema 驗證

```yaml
expect:
  schema: "#/components/schemas/User"  # 引用 OpenAPI Schema
```

### 自訂驗證規則

```yaml
expect:
  custom:
    # 非空驗證
    - field: "id"
      rule: "notNull"

    # 正規表示式驗證
    - field: "email"
      rule: "regex"
      pattern: "^[^@]+@[^@]+\\.[^@]+$"

    # 包含驗證
    - field: "tags"
      rule: "contains"
      value: "important"
```

## 錯誤處理

### 解析錯誤

```typescript
try {
  const flow = await parser.parseFile('invalid.yaml');
} catch (error) {
  if (error instanceof FlowParseError) {
    console.error(`解析錯誤於第 ${error.line} 行: ${error.message}`);
    console.error(`錯誤內容: ${error.snippet}`);
  }
}
```

### 驗證錯誤

```typescript
const result = parser.validate(flow);

if (!result.valid) {
  result.errors.forEach(err => {
    console.error(`${err.path}: ${err.message}`);
  });
}
```

## 開發指令

```bash
# 編譯模組
pnpm run build

# 開發模式 (watch)
pnpm run dev
```

## 架構設計原則

1. **容錯性**: 提供清楚的錯誤訊息與建議修正方式
2. **擴充性**: 易於新增新的驗證規則與語法特性
3. **效能**: 使用高效的 YAML 解析器，支援大型流程檔案
4. **型別安全**: 完整的 TypeScript 型別定義
5. **標準化**: 遵循 YAML 1.2 規範

## 依賴關係

### 被依賴於
- `@specpilot/core-flow` - 執行前解析流程
- `@specpilot/flow-generator` - 驗證產生的流程
- `@specpilot/flow-validator` - 流程品質檢查
- `apps/cli` - CLI 載入流程
- `apps/mcp-server` - MCP 工具載入流程

### 依賴於
- `@specpilot/schemas` - Schema 定義
- `@specpilot/shared` - 共用工具

## 錯誤碼範圍

- `1503` - Flow 解析錯誤
- `1540-1549` - YAML 語法錯誤
- `1550-1559` - Flow 驗證錯誤
- `1560-1569` - 變數引用錯誤

## 擴充功能

### 自訂驗證器

```typescript
import { FlowParser, ValidationRule } from '@specpilot/flow-parser';

// 註冊自訂驗證規則
const customRule: ValidationRule = {
  name: 'customRule',
  validate: (value, options) => {
    // 驗證邏輯
    return { valid: true };
  }
};

parser.registerValidationRule(customRule);
```

### 自訂函式

```typescript
// 註冊自訂函式供變數系統使用
parser.registerFunction('uuid', () => {
  return crypto.randomUUID();
});

// 在 YAML 中使用
// path: /users/${uuid()}
```

## 未來擴充方向

1. 支援 JSON 格式的流程定義
2. 流程繼承與組合 (extends, includes)
3. 條件步驟 (if/else)
4. 迴圈步驟 (for/while)
5. 並行步驟執行定義
6. 流程範本系統
7. 視覺化流程編輯器
8. 多檔案流程分割與引用
9. 流程版本相容性檢查
