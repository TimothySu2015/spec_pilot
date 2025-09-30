# AI 智能診斷功能使用範例

本文件展示如何使用 SpecPilot 的 AI 智能診斷功能來快速定位和修復測試失敗問題。

## 使用場景

### 場景 1: 網路連線失敗

**問題描述**: 測試執行時所有請求都失敗,回傳網路錯誤。

**診斷過程**:

1. 執行測試流程:
```bash
pnpm run start -- --spec specs/api.yaml --flow flows/health_check.yaml --baseUrl http://localhost:3000
```

2. 透過 MCP 取得報表:
```json
{
  "jsonrpc": "2.0",
  "method": "getReport",
  "id": "1"
}
```

3. 查看診斷上下文:
```json
{
  "result": {
    "status": "failure",
    "diagnosticContext": {
      "hasFailed": true,
      "failureCount": 3,
      "failedSteps": [
        {
          "stepName": "健康檢查",
          "statusCode": 0,
          "classification": {
            "primaryType": "network",
            "confidence": 95,
            "indicators": ["statusCode: 0", "網路連線失敗"]
          }
        }
      ],
      "errorPatterns": [
        {
          "pattern": "all_network_errors",
          "description": "所有失敗都是網路錯誤，API 服務可能未啟動",
          "likelihood": "high"
        }
      ],
      "diagnosticHints": {
        "quickDiagnosis": "3 個步驟失敗，全部是網路錯誤，API 服務可能未啟動",
        "likelyCauses": [
          "API 服務未啟動或無法連線",
          "網路連線問題或防火牆阻擋",
          "URL 設定錯誤"
        ],
        "suggestedActions": [
          "確認 API 服務是否正在執行",
          "檢查 baseUrl 設定是否正確",
          "測試網路連線是否正常"
        ]
      }
    }
  }
}
```

**AI 分析**:
- 錯誤類型: 網路錯誤 (信心度 95%)
- 錯誤模式: 所有失敗都是網路錯誤
- 根本原因: API 服務未啟動

**修復步驟**:
1. 檢查 API 服務狀態: `ps aux | grep api-server`
2. 啟動 API 服務: `npm run start:api`
3. 重新執行測試確認修復

---

### 場景 2: 認證 Token 過期

**問題描述**: 登入成功後,後續需要認證的請求全部失敗。

**診斷上下文**:
```json
{
  "diagnosticContext": {
    "hasFailed": true,
    "failureCount": 2,
    "failedSteps": [
      {
        "stepName": "取得使用者資料",
        "statusCode": 401,
        "classification": {
          "primaryType": "auth",
          "confidence": 95,
          "indicators": ["HTTP 401", "error: TOKEN_EXPIRED"]
        }
      },
      {
        "stepName": "更新使用者資料",
        "statusCode": 401,
        "classification": {
          "primaryType": "auth",
          "confidence": 95,
          "indicators": ["HTTP 401", "error: INVALID_TOKEN"]
        }
      }
    ],
    "errorPatterns": [
      {
        "pattern": "consecutive_auth_failures",
        "description": "連續 2 個步驟認證失敗",
        "likelihood": "high"
      }
    ],
    "diagnosticHints": {
      "quickDiagnosis": "2 個步驟失敗，主要是認證問題",
      "likelyCauses": [
        "認證 Token 遺失、無效或已過期",
        "API Key 設定錯誤",
        "使用者權限不足"
      ],
      "suggestedActions": [
        "更新或重新取得認證 Token",
        "檢查 .env.local 中的認證設定",
        "確認使用者帳號具有足夠的權限"
      ],
      "suggestedQuestions": [
        "Token 是什麼時候過期的？如何刷新？",
        "API 使用哪種認證方式（Bearer Token / API Key）？"
      ]
    }
  }
}
```

**AI 分析**:
- 錯誤類型: 認證錯誤 (信心度 95%)
- 錯誤模式: 連續認證失敗
- 根本原因: Token 已過期 (TOKEN_EXPIRED)

**修復步驟**:
1. 檢查 Token 有效期限
2. 實作 Token 自動刷新機制
3. 在測試流程中加入 Token 刷新步驟

---

### 場景 3: 連鎖失敗

**問題描述**: 第一步登入失敗,導致後續所有需要認證的步驟都失敗。

**診斷上下文**:
```json
{
  "diagnosticContext": {
    "hasFailed": true,
    "failureCount": 3,
    "errorPatterns": [
      {
        "pattern": "cascading_failures",
        "description": "第一步失敗導致後續步驟連鎖失敗",
        "likelihood": "high",
        "affectedSteps": [0, 1, 2]
      }
    ],
    "diagnosticHints": {
      "quickDiagnosis": "3 個步驟失敗，第一步失敗導致後續連鎖失敗",
      "likelyCauses": [
        "第一步失敗導致後續步驟無法正常執行"
      ],
      "suggestedActions": [
        "優先修復第一個失敗的步驟",
        "修復後重新執行測試，確認是否解決後續失敗"
      ],
      "suggestedQuestions": [
        "第一步失敗的根本原因是什麼？"
      ]
    }
  }
}
```

**AI 分析**:
- 錯誤模式: 連鎖失敗
- 關鍵發現: 第一步登入失敗導致後續所有步驟失敗
- 修復策略: 專注修復第一步

