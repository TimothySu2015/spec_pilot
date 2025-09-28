# MCP 介面文件

## 概述

SpecPilot MCP (Model Context Protocol) 伺服器提供 JSON-RPC 2.0 介面，讓 AI Agent 與自動化系統可以透過結構化協議呼叫 API 測試功能。MCP 伺服器支援四個核心方法，涵蓋規格列表、流程管理、測試執行與報表取得。

## 啟動方式

使用以下指令啟動 MCP 伺服器：

```bash
pnpm run start:mcp
```

伺服器將透過 STDIN/STDOUT 進行 JSON-RPC 2.0 通訊，等待來自客戶端的請求。

## 支援方法

### 1. listSpecs

列出 `specs/` 目錄下可用的 OpenAPI 規格檔案。

#### 參數
無參數

#### 請求範例
```json
{
  "jsonrpc": "2.0",
  "method": "listSpecs",
  "id": "1"
}
```

#### 成功回應範例
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": [
    {
      "name": "openapi.yaml",
      "path": "specs/openapi.yaml",
      "size": 2048,
      "extension": "yaml"
    },
    {
      "name": "user-api.json",
      "path": "specs/user-api.json",
      "size": 1536,
      "extension": "json"
    }
  ]
}
```

#### 錯誤情況
- 目錄不存在或無法讀取時回傳內部錯誤

### 2. listFlows

列出可用的測試流程 YAML 檔案，支援篩選功能。

#### 參數
- `directory` (選用): 指定搜尋目錄，預設為 `flows/`
- `prefix` (選用): 檔名前綴篩選
- `filename` (選用): 完整檔名搜尋

#### 請求範例
```json
{
  "jsonrpc": "2.0",
  "method": "listFlows",
  "params": {
    "directory": "flows/",
    "prefix": "user"
  },
  "id": "2"
}
```

#### 成功回應範例
```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "result": [
    {
      "name": "user_crud.yaml",
      "path": "flows/user_crud.yaml",
      "size": 1024,
      "extension": "yaml"
    },
    {
      "name": "user_auth.yml",
      "path": "flows/user_auth.yml",
      "size": 768,
      "extension": "yml"
    }
  ]
}
```

#### 錯誤情況
- 目錄路徑遍歷攻擊防護
- 目錄不存在或無法讀取時回傳內部錯誤

### 3. runFlow

執行測試流程，支援檔案模式與內容模式。

#### 參數

**檔案模式**:
```typescript
{
  spec: string;        // OpenAPI 規格檔案路徑
  flow: string;        // 測試流程檔案路徑
  baseUrl?: string;    // 覆寫 API 基礎 URL
  port?: number;       // 覆寫 API 埠號
  token?: string;      // 覆寫認證憑證
}
```

**內容模式**:
```typescript
{
  specContent: string;  // OpenAPI 規格內容 (YAML/JSON)
  flowContent: string;  // 測試流程內容 (YAML)
  baseUrl?: string;     // 覆寫 API 基礎 URL
  port?: number;        // 覆寫 API 埠號
  token?: string;       // 覆寫認證憑證
}
```

#### 檔案模式請求範例
```json
{
  "jsonrpc": "2.0",
  "method": "runFlow",
  "params": {
    "spec": "specs/openapi.yaml",
    "flow": "flows/user_crud.yaml",
    "baseUrl": "http://localhost:3000",
    "token": "eyJhbGciOiJIUzI1NiJ9..."
  },
  "id": "3"
}
```

#### 內容模式請求範例
```json
{
  "jsonrpc": "2.0",
  "method": "runFlow",
  "params": {
    "specContent": "openapi: 3.0.0\ninfo:\n  title: Test API\n...",
    "flowContent": "name: 使用者測試流程\nsteps:\n  - name: 建立使用者\n...",
    "baseUrl": "http://localhost:3000"
  },
  "id": "4"
}
```

#### 成功回應範例
```json
{
  "jsonrpc": "2.0",
  "id": "3",
  "result": {
    "executionId": "exec-2025-09-28-123456",
    "status": "success",
    "reportSummary": {
      "totalSteps": 5,
      "passedSteps": 5,
      "failedSteps": 0,
      "executionTime": "2.5s"
    },
    "reportPath": "reports/result.json"
  }
}
```

#### 錯誤情況
- 檔案不存在或無法讀取
- 規格或流程格式錯誤
- 內容大小超過 10MB 限制
- 測試執行失敗

### 4. getReport

取得最新的測試報表。

#### 參數
無參數

#### 請求範例
```json
{
  "jsonrpc": "2.0",
  "method": "getReport",
  "id": "5"
}
```

#### 成功回應範例
```json
{
  "jsonrpc": "2.0",
  "id": "5",
  "result": {
    "reportPath": "reports/result.json",
    "summary": {
      "executionId": "exec-2025-09-28-123456",
      "status": "success",
      "totalSteps": 5,
      "passedSteps": 5,
      "failedSteps": 0,
      "startTime": "2025-09-28T12:34:56.789Z",
      "endTime": "2025-09-28T12:34:59.289Z",
      "executionTime": "2.5s"
    },
    "fullReport": {
      "executionId": "exec-2025-09-28-123456",
      "startTime": "2025-09-28T12:34:56.789Z",
      "endTime": "2025-09-28T12:34:59.289Z",
      "status": "success",
      "steps": [
        {
          "stepNumber": 1,
          "name": "建立使用者",
          "status": "passed",
          "executionTime": "0.5s",
          "request": "***",
          "response": "***",
          "validationResults": []
        }
      ]
    }
  }
}
```

#### 錯誤情況
- 報表檔案不存在
- 報表檔案損壞或格式錯誤
- 檔案讀取權限錯誤

## 錯誤處理

### JSON-RPC 標準錯誤碼

MCP 伺服器使用標準 JSON-RPC 2.0 錯誤碼：

| 錯誤碼 | 名稱 | 說明 | 常見情況 |
|--------|------|------|----------|
| -32700 | Parse error | JSON 解析錯誤 | 請求內容不是有效的 JSON 格式 |
| -32600 | Invalid Request | 無效請求 | 請求格式不符合 JSON-RPC 2.0 規範 |
| -32601 | Method not found | 方法不存在 | 呼叫的方法名稱不存在 |
| -32602 | Invalid params | 無效參數 | 方法參數格式錯誤或遺失必要參數 |
| -32603 | Internal error | 內部錯誤 | 伺服器內部執行錯誤 |

### 錯誤回應格式

```json
{
  "jsonrpc": "2.0",
  "id": "request-id",
  "error": {
    "code": -32603,
    "message": "內部錯誤：無法讀取規格檔案",
    "data": {
      "file": "specs/openapi.yaml",
      "reason": "檔案不存在"
    }
  }
}
```

### 常見錯誤與解決方法

#### 1. 檔案相關錯誤
- **問題**: 規格或流程檔案不存在
- **解決**: 使用 `listSpecs` 或 `listFlows` 確認檔案路徑
- **預防**: 檔案路徑使用相對於專案根目錄的路徑

#### 2. 格式錯誤
- **問題**: YAML/JSON 格式錯誤
- **解決**: 使用 YAML/JSON 驗證工具檢查檔案格式
- **預防**: 使用支援語法檢查的編輯器

#### 3. 網路連線錯誤
- **問題**: 目標 API 伺服器無法連線
- **解決**: 檢查 `baseUrl` 設定與目標伺服器狀態
- **預防**: 執行測試前先確認目標伺服器可用性

#### 4. 認證錯誤
- **問題**: API 認證失敗
- **解決**: 檢查 `token` 參數格式與有效性
- **預防**: 定期更新認證憑證

### 診斷指引

#### 查看結構化日誌
```bash
# 查看最新日誌
tail -f logs/specpilot.log

