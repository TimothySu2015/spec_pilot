# @specpilot/flow-generator - 對話式 Flow 產生器

## ⚠️ 實作狀態

**版本**: 0.6.0 (Phase 12)
**完成度**: 90%
**最後更新**: 2025-10-20
**維護狀態**: 穩定 (核心功能已完成，測試覆蓋完整)

---

### ⚠️ 重要提示

此模組**核心功能已實作完成**，包含 NLP 解析、意圖識別、上下文管理等對話式流程產生所需的所有關鍵元件。

**實際可用的測試套件自動產生功能**在 `@specpilot/test-suite-generator` 中。

本模組專注於「對話式」的 Flow 產生，與 `test-suite-generator` 的「批次自動產生」是互補關係。

---

### 🔴 架構決策：MCP 與 NLP 的分離

**重要**: 如果未來需要調整此模組的 NLP 相關功能，請**特別注意**以下架構設計決策：

#### MCP Server 不使用 NLP 解析

**結論**: 新版 MCP Server (`apps/mcp-server/src/index.ts`) **不使用** NLPFlowParser 進行自然語言解析。

**原因**:
- AI (Claude) 本身已具備強大的自然語言理解能力
- Claude 可直接產生結構化參數 (specPath, endpoints, options 等)
- 不需要額外的 NLP 解析層來理解使用者意圖

**實際運作方式**:
```typescript
// ✅ 新版 MCP Server 直接使用 TestSuiteGenerator
const generator = new TestSuiteGenerator(analyzer, {
  endpoints: params.endpoints,           // AI 直接提供結構化參數
  includeSuccessCases: true,
  includeErrorCases: true,
  generateFlows: params.generateFlows
});
const flow = generator.generate(options);
```

**Legacy MCP 的 NLP 使用** (`apps/mcp-server/src/legacy/handlers/generate-flow.ts`):
- 舊版 MCP handler 確實使用 NLPFlowParser 解析自然語言 `description`
- 但此 handler 已被標記為 deprecated，僅作為參考實作保留

#### NLP 模組的實際用途

**當前實作目的**: 為**未來的 CLI 介面**預留 NLP 功能

**潛在使用場景**:
```bash
# 未來可能的 CLI 使用方式（尚未實作）
specpilot generate --natural "我想測試使用者登入功能，使用 POST /auth/login"
```

在這種情況下，CLI 需要 NLPFlowParser 來解析使用者的自然語言輸入，因為 CLI 環境沒有 AI 可以直接提供結構化參數。

#### 維護注意事項

**如果未來需要調整 NLP 模組，請注意**:

1. **不要假設 MCP 會使用 NLP**:
   - MCP 相關的功能變更不需要同步更新 NLP 模組
   - NLP 模組的改動不會影響 MCP Server 的行為

2. **CLI 是 NLP 的主要目標使用者**:
   - 改善 NLP 解析準確度時，應以 CLI 使用場景為考量
   - 測試案例應模擬 CLI 環境下的使用者輸入

3. **避免重複實作**:
   - MCP 環境：讓 AI 直接提供結構化參數，不要嘗試引入 NLP
   - CLI 環境：使用 NLP 解析自然語言輸入

4. **文件同步**:
   - 調整 NLP 功能時，同步更新此文件說明
   - 在 commit message 中標註影響範圍 (CLI/MCP)

---

## 已實作功能 ✅

### 1. FlowBuilder - Flow 建構器

**檔案位置**: `src/flow-builder.ts`
**測試覆蓋**: `__tests__/flow-builder.test.ts`

✅ **完整實作的功能**:
- 建立基本 Flow 結構
- 新增測試步驟 (支援完整的 request 配置)
- 支援變數提取 (使用新的 `capture` 格式)
- **支援驗證規則 (使用 `expect.body.customRules` 格式)** ⭐ Phase 12 完成
  - 所有 8 種驗證規則：notNull, regex, contains, equals, notContains, greaterThan, lessThan, length
  - 向後相容舊格式 `validations` (自動轉換)
  - 完整測試覆蓋（20 個測試）
