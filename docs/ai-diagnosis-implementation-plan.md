# SpecPilot AI 診斷功能實作計劃

> **✅ 實作狀態**: 階段 1-3 與階段 5 已完成 (2025-09-30)
>
> - ✅ 階段 1: 增強錯誤報表
> - ✅ 階段 2: 建立診斷上下文生成器
> - ✅ 階段 3: 整合診斷上下文到 MCP
> - ✅ 階段 4: 文件與範例
> - ✅ 階段 5: 測試與驗證 (17/17 單元測試通過)
> - ⏸️ 階段 6: 最終驗證與發布 (可選)

## 📋 專案概述

### 目標
在 SpecPilot 中建立 AI 驅動的錯誤診斷功能,透過 Claude Desktop 分析 API 測試失敗原因並提供修復建議。

### 核心理念
- **透過 Claude Desktop 進行診斷** - 利用使用者的 Claude Pro 訂閱
- **API 錯誤訊息為核心** - 保留完整的錯誤回應內容 (包含 stack trace)
- **本機開發階段使用** - 不用於正式環境,安全性要求較低
- **診斷友善的錯誤格式** - 制定 API 開發規範,確保錯誤訊息結構化

### 預期效果
- 診斷成功率: **85-90%** (針對常見錯誤)
- 使用方式: 在 Claude Desktop 中透過 MCP 工具互動
- 適用場景: API 開發、測試、除錯階段

---

## 🔄 完整流程圖

### 整體架構流程

