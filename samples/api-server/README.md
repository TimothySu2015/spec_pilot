# SpecPilot Sample API Server

這是一個完整的 Express API 範例專案,展示診斷友善的錯誤處理與 JWT 認證流程,專門設計用於測試 SpecPilot 的 MCP 功能。

## 📋 專案特色

- ✅ **診斷友善的錯誤處理** - 基於 `docs/guides/api-errors/error-handler-nodejs.md` 的標準實作
- ✅ **JWT 認證流程** - 完整的登入、註冊、Token 刷新機制
- ✅ **環境感知錯誤格式** - 開發環境顯示 Stack Trace,正式環境隱藏敏感資訊
- ✅ **記憶體資料庫** - 使用記憶體模擬資料庫,無需額外設定
- ✅ **完整的測試流程** - 包含 OpenAPI 規格與測試流程 YAML
- ✅ **結構化日誌** - JSON 格式的結構化日誌輸出

## 🏗️ 專案結構

```
api-server/
├── errors/
│   └── DiagnosticError.js          # 自訂錯誤類別
├── utils/
│   ├── error-formatter.js          # 錯誤格式化工具
│   ├── jwt.js                      # JWT 工具函式
│   └── logger.js                   # Logger 工具
├── middleware/
│   ├── error-handler.js            # 全域錯誤處理 Middleware
│   └── auth.js                     # JWT 認證 Middleware
├── routes/
│   ├── auth.js                     # 認證路由 (登入/註冊/刷新)
│   └── users.js                    # 使用者 CRUD 路由
├── models/
│   └── User.js                     # User Model (記憶體資料庫)
├── app.js                          # Express 應用程式
├── server.js                       # 伺服器入口
├── package.json                    # 依賴套件
├── openapi.yaml                    # OpenAPI 規格定義
├── test-flow.yaml                  # SpecPilot 測試流程
├── .env                            # 開發環境變數
└── .env.production                 # 正式環境變數
```

## 🚀 快速開始

### 1. 安裝依賴套件

```bash
cd samples/api-server
npm install
```

### 2. 啟動伺服器

```bash
# 開發模式 (使用 nodemon)
npm run dev

# 正式模式
npm start
```

伺服器將在 `http://localhost:3000` 啟動。

### 3. 測試 API

#### 健康檢查
```bash
curl http://localhost:3000/health
```

#### 使用者登入
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

預設使用者帳號:
- **使用者名稱**: `admin` / **密碼**: `admin123`
- **使用者名稱**: `user1` / **密碼**: `user123`

## 🔧 環境變數

### `.env` (開發環境)

```env
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d

ERROR_INCLUDE_STACK_TRACE=true
ERROR_INCLUDE_SOURCE_CONTEXT=true
ERROR_MAX_STACK_DEPTH=20
```

### `.env.production` (正式環境)

- `ERROR_INCLUDE_STACK_TRACE=false` - 不顯示 Stack Trace
- `ERROR_INCLUDE_SOURCE_CONTEXT=false` - 不顯示原始碼上下文
- `JWT_EXPIRES_IN=15m` - 較短的 Token 有效期

## 📡 API 端點

### 認證相關

| 方法 | 路徑 | 說明 | 需認證 |
|------|------|------|--------|
| POST | `/api/auth/login` | 使用者登入 | ❌ |
| POST | `/api/auth/register` | 使用者註冊 | ❌ |
| POST | `/api/auth/refresh` | 刷新 Token | ❌ |

### 使用者管理

| 方法 | 路徑 | 說明 | 需認證 |
|------|------|------|--------|
| GET | `/api/users` | 取得使用者清單 | ✅ |
| GET | `/api/users/:id` | 取得單一使用者 | ✅ |
| POST | `/api/users` | 建立使用者 | ✅ |
| PUT | `/api/users/:id` | 更新使用者 | ✅ |
| DELETE | `/api/users/:id` | 刪除使用者 | ✅ |

### 其他

| 方法 | 路徑 | 說明 | 需認證 |
|------|------|------|--------|
| GET | `/health` | 健康檢查 | ❌ |
| GET | `/` | API 資訊 | ❌ |

## 🧪 使用 SpecPilot 測試