- 設定全域配置 (globals)
- 鏈式呼叫 API (Fluent Interface)
- 重置建構器狀態

**API 範例**:
```typescript
import { FlowBuilder } from '@specpilot/flow-generator';

const builder = new FlowBuilder();

const flow = builder
  .setName('測試流程')
  .setDescription('測試描述')
  .addStep({
    name: '取得使用者',
    method: 'GET',
    path: '/users/123',
    expectedStatusCode: 200,
    extractVariables: {
      userId: 'id'  // 提取變數
    },
    // ✅ 推薦：使用 customRules（新格式）
    customRules: [
      { field: 'email', rule: 'notNull' },
      { field: 'email', rule: 'regex', value: '^[^@]+@[^@]+$' }
    ]
    // ⚠️ 舊格式（仍支援但不推薦）:
    // validations: [{ field: 'email', rule: 'notNull' }]
  })
  .build();

console.log(flow);
// {
//   name: '測試流程',
//   description: '測試描述',
//   steps: [{
//     expect: {
//       statusCode: 200,
//       body: {
//         customRules: [...]
//       }
//     }
//   }]
// }
```

**完整範例**: 請參考 `examples/custom-rules-example.ts`

---

### 2. IntentRecognizer - 意圖識別與端點推薦

**檔案位置**: `src/intent-recognizer.ts`
**測試覆蓋**: `__tests__/intent-recognizer.test.ts` (100% 覆蓋率, 37 tests)

✅ **完整實作的功能**:
- 從 OpenAPI 規格提取端點資訊
- 根據 ParsedIntent 推薦相關端點
- 計算匹配信心度 (基於 HTTP method、summary、operationId)
- 產生推薦原因說明

**匹配演算法**:
- HTTP method 匹配: 30% 權重
- Summary/Description 關鍵字匹配: 40% 權重
- OperationId 匹配: 30% 權重
- 最低信心度閾值: 0.3 (可配置)

**API 範例**:
```typescript
import { IntentRecognizer } from '@specpilot/flow-generator';
import type { ParsedIntent } from '@specpilot/flow-generator';

const recognizer = new IntentRecognizer({
  spec: openApiDoc,
  minConfidence: 0.3,
  maxResults: 5
});

const intent: ParsedIntent = {
  action: 'create_flow',
  entities: {
    endpoint: '登入',
    method: 'POST'
  },
  confidence: 0.8
};

const matches = recognizer.recommendEndpoints(intent);
// [
//   {
//     endpoint: { path: '/auth/login', method: 'POST', ... },
//     operationId: 'userLogin',
//     confidence: 0.95,
//     reason: 'HTTP 方法匹配 (POST), Summary: 使用者登入'
//   }
// ]
```

---

### 3. ContextManager - 對話上下文管理

**檔案位置**: `src/context-manager.ts`
**測試覆蓋**: `__tests__/context-manager.test.ts` (100% 覆蓋率, 40 tests)

✅ **完整實作的功能**:
- 建立新對話上下文 (單例模式)
- 儲存當前 Flow 建構狀態
- 管理對話歷史記錄
- 自動過期機制 (預設 30 分鐘)
- 限制對話歷史大小 (預設 50 筆)
- 清理過期的上下文

**API 範例**:
```typescript
import { ContextManager } from '@specpilot/flow-generator';

const manager = ContextManager.getInstance();

// 建立新對話
const contextId = manager.createContext();
// => "ctx-1705467890123-abc123"

// 取得上下文
const context = manager.getContext(contextId);
// {
//   contextId: "ctx-...",
//   currentFlow: { steps: [] },
//   extractedVariables: {},
//   conversationHistory: [],
//   createdAt: "2025-01-17T10:30:00Z",
//   expiresAt: "2025-01-17T11:00:00Z"
// }

// 更新上下文
manager.updateContext(contextId, {
  currentFlow: newFlow
});

// 新增對話記錄
manager.addConversationTurn(contextId, {
  role: 'user',
  content: '我想測試登入',
  timestamp: new Date().toISOString()
});
```

