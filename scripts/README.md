# 測試腳本工具

## 📋 可用腳本

### test-diagnostic-context.js

測試診斷上下文生成器，讀取測試報表並產生完整的診斷上下文。

#### 使用方式

```bash
# 使用預設報表 (reports/result.json)
node scripts/test-diagnostic-context.js

# 指定報表路徑
node scripts/test-diagnostic-context.js reports/custom-report.json
```

#### 輸出內容

1. **基本資訊** - 報表載入狀態、執行 ID、失敗數量
2. **診斷上下文完整結構** - JSON 格式的完整物件
3. **診斷上下文摘要** - 格式化顯示，包含：
   - 失敗步驟詳情（錯誤分類、信心度、判斷依據）
   - 環境資訊（基礎 URL、備援狀態、認證命名空間）
   - 偵測到的錯誤模式（連續失敗、連鎖失敗等）
   - 診斷提示（快速診斷、可能原因、建議動作）
   - 相關步驟資訊（步驟依賴關係）

#### 範例輸出

```
================================================================================
📊 診斷上下文測試工具
================================================================================

📁 讀取報表: D:\codes\spec_pilot\reports\result.json

✅ 報表載入成功
   執行 ID: run-1234567890
   狀態: partial
   總步驟: 3
   失敗步驟: 2

🔍 建立診斷上下文...

================================================================================
📋 診斷上下文完整結構
================================================================================

{
  "hasFailed": true,
  "failureCount": 2,
  "failedSteps": [
    {
      "stepName": "登入",
      "stepIndex": 0,
      "statusCode": 401,
      "classification": {
        "primaryType": "auth",
        "confidence": 95,
        "indicators": ["HTTP 401", "error: TOKEN_EXPIRED"]
      },
      "errorMessage": "Token 已過期",
      "hasErrorDetails": true,
      "responseTime": 150
    }
  ],
  "environment": {
    "baseUrl": "http://localhost:3000",
    "fallbackUsed": false,
    "authNamespaces": []
  },
  "errorPatterns": [
    {
      "pattern": "consecutive_auth_failures",
      "description": "連續認證失敗",
      "likelihood": "high",
      "affectedSteps": [0, 1]
    }
  ],
  "diagnosticHints": {
    "quickDiagnosis": "2 個步驟失敗，主要是認證問題",
    "likelyCauses": [
      "認證 Token 遺失、無效或已過期",
      "API Key 設定錯誤"
    ],
    "suggestedActions": [
      "更新或重新取得認證 Token",
      "檢查 .env.local 中的 SPEC_PILOT_TOKEN"
    ]
  }
}

================================================================================
📊 診斷上下文摘要（格式化顯示）
================================================================================

【基本資訊】
  是否有失敗: ✅ 是
  失敗數量: 2

【失敗步驟詳情】

  步驟 1: 登入
    索引: 0
    HTTP 狀態碼: 401
    錯誤分類:
      主要類型: auth
      信心度: 95%
      判斷依據: HTTP 401, error: TOKEN_EXPIRED
    錯誤訊息: Token 已過期
    回應時間: 150ms

【環境資訊】
  基礎 URL: http://localhost:3000
  使用備援: 否
  認證命名空間: 無

【偵測到的錯誤模式】

  模式 1:
    類型: consecutive_auth_failures
    描述: 連續認證失敗
    可能性: high
    影響步驟: 0, 1

【診斷提示】

  📊 快速診斷:
     2 個步驟失敗，主要是認證問題

  💡 可能原因:
     1. 認證 Token 遺失、無效或已過期
     2. API Key 設定錯誤

  🔧 建議動作:
     1. 更新或重新取得認證 Token
     2. 檢查 .env.local 中的 SPEC_PILOT_TOKEN

================================================================================
✅ 測試完成！
================================================================================
```

## 📝 注意事項

- 確保已執行 `pnpm install` 安裝所有依賴
- 測試前需要先執行測試流程產生報表檔案
- 腳本使用 ES Module 格式，需要 Node.js 版本支援
