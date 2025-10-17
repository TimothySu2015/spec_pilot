# @specpilot/test-suite-generator - 測試套件自動產生器

## ⚠️ 實作狀態

**版本**: 0.2.0
**完成度**: 75%
**最後更新**: 2025-01-17
**維護狀態**: 開發中 (核心功能完成)

---

### ⚠️ 重要提示

此模組負責**批次自動產生完整測試套件**，與 `@specpilot/flow-generator` 的對話式產生是互補關係。

**核心功能已實作完成**，能夠：
- ✅ 自動分析 OpenAPI 規格
- ✅ 產生 CRUD 成功案例
- ✅ 產生錯誤案例測試
- ✅ 產生邊界測試
- ✅ 推斷資源依賴關係
- ✅ 自動產生測試資料
- ✅ 品質檢查與建議

**未完成功能**主要是進階配置與優化，不影響基本使用。

---

## 已實作功能 ✅

### 1. TestSuiteGenerator - 測試套件產生器

**檔案位置**: `src/test-suite-generator.ts` (146 行)
**測試覆蓋**: ❌ 尚無測試 (整合測試存在於 E2E 測試中)

✅ **完整實作的功能**:
- 整合所有產生器 (CRUD、Error、Edge、Dependency)
- 產生完整測試套件 (包含成功、錯誤、邊界案例)
- 支援選擇性端點產生
- 自動產生測試統計摘要
- 從 OpenAPI servers 提取 baseUrl

**主要方法**:
- `generate(options)` - 產生完整測試套件
- `getSummary(flow)` - 取得測試摘要
- `getTargetEndpoints(options)` - 過濾目標端點
- `extractBaseUrl()` - 提取 API 基礎 URL

**API 範例**:
```typescript
import { TestSuiteGenerator } from '@specpilot/test-suite-generator';
import { SpecAnalyzer } from '@specpilot/test-suite-generator';

// 1. 建立規格分析器
const analyzer = new SpecAnalyzer({ spec: openApiDoc });

// 2. 建立測試產生器
const generator = new TestSuiteGenerator(analyzer, {
  includeSuccessCases: true,   // 預設 true
  includeErrorCases: true,      // 預設 false
  includeEdgeCases: true,       // 預設 false
  generateFlows: true,          // 預設 false (資源依賴流程)
  endpoints: ['createUser', 'getUser']  // 可選：只產生特定端點
});

// 3. 產生測試套件
const flow = generator.generate();
// FlowDefinition {
//   name: '自動產生的測試套件',
//   description: '包含 N 個端點的測試案例',
//   baseUrl: 'http://localhost:3000',
//   steps: [...],
//   metadata: { summary: { totalTests, successTests, errorTests, ... } }
// }

// 4. 取得測試摘要
const summary = generator.getSummary(flow);
// {
//   totalTests: 15,
//   successTests: 5,
//   errorTests: 8,
//   edgeTests: 2,
//   endpoints: ['createUser', 'getUser', ...]
// }
```

**產生的測試類型**:
1. **成功案例** (includeSuccessCases)
   - 每個端點 1 個基本成功案例
   - 自動產生測試資料

2. **錯誤案例** (includeErrorCases)
   - 必填欄位缺失測試
   - 格式驗證失敗測試
   - 認證錯誤測試 (401)

3. **邊界測試** (includeEdgeCases)
   - 最大/最小長度測試
   - 最大/最小值測試

4. **流程串接** (generateFlows)
   - 自動推斷 CRUD 操作順序
   - 變數提取與引用

---

### 2. SpecAnalyzer - OpenAPI 規格分析器

**檔案位置**: `src/spec-analyzer.ts` (358 行)
**測試覆蓋**: ✅ `__tests__/spec-analyzer.test.ts` (2 個測試通過)

✅ **完整實作的功能**:
- 提取所有 API 端點資訊
- 解析 requestBody 與 response Schema
- 分析資源依賴關係 (依賴圖)
- 識別認證端點
- 自動產生 operationId (如果缺少)
- 提取 OpenAPI examples