**修復步驟**:
1. 檢查第一步登入的錯誤詳情
2. 修復登入問題（例如：帳號密碼錯誤）
3. 重新執行測試,確認後續步驟恢復正常

---

### 場景 4: 驗證錯誤

**問題描述**: API 回傳 400 錯誤,提示資料格式不符合規格。

**診斷上下文**:
```json
{
  "diagnosticContext": {
    "hasFailed": true,
    "failureCount": 1,
    "failedSteps": [
      {
        "stepName": "建立使用者",
        "statusCode": 400,
        "classification": {
          "primaryType": "validation",
          "confidence": 90,
          "indicators": ["HTTP 400", "Schema 驗證失敗"]
        }
      }
    ],
    "diagnosticHints": {
      "quickDiagnosis": "1 個步驟失敗，主要是驗證問題",
      "likelyCauses": [
        "請求資料格式不符合 API 規格",
        "必要欄位遺失或型別錯誤",
        "資源不存在或 ID 錯誤"
      ],
      "suggestedActions": [
        "比對 API 規格，檢查請求資料格式",
        "確認必要欄位都已正確提供",
        "檢查資料型別是否符合規格要求"
      ],
      "suggestedQuestions": [
        "錯誤訊息中提到哪些欄位有問題？",
        "API 規格對這些欄位的要求是什麼？"
      ]
    }
  }
}
```

**AI 分析**:
- 錯誤類型: 驗證錯誤 (信心度 90%)
- 問題: 請求資料不符合 API Schema

**修復步驟**:
1. 查看完整錯誤訊息,確認哪些欄位有問題
2. 比對 OpenAPI 規格,確認欄位要求
3. 修正測試流程中的請求資料格式

---

## 在 Claude Desktop 中使用診斷功能

### 步驟 1: 執行測試

透過 Claude 使用 SpecPilot MCP 工具執行測試:

```
@specpilot 請執行 specs/api.yaml 和 flows/user_crud.yaml 的測試,
baseUrl 是 http://localhost:3000
```

### 步驟 2: 查看診斷結果

如果測試失敗,要求 Claude 分析診斷上下文:

```
剛才的測試失敗了,請幫我分析 diagnosticContext 並找出問題
```

### 步驟 3: 獲得修復建議

Claude 會基於診斷上下文提供:
- 問題根本原因分析
- 具體修復步驟
- 相關程式碼範例
- 預防措施建議

### 範例對話

**User**: 測試失敗了,能幫我看看是什麼問題嗎？

**Claude**: 我來分析一下診斷上下文...

根據診斷結果,發現是連續認證失敗的問題:
- 2 個步驟都因為 HTTP 401 失敗
- 錯誤代碼顯示 TOKEN_EXPIRED
- 信心度 95%，可以確定是 Token 過期問題

建議的修復方案:
1. 在測試流程開始前,先執行登入步驟取得新 Token
2. 或是檢查 .env.local 中的 SPEC_PILOT_TOKEN 是否已過期
3. 如果 API 支援,可以實作 Token 自動刷新機制

需要我幫你修改測試流程嗎？

---

## 診斷功能技術細節

### 錯誤分類邏輯

**網路錯誤** (statusCode: 0)
- 信心度: 95%
- 常見原因: API 服務未啟動、網路連線問題

**認證錯誤** (statusCode: 401/403)
- 信心度: 80-95% (有 errorCode 時為 95%)
- 常見原因: Token 過期、權限不足

**驗證錯誤** (statusCode: 400/422)
- 信心度: 85-90%
- 常見原因: 資料格式錯誤、必要欄位遺失

**伺服器錯誤** (statusCode: 500+)
- 信心度: 90%
- 常見原因: API 內部錯誤、資料庫問題

### 錯誤模式偵測

1. **consecutive_auth_failures**: 連續 2 個以上認證失敗
2. **cascading_failures**: 第一步失敗導致後續失敗
3. **all_network_errors**: 所有失敗都是網路錯誤
4. **same_resource_failures**: 同一資源的多個操作都失敗

### 安全性考量

診斷系統會自動遮罩敏感資料:
- 密碼、Token、API Key
- Authorization headers
- 包含 'secret', 'password' 等關鍵字的欄位

同時保留診斷必需的資訊:
- HTTP 狀態碼
- 錯誤類型與代碼
- Stack trace (用於除錯)
- 請求 URL 與方法

---

## 最佳實踐

### 1. 定期檢查診斷報表
```bash
# 每次測試後都查看診斷上下文
pnpm run start:mcp
# 然後使用 getReport 方法
```

### 2. 建立錯誤處理指南
根據常見的診斷模式,建立團隊內部的錯誤處理手冊。

### 3. 整合到 CI/CD
在 CI/CD 流程中加入診斷報表分析,自動通知相關團隊。

### 4. 利用 AI 協助
充分利用 Claude 的 MCP 整合,讓 AI 自動分析診斷上下文並提供修復建議。

---

## 參考資源

- [AI 診斷實作計畫](../ai-diagnosis-implementation-plan.md)
- [MCP 介面文件](../mcp-interface.md)
- [測試流程範例](../../flows/)
- [OpenAPI 規格範例](../../specs/)