### 方法 1: 使用 CLI

```bash
# 從專案根目錄執行
pnpm run start -- \
  --spec samples/api-server/openapi.yaml \
  --flow samples/api-server/test-flow.yaml \
  --baseUrl http://localhost:3000
```

### 方法 2: 使用 MCP Server

1. 確保 API Server 正在運行:
```bash
cd samples/api-server
npm run dev
```

2. 在 Claude Desktop 中使用 MCP 工具:

```javascript
// 列出可用的測試流程
mcp__specpilot__listFlows({ directory: "samples/api-server" })

// 執行測試流程
mcp__specpilot__runFlow({
  spec: "samples/api-server/openapi.yaml",
  flow: "samples/api-server/test-flow.yaml",
  baseUrl: "http://localhost:3000"
})

// 取得測試報表
mcp__specpilot__getReport({ format: "summary" })
```

## 📊 測試流程涵蓋範圍

`test-flow.yaml` 包含以下測試案例:

### 認證流程
- ✅ 健康檢查
- ✅ 使用者登入 (成功/失敗)
- ✅ 使用者註冊 (成功/失敗)
- ✅ Token 刷新 (成功/失敗)
- ✅ 未提供 Token 訪問受保護端點

### CRUD 操作
- ✅ 取得使用者清單
- ✅ 取得單一使用者
- ✅ 建立使用者
- ✅ 更新使用者
- ✅ 刪除使用者

### 錯誤處理測試
- ✅ 認證錯誤 (401)
- ✅ 驗證錯誤 (400)
- ✅ 資源不存在 (404)
- ✅ Email 格式錯誤
- ✅ 年齡驗證失敗
- ✅ 使用者名稱重複

## 🔍 錯誤回應範例

### 認證失敗 (401)
```json
{
  "error": "AUTHENTICATION_FAILED",
  "message": "認證 Token 已於 2025-01-15T10:30:00.000Z 過期",
  "hint": "請使用 POST /api/auth/refresh 端點刷新 Token",
  "details": {
    "expired_at": "2025-01-15T10:30:00.000Z",
    "current_time": "2025-01-15T11:00:00.000Z"
  },
  "documentation_url": "https://api.example.com/docs/errors/auth",
  "request_id": "req-1705318800000-abc123",
  "timestamp": "2025-01-15T11:00:00.000Z"
}
```

### 驗證錯誤 (400)
```json
{
  "error": "VALIDATION_ERROR",
  "message": "請求資料驗證失敗",
  "hint": "請檢查並修正以下欄位",
  "details": {
    "fields": [
      {
        "field": "email",
        "error": "email 格式不正確",
        "received": "invalid-email"
      },
      {
        "field": "age",
        "error": "年齡必須大於或等於 18",
        "received": 15
      }
    ]
  },
  "request_id": "req-1705318800000-abc123",
  "timestamp": "2025-01-15T11:00:00.000Z"
}
```

### 資源不存在 (404)
```json
{
  "error": "RESOURCE_NOT_FOUND",
  "message": "找不到 User 資源: 999",
  "hint": "請確認使用者 ID 是否正確,或該使用者是否已被刪除",
  "details": {
    "resourceType": "User",
    "resourceId": "999"
  },
  "request_id": "req-1705318800000-abc123",
  "timestamp": "2025-01-15T11:00:00.000Z"
}
```

## 📝 依賴套件

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

## 🎯 設計目標

此專案旨在:

1. **展示 SpecPilot 診斷能力** - 透過標準化的錯誤格式,讓 AI 能精準診斷問題
2. **測試 MCP 整合** - 作為 SpecPilot MCP Server 的測試目標
3. **提供最佳實踐範例** - 展示 Node.js API 錯誤處理的最佳實踐
4. **簡化測試流程** - 無需資料庫設定,開箱即用

## 📚 相關文件

- [API 錯誤處理指南](../../docs/guides/api-errors/error-handler-nodejs.md)
- [OpenAPI 規格](./openapi.yaml)
- [測試流程定義](./test-flow.yaml)

## 🤝 貢獻

這是 SpecPilot 專案的一部分,如有問題或建議,請參考主專案的貢獻指南。

## 📄 授權

MIT License