**主要方法**:
- `extractEndpoints()` - 提取所有端點 ✅
- `analyzeDependencies()` - 分析資源依賴圖 ✅
- `getAuthenticationFlow()` - 識別登入端點 ✅

**API 範例**:
```typescript
import { SpecAnalyzer } from '@specpilot/test-suite-generator';

const analyzer = new SpecAnalyzer({ spec: openApiDoc });

// 提取所有端點
const endpoints = analyzer.extractEndpoints();
// [
//   {
//     path: '/users',
//     method: 'POST',
//     operationId: 'createUser',
//     summary: '建立使用者',
//     requestSchema: { type: 'object', properties: {...} },
//     responseSchemas: { 201: {...} },
//     security: [...],
//     examples: {...}
//   },
//   ...
// ]

// 分析依賴關係
const graph = analyzer.analyzeDependencies();
// {
//   nodes: [
//     { operationId: 'createUser', resourceType: 'users', ... }
//   ],
//   edges: [
//     { from: 'createUser', to: 'getUser', type: 'creates', variable: 'id' }
//   ]
// }

// 識別認證流程
const authFlow = analyzer.getAuthenticationFlow();
// {
//   operationId: 'userLogin',
//   endpoint: {...},
//   credentialFields: ['username', 'password'],
//   tokenField: 'token'
// }
```

**依賴分析邏輯**:
- POST `/users` → GET `/users/{id}` (creates)
- POST `/users` → PUT `/users/{id}` (modifies)
- POST `/users` → DELETE `/users/{id}` (deletes)
- 路徑參數依賴自動推斷

---

### 3. CRUDGenerator - CRUD 測試產生器

**檔案位置**: `src/crud-generator.ts` (94 行)
**測試覆蓋**: ✅ `__tests__/crud-generator.test.ts` (2 個測試通過)

✅ **完整實作的功能**:
- 產生基本 CRUD 成功案例
- 根據 HTTP method 推斷預期狀態碼
- 從 OpenAPI responses 讀取實際狀態碼
- 整合 DataSynthesizer 產生測試資料

**主要方法**:
- `generateSuccessCases(endpoint)` - 產生成功測試 ✅
- `synthesizeTestData(schema, examples)` - 產生測試資料 ✅

**狀態碼對應**:
- GET → 200
- POST → 201 (如果 responses 有定義則使用規格值)
- PUT/PATCH → 200
- DELETE → 204

**API 範例**:
```typescript
import { CRUDGenerator } from '@specpilot/test-suite-generator';

const generator = new CRUDGenerator({
  useExamples: true  // 優先使用 OpenAPI examples
});

const steps = generator.generateSuccessCases(endpoint);
// [
//   {
//     name: '建立使用者 - 成功案例',
//     request: {
//       method: 'POST',
//       path: '/users',
//       body: { username: 'testuser', email: 'test@example.tw' }
//     },
//     expectations: {
//       status: 201
//     }
//   }
// ]
```

---

### 4. DataSynthesizer - 測試資料合成器

**檔案位置**: `src/data-synthesizer.ts` (340 行)
**測試覆蓋**: ❌ 尚無測試 (透過 CRUD 測試間接驗證)

✅ **完整實作的功能**:
- 根據 JSON Schema 產生測試資料
- 優先使用 examples、default 值
- 支援 enum 選擇
- 支援所有 JSON 類型 (string, number, boolean, array, object)
- 支援 format 驗證 (email, uuid, date, phone 等)
- 根據欄位名稱產生合理資料 (username, password, email 等)
- 支援繁體中文與英文 locale
- 產生無效值 (用於錯誤測試)

**主要方法**:
- `synthesize(schema, examples)` - 產生有效測試資料 ✅
- `synthesizeInvalid(schema)` - 產生無效測試資料 ✅

