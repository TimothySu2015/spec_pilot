# @specpilot/flow-validator - Flow 定義驗證器

## 模組概述

`@specpilot/flow-validator` 是 SpecPilot 的流程品質檢查模組，專門用於驗證自動生成或手寫的測試流程定義是否符合規範、邏輯是否合理、品質是否達標。這是確保 AI 生成流程可靠性的關鍵模組。

## 核心職責

1. **結構驗證**: 檢查流程定義結構是否完整正確
2. **語意驗證**: 驗證流程邏輯的合理性與一致性
3. **端點驗證**: 確認流程中的端點都存在於 OpenAPI 規格中
4. **依賴驗證**: 檢查變數依賴關係是否完整無循環
5. **品質評估**: 對流程品質進行量化評分
6. **最佳實踐檢查**: 檢查是否符合測試流程的最佳實踐

## 技術堆疊

### 核心依賴
- `@specpilot/spec-loader` - 載入 OpenAPI 規格進行對照
- `@specpilot/flow-parser` - 解析流程定義
- `@specpilot/schemas` - Schema 定義
- `ajv` (^8.12.0) - JSON Schema 驗證

## 核心元件

### FlowValidator
主要驗證器類別：

```typescript
import { FlowValidator } from '@specpilot/flow-validator';

const validator = new FlowValidator({
  spec: openApiSpec,
  strictMode: true  // 嚴格模式
});

// 驗證流程
const result = await validator.validate(flow);

if (result.valid) {
  console.log(`✅ 流程驗證通過 (評分: ${result.score}/100)`);
} else {
  console.log(`❌ 發現 ${result.errors.length} 個錯誤`);
  result.errors.forEach(err => {
    console.log(`  - ${err.message} (${err.severity})`);
  });
}
```

### QualityAnalyzer
品質分析器，對流程品質進行量化評估：

```typescript
class QualityAnalyzer {
  analyze(flow: FlowDefinition): QualityReport {
    return {
      overallScore: 85,
      metrics: {
        structureScore: 95,    // 結構完整度
        coverageScore: 80,     // 測試覆蓋度
        maintainabilityScore: 90,  // 可維護性
        reliabilityScore: 85   // 可靠性
      },
      suggestions: [...]
    };
  }
}
```

### DependencyValidator
依賴驗證器，檢查變數依賴關係：

```typescript
class DependencyValidator {
  // 檢查變數引用完整性
  validateReferences(flow: FlowDefinition): ValidationError[];

  // 偵測循環依賴
  detectCircularDependencies(flow: FlowDefinition): string[][];

  // 檢查未使用的變數
  findUnusedVariables(flow: FlowDefinition): string[];
}
```

## 驗證類型

### 1. 結構驗證

檢查流程定義的基本結構：

- ✅ 必要欄位是否存在 (name, steps)
- ✅ 欄位型別是否正確
- ✅ 步驟定義是否完整
- ✅ HTTP 方法是否有效
- ✅ 路徑格式是否正確

```typescript
// 錯誤範例
{
  name: "測試",
  steps: [
    { method: "INVALID", path: "/users" }  // ❌ 無效的 HTTP 方法
  ]
}
```

### 2. 端點驗證

對照 OpenAPI 規格檢查端點：

- ✅ 端點路徑是否存在
- ✅ HTTP 方法是否支援
- ✅ 請求參數是否符合規格
- ✅ 請求 Body 是否符合 Schema

```yaml
steps:
  - name: "測試"
    method: POST
    path: /api/users  # 檢查此端點是否在 OpenAPI 中定義
    body:
      name: "測試"    # 檢查欄位是否符合 Schema
```

### 3. 依賴驗證

檢查變數依賴關係：

```yaml
steps:
  # ❌ 錯誤：引用了不存在的變數
  - name: "步驟 1"
    path: /users/${unknownVar.id}

  # ✅ 正確：先儲存再引用
  - name: "步驟 2"
    path: /users
    saveAs: user

  - name: "步驟 3"
    path: /users/${user.id}
```

### 4. 語意驗證

檢查邏輯合理性：

- ✅ DELETE 後不應再 GET 同一資源
- ✅ 認證步驟應在需要認證的步驟之前
- ✅ 建立資源前不應先刪除
- ✅ 變數引用的順序合理

```yaml
# ❌ 語意錯誤範例
steps:
  - name: "刪除使用者"
    method: DELETE
    path: /users/123
    saveAs: deletedUser

  - name: "讀取已刪除的使用者"  # ❌ 邏輯不合理
    method: GET
    path: /users/${deletedUser.id}
```

### 5. 品質檢查

評估流程品質：

