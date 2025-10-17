# @specpilot/flow-generator - 對話式 Flow 產生器

## ⚠️ 實作狀態

**版本**: 0.2.0
**完成度**: 35%
**最後更新**: 2025-01-17
**維護狀態**: 開發中 (實驗性)

---

### ⚠️ 重要提示

此模組**尚未完成**，許多功能僅有架構或完全未實作。

**實際可用的測試套件自動產生功能**在 `@specpilot/test-suite-generator` 中。

本模組專注於「對話式」的 Flow 產生，與 `test-suite-generator` 的「批次自動產生」是互補關係。

---

## 已實作功能 ✅

### 1. FlowBuilder - Flow 建構器

**檔案位置**: `src/flow-builder.ts`
**測試覆蓋**: `__tests__/flow-builder.test.ts`

✅ **完整實作的功能**:
- 建立基本 Flow 結構
- 新增測試步驟 (支援完整的 request 配置)
- 支援變數提取 (使用新的 `capture` 格式)
- 支援驗證規則 (使用新的 `validation` 格式)
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
    validations: [
      { field: 'email', rule: 'notNull' }
    ]
  })
  .build();

console.log(flow);
// {
//   name: '測試流程',
//   description: '測試描述',
//   steps: [...]
// }
```

---

### 2. IntentRecognizer - 意圖識別與端點推薦

**檔案位置**: `src/intent-recognizer.ts`
**測試覆蓋**: ❌ 尚無測試

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
**測試覆蓋**: ❌ 尚無測試

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
**測試覆蓋**: ❌ 尚無測試

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

### 5. 型別定義

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

## 部分實作 ⚠️

### NLPFlowParser - 自然語言解析器

**檔案位置**: `src/nlp-parser.ts:14`
**當前狀態**: ⚠️ **僅有類別架構，核心邏輯標記為 TODO**

**已實作**:
- ✅ 類別結構與方法簽名
- ✅ 私有方法架構 (`extractKeywords`, `identifyHttpMethod`)
- ✅ 基本的 HTTP Method 關鍵字映射表

**未實作 (TODO)**:
```typescript
async parse(_userInput: string, _context?: ConversationContext): Promise<ParsedIntent> {
  // TODO: 實作自然語言解析邏輯
  // 1. 關鍵字比對
  // 2. 實體提取
  // 3. 意圖分類

  // 當前僅回傳空的 Intent
  const intent: ParsedIntent = {
    action: 'create_flow',
    entities: {},
    confidence: 0.5,
  };
  return intent;
}
```

**剩餘工作**:
- [ ] 實作關鍵字提取邏輯
- [ ] 實作 HTTP Method 識別
- [ ] 實作參數實體提取
- [ ] 實作驗證規則識別
- [ ] 新增單元測試

**設計文件**: 參考 `docs/archive/plans/flow-generation-plan-2025-10-03.md` 第 434-458 行

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
3. 使用 `NLPFlowParser` 解析使用者輸入 (⚠️ 當前僅回傳空 Intent)
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

**當前覆蓋率**: ~15% (僅 FlowBuilder 有測試)

| 模組 | 測試檔案 | 狀態 |
|------|---------|------|
| FlowBuilder | ✅ `__tests__/flow-builder.test.ts` | 4 個測試通過 |
| IntentRecognizer | ❌ 無測試 | 待建立 |
| ContextManager | ❌ 無測試 | 待建立 |
| SuggestionEngine | ❌ 無測試 | 待建立 |
| NLPFlowParser | ❌ 無測試 | 待建立 |

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
│   ├── intent-recognizer.ts  # ✅ 意圖識別
│   ├── context-manager.ts    # ✅ 上下文管理
│   ├── suggestion-engine.ts  # ✅ 建議引擎
│   ├── nlp-parser.ts         # ⚠️ 自然語言解析 (TODO)
│   └── types.ts              # ✅ 型別定義
├── __tests__/
│   └── flow-builder.test.ts  # ✅ 僅此一個測試
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

- [ ] **NLPFlowParser 未實作** - 當前無法真正解析自然語言
  - **影響**: 對話式產生功能不完整
  - **暫行方案**: 依賴 IntentRecognizer 的關鍵字比對

- [ ] **測試覆蓋率不足** - 僅 FlowBuilder 有測試
  - **影響**: 程式碼品質保證不足
  - **計畫**: 逐步補齊單元測試

### 限制

- **不支援複雜語意理解** - 僅基於關鍵字比對
- **不支援多語言** - 僅支援繁體中文關鍵字
- **不支援語境推理** - 無法理解代名詞或隱含指代

---

## 後續開發計畫

### 短期 (優先度 P0)

- [ ] 完成 NLPFlowParser 的核心邏輯
- [ ] 補齊單元測試 (目標覆蓋率 ≥ 75%)
- [ ] 改善端點匹配演算法準確率

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