**API 範例**:
```typescript
import { DataSynthesizer } from '@specpilot/test-suite-generator';

const synthesizer = new DataSynthesizer({
  useExamples: true,
  useDefaults: true,
  useEnums: true,
  locale: 'zh-TW'  // 或 'en-US'
});

// 產生有效資料
const validData = synthesizer.synthesize({
  type: 'object',
  properties: {
    username: { type: 'string' },
    email: { type: 'string', format: 'email' },
    age: { type: 'integer', minimum: 0, maximum: 150 }
  },
  required: ['username', 'email']
});
// {
//   username: 'testuser',
//   email: 'test@example.tw',
//   age: 1
// }

// 產生無效資料
const invalidEmail = synthesizer.synthesizeInvalid({
  type: 'string',
  format: 'email'
});
// 'invalid-email'
```

**支援的 format**:
- email → `test@example.tw` / `test@example.com`
- uuid → `123e4567-e89b-12d3-a456-426614174000`
- date → `2025-01-17`
- date-time → ISO 8601 格式
- uri/url → `https://example.com`
- ipv4 → `192.168.1.1`
- phone → `0912345678` (zh-TW) / `+1-555-123-4567` (en-US)

**智慧欄位識別**:
- `username` → `testuser`
- `password` → `password123`
- `email` → `test@example.tw`
- `name` → `測試使用者` (zh-TW) / `Test User` (en-US)
- `description` → `這是測試描述`
- `address` → `台北市信義區`

---

### 5. DependencyResolver - 依賴解析器

**檔案位置**: `src/dependency-resolver.ts` (319 行)
**測試覆蓋**: ❌ 尚無測試

✅ **完整實作的功能**:
- 分析資源依賴關係
- 產生 CRUD 流程串接
- 自動推斷變數依賴 (resourceId)
- 支援登入流程識別 (authToken)
- 按資源類型分組端點
- 產生 CRUD 執行順序 (POST → GET → PUT → DELETE)
- 自動替換路徑參數為變數引用

**主要方法**:
- `resolveExecutionOrder(endpoints)` - 產生串接流程 ✅
- `analyzeDependencies(endpoints)` - 分析依賴 ✅

**API 範例**:
```typescript
import { DependencyResolver } from '@specpilot/test-suite-generator';

const resolver = new DependencyResolver();
const steps = resolver.resolveExecutionOrder(endpoints);
// [
//   {
//     name: '建立使用者',
//     request: { method: 'POST', path: '/users', body: {...} },
//     capture: [{ variableName: 'resourceId', path: 'id' }],
//     expect: { statusCode: 201 }
//   },
//   {
//     name: '取得使用者',
//     request: { method: 'GET', path: '/users/{{resourceId}}' },
//     expect: { statusCode: 200 }
//   },
//   {
//     name: '更新使用者',
//     request: { method: 'PUT', path: '/users/{{resourceId}}', body: {...} },
//     expect: { statusCode: 200 }
//   },
//   {
//     name: '刪除使用者',
//     request: { method: 'DELETE', path: '/users/{{resourceId}}' },
//     expect: { statusCode: 204 }
//   }
// ]
```

**變數命名邏輯**:
- 登入端點 → `authToken` (從 `token` 欄位提取)
- 資源建立 → `resourceId` (從 `id` 欄位提取)
- 路徑參數 → 自動替換為 `{{resourceId}}`

---

### 6. ErrorCaseGenerator - 錯誤案例產生器

**檔案位置**: `src/error-case-generator.ts` (173 行)
**測試覆蓋**: ❌ 尚無測試

✅ **完整實作的功能**:
- 產生必填欄位缺失測試
- 產生格式驗證失敗測試
- 產生認證錯誤測試 (401)
- 整合 DataSynthesizer 產生無效資料

**主要方法**:
- `generateMissingFieldCases(endpoint)` - 必填欄位缺失 ✅
- `generateFormatValidationCases(endpoint)` - 格式驗證錯誤 ✅
- `generateAuthErrorCases(endpoint)` - 認證錯誤 ✅