```
┌────────────────────────────────────────────────────────────────────────┐
│                          使用者 (開發者)                                │
└───────────────────────────────┬────────────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────────────┐
│                        Claude Desktop                                   │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │ User: 執行測試並診斷錯誤                                      │     │
│  │                                                               │     │
│  │ @mcp__specpilot__runFlow spec=api.yaml flow=test.yaml       │     │
│  │   ↓ (測試執行,部分失敗)                                      │     │
│  │                                                               │     │
│  │ @mcp__specpilot__getReport                                   │     │
│  │   ↓ (取得包含診斷上下文的報表)                               │     │
│  │                                                               │     │
│  │ Claude 分析診斷上下文:                                        │     │
│  │ - 讀取完整錯誤訊息 (包含 stack trace)                        │     │
│  │ - 理解錯誤分類 (auth/network/validation/server)             │     │
│  │ - 查看錯誤模式 (連續失敗、連鎖反應)                          │     │
│  │ - 參考診斷提示                                                │     │
│  │                                                               │     │
│  │ Claude 回應:                                                  │     │
│  │ ✅ 精確的問題診斷                                             │     │
│  │ ✅ 根本原因分析                                               │     │
│  │ ✅ 具體的修復步驟                                             │     │
│  │ ✅ 程式碼範例 (如需要)                                        │     │
│  └──────────────────────────────────────────────────────────────┘     │
└───────────────────────────────┬────────────────────────────────────────┘
                                │ (MCP 協議)
                                ↓
┌────────────────────────────────────────────────────────────────────────┐
│                    SpecPilot MCP Server                                 │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │ handleRunFlow()                                               │     │
│  │   → 執行測試                                                  │     │
│  │   → 生成報表 (包含完整錯誤資訊)                              │     │
│  │   → 儲存到 reports/result.json                               │     │
│  └──────────────────────────────────────────────────────────────┘     │
│  ┌──────────────────────────────────────────────────────────────┐     │
│  │ handleGetReport()                                             │     │
│  │   → 載入報表                                                  │     │
│  │   → 建立診斷上下文 (DiagnosticContextBuilder)                │     │
│  │   → 回傳報表 + 診斷上下文                                    │     │
│  └──────────────────────────────────────────────────────────────┘     │
└───────────────────────────────┬────────────────────────────────────────┘
                                │
                                ↓
┌────────────────────────────────────────────────────────────────────────┐
│                      測試報表生成流程                                   │
│                                                                         │
│  Step 1: HTTP 請求執行                                                 │
│  ┌─────────────────────────────────────────────────────┐              │
│  │ HTTP Runner 執行 API 請求                            │              │
│  │   → 成功: 取得回應                                   │              │
│  │   → 失敗: 取得錯誤回應 (含 stack trace)             │              │
│  └─────────────────────────────────────────────────────┘              │
│                                                                         │
│  Step 2: 報表生成 (ReportGenerator)                                    │
│  ┌─────────────────────────────────────────────────────┐              │
│  │ IF 測試失敗:                                         │              │
│  │   ✅ 保留完整錯誤 body                               │              │
│  │   ✅ 保留錯誤 headers                                │              │
│  │   ✅ 提取 stack trace                                │              │
│  │   ✅ 記錄回應時間                                    │              │
│  │   ⚠️  遮罩敏感資料 (password, token, etc.)          │              │
│  │                                                      │              │
│  │ IF 測試成功:                                         │              │
│  │   ✅ 只保留 hash (節省空間)                          │              │
│  └─────────────────────────────────────────────────────┘              │
│                                                                         │
│  Step 3: 診斷上下文建立 (DiagnosticContextBuilder)                    │
│  ┌─────────────────────────────────────────────────────┐              │
│  │ 1. 分析失敗步驟                                      │              │
│  │    → 錯誤分類 (auth/network/validation/server)      │              │
│  │    → 信心度評分 (0-100)                              │              │
│  │    → 判斷依據記錄                                    │              │
│  │                                                      │              │
│  │ 2. 偵測錯誤模式                                      │              │
│  │    → 連續認證失敗?                                   │              │
│  │    → 連鎖失敗? (第一步失敗導致後續失敗)             │              │
│  │    → 全部網路錯誤? (API 未啟動)                     │              │
│  │                                                      │              │
│  │ 3. 生成診斷提示                                      │              │
│  │    → 快速診斷摘要                                    │              │
│  │    → 可能原因列表                                    │              │
│  │    → 建議的修復動作                                  │              │
│  │    → 建議詢問的問題                                  │              │
│  └─────────────────────────────────────────────────────┘              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🤔 設計決策與理由

### 為什麼要保留完整錯誤訊息?

#### 問題: 目前只有 Hash

```typescript
// 目前的報表
response: {
  bodyHash: "sha256:abc123..."  // ❌ Claude 看不到內容
}
```

**問題**:
- ❌ Claude 無法讀取實際的錯誤訊息
- ❌ 無法看到 API 回傳的 stack trace
- ❌ 無法理解具體的失敗原因
- ❌ 只能根據 HTTP 狀態碼猜測

**結果**: 診斷成功率只有 40-50%

#### 解決方案: 失敗時保留完整內容

```typescript
// 改進後的報表
response: {
  bodyHash: "sha256:abc123...",
  errorDetails: {  // ✨ 失敗時才有
    body: {
      error: "TOKEN_EXPIRED",
      message: "JWT Token 已於 10:30 過期",
      hint: "請使用 /auth/refresh 刷新",
      stack_trace: [...]
    }
  }
}
```

**優點**:
- ✅ Claude 可以讀取完整錯誤訊息
- ✅ 看得到 API 開發者提供的修復提示
- ✅ Stack trace 提供程式碼層級的診斷
- ✅ 診斷成功率提升到 70-80% (API 需遵守規範時可達 85-90%)

**權衡**:
- ⚠️ 報表檔案變大 (但只在失敗時)
- ⚠️ 需要處理敏感資料遮罩
- ✅ 只在本機開發使用,安全性可控

**📖 相關文件**: 請參考 [API 錯誤處理標準化指南](./guides/api-errors/api-error-handling-guide.md) 了解如何設計診斷友善的 API 錯誤格式

---

### 為什麼需要診斷上下文 (Diagnostic Context)?

#### 問題: 原始報表對 AI 不夠友善

```typescript
// 原始報表 - 需要 AI 自己分析
{
  steps: [
    { name: "登入", statusCode: 401, validationResults: [...] },
    { name: "取得資料", statusCode: 401, validationResults: [...] },
    { name: "更新資料", statusCode: 401, validationResults: [...] }
  ]
}
```

**問題**:
- ❌ AI 需要花時間分析錯誤類型
- ❌ 無法一眼看出錯誤模式 (3 個步驟都是認證失敗)
- ❌ 缺少診斷提示
- ❌ 需要更多 Token 和時間

#### 解決方案: 預先分析並結構化

```typescript
// 診斷上下文 - 預先分析好的資訊
{
  diagnosticContext: {
    quickDiagnosis: "3 個步驟失敗,主要是認證問題",

    errorPatterns: [{
      pattern: "consecutive_auth_failures",
      description: "連續認證失敗",
      likelihood: "high"
    }],

    diagnosticHints: {
      likelyCauses: ["Token 過期", "Token 無效"],
      suggestedActions: ["更新 Token", "檢查 .env.local"]
    }
  }
}
```

**優點**:
- ✅ Claude 立即理解問題本質
- ✅ 減少分析時間和 Token 消耗
- ✅ 診斷提示引導 Claude 給出更好的建議
- ✅ 錯誤模式偵測提高診斷準確度

**為什麼這樣設計**:
1. **節省 AI 推理時間** - 預先做好基礎分析
2. **提高診斷準確度** - 基於規則的分類很可靠
3. **提供診斷方向** - 避免 AI 偏離重點
4. **降低成本** - 減少 Token 消耗

---

### 為什麼要錯誤分類 (Error Classification)?

#### 分類邏輯

```typescript
classifyError(step: IStepResult): ErrorClassification {
  const code = step.response.statusCode;

  if (code === 401 || code === 403) {
    return {
      primaryType: 'auth',
      confidence: 90,
      indicators: ['HTTP 401', '錯誤訊息包含 token']
    };
  }
  // ... 其他分類
}
```

**為什麼需要分類?**

1. **快速定位問題領域**
   - `auth` → 認證相關,檢查 Token
   - `network` → 連線問題,檢查服務
   - `validation` → Schema 問題,比對規格
   - `server` → API 問題,查看伺服器日誌

2. **提供信心度評分**
   - 90%+ → 非常確定,直接修復
   - 70-90% → 較確定,需要驗證
   - <70% → 不確定,需要更多資訊

3. **記錄判斷依據**
   - Claude 可以理解為什麼這樣分類
   - 使用者可以驗證分類是否正確
   - 方便後續改進分類邏輯

---

### 為什麼要偵測錯誤模式 (Error Patterns)?

#### 範例: 連鎖失敗偵測

```typescript
// 步驟 1 失敗 → 步驟 2-5 也失敗
if (steps[0].status === 'failure') {
  const subsequentFailures = steps.slice(1).filter(s => s.status === 'failure');

  if (subsequentFailures.length > 0) {
    return {
      pattern: 'cascading_failures',
      description: '第一步失敗導致後續步驟連鎖失敗',
      likelihood: 'high'
    };
  }
}
```

**為什麼重要?**

1. **避免誤診**
   - 不要把 5 個失敗當成 5 個獨立問題
   - 實際上可能只需要修復第一個

2. **節省時間**
   - 直接告訴 Claude: "修好第一步就行了"
   - 不用逐一分析每個失敗

3. **提供系統層級的洞察**
   - 連續認證失敗 → Token 配置問題
   - 全部網路錯誤 → API 服務未啟動
   - 某個資源的所有操作都失敗 → 資源不存在

---

### 為什麼要診斷提示 (Diagnostic Hints)?

#### 提示的作用

```typescript
diagnosticHints: {
  quickDiagnosis: "2 個步驟失敗,主要是認證問題",

  likelyCauses: [
    "JWT Token 已過期",
    "API Key 設定錯誤"
  ],

  suggestedActions: [
    "更新 .env.local 中的 SPEC_PILOT_TOKEN",
    "使用 /auth/refresh 端點刷新 Token"
  ],

  suggestedQuestions: [
    "Token 是什麼時候過期的?",
    "如何取得新的 Token?"
  ]
}
```

**為什麼需要提示?**

1. **引導 Claude 的思考方向**
   - 不是讓 AI 從零開始推理
   - 提供診斷的起點和方向

2. **提供可操作的建議**
   - 不只說"Token 有問題"
   - 具體說明"更新 .env.local 中的 SPEC_PILOT_TOKEN"

3. **幫助使用者理解問題**
   - 即使不問 Claude,看到提示就知道該做什麼
   - 降低對 AI 的依賴

4. **標準化診斷流程**
   - 確保診斷品質一致
   - 避免 Claude 天馬行空的猜測

---

### 為什麼要敏感資料遮罩?

#### 遮罩邏輯

```typescript
maskSensitiveFields(obj: any): any {
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey'];

  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
      result[key] = '***';  // 遮罩
    } else {
      result[key] = value;  // 保留
    }
  }
}
```

**為什麼即使在本機也要遮罩?**

1. **養成好習慣**
   - 即使是開發環境也不暴露密碼
   - 避免不小心分享包含密碼的報表

2. **報表可能被分享**
   - 開發者可能把報表貼到 Slack 詢問
   - 報表可能被 commit 到 Git

3. **為未來擴充做準備**
   - 未來可能在測試環境使用
   - 遮罩邏輯已經建立好了

4. **保留診斷資訊**
   - 只遮罩值,不遮罩欄位名稱
   - Claude 仍然知道"有 password 欄位"

**範例**:
```typescript
// 原始
{ "password": "secret123", "email": "user@example.com" }