---

### 4. SuggestionEngine - 智能建議引擎

**檔案位置**: `src/suggestion-engine.ts`
**測試覆蓋**: `__tests__/suggestion-engine.test.ts` (100% 覆蓋率, 34 tests)

✅ **完整實作的功能**:
- 檢查必填欄位 (requestBody、路徑參數)
- 檢查認證需求
- 推薦驗證規則
- 推薦可用變數

**API 範例**:
```typescript
import { SuggestionEngine } from '@specpilot/flow-generator';

const engine = new SuggestionEngine();

const suggestions = engine.getSuggestions(
  currentStep,  // Partial<FlowStep>
  endpoint      // EndpointInfo
);

// [
//   {
//     type: 'missing_required',
//     message: '缺少必填欄位: email, password',
//     action: 'prompt_for_values',
//     data: { fields: ['email', 'password'] }
//   },
//   {
//     type: 'auth_required',
//     message: '此端點需要認證，請確保已設定 token',
//     action: 'check_auth'
//   }
// ]
```

---

### 6. 型別定義

**檔案位置**: `src/types.ts`

✅ **完整定義的型別**:
- `ParsedIntent` - 解析後的使用者意圖
- `EndpointInfo` - 端點資訊
- `EndpointMatch` - 端點匹配結果
- `ConversationContext` - 對話上下文
- `ConversationTurn` - 對話回合
- `Suggestion` - 智能建議
- `FlowStepConfig` - Flow Builder 步驟配置
- `NLPParserConfig` - NLP 解析器配置
- `IntentRecognizerConfig` - 意圖識別器配置
- `ContextManagerConfig` - 上下文管理器配置

---

### 5. NLPFlowParser - 自然語言解析器

**檔案位置**: `src/nlp-parser.ts`
**測試覆蓋**: `__tests__/nlp-parser.test.ts` (89.97% 覆蓋率, 205 tests)

✅ **完整實作的功能**:
- 解析使用者自然語言輸入
- 意圖分類 (create_flow, add_step, modify_step, add_validation)
- **簡易中文分詞** (ChineseTokenizer - 最長匹配算法 + 領域自訂詞典)
- 關鍵字提取 (支援繁體中文與英文，含複合詞拆分)
- HTTP Method 識別 (支援英文 HTTP Method 直接識別 + 15+ 種中文動詞映射)
- **改善 URL 路徑識別** (支援多層級、路徑參數、完整 URL)
- 端點名稱提取 (10+ 種資源名稱提取模式)
- **改善參數提取** (支援布林、null、陣列、引號字串、數值)
- 驗證規則識別
- 信心度計算 (0-1 分數，基於提取實體數量)

**核心演算法**:
- **中文分詞**: 最長匹配 + 停用詞過濾 (100+ 常用停用詞)
- **HTTP Method 映射**:
  - 英文優先 (GET/POST/PUT/DELETE/PATCH 等，不區分大小寫)
  - 中文動詞 (登入→POST, 查詢→GET, 更新→PUT, 刪除→DELETE)
- **URL 路徑識別**:
  - 簡單路徑: `/users`
  - 多層級: `/api/v1/users`
  - 路徑參數: `/users/{id}`
  - 完整 URL: `http://example.com/api/users`
- **參數提取**:
  - 布林值: `true`, `false`, `真`, `假`
  - Null: `null`, `空`, `無`
  - 陣列: `[1,2,3]`, `["a","b"]`
  - 字串: `"hello world"`
  - 數值: 整數、浮點數、負數
- **信心度計算**: 基礎 0.3 + HTTP Method(+0.2) + 端點(+0.3) + 參數(+0.1) + 驗證(+0.1)