```typescript
interface QualityMetrics {
  // 結構品質
  hasDescription: boolean;        // 是否有描述
  stepsHaveNames: boolean;        // 步驟是否都有名稱
  properNaming: boolean;          // 命名是否規範

  // 測試覆蓋
  coversCRUD: boolean;            // 是否涵蓋 CRUD
  hasValidation: boolean;         // 是否有驗證規則
  coversErrorCases: boolean;      // 是否涵蓋錯誤情境

  // 可維護性
  reasonableLength: boolean;      // 步驟數量合理 (<50)
  noHardcodedValues: boolean;     // 無硬編碼值
  usesVariables: boolean;         // 使用變數系統

  // 可靠性
  hasRetryLogic: boolean;         // 有重試機制
  hasTimeouts: boolean;           // 有逾時設定
  properErrorHandling: boolean;   // 有錯誤處理
}
```

## 驗證結果

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean;
  score: number;  // 0-100
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: Suggestion[];
  metrics: QualityMetrics;
}

interface ValidationError {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  path: string;  // 錯誤位置 (例如: steps[2].method)
  suggestion?: string;  // 修正建議
}
```

### 範例輸出

```typescript
{
  valid: false,
  score: 65,
  errors: [
    {
      severity: 'error',
      code: 'INVALID_ENDPOINT',
      message: '端點 /api/unknown 不存在於 OpenAPI 規格中',
      path: 'steps[3].path',
      suggestion: '請檢查 OpenAPI 規格或修正端點路徑'
    },
    {
      severity: 'warning',
      code: 'UNUSED_VARIABLE',
      message: '變數 "user" 已儲存但從未使用',
      path: 'steps[1].saveAs'
    }
  ],
  warnings: [
    {
      severity: 'warning',
      code: 'MISSING_DESCRIPTION',
      message: '建議為流程加入描述以提高可讀性',
      path: 'description'
    }
  ],
  suggestions: [
    '考慮加入錯誤情境測試 (4xx, 5xx)',
    '建議為關鍵步驟加入自訂驗證規則',
    '可以使用變數減少硬編碼值'
  ]
}
```

## 使用範例

### 基本驗證

```typescript
import { FlowValidator } from '@specpilot/flow-validator';

const validator = new FlowValidator({
  spec: await loadSpec('specs/api.yaml')
});

const flow = await parseFlow('flows/test.yaml');
const result = await validator.validate(flow);

if (!result.valid) {
  console.error('驗證失敗:');
  result.errors.forEach(e => console.error(`  ${e.message}`));
  process.exit(1);
}
```

### 品質檢查

```typescript
const qualityReport = await validator.analyzeQuality(flow);

console.log(`品質評分: ${qualityReport.overallScore}/100`);
console.log('改進建議:');
qualityReport.suggestions.forEach(s => console.log(`  - ${s}`));
```

### 自訂驗證規則

```typescript
validator.addCustomRule({
  name: 'require-auth-step',
  validate: (flow) => {
    const hasAuthStep = flow.steps.some(s =>
      s.path.includes('/auth') || s.path.includes('/login')
    );
    return {
      valid: hasAuthStep,
      message: hasAuthStep ? '✅' : '❌ 流程應包含認證步驟'
    };
  }
});
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

1. **層次驗證**: 從語法到語意，層層檢查
2. **友善回饋**: 提供清楚的錯誤訊息與修正建議
3. **可擴充性**: 易於新增自訂驗證規則
4. **效能優先**: 快速驗證，適合 CI/CD 整合
5. **智慧建議**: 提供改進建議而非僅指出錯誤

## 依賴關係

### 被依賴於
- `@specpilot/flow-generator` - 驗證生成的流程
- `apps/mcp-server` - MCP 工具驗證
- CI/CD Pipeline - 自動化品質檢查

### 依賴於
- `@specpilot/spec-loader` - 載入規格對照
- `@specpilot/flow-parser` - 解析流程
- `@specpilot/schemas` - Schema 定義

## 驗證等級

### Strict Mode (嚴格模式)
- 所有警告都視為錯誤
- 要求 100% 符合最佳實踐
- 適用於正式環境

### Standard Mode (標準模式)
- 只有錯誤會導致驗證失敗
- 警告僅作為建議
- 適用於開發環境

### Permissive Mode (寬鬆模式)
- 僅檢查致命錯誤
- 適用於快速測試

## 未來擴充方向

1. 支援自訂驗證規則市集
2. 整合效能測試驗證 (負載測試配置)
3. 安全性檢查 (敏感資料外洩檢測)
4. 多流程依賴驗證
5. 視覺化驗證報告
6. AI 輔助的智慧修復建議
7. 團隊規範設定檔 (.flowlintrc)
8. IDE 外掛即時驗證