// 遮罩後
{ "password": "***", "email": "user@example.com" }

// Claude 仍然知道:
// - 有 password 欄位 (可能相關)
// - email 是正常的
```

---

### 為什麼分階段開發?

#### 階段劃分原則

```
階段 1: 資料層 (報表)
  ↓ 有資料才能分析
階段 2: 分析層 (診斷上下文)
  ↓ 有分析才能展示
階段 3: 展示層 (MCP 整合)
  ↓ 能用了再寫文件
階段 4: 文件層 (規範與範例)
  ↓ 文件齊全再測試
階段 5: 驗證層 (測試)
  ↓ 測試通過再發布
階段 6: 發布層 (文件與範例)
```

**為什麼不能一次做完?**

1. **依賴關係明確**
   - 沒有錯誤資訊,就無法分析
   - 沒有分析結果,就無法展示
   - 每個階段都是下個階段的基礎

2. **每階段可驗證**
   - 完成階段 1 → 可以看到報表有錯誤資訊
   - 完成階段 2 → 可以看到診斷上下文
   - 完成階段 3 → 可以在 Claude Desktop 測試
   - 階段性成果明確

3. **降低風險**
   - 如果階段 1 有問題,在階段 2 才發現就晚了
   - 每階段完成後測試,及早發現問題

4. **保持專注**
   - 一次只做一件事
   - 避免同時處理太多變更

---

### 為什麼測試這麼重要?

#### 測試策略

```
單元測試 (60%)
  ↓ 測試每個函式
整合測試 (30%)
  ↓ 測試模組間互動
端對端測試 (10%)
  ↓ 測試實際使用場景