**API 範例**:
```typescript
import { NLPFlowParser } from '@specpilot/flow-generator';

const parser = new NLPFlowParser({ spec: openApiDoc });

const intent = await parser.parse('我想測試登入 API，使用 POST /auth/login');
// {
//   action: 'create_flow',
//   entities: {
//     method: 'POST',
//     endpoint: 'auth/login'
//   },
//   confidence: 0.8
// }

const intent2 = await parser.parse('新增步驟：建立訂單，參數 user_id:123 product:apple');
// {
//   action: 'add_step',
//   entities: {
//     method: 'POST',
//     endpoint: '訂單',
//     parameters: { user_id: '123', product: 'apple' }
//   },
//   confidence: 0.9
// }
```

---

## 未實作功能 ❌

以下功能在原設計計畫中，但**完全沒有程式碼**:

### 1. DependencyResolver - 依賴解析器

**原設計**: 自動識別步驟間的資料依賴關係

❌ **狀態**: 完全未實作
❌ **檔案**: 不存在
**原因**: 優先度較低，功能複雜度高
**設計文件**: `docs/archive/plans/flow-generation-plan-2025-10-03.md` 第 363-377 行

**預期功能**:
```typescript
// 這些方法目前不存在
class DependencyResolver {
  resolveDependencies(steps: Step[]): ResolvedDependency[];
  generateVariableReference(sourceStep: string, path: string): string;
}
```

---

### 2. FlowGenerator - 統一入口類別

**原設計**: 提供統一的 API 入口

❌ **狀態**: 完全未實作
❌ **檔案**: 不存在
**原因**: 架構調整，MCP Server 直接使用 FlowBuilder 和 IntentRecognizer
**設計文件**: 原 CLAUDE.md 第 143-171 行

**原設計的 API (不存在)**:
```typescript
// ❌ 這些 API 目前不存在
const generator = new FlowGenerator({ specPath: 'specs/api.yaml' });
const flow = await generator.generate({ description: "..." });
const flow = await generator.generateCRUD({ resource: 'users' });
```

**實際使用方式**:
```typescript
// ✅ 實際上是這樣使用 (在 MCP Server 中)
const builder = new FlowBuilder();
const recognizer = new IntentRecognizer({ spec });
const parser = new NLPFlowParser({ spec });
```

---

### 3. CRUD 自動生成方法

❌ **狀態**: 未實作
**原因**: 此功能在 `@specpilot/test-suite-generator` 中實作
**參考**: `packages/test-suite-generator/src/crud-generator.ts`

**原設計的 API (不存在)**:
```typescript
// ❌ FlowBuilder 沒有這些方法
builder.generateCRUD({ resource: 'users', operations: [...] });
builder.generateAuthFlow({ authType: 'jwt', ... });
```

---

### 4. 認證流程生成

❌ **狀態**: 未實作
**原因**: 此功能在 `@specpilot/test-suite-generator` 中實作

---

### 5. 資源依賴推斷

❌ **狀態**: 未實作
**原因**: 需要 DependencyResolver 支援

---

### 6. 品質評分與迭代改進

❌ **狀態**: 未實作

**原設計的 API (不存在)**:
```typescript
// ❌ 這些方法不存在
const quality = await generator.evaluateQuality(flow);
const refined = await generator.refine(flow, feedback);
```

---

### 7. Flow 輸出方法

❌ **狀態**: 未實作

**原設計的 API (不存在)**:
```typescript
// ❌ Flow 物件沒有這些方法
flow.toYAML();
flow.saveToFile('flows/xxx.yaml');
```

**實際使用**:
```typescript
// ✅ 使用 yaml 套件手動轉換
import { stringify } from 'yaml';
const yamlContent = stringify(flow);
```

---

## 模組概述

### 核心職責

本模組負責**對話式測試流程產生**，透過自然語言理解使用者意圖，推薦相關 API 端點，並逐步建構測試流程。