# 篩選特定執行 ID 的日誌
grep "exec-2025-09-28-123456" logs/specpilot.log
```

#### 日誌事件類型
- `listSpecs_start` / `listSpecs_success` / `listSpecs_error`
- `listFlows_start` / `listFlows_success` / `listFlows_error`
- `runFlow_start` / `runFlow_success` / `runFlow_error`
- `getReport_start` / `getReport_success` / `getReport_error`

#### 錯誤追蹤
每個請求都會產生唯一的 `executionId`，可用於追蹤完整的執行流程與錯誤詳情。日誌中會自動遮罩敏感資料（如 token、password 等欄位）。

## JSON-RPC 2.0 基本格式

### 請求格式
```json
{
  "jsonrpc": "2.0",
  "method": "方法名稱",
  "params": { /* 方法參數 */ },
  "id": "唯一請求識別碼"
}
```

### 成功回應格式
```json
{
  "jsonrpc": "2.0",
  "id": "請求識別碼",
  "result": { /* 回應資料 */ }
}
```

### 錯誤回應格式
```json
{
  "jsonrpc": "2.0",
  "id": "請求識別碼",
  "error": {
    "code": -32603,
    "message": "錯誤訊息",
    "data": { /* 額外錯誤資訊 */ }
  }
}
```

## 安全性考量

1. **路徑遍歷防護**: `listFlows` 方法包含目錄驗證，防止路徑遍歷攻擊
2. **內容大小限制**: `runFlow` 方法的內容模式限制檔案大小為 10MB
3. **敏感資料遮罩**: 日誌系統自動遮罩認證憑證等敏感資訊
4. **輸入驗證**: 所有方法參數都經過格式驗證

## Claude Desktop 整合

### 設定方式

在 Claude Desktop 設定檔中新增 SpecPilot MCP 伺服器：

**設定檔位置**：
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

**設定範例**：
```json
{
  "mcpServers": {
    "specpilot": {
      "command": "pnpm",
      "args": ["run", "start:mcp"],
      "cwd": "/path/to/specpilot",
      "env": {
        "NODE_ENV": "production",
        "SPEC_PILOT_BASE_URL": "https://your-api.example.com",
        "SPEC_PILOT_TOKEN": "your-api-token"
      }
    }
  }
}
```

### 使用範例

設定完成後，您可以在 Claude Desktop 中：

```
你：列出可用的 API 規格檔案
Claude：[執行 listSpecs 方法並顯示結果]

你：執行用戶測試流程並分析結果
Claude：[執行 runFlow 和 getReport，提供測試分析]
```

詳細整合指南請參考：[Claude Desktop 整合指南](claude-desktop-integration.md)

## 與 CLI 介面比較

| 特性 | CLI 介面 | MCP 介面 |
|------|----------|----------|
| 適用場景 | 本地開發、CI/CD | AI Agent 整合、Claude Desktop |
| 參數方式 | 命令列參數 | JSON-RPC 2.0 格式 |
| 輸出方式 | 終端輸出 + 檔案 | 結構化 JSON 回應 |
| 執行模式 | 一次性執行 | 持續運作服務 |
| 啟動指令 | `pnpm run start` | `pnpm run start:mcp` |
| AI 整合 | 不支援 | 完整支援 Claude Desktop |

CLI 介面適合手動操作與腳本自動化，MCP 介面則專為程式化整合與 AI Agent 協作設計。