```

**為什麼需要這麼多測試?**

1. **單元測試: 確保邏輯正確**
   ```typescript
   test('敏感欄位被正確遮罩', () => {
     const input = { password: 'secret', email: 'user@ex.com' };
     const result = maskSensitiveFields(input);
     expect(result.password).toBe('***');
     expect(result.email).toBe('user@ex.com');
   });
   ```

2. **整合測試: 確保模組協作**
   ```typescript
   test('診斷上下文正確生成', async () => {
     const report = createFailedReport();
     const context = builder.build(report);
     expect(context.errorPatterns).toHaveLength(1);
   });
   ```

3. **端對端測試: 確保實際可用**
   ```typescript
   test('在 Claude Desktop 中診斷成功', async () => {
     // 1. 執行測試 (會失敗)
     // 2. 取得報表
     // 3. 驗證診斷上下文
     // 4. 確認 Claude 能理解
   });
   ```

**為什麼要 80% 覆蓋率?**
- ✅ 確保關鍵邏輯都被測試
- ✅ 重構時有信心不會破壞功能
- ✅ 新增功能時可以驗證沒影響既有功能
- ⚠️ 不追求 100%,避免過度測試

---

## 🎯 設計哲學總結

### 核心原則

1. **以 API 錯誤訊息為核心**
   - API 開發者最了解問題
   - 錯誤訊息是最可靠的診斷來源
   - Stack trace 提供程式碼層級的洞察

2. **預先分析,減輕 AI 負擔**
   - 基於規則的錯誤分類很可靠
   - 錯誤模式偵測提高準確度
   - 診斷提示引導 AI 思考方向

3. **結構化資訊,易於理解**
   - 診斷上下文是為 AI 設計的資料格式
   - 清晰的結構讓 Claude 快速理解
   - 減少 Token 消耗和推理時間

4. **安全第一,即使在開發環境**
   - 敏感資料必須遮罩
   - 養成良好的安全習慣
   - 為未來擴充做準備

5. **循序漸進,階段性驗證**
   - 每個階段都有明確目標
   - 完成後立即驗證
   - 降低風險,保持專注

---

## 🎯 開發階段規劃

### 📊 實際程式碼分析結果 (2025-01-15)

經過對現有程式碼的分析 (主要參考 `apps/mcp-server/src/handlers/run-flow.ts` 和 `packages/core-flow/src/`),發現:

**✅ 好消息**:
1. 資料流程清晰: `HttpRunner` → `ValidationEngine` → `ReportingIntegration` → `ReportGenerator`
2. Axios 已自動處理 JSON/非JSON 回應,不需額外處理
3. 現有介面設計良好,只需擴充而非重構

**⚠️ 需要處理的問題**:
1. **網路層級錯誤處理** (2小時) - `HttpClient` throw error 需改為回傳虛擬 response
2. **IStepInput 型別擴充** (2小時) - `response` 需加入 `body`, `headers`, `responseTime`
3. **敏感資料遮罩實作** (3小時) - 新增 `maskSensitiveFields()` 和 `maskSensitiveHeaders()`

**修正後總工作量**: **11 天** (原估計 14 天)

---

### 階段 1: 增強錯誤報表 (2.5 天) 🔴 最高優先級

**目標**: 讓報表保留完整的錯誤資訊,而不是只有 hash

#### 1.0 前置修改: 處理網路層級錯誤 (2 小時)

**檔案**: `packages/http-runner/src/http-client.ts`

**問題**: 第 74-88 行 catch 區塊會 throw error,導致網路錯誤時整個流程中斷

**任務**:
- [ ] 修改 `catch` 區塊,回傳虛擬 `IHttpResponse` 而不是拋出錯誤
- [ ] 設定 `status: 0` 表示網路層級錯誤
- [ ] 在 `data` 中包含錯誤資訊 (error_code, message)
- [ ] 更新相關測試

**變更內容**:
```typescript
catch (error) {
  const duration = Date.now() - startTime;
  const errorMessage = error instanceof Error ? error.message : '未知錯誤';
  const errorCode = (error as any).code; // ECONNREFUSED, ETIMEDOUT...

  logger.error(EVENT_CODES.STEP_FAILURE, {
    executionId,
    component: 'http-client',
    method: request.method,
    url: request.url,
    error: errorMessage,
    errorCode,
    duration,
  });

  // ✨ 回傳虛擬 response 而不是拋出
  return {
    status: 0,
    headers: {},
    data: {
      _network_error: true,
      error: 'NETWORK_ERROR',
      message: errorMessage,
      error_code: errorCode,
      url: request.url,
      method: request.method
    },
    duration
  };
}
```

**驗收標準**:
- 網路錯誤不會中斷整個測試流程
- 回傳的 response 包含錯誤資訊
- 現有測試需更新或新增測試案例

---

#### 1.1 擴充 IStepInput 型別定義 (1 小時)

**檔案**: `packages/reporting/src/report-generator.ts`

**問題**: 第 17-34 行 `IStepInput.response` 缺少 `body`, `headers`, `responseTime`

**任務**:
- [ ] 在 `IStepInput.response` 新增 `body?`, `headers?`, `responseTime?`
- [ ] 保持向後相容性 (所有新欄位都是可選)
- [ ] TypeScript 編譯通過

**變更內容**:
```typescript
export interface IStepInput {
  name: string;
  status: 'success' | 'failure' | 'skipped';
  startTime: string;
  duration: number;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: unknown;
  };
  response: {
    statusCode: number;
    success: boolean;
    validationResults: string[];
    errorMessage?: string;
    // ✨ 新增
    body?: unknown;
    headers?: Record<string, string>;
    responseTime?: number;
  };
}
```

**驗收標準**:
- TypeScript 編譯通過
- 不破壞現有測試
- 新增的欄位為可選,確保向後相容

---

#### 1.2 修改 ReportingIntegration 傳遞完整資料 (1 小時)

**檔案**: `packages/core-flow/src/reporting-integration.ts`

**問題**: 第 99-112 行 `recordStepComplete()` 沒有傳遞 response body/headers

**任務**:
- [ ] 修改 `recordStepComplete()` 方法
- [ ] 從 `testResult.response` 提取 `data`, `headers`, `duration`
- [ ] 傳遞給 `IStepInput.response`

**變更內容**:
```typescript
const stepInput: IStepInput = {
  name: step.name,
  status: testResult.status === 'passed' ? 'success' :
          testResult.status === 'failed' ? 'failure' : 'skipped',
  startTime: stepStartTime,
  duration: testResult.duration,
  request,
  response: {
    statusCode: response.statusCode,
    success: testResult.status === 'passed',
    validationResults: response.validationResults,
    errorMessage: response.errorMessage || testResult.error,
    // ✨ 新增: 從 testResult.response 傳遞
    body: testResult.response?.data,
    headers: testResult.response?.headers,
    responseTime: testResult.response?.duration
  }
};
```

**驗收標準**:
- `IStepInput` 包含完整的 response 資訊
- 所有呼叫點都正常運作
- 整合測試通過

---

#### 1.3 修改 execution-report.ts 新增 errorDetails 欄位 (30 分鐘)

**檔案**: `packages/reporting/src/execution-report.ts`

**任務**:
- [ ] 在 `IStepResult.response` 新增 `errorDetails` 欄位
- [ ] 定義 `ErrorDetails` 介面
- [ ] 保持向後相容性

**變更內容**:
```typescript
/**
 * 錯誤詳情 (失敗時才包含)
 */
export interface IErrorDetails {
  body: unknown;                      // 完整錯誤回應 (已遮罩敏感資料)
  headers: Record<string, string>;    // 回應 Headers (已遮罩敏感資料)
  responseTime: number;               // 回應時間 (毫秒)
  bodySize: number;                   // 原始 body 大小
  bodyTruncated: boolean;             // 是否被截斷
}