**API 範例**:
```typescript
import { ErrorCaseGenerator } from '@specpilot/test-suite-generator';

const generator = new ErrorCaseGenerator({
  includeMissingFields: true,
  includeInvalidFormats: true,
  includeAuthErrors: true
});

const endpoint = {
  path: '/users',
  method: 'POST',
  operationId: 'createUser',
  requestSchema: {
    type: 'object',
    properties: {
      username: { type: 'string' },
      email: { type: 'string', format: 'email' }
    },
    required: ['username', 'email']
  },
  security: [{ bearerAuth: [] }]
};

// 必填欄位缺失
const missingCases = generator.generateMissingFieldCases(endpoint);
// [
//   {
//     name: '建立使用者 - 缺少 username',
//     request: { method: 'POST', path: '/users', body: { email: '...' } },
//     expect: { statusCode: 400 }
//   },
//   {
//     name: '建立使用者 - 缺少 email',
//     request: { method: 'POST', path: '/users', body: { username: '...' } },
//     expect: { statusCode: 400 }
//   }
// ]

// 格式驗證錯誤
const formatCases = generator.generateFormatValidationCases(endpoint);
// [
//   {
//     name: '建立使用者 - 無效 email 格式',
//     request: { method: 'POST', path: '/users', body: { email: 'invalid-email', ... } },
//     expect: { statusCode: 400 }
//   }
// ]

// 認證錯誤
const authCases = generator.generateAuthErrorCases(endpoint);
// [
//   {
//     name: '建立使用者 - 無認證',
//     request: { method: 'POST', path: '/users' },
//     expect: { statusCode: 401 }
//   }
// ]
```

---

### 7. EdgeCaseGenerator - 邊界測試產生器

**檔案位置**: `src/edge-case-generator.ts` (148 行)
**測試覆蓋**: ❌ 尚無測試

✅ **完整實作的功能**:
- 產生字串長度邊界測試 (minLength, maxLength)
- 產生數值範圍邊界測試 (minimum, maximum)
- 產生超出限制的測試 (預期 400)

**主要方法**:
- `generateEdgeCases(endpoint)` - 產生邊界測試 ✅

**API 範例**:
```typescript
import { EdgeCaseGenerator } from '@specpilot/test-suite-generator';

const generator = new EdgeCaseGenerator();

const endpoint = {
  path: '/users',
  method: 'POST',
  operationId: 'createUser',
  requestSchema: {
    type: 'object',
    properties: {
      username: { type: 'string', minLength: 3, maxLength: 20 },
      age: { type: 'integer', minimum: 0, maximum: 150 }
    }
  }
};

const steps = generator.generateEdgeCases(endpoint);
// [
//   { name: '建立使用者 - username 最小長度', ..., expect: { status: 200 } },
//   { name: '建立使用者 - username 最大長度', ..., expect: { status: 200 } },
//   { name: '建立使用者 - username 超過最大長度', ..., expect: { status: 400 } },
//   { name: '建立使用者 - age 最小值', ..., expect: { status: 200 } },
//   { name: '建立使用者 - age 最大值', ..., expect: { status: 200 } }
// ]
```

---

### 8. FlowQualityChecker - Flow 品質檢查器

**檔案位置**: `src/flow-quality-checker.ts` (459 行)
**測試覆蓋**: ❌ 尚無測試

✅ **完整實作的功能**:
- 檢查狀態碼是否符合 OpenAPI 規格
- 檢查測試資料品質 (過短、格式錯誤)
- 檢查步驟名稱重複
- 檢查認證流程完整性
- 檢查路徑參數處理
- 檢查 capture 欄位設定
- 產生品質評分 (0-100)
- 產生自動修正建議

**主要方法**:
- `check()` - 執行品質檢查 ✅
- `generateFixSuggestions(report)` - 產生修正建議 ✅

