# @specpilot/core-flow - 流程協調引擎

## 模組概述

`@specpilot/core-flow` 是 SpecPilot 的核心協調引擎，負責整合所有測試執行相關的模組，協調測試步驟的執行順序、狀態管理、錯誤處理與結果收集。這是整個測試執行流程的中樞。

## 核心職責

1. **流程協調**: 協調測試步驟的執行順序與依賴關係
2. **狀態管理**: 管理測試執行過程中的上下文與變數狀態
3. **錯誤處理**: 統一處理執行過程中的錯誤與異常
4. **結果收集**: 收集並彙整測試步驟的執行結果
5. **執行控制**: 支援 fail-fast、重試、逾時等執行策略

## 技術堆疊

### 核心依賴
- `@specpilot/flow-parser` - 解析測試流程定義
- `@specpilot/http-runner` - 執行 HTTP 請求
- `@specpilot/validation` - 驗證回應內容
- `@specpilot/reporting` - 產生測試報表
- `@specpilot/shared` - 共用工具與型別

## 核心元件

### FlowOrchestrator
主要的流程協調器，負責執行測試流程：

```typescript
import { FlowOrchestrator } from '@specpilot/core-flow';

const orchestrator = new FlowOrchestrator({
  spec: openApiSpec,
  flow: parsedFlow,
  config: runtimeConfig
});

const result = await orchestrator.execute();
```

### ExecutionContext
執行上下文管理器，維護測試執行期間的狀態：

```typescript
interface ExecutionContext {
  variables: Record<string, any>;  // 變數儲存 (用於步驟間傳遞)
  authToken?: string;               // 認證憑證
  executionId: string;              // 執行唯一識別碼
  startTime: Date;                  // 開始時間
}
```

### StepExecutor
單一步驟執行器，負責執行單個測試步驟：

```typescript
class StepExecutor {
  async executeStep(step: FlowStep, context: ExecutionContext): Promise<StepResult>;
}
```

## 執行流程

```
1. 初始化執行上下文
    ↓
2. 解析流程定義 (透過 flow-parser)
    ↓
3. 執行前置步驟 (認證、設定等)
    ↓
4. 循序執行測試步驟
    ├─ 4.1. 變數替換與參數準備
    ├─ 4.2. 發送 HTTP 請求 (透過 http-runner)
    ├─ 4.3. 驗證回應 (透過 validation)
    ├─ 4.4. 儲存變數供後續步驟使用
    └─ 4.5. 收集執行結果
    ↓
5. 執行後置步驟 (清理等)
    ↓
6. 產生測試報表 (透過 reporting)
    ↓
7. 回傳執行結果
```

## 關鍵功能

### 變數系統
支援步驟間的變數傳遞與引用：

```yaml
steps:
  - name: "登入"
    saveAs: loginResponse

  - name: "使用 Token"
    headers:
      Authorization: "Bearer ${loginResponse.token}"
```

### 錯誤處理策略

支援兩種錯誤處理模式，透過 `options.failFast` 設定：

#### 1. **Fail-Fast 模式** (`failFast: true`)
遇到錯誤立即停止執行後續步驟：

```yaml
options:
  failFast: true  # 啟用 Fail-Fast 模式

steps:
  - name: "步驟 1"  # 如果失敗
  - name: "步驟 2"  # 不執行
  - name: "步驟 3"  # 不執行
```

**適用場景**：
- 步驟間有強依賴關係（如：驗證碼 → 註冊 → 發送郵件）
- CI/CD 快速驗證
- 希望節省執行時間與資源

**程式碼實作**：
```typescript
// 在 FlowOrchestrator 與 EnhancedFlowOrchestrator 中實作
const failFast = flowDefinition.options?.failFast ?? false;

for (const step of flowDefinition.steps) {
  const stepResult = await this.executeStep(step, context);
  results.push(stepResult);

  if (stepResult.status === 'failed' && failFast) {
    logger.error('步驟執行失敗，啟用 Fail-Fast 模式，停止執行後續步驟', {
      event: 'FAIL_FAST_TRIGGERED'
    });
    break; // 中斷迴圈
  }
}
```

#### 2. **Continue-On-Error 模式** (`failFast: false` 或預設)
繼續執行所有步驟，收集完整測試結果：

```yaml
options:
  failFast: false  # 或不設定（預設為 false）

steps:
  - name: "步驟 1"  # 如果失敗
  - name: "步驟 2"  # 仍然執行
  - name: "步驟 3"  # 仍然執行
```

**適用場景**：
- 健康檢查（檢查多個獨立服務）
- 完整測試報告（需要知道所有錯誤點）
- 步驟間相互獨立

#### 3. **Retry 機制** (指數退避)
失敗時自動重試，由 `http-runner` 模組處理（協調器層級未實作）

**範例檔案**：
- `flows/user-registration-failfast-example.yaml` - Fail-Fast 模式完整範例

### 認證流程整合

自動處理登入流程並注入認證憑證：

```typescript
// 自動從登入回應中提取 token
const authToken = extractToken(loginResponse);
context.authToken = authToken;

// 後續請求自動注入 Authorization header
```

## 使用範例

```typescript
import { FlowOrchestrator } from '@specpilot/core-flow';
import { loadSpec } from '@specpilot/spec-loader';
import { parseFlow } from '@specpilot/flow-parser';

// 載入規格與流程
const spec = await loadSpec('specs/api.yaml');
const flow = await parseFlow('flows/user-crud.yaml');

// 建立協調器並執行
const orchestrator = new FlowOrchestrator({
  spec,
  flow,
  config: {
    baseUrl: 'http://localhost:3000',
    timeout: 5000,
    retryCount: 3
  }
});

const result = await orchestrator.execute();

// 檢查結果
if (result.success) {
  console.log(`✅ ${result.passedSteps} 個步驟通過`);
} else {
  console.error(`❌ ${result.failedSteps} 個步驟失敗`);
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

1. **協調不執行**: 協調器本身不執行具體操作，而是委派給專門模組
2. **責任鏈模式**: 步驟執行採用責任鏈模式，易於擴充
3. **狀態隔離**: 每次執行使用獨立的上下文，避免狀態污染
4. **可觀測性**: 每個步驟都產生詳細的執行日誌
5. **容錯設計**: 支援多種錯誤處理策略，提高執行彈性

## 依賴關係

### 被依賴於
- `apps/cli` - CLI 執行入口
- `apps/mcp-server` - MCP Server 執行引擎
- `@specpilot/reporting` - 讀取執行結果

### 依賴於
- `@specpilot/flow-parser` - 流程解析
- `@specpilot/http-runner` - HTTP 執行
- `@specpilot/validation` - 回應驗證
- `@specpilot/reporting` - 報表產生
- `@specpilot/shared` - 共用工具

## 錯誤碼範圍

- `1601-1610` - 流程初始化錯誤
- `1611-1620` - 步驟執行錯誤
- `1621-1630` - 上下文管理錯誤
- `1631-1640` - 變數處理錯誤

## 未來擴充方向

1. 支援並行步驟執行 (parallel steps)
2. 條件分支與迴圈控制 (if/for)
3. 子流程呼叫 (sub-flow)
4. 執行計畫快取與重用
5. 即時執行進度回報 (WebSocket)
6. 分散式執行支援
7. 效能追蹤與瓶頸分析
