# SpecPilot AI 診斷功能實作計劃

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
- ✅ 診斷成功率提升到 85-90%

**權衡**:
- ⚠️ 報表檔案變大 (但只在失敗時)
- ⚠️ 需要處理敏感資料遮罩
- ✅ 只在本機開發使用,安全性可控

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

### 階段 1: 增強錯誤報表 (2-3 天) 🔴 最高優先級

**目標**: 讓報表保留完整的錯誤資訊,而不是只有 hash

#### 1.1 修改報表資料結構

**檔案**: `packages/reporting/src/execution-report.ts`

**任務**:
- [ ] 在 `IStepResult.response` 新增 `errorDetails` 欄位
- [ ] 定義 `ErrorDetails` 介面
- [ ] 保持向後相容性

**變更內容**:
```typescript
export interface IStepResult {
  // ... 現有欄位
  response: {
    statusCode: number;
    success: boolean;
    bodyHash: string;

    // ✨ 新增: 失敗時的完整錯誤資訊
    errorDetails?: {
      body: unknown;              // 完整錯誤回應
      headers: Record<string, string>;
      responseTime: number;
      stackTrace?: string[];      // Stack trace (如果有)
    };

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

#### 1.2 實作敏感資料遮罩

**檔案**: `packages/reporting/src/report-generator.ts`

**任務**:
- [ ] 實作 `sanitizeErrorBody()` 方法
- [ ] 實作 `sanitizeHeaders()` 方法
- [ ] 實作 `maskSensitiveFields()` 方法
- [ ] 加入單元測試

**遮罩規則**:
- 密碼、Token、API Key 等敏感欄位 → `"***"`
- Authorization、Cookie 等 Headers → `"***"`
- 保留錯誤訊息結構和其他診斷資訊

**測試案例**:
```typescript
// 輸入
{
  "error": "AUTH_FAILED",
  "password": "secret123",
  "user_id": 456
}

// 輸出
{
  "error": "AUTH_FAILED",
  "password": "***",
  "user_id": 456
}
```

---

#### 1.3 修改報表生成邏輯

**檔案**: `packages/reporting/src/report-generator.ts`

**任務**:
- [ ] 修改 `generateStepResult()` 方法
- [ ] 失敗時保留完整錯誤內容
- [ ] 成功時維持只存 hash (節省空間)
- [ ] 加入整合測試

**邏輯**:
```typescript
private generateStepResult(stepInput: StepInput): StepResult {
  const isFailure = stepInput.status === 'failure';

  return {
    // ...
    response: {
      // 總是計算 hash
      bodyHash: this.calculateHash(stepInput.response.body),

      // ✨ 失敗時保留完整資訊
      errorDetails: isFailure ? {
        body: this.sanitizeErrorBody(stepInput.response.body),
        headers: this.sanitizeHeaders(stepInput.response.headers),
        responseTime: stepInput.response.responseTime,
        stackTrace: this.extractStackTrace(stepInput.response.body),
      } : undefined,
    }
  };
}
```

**驗收標準**:
- 失敗的步驟報表包含 `errorDetails`
- 成功的步驟報表不包含 `errorDetails`
- 敏感資料已被遮罩
- 所有現有測試通過

---

### 階段 2: 建立診斷上下文生成器 (2-3 天) 🟡 高優先級

**目標**: 為 Claude 準備結構化、易理解的診斷資訊

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

**錯誤分類邏輯**:
- HTTP 401/403 → `auth` (90% 信心度)
- HTTP 0/-1 → `network` (95% 信心度)
- HTTP 500+ → `server` (85% 信心度)
- 驗證失敗 → `validation` (80% 信心度)

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

### 階段 4: 建立 API 開發規範 (1 天) 🟢 中優先級

**目標**: 制定診斷友善的錯誤格式規範,供 API 開發者參考

#### 4.1 撰寫開發規範文件

**檔案**: `docs/api-development-guidelines.md` (新建)

**任務**:
- [ ] 撰寫標準錯誤格式規範
- [ ] 提供各種錯誤類型的範例
- [ ] 說明 Stack Trace 的處理方式
- [ ] 提供 Node.js 實作範例
- [ ] 說明環境分離策略

**內容大綱**:
1. 標準錯誤格式定義
2. 必填欄位與建議欄位
3. Stack Trace 處理規範
4. 常見錯誤類型範例 (401, 400, 404, 500)
5. 實作範例 (Node.js/Express)
6. 最佳實踐與注意事項
7. SpecPilot 診斷能力說明

---

#### 4.2 建立 OpenAPI 錯誤 Schema

**檔案**: `docs/error-schema-template.yaml` (新建)

**任務**:
- [ ] 定義 `DiagnosticError` Schema
- [ ] 提供使用範例
- [ ] 說明各欄位的用途

**內容**:
```yaml
components:
  schemas:
    DiagnosticError:
      type: object
      required: [error, message]
      properties:
        error:
          type: string
          example: "TOKEN_EXPIRED"
        message:
          type: string
          example: "認證 Token 已過期"
        hint:
          type: string
          example: "請使用 POST /auth/refresh 刷新 Token"
        stack_trace:
          type: array
          items:
            type: string
        details:
          type: object
        documentation_url:
          type: string
          format: uri
```

---

#### 4.3 建立實作範例

**檔案**: `docs/examples/error-handler-nodejs.js` (新建)

**任務**:
- [ ] 提供 Node.js/Express 錯誤處理器範例
- [ ] 實作環境感知的錯誤格式化
- [ ] 實作敏感資料遮罩
- [ ] 加入詳細註解

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

| 階段 | 工作量 | 優先級 | 依賴 |
|-----|-------|-------|-----|
| 階段 1: 增強錯誤報表 | 2-3 天 | 🔴 最高 | 無 |
| 階段 2: 診斷上下文生成器 | 2-3 天 | 🟡 高 | 階段 1 |
| 階段 3: 整合到 MCP | 1-2 天 | 🟡 高 | 階段 2 |
| 階段 4: API 開發規範 | 1 天 | 🟢 中 | 可並行 |
| 階段 5: 測試與驗證 | 2-3 天 | 🟡 高 | 階段 1-3 |
| 階段 6: 文件與範例 | 1-2 天 | 🟢 中 | 階段 5 |
| **總計** | **9-14 天** | | |

---

## 🎯 里程碑

### Milestone 1: 基礎功能完成 (第 3-5 天)
- ✅ 報表包含完整錯誤資訊
- ✅ 敏感資料正確遮罩
- ✅ 診斷上下文正確生成
- ✅ MCP getReport 回傳診斷上下文

**驗收標準**:
- 所有單元測試通過
- 可以在報表中看到完整錯誤訊息
- Claude Desktop 能讀取到診斷上下文

---

### Milestone 2: 完整測試通過 (第 7-9 天)
- ✅ 所有測試通過 (覆蓋率 ≥ 80%)
- ✅ 整合測試驗證各種錯誤場景
- ✅ 端對端測試確認實際效果

**驗收標準**:
- CI/CD 全綠
- 在 Claude Desktop 中實際測試診斷功能
- Claude 能正確診斷至少 5 種錯誤類型

---

### Milestone 3: 正式發布 (第 11-14 天)
- ✅ 完整文件
- ✅ 使用範例
- ✅ API 開發規範

**驗收標準**:
- 文件完整且易於理解
- 提供可執行的範例
- 診斷成功率達 85% 以上

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