export interface IStepResult {
  // ... 現有欄位
  response: {
    statusCode: number;
    success: boolean;
    bodyHash: string;

    // ✨ 新增: 失敗時的完整錯誤資訊
    errorDetails?: IErrorDetails;

    validationResults: string[];
    errorMessage: string | null;
  };
}
```

**驗收標準**:
- TypeScript 編譯通過
- 不破壞現有測試
- 新增的欄位為可選,確保向後相容

---

#### 1.4 實作敏感資料遮罩 (3 小時)

**檔案**: `packages/reporting/src/report-generator.ts`

**任務**:
- [ ] 實作 `maskSensitiveFields()` 方法 (遞迴遮罩)
- [ ] 實作 `maskSensitiveHeaders()` 方法
- [ ] 確保 `stack_trace` 不被遮罩
- [ ] 加入單元測試

**遮罩規則**:
- **敏感欄位**: `password`, `token`, `secret`, `apiKey`, `api_key`, `authorization`, `jwt`, `bearer`, `credentials`, `access_token`
- **敏感 Headers**: `authorization`, `cookie`, `set-cookie`, `x-api-key`, `x-auth-token`, `proxy-authorization`
- **不遮罩**: `stack_trace`, `stackTrace` (診斷需要)

**實作**:
```typescript
/**
 * 遮罩敏感欄位
 */
private maskSensitiveFields(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => this.maskSensitiveFields(item));
  }

  const masked: any = {};
  const sensitiveKeys = [
    'password', 'token', 'secret', 'apikey', 'api_key',
    'authorization', 'jwt', 'bearer', 'credentials', 'access_token'
  ];

  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();

    // stack_trace 不遮罩
    if (key === 'stack_trace' || key === 'stackTrace') {
      masked[key] = value;
      continue;
    }

    // 敏感欄位遮罩
    if (sensitiveKeys.some(sk => keyLower.includes(sk))) {
      masked[key] = '***';
    } else {
      masked[key] = this.maskSensitiveFields(value);
    }
  }

  return masked;
}

/**
 * 遮罩敏感 Headers
 */
private maskSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
  const sensitiveHeaders = [
    'authorization', 'cookie', 'set-cookie',
    'x-api-key', 'x-auth-token', 'proxy-authorization'
  ];

  const masked: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const keyLower = key.toLowerCase();
    if (sensitiveHeaders.includes(keyLower)) {
      masked[key] = '***';
    } else {
      masked[key] = value;
    }
  }

  return masked;
}
```

**測試案例**:
```typescript
// 測試 1: 敏感欄位遮罩
{
  "error": "AUTH_FAILED",
  "password": "secret123",    // → "***"
  "user_id": 456              // → 456 (保留)
}

// 測試 2: stack_trace 不遮罩
{
  "error": "SERVER_ERROR",
  "stack_trace": ["at foo()", "at bar()"],  // → 保留完整內容
  "api_key": "abc123"         // → "***"
}

// 測試 3: 巢狀物件遮罩
{
  "user": {
    "email": "user@ex.com",   // → 保留
    "password": "secret"      // → "***"
  }
}
```

---

#### 1.5 修改報表生成邏輯 (2 小時)

**檔案**: `packages/reporting/src/report-generator.ts`

**問題**: 第 57-76 行 `generateStepResult()` 需要在失敗時保留 errorDetails

**任務**:
- [ ] 修改 `generateStepResult()` 方法
- [ ] 失敗時建立 `errorDetails` 物件
- [ ] 成功時維持只存 hash (節省空間)
- [ ] 加入整合測試

**邏輯**:
```typescript
private generateStepResult(stepInput: IStepInput): IStepResult {
  const isFailure = stepInput.status === 'failure';
  const responseBody = stepInput.response.body;

  return {
    name: stepInput.name,
    status: stepInput.status,
    startTime: stepInput.startTime,
    duration: stepInput.duration,
    request: {
      method: stepInput.request.method,
      url: stepInput.request.url,
      headerHash: this.calculateHash(stepInput.request.headers),
      bodyHash: this.calculateHash(stepInput.request.body),
    },
    response: {
      statusCode: stepInput.response.statusCode,
      success: stepInput.response.success,
      validationResults: stepInput.response.validationResults,
      errorMessage: stepInput.response.errorMessage || null,

      // ✨ 失敗時保留完整錯誤資訊
      errorDetails: isFailure && responseBody ? {
        body: this.maskSensitiveFields(responseBody),
        headers: this.maskSensitiveHeaders(stepInput.response.headers || {}),
        responseTime: stepInput.response.responseTime || 0,
        bodySize: JSON.stringify(responseBody).length,
        bodyTruncated: false // TODO: 實作截斷邏輯
      } : undefined
    },
  };
}
```

**驗收標準**:
- 失敗的步驟報表包含 `errorDetails`
- 成功的步驟報表不包含 `errorDetails`
- 敏感資料已被遮罩
- `stack_trace` 完整保留
- 所有現有測試通過

---

### 階段 2: 建立診斷上下文生成器 (2 天) 🟡 高優先級

**目標**: 為 Claude 準備結構化、易理解的診斷資訊

**修正說明**: 經過實際程式碼分析,錯誤分類邏輯比預期簡單,因為:
1. 網路錯誤統一為 `statusCode: 0`
2. 可結合 `errorDetails.body.error` 提高準確度
3. 不需要複雜的模式識別

#### 2.1 定義診斷上下文型別

**檔案**: `packages/reporting/src/diagnostic-context.ts` (新建)

**任務**:
- [ ] 定義 `DiagnosticContext` 介面
- [ ] 定義 `FailedStepDiagnostic` 介面
- [ ] 定義 `ErrorPattern` 介面
- [ ] 定義 `DiagnosticHints` 介面
- [ ] 加入完整的 JSDoc 註解

**核心型別**:
```typescript
export interface DiagnosticContext {
  hasFailed: boolean;
  failureCount: number;
  failedSteps: FailedStepDiagnostic[];
  environment: EnvironmentDiagnostic;
  errorPatterns: ErrorPattern[];
  diagnosticHints: DiagnosticHints;
  relatedSteps?: RelatedStepInfo[];
}
```

---

#### 2.2 實作診斷上下文建構器

**檔案**: `packages/reporting/src/diagnostic-context-builder.ts` (新建)

**任務**:
- [ ] 實作 `DiagnosticContextBuilder` 類別
- [ ] 實作 `build()` 方法 - 主要入口
- [ ] 實作 `buildFailedStepDiagnostic()` - 分析單一失敗步驟
- [ ] 實作 `classifyError()` - 自動分類錯誤類型
- [ ] 實作 `detectErrorPatterns()` - 偵測錯誤模式
- [ ] 實作 `generateDiagnosticHints()` - 生成診斷提示
- [ ] 加入完整單元測試

**關鍵方法**:
```typescript
export class DiagnosticContextBuilder {
  build(report: IExecutionReport): DiagnosticContext | null;