**API 範例**:
```typescript
import { FlowQualityChecker } from '@specpilot/test-suite-generator';

const checker = new FlowQualityChecker(spec, flow);
const report = checker.check();
// {
//   totalIssues: 5,
//   errors: 1,
//   warnings: 3,
//   infos: 1,
//   score: 75,
//   issues: [
//     {
//       severity: 'error',
//       type: 'invalid_status_code',
//       location: 'steps[2].expect.statusCode',
//       message: '預期狀態碼 200 與 OpenAPI 規格不符',
//       suggestion: '應該使用 201',
//       stepIndex: 2
//     },
//     {
//       severity: 'warning',
//       type: 'poor_test_data',
//       location: 'steps[0].request.body.username',
//       message: '測試資料 "x" 過於簡單',
//       suggestion: '建議使用更真實的測試資料',
//       stepIndex: 0
//     }
//   ]
// }

// 產生修正建議
const suggestions = checker.generateFixSuggestions(report);
// [
//   {
//     stepIndex: 2,
//     fieldPath: 'expect.statusCode',
//     currentValue: 200,
//     suggestedValue: 201,
//     reason: '預期狀態碼 200 與 OpenAPI 規格不符'
//   }
// ]
```

**檢查項目**:
- ✅ 狀態碼與規格一致性
- ✅ 測試資料合理性 (長度、格式)
- ✅ 步驟名稱唯一性與清晰度
- ✅ 認證流程完整性
- ✅ 路徑參數正確處理
- ✅ Capture 欄位正確設定

**評分計算**:
- 每個 error: -10 分
- 每個 warning: -5 分
- 每個 info: -2 分
- 基礎分: 100 分

---

### 9. 型別定義

**檔案位置**: `src/types.ts`

✅ **完整定義的型別**:
- `GenerationOptions` - 產生器選項
- `TestSuiteSummary` - 測試摘要
- `EndpointInfo` - 端點資訊
- `DependencyGraph` - 依賴圖
- `DependencyNode` - 依賴節點
- `DependencyEdge` - 依賴邊
- `AuthFlowInfo` - 認證流程資訊
- `JSONSchema` - JSON Schema 定義
- `SpecAnalyzerConfig` - 規格分析器配置
- `CRUDGeneratorConfig` - CRUD 產生器配置
- `ErrorCaseGeneratorConfig` - 錯誤產生器配置

---

## 未實作功能 ❌

以下功能在原 CLAUDE.md 中描述，但**完全沒有程式碼**:

### 1. TestCaseGenerator (抽象類別)

❌ **狀態**: 未實作
**原因**: 設計調整，改為具體的產生器 (CRUD/Error/Edge)
**原設計**: 統一的 `generateHappyPathTests()` 等方法
**實際**: 分散到 CRUDGenerator、ErrorCaseGenerator、EdgeCaseGenerator

---

### 2. TestSuiteGenerator 的部分 API

❌ **狀態**: 未實作

**不存在的方法**:
```typescript
// ❌ 這些方法不存在
generator.generateForResource('User');
generator.generateForEndpoint('POST', '/users');
generator.generateCRUDTests();
generator.getCoverageReport();  // 覆蓋率報告
```

**實際 API**:
```typescript
// ✅ 實際存在的方法
generator.generate(options);
generator.getSummary(flow);
```

---

### 3. TestSuite 物件與 saveAll 方法

❌ **狀態**: 未實作

**原設計的 API (不存在)**:
```typescript
// ❌ 不存在
const testSuite = await generator.generate();
await testSuite.saveAll('flows/generated/');
```

**實際使用**:
```typescript
// ✅ 實際方式
const flow = generator.generate();
import { stringify } from 'yaml';
const yamlContent = stringify(flow);
// 手動儲存到檔案
```

---

### 4. 資料產生策略

❌ **狀態**: 部分未實作

**實作的**:
- ✅ 根據 Schema 產生資料
- ✅ 使用 examples
- ✅ 使用 default 值
- ✅ 根據 format 產生

**未實作的**:
- ❌ 使用 faker.js 產生更真實的資料
- ❌ 可配置的資料產生策略

---

### 5. 測試套件類型 (Smoke/Basic/Comprehensive)

❌ **狀態**: 概念存在，但無專門實作

**原設計**: 三種預設套件類型
**實際**: 透過 `GenerationOptions` 控制，但無預設組合