**與 test-suite-generator 的區別**:
- `flow-generator`: 對話式、漸進式、需要人工參與
- `test-suite-generator`: 批次式、自動化、一次產生完整測試套件

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

**檔案位置**: `apps/mcp-server/src/legacy/handlers/generate-flow.ts`

**工作流程**:
1. 載入 OpenAPI 規格
2. 使用 `ContextManager` 建立或取得對話上下文
3. 使用 `NLPFlowParser` 解析使用者輸入 (✅ 完整實作)
4. 使用 `IntentRecognizer` 推薦端點
5. 使用 `FlowBuilder` 建構 Flow
6. 使用 `SuggestionEngine` 產生建議
7. 更新對話上下文
8. 回傳 YAML 格式的 Flow

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

**當前覆蓋率**: ~85% (所有核心模組已完成測試)

| 模組 | 測試檔案 | 狀態 |
|------|---------|------|
| FlowBuilder | ✅ `__tests__/flow-builder.test.ts` | **20 tests** (Phase 12 擴充), 100% 覆蓋率 |
| NLPFlowParser | ✅ `__tests__/nlp-parser.test.ts` | 41 tests, 100% 覆蓋率 |
| IntentRecognizer | ✅ `__tests__/intent-recognizer.test.ts` | 37 tests, 100% 覆蓋率 |
| ContextManager | ✅ `__tests__/context-manager.test.ts` | 40 tests, 100% 覆蓋率 |
| SuggestionEngine | ✅ `__tests__/suggestion-engine.test.ts` | 34 tests, 100% 覆蓋率 |

**總計**: **172 tests** (+16 from Phase 12), ~85% 覆蓋率

**執行測試**:
```bash
# 執行此模組的測試
pnpm -w run test packages/flow-generator/__tests__/ --run

# 覆蓋率報告
pnpm -w run test packages/flow-generator/__tests__/ --coverage
```

---

## 架構設計

### 設計原則

1. **可解釋性**: 產生的流程有清楚的步驟說明
2. **對話式**: 支援多輪對話逐步完善 Flow
3. **智慧推斷**: 自動推薦端點與驗證規則
4. **擴充性**: 易於新增新的生成策略

### 目錄結構