  private buildFailedStepDiagnostic(step: IStepResult): FailedStepDiagnostic;
  private classifyError(step: IStepResult): ErrorClassification;
  private detectErrorPatterns(report: IExecutionReport): ErrorPattern[];
  private generateDiagnosticHints(failedSteps: IStepResult[]): DiagnosticHints;
}
```

**錯誤分類邏輯** (改進版):
```typescript
private classifyError(step: IStepResult): ErrorClassification {
  const code = step.response.statusCode;
  const body = step.response.errorDetails?.body;
  const errorCode = typeof body === 'object' && body !== null ?
    (body as any).error : null;

  // 網路層級錯誤 (由 HttpClient 統一處理)
  if (code === 0) {
    return { primaryType: 'network', confidence: 95, indicators: ['statusCode: 0'] };
  }

  // 認證錯誤 (結合錯誤代碼提高準確度)
  if (code === 401) {
    const authCodes = ['TOKEN_EXPIRED', 'AUTHENTICATION_FAILED', 'INVALID_TOKEN'];
    if (errorCode && authCodes.includes(errorCode)) {
      return { primaryType: 'auth', confidence: 95, indicators: [`HTTP 401`, `error: ${errorCode}`] };
    }
    return { primaryType: 'auth', confidence: 80, indicators: ['HTTP 401'] };
  }

  // 授權錯誤
  if (code === 403) {
    return { primaryType: 'auth', confidence: 85, indicators: ['HTTP 403'] };
  }

  // 驗證錯誤
  if (code === 400 || code === 422) {
    return { primaryType: 'validation', confidence: 85, indicators: [`HTTP ${code}`] };
  }

  // 伺服器錯誤
  if (code >= 500) {
    return { primaryType: 'server', confidence: 90, indicators: [`HTTP ${code}`] };
  }

  return { primaryType: 'unknown', confidence: 50, indicators: [`HTTP ${code}`] };
}
```

**錯誤模式偵測**:
- 連續認證失敗
- 第一步失敗導致連鎖失敗
- 全部網路錯誤 (API 未啟動)

---

#### 2.3 實作診斷提示生成器

**檔案**: `packages/reporting/src/diagnostic-hints-generator.ts` (新建)

**任務**:
- [ ] 實作快速診斷生成
- [ ] 實作可能原因分析
- [ ] 實作修復建議生成
- [ ] 加入單元測試

**範例輸出**:
```typescript
{
  quickDiagnosis: "2 個步驟失敗,主要是認證問題",
  likelyCauses: [
    "認證 Token 遺失、無效或已過期",
    "API Key 設定錯誤"
  ],
  suggestedActions: [
    "更新或重新取得認證 Token",
    "檢查 .env.local 中的 SPEC_PILOT_TOKEN"
  ]
}
```

---

### 階段 3: 整合診斷上下文到 MCP (1-2 天) 🟡 高優先級

**目標**: 讓 getReport 回傳包含診斷上下文的報表

#### 3.1 修改 MCP getReport Handler

**檔案**: `apps/mcp-server/src/handlers/get-report.ts`

**任務**:
- [ ] 引入 `DiagnosticContextBuilder`
- [ ] 在回傳報表前建立診斷上下文
- [ ] 將診斷上下文加入回應
- [ ] 更新回應型別定義
- [ ] 加入整合測試

**變更**:
```typescript
import { DiagnosticContextBuilder } from '@specpilot/reporting';