**實際使用**:
```typescript
// 模擬 Smoke Test
const flow = generator.generate({
  includeSuccessCases: true,
  includeErrorCases: false,
  includeEdgeCases: false,
  endpoints: ['health', 'auth']  // 手動指定關鍵端點
});

// 模擬 Comprehensive Test
const flow = generator.generate({
  includeSuccessCases: true,
  includeErrorCases: true,
  includeEdgeCases: true,
  generateFlows: true
});
```

---

### 6. CRUD 資源識別方法

❌ **狀態**: 未實作

**原設計**:
```typescript
// ❌ 不存在
const resources = generator.identifyCRUDResources(spec);
const models = generator.analyzeDataModels(spec);
```

**實際**: 功能在 SpecAnalyzer 中，但無專門的 CRUD 資源識別方法

---

## 模組概述

### 核心職責

本模組負責**批次自動產生完整的測試套件**，透過分析 OpenAPI 規格，自動產生涵蓋所有端點的測試流程。

**與 flow-generator 的區別**:
- `test-suite-generator`: 批次式、自動化、一次產生完整測試套件
- `flow-generator`: 對話式、漸進式、需要人工參與

### 技術堆疊

**核心依賴**:
- `@specpilot/spec-loader` (workspace:*) - 載入 OpenAPI 規格
- `@specpilot/flow-parser` (workspace:*) - Flow 定義型別
- `@specpilot/schemas` (workspace:*) - Schema 定義
- `@specpilot/shared` (workspace:*) - 共用工具
- `yaml` (^2.4.3) - YAML 序列化

**開發依賴**:
- `vitest` (^1.6.0) - 測試框架
- `tsup` (^8.0.1) - 打包工具
- `tsx` (^4.7.0) - TypeScript 執行器

---

## MCP Server 整合

本模組透過 MCP Server 的 `generateFlow` 工具使用：

**檔案位置**: `apps/mcp-server/src/handlers/generate-flow.ts`

**使用場景**:
- MCP `generateFlow` 工具的 `generateFlows: true` 選項
- 自動產生完整測試套件

---

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

---

## 測試狀態

### 單元測試

**當前覆蓋率**: ~20% (僅 2 個核心類別有測試)

| 模組 | 測試檔案 | 狀態 |
|------|---------|------|
| CRUDGenerator | ✅ `__tests__/crud-generator.test.ts` | 2 個測試通過 |
| SpecAnalyzer | ✅ `__tests__/spec-analyzer.test.ts` | 2 個測試通過 |
| DataSynthesizer | ❌ 無測試 | 待建立 |
| ErrorCaseGenerator | ❌ 無測試 | 待建立 |
| EdgeCaseGenerator | ❌ 無測試 | 待建立 |
| DependencyResolver | ❌ 無測試 | 待建立 |
| TestSuiteGenerator | ❌ 無測試 | 待建立 |
| FlowQualityChecker | ❌ 無測試 | 待建立 |

**執行測試**:
```bash
# 執行此模組的測試
pnpm -w run test packages/test-suite-generator/__tests__/ --run

# 覆蓋率報告
pnpm -w run test packages/test-suite-generator/__tests__/ --coverage
```

**E2E 測試**:
- ✅ 完整的整合測試存在於 `tests/e2e/flow-generation.e2e.spec.ts`
- ✅ 驗證產生的 Flow 可以被 FlowOrchestrator 執行

---

## 架構設計

### 設計原則

1. **自動化優先**: 盡可能減少人工介入
2. **智慧推斷**: 自動推斷依賴與資料關係
3. **品質保證**: 產生的流程都經過驗證
4. **可讀性**: 產生的流程易於理解與維護
5. **可擴充**: 易於新增新的產生策略

### 目錄結構