```
packages/flow-generator/
├── src/
│   ├── index.ts              # 主要匯出
│   ├── flow-builder.ts       # ✅ Flow 建構器
│   ├── nlp-parser.ts         # ✅ 自然語言解析
│   ├── intent-recognizer.ts  # ✅ 意圖識別
│   ├── context-manager.ts    # ✅ 上下文管理
│   ├── suggestion-engine.ts  # ✅ 建議引擎
│   └── types.ts              # ✅ 型別定義
├── __tests__/
│   ├── flow-builder.test.ts       # ✅ 4 tests
│   ├── nlp-parser.test.ts         # ✅ 41 tests
│   ├── intent-recognizer.test.ts  # ✅ 37 tests
│   ├── context-manager.test.ts    # ✅ 40 tests
│   └── suggestion-engine.test.ts  # ✅ 34 tests
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

- [ ] **缺少整合測試** - 目前僅有單元測試
  - **影響**: 模組間協作行為未充分驗證
  - **計畫**: 後續補充端對端測試

### 限制

- **不支援複雜語意理解** - 僅基於關鍵字比對
- **不支援多語言** - 僅支援繁體中文關鍵字
- **不支援語境推理** - 無法理解代名詞或隱含指代

---

## 後續開發計畫

### 短期 (優先度 P0)

- [x] 新增端對端整合測試 (已完成於 P1 Phase 6.4)
- [ ] 改善端點匹配演算法準確率
- [x] **優化 NLP 解析的複雜語句支援 - 階段 1 已完成** (db81b52)
  - ✅ 實作簡易中文分詞器
  - ✅ 改善 HTTP Method 識別（支援英文）
  - ✅ 改善 URL 路徑識別
  - ✅ 改善參數提取（支援多型別）
  - 📊 測試數量：41 → 205 tests (+164)

### 中期 (優先度 P1)

- [ ] 實作 DependencyResolver
- [ ] 支援更多自然語言模式
- [ ] 整合 Flow 驗證功能

### 長期 (優先度 P2)

- [ ] 支援多語言
- [ ] 支援語境推理
- [ ] 支援從測試案例文件自動產生

---

## 變更歷史

| 版本 | 日期 | 主要變更 |
|------|------|---------|
| 0.6.0 | 2025-10-20 | ✅ **Phase 12: FlowBuilder customRules 完整支援**<br>  - 修正 FlowBuilder 舊格式自動轉換邏輯<br>  - `validations` 現在自動轉換為 `expect.body.customRules`<br>  - 不再產生舊的 `step.validation` 欄位<br>  - 新增 16 個測試（4 → 20 tests）:<br>    • 4 個 customRules 基礎測試<br>    • 3 個向後相容測試<br>    • 9 個驗證規則測試（所有 8 種 + 混合）<br>  - 新增範例檔案 `examples/custom-rules-example.ts`<br>  - 更新文件與 API 範例<br>  - 總測試數：156 → 172 tests |
| 0.5.0 | 2025-10-20 | ✅ **Phase 11: 統一驗證格式**<br>  - 更新 `FlowStepConfig` 新增 `customRules` 欄位<br>  - 標記 `validations` 為 @deprecated<br>  - FlowBuilder 優先使用 `customRules` 格式<br>  - 支援 `expect.body.customRules` 結構<br>  - 向後相容舊 `validation` 格式<br>  - 測試更新使用正確的 `expect.statusCode` 欄位<br>  - 4 個測試通過 |
| 0.4.0 | 2025-10-19 | ✅ **優化 NLP 解析支援複雜語句（階段 1）** (db81b52)<br>  - 實作簡易中文分詞器 ChineseTokenizer<br>  - 改善 HTTP Method 識別（支援英文）<br>  - 改善 URL 路徑識別（多層級、路徑參數）<br>  - 改善參數提取（布林、null、陣列）<br>  - 新增 164 個測試 (41 → 205 tests)<br>  - NLPFlowParser 覆蓋率：89.97%<br>  - ChineseTokenizer 覆蓋率：95.42%<br>✅ **新增 MCP 與 NLP 架構決策記錄** (e2643ac)<br>  - 明確 MCP Server 不使用 NLP 解析<br>  - NLP 為未來 CLI 介面保留 |
| 0.3.0 | 2025-01-19 | ✅ 完成 NLPFlowParser 實作 (41 tests)<br>✅ 新增 IntentRecognizer 測試 (37 tests)<br>✅ 新增 ContextManager 測試 (40 tests)<br>✅ 新增 SuggestionEngine 測試 (34 tests)<br>📊 測試覆蓋率提升至 85% (156 tests) |
| 0.2.0 | 2025-01-17 | 更新 CLAUDE.md 反映實際狀態 |
| 0.1.0 | 2025-10-12 | 初始版本，基礎架構完成 |

---

## 參考資料

- [原設計計畫](../../docs/archive/plans/flow-generation-plan-2025-10-03.md) (已歸檔)
- [MCP Server 整合](../../apps/mcp-server/src/legacy/handlers/generate-flow.ts)
- [test-suite-generator 模組](../test-suite-generator/CLAUDE.md) (批次自動產生)

---

## 維護指南

**給開發者**:
- 每次修改程式碼後**立即更新**此文件
- 完成功能時，從「未實作」或「部分實作」移到「已實作」
- 新增測試時，更新「測試狀態」區塊
- 定期更新「最後更新」日期與「完成度」百分比

**給 AI**:
- 此文件反映**實際程式碼狀態**，不是設計理想
- 「未實作功能」區塊的功能**真的不存在**，不要假設可以使用
- 需要類似功能時，請查看 `@specpilot/test-suite-generator`