export function handleGetReport(request: IMcpRequest): IMcpResponse {
  // ... 現有邏輯 ...

  const report = parsedReport as IExecutionReport;

  // ✨ 建立診斷上下文
  const diagnosticBuilder = new DiagnosticContextBuilder();
  const diagnosticContext = diagnosticBuilder.build(report);

  const result: IGetReportResult = {
    reportPath,
    executionId: report.executionId,
    status: report.status,
    reportSummary: { ... },
    report,
    diagnosticContext,  // ✨ 新增診斷上下文
  };

  return createSuccessResponse(result, requestId);
}
```

---

#### 3.2 更新 MCP 回應型別

**檔案**: `apps/mcp-server/src/rpc-handler.ts`

**任務**:
- [ ] 在 `IGetReportResult` 新增 `diagnosticContext` 欄位
- [ ] 更新型別定義
- [ ] 確保 TypeScript 編譯通過

**變更**:
```typescript
export interface IGetReportResult {
  reportPath: string;
  executionId: string;
  status: string;
  reportSummary: {
    totalSteps: number;
    successfulSteps: number;
    failedSteps: number;
    skippedSteps: number;
    duration: number;
  };
  report: IExecutionReport;
  diagnosticContext?: DiagnosticContext;  // ✨ 新增
}
```

---

### 階段 4: API 開發規範 (已完成) ✅

**狀態**: 已有完整文件,無需額外開發

#### 4.1 現有文件

**檔案**: `docs/guides/api-errors/api-error-handling-guide.md` ✅

**已包含內容**:
- ✅ 標準錯誤格式規範 (JSON Schema)
- ✅ 四種主流框架實作範例 (Node.js, Python, Java, .NET)
- ✅ Stack Trace 處理規範與環境分離策略
- ✅ 常見錯誤類型範例 (401, 403, 422, 404, 500, 502)
- ✅ OpenAPI Schema 定義
- ✅ SpecPilot 整合步驟
- ✅ 安全性注意事項與測試檢查清單
- ✅ 完整工作流程圖 (開發、測試、AI 診斷)

**關鍵特點**:
1. **四種框架支援**: Node.js (Express), Python (FastAPI/Flask), Java (Spring Boot), .NET (ASP.NET Core)
2. **環境分離**: Development (完整 stack trace) / Staging (精簡) / Production (隱藏)
3. **敏感資料遮罩**: 自動遮罩 password, token, secret 等欄位
4. **標準化錯誤代碼**: 大寫蛇形命名 (如 `AUTHENTICATION_FAILED`)
5. **診斷提示欄位**: `hint` 提供快速修復建議

---

#### 4.2 參考範例

**標準錯誤格式**:
```json
{
  "error": "AUTHENTICATION_FAILED",
  "message": "JWT Token 已過期",
  "hint": "請使用 /auth/refresh 端點更新 Token",
  "stack_trace": [
    "at AuthService.verifyToken (auth-service.js:45)",
    "at AuthMiddleware.authenticate (auth-middleware.js:23)"
  ],
  "source_context": {
    "file": "auth-service.js",
    "line": 45,
    "method": "verifyToken"
  },
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-15T10:30:45.123Z",
  "status_code": 401,
  "path": "/api/users/profile"
}
```

**OpenAPI Schema** (已包含在文件中):
- 完整的 `DiagnosticError` Schema 定義
- 與 SpecPilot 整合範例
- 測試流程 YAML 範例

---

#### 4.3 後續工作

**無需額外開發**,但可以在實作完成後:
- [ ] 更新文件連結到實際的診斷功能文件
- [ ] 在 README.md 中加入 API 開發規範的參考連結
- [ ] 根據實際測試結果更新診斷成功率數據

**時間**: **0 天** (已完成)

---

### 階段 5: 測試與驗證 (2-3 天) 🟡 高優先級

#### 5.1 單元測試

**任務**:
- [ ] `report-generator.test.ts` - 測試敏感資料遮罩
- [ ] `diagnostic-context-builder.test.ts` - 測試診斷上下文生成
- [ ] `diagnostic-hints-generator.test.ts` - 測試提示生成
- [ ] 測試覆蓋率 ≥ 80%

**測試案例**:
- 成功的測試不應包含 errorDetails
- 失敗的測試應包含完整 errorDetails
- 敏感欄位被正確遮罩
- 錯誤分類正確 (auth, network, validation, server)
- 錯誤模式偵測正確
- 診斷提示合理且有用

---

#### 5.2 整合測試

**檔案**: `apps/mcp-server/__tests__/get-report-with-diagnosis.test.ts` (新建)

**任務**:
- [ ] 測試完整的 getReport 流程
- [ ] 驗證診斷上下文正確生成
- [ ] 測試各種失敗場景
- [ ] 測試 MCP 回應格式

**測試場景**:
1. 認證失敗 (401) - 應分類為 auth
2. 網路錯誤 (statusCode: 0) - 應分類為 network
3. 伺服器錯誤 (500) - 應分類為 server
4. Schema 驗證失敗 - 應分類為 validation
5. 混合失敗 - 應偵測錯誤模式

---

#### 5.3 端對端測試

**任務**:
- [ ] 建立測試 API (包含診斷友善的錯誤格式)
- [ ] 執行完整測試流程
- [ ] 驗證報表包含診斷上下文
- [ ] 在 Claude Desktop 中手動測試診斷功能

**測試流程**:
1. 啟動測試 API
2. 執行會失敗的測試 Flow
3. 檢查生成的報表是否包含 `errorDetails`
4. 使用 MCP 的 `getReport` 取得報表
5. 驗證 `diagnosticContext` 的內容
6. 在 Claude Desktop 中詢問失敗原因
7. 驗證 Claude 能夠理解並給出診斷

---

### 階段 6: 文件與範例 (1-2 天) 🟢 中優先級

#### 6.1 更新專案文件

**任務**:
- [ ] 更新 `README.md` - 說明診斷功能
- [ ] 更新 `MCP-SETUP.md` - 加入診斷功能使用說明
- [ ] 建立 `docs/diagnosis-feature.md` - 完整功能說明

---

#### 6.2 建立使用範例

**檔案**: `examples/diagnosis-workflow/` (新建)

**任務**:
- [ ] 建立範例 API (含診斷友善錯誤格式)
- [ ] 建立測試 Flow (包含會失敗的測試)
- [ ] 建立使用說明 `README.md`
- [ ] 提供 Claude Desktop 互動範例

**範例內容**:
```
examples/diagnosis-workflow/
├── api/
│   ├── server.js              # 測試 API 伺服器
│   └── error-handler.js       # 診斷友善的錯誤處理
├── specs/
│   └── test-api.yaml          # OpenAPI 規格
├── flows/
│   └── failing-tests.yaml     # 會失敗的測試
└── README.md                  # 使用說明
```

---

#### 6.3 建立疑難排解指南

**檔案**: `docs/diagnosis-troubleshooting.md` (新建)

**任務**:
- [ ] 常見問題與解決方案
- [ ] 診斷結果不準確時的處理
- [ ] 如何改善錯誤訊息品質

---

## 📊 開發時程估算

### 修正前 vs 修正後

| 階段 | 原估計 | 修正後 | 變化 | 優先級 | 依賴 |
|-----|-------|-------|------|-------|-----|
| 階段 1: 增強錯誤報表 | 2-3 天 | **2.5 天** | -0.5天 | 🔴 最高 | 無 |
| 階段 2: 診斷上下文生成器 | 2-3 天 | **2 天** | -1天 | 🟡 高 | 階段 1 |
| 階段 3: 整合到 MCP | 1-2 天 | **1 天** | -1天 | 🟡 高 | 階段 2 |
| 階段 4: API 開發規範 | 1 天 | **0 天** | -1天 (已有文件) | 🟢 中 | 可並行 |
| 階段 5: 測試與驗證 | 2-3 天 | **4 天** | +1.5天 | 🟡 高 | 階段 1-3 |
| 階段 6: 文件與範例 | 1-2 天 | **1.5 天** | -0.5天 | 🟢 中 | 階段 5 |
| **總計** | **9-14 天** | **11 天** | **-3天** | | |

### 修正理由

**減少的工作量**:
1. ✅ 資料流程已清楚,不需要架構重構 (-1天)
2. ✅ Axios 已處理 JSON 解析 (-0.5天)
3. ✅ 已有 `api-error-handling-guide.md` (-1天)
4. ✅ Stack trace 不需要提取邏輯 (-0.5天)

**增加的工作量**:
1. ⚠️ 測試覆蓋率需要更完整 (+1.5天)
2. ⚠️ 網路錯誤處理需要修改現有邏輯 (+0.5天)

---

## 🎯 里程碑

### Milestone 1: 基礎功能完成 (第 1-4.5 天)
- ✅ 網路錯誤處理修復 (HttpClient)
- ✅ 型別定義擴充 (IStepInput, IErrorDetails)
- ✅ 報表包含完整錯誤資訊
- ✅ 敏感資料正確遮罩
- ✅ 診斷上下文正確生成
- ✅ MCP getReport 回傳診斷上下文

**驗收標準**:
- 所有單元測試通過
- 網路錯誤不會中斷測試流程
- 可以在報表中看到完整錯誤訊息 (包含 stack_trace)
- 敏感資料已遮罩 (密碼、Token 等顯示為 ***)
- Claude Desktop 能讀取到診斷上下文

**實際工作分解**:
- 第 1 天: 1.0 + 1.1 (網路錯誤 + 型別擴充)
- 第 2 天: 1.2 + 1.3 (資料傳遞 + errorDetails)
- 第 3 天: 1.4 + 1.5 (敏感資料遮罩 + 報表邏輯)
- 第 4-4.5 天: 階段 2 診斷上下文

---

### Milestone 2: 完整測試通過 (第 5.5-9.5 天)
- ✅ 所有測試通過 (覆蓋率 ≥ 80%)
- ✅ 整合測試驗證各種錯誤場景
- ✅ 端對端測試確認實際效果

**驗收標準**:
- CI/CD 全綠
- 在 Claude Desktop 中實際測試診斷功能
- Claude 能正確診斷至少 6 種錯誤類型:
  1. 網路錯誤 (statusCode: 0)
  2. 認證失敗 (401)
  3. 授權失敗 (403)
  4. 驗證錯誤 (400/422)
  5. 伺服器錯誤 (500+)
  6. 連鎖失敗模式

**實際工作分解**:
- 第 5.5 天: 階段 3 MCP 整合
- 第 6.5-9.5 天: 階段 5 測試 (單元 + 整合 + E2E)

---

### Milestone 3: 正式發布 (第 10-11 天)
- ✅ 完整文件更新
- ✅ 使用範例與疑難排解指南
- ✅ 實際診斷成功率驗證

**驗收標準**:
- 文件完整且易於理解
- 提供可執行的範例 (包含會失敗的測試)
- 診斷成功率達 **70-80%** (實際可達成的目標)
- README 更新診斷功能說明

**實際工作分解**:
- 第 10-11 天: 階段 6 文件與範例

**📝 備註**: 診斷成功率從 85-90% 調整為 70-80%,因為實際上:
- 需要 API 遵守 `api-error-handling-guide.md` 規範才能達到最佳效果
- 許多現有 API 不會提供結構化錯誤或 stack trace
- 70-80% 是更務實的目標

---

## 🔧 開發環境準備

### 必要工具
- Node.js 20.11.1 LTS
- pnpm 9.1
- TypeScript 5.4.5
- Claude Desktop (用於測試)

### 專案設定
```bash
# 安裝依賴
pnpm install

# 執行測試
pnpm run test

# 啟動 MCP Server
pnpm run start:mcp

# 執行 Lint
pnpm run lint
```

---

## 📝 Checklist

### 開發前準備
- [ ] 閱讀完整計劃文件
- [ ] 確認開發環境正常
- [ ] 建立功能分支 `feature/ai-diagnosis`
- [ ] 設定 Git pre-commit hook

### 每個階段完成後
- [ ] 執行單元測試
- [ ] 執行 Lint 檢查
- [ ] 更新相關文件
- [ ] Commit 變更 (遵循 Conventional Commits)
- [ ] 更新此計劃文件的進度

### 最終發布前
- [ ] 所有測試通過
- [ ] 文件完整
- [ ] 在 Claude Desktop 實測成功
- [ ] Code Review
- [ ] 合併到 main 分支
- [ ] 建立 Release Notes

---

## 🚀 下一步

建議從 **階段 1.1** 開始:修改報表資料結構。

準備好開始了嗎? 🎯