```
packages/test-suite-generator/
├── src/
│   ├── index.ts                    # 主要匯出
│   ├── test-suite-generator.ts     # ✅ 主產生器
│   ├── spec-analyzer.ts            # ✅ 規格分析
│   ├── crud-generator.ts           # ✅ CRUD 測試
│   ├── data-synthesizer.ts         # ✅ 測試資料產生
│   ├── dependency-resolver.ts      # ✅ 依賴解析
│   ├── error-case-generator.ts     # ✅ 錯誤案例
│   ├── edge-case-generator.ts      # ✅ 邊界測試
│   ├── flow-quality-checker.ts     # ✅ 品質檢查
│   └── types.ts                    # ✅ 型別定義
├── __tests__/
│   ├── crud-generator.test.ts      # ✅ CRUD 測試
│   └── spec-analyzer.test.ts       # ✅ 分析器測試
├── package.json
└── tsconfig.json
```

---

## 依賴關係

### 被依賴於

- `apps/mcp-server` - MCP Server 的 `generateFlow` 工具

### 依賴於

- `@specpilot/spec-loader` - 載入 OpenAPI 規格
- `@specpilot/flow-parser` - Flow 型別定義
- `@specpilot/schemas` - Schema 定義
- `@specpilot/shared` - 共用工具

---

## 已知問題與限制

### 已知問題

- [ ] **測試覆蓋率不足** - 僅 2 個測試檔案
  - **影響**: 程式碼品質保證不足
  - **計畫**: 逐步補齊單元測試

- [ ] **DataSynthesizer 不使用 faker.js**
  - **影響**: 測試資料不夠真實
  - **暫行方案**: 根據欄位名稱與 format 產生合理資料

- [ ] **步驟名稱可能重複** (DependencyResolver:126-137)
  - **症狀**: 如果 endpoint.summary 已包含動作詞，可能產生重複文字
  - **範例**: `summary="建立使用者"` → 產生 `"建立建立使用者"`
  - **影響**: FlowQualityChecker 會偵測到警告
  - **修正方式**: 已有邏輯檢查 summary 是否包含動作詞

### 限制

- **不支援 GraphQL** - 僅支援 OpenAPI 3.0
- **不支援效能測試** - 僅功能測試
- **不支援安全測試** - 僅基本的 401 認證測試
- **依賴推斷有限** - 僅支援路徑參數依賴，不支援複雜的跨資源依賴

---

## 後續開發計畫

### 短期 (優先度 P0)

- [ ] 補齊單元測試 (目標覆蓋率 ≥ 75%)
- [ ] 修正步驟名稱重複問題
- [ ] 支援更多 OpenAPI 3.0 特性

### 中期 (優先度 P1)

- [ ] 整合 faker.js 產生更真實的測試資料
- [ ] 支援更複雜的依賴推斷
- [ ] 支援 OpenAPI 3.1

### 長期 (優先度 P2)

- [ ] 支援 GraphQL Schema
- [ ] 支援效能測試案例產生
- [ ] 支援安全測試案例產生
- [ ] 視覺化測試覆蓋圖

---

## 變更歷史

| 版本 | 日期 | 主要變更 |
|------|------|---------|
| 0.2.0 | 2025-01-17 | 更新 CLAUDE.md 反映實際狀態 |
| 0.1.0 | 2025-10-12 | 初始版本，核心功能完成 |

---

## 參考資料

- [MCP Server 整合](../../apps/mcp-server/src/handlers/generate-flow.ts)
- [flow-generator 模組](../flow-generator/CLAUDE.md) (對話式產生)
- [E2E 測試](../../tests/e2e/flow-generation.e2e.spec.ts)

---

## 維護指南

**給開發者**:
- 每次修改程式碼後**立即更新**此文件
- 完成功能時，從「未實作」移到「已實作」
- 新增測試時，更新「測試狀態」區塊
- 定期更新「最後更新」日期與「完成度」百分比

**給 AI**:
- 此文件反映**實際程式碼狀態**，不是設計理想
- 「未實作功能」區塊的功能**真的不存在**，不要假設可以使用
- 此模組與 `@specpilot/flow-generator` 是互補關係，不是重複功能
- 需要對話式產生時，使用 `flow-generator`；需要批次自動產生時，使用此模組
