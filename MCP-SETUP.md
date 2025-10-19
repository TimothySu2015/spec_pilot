# SpecPilot MCP Server 設定指南

## 🚀 快速設定

### 1. 確保 MCP Server 已編譯

```bash
cd apps/mcp-server
pnpm run build
```

這會在 `apps/mcp-server/dist/index.cjs` 產生完整打包的 MCP Server（包含所有內部依賴）。

### 2. 設定 Claude Desktop

將以下配置加入您的 Claude Desktop 設定檔：

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "specpilot": {
      "command": "node",
      "args": ["D:\\codes\\spec_pilot\\apps\\mcp-server\\dist\\index.cjs"],
      "cwd": "D:\\codes\\spec_pilot"
    }
  }
}
```

**重要**：
- 請將路徑 `D:\\codes\\spec_pilot` 替換為您的實際專案路徑
- Windows 路徑需使用雙反斜線 `\\`
- macOS/Linux 範例：`"/Users/username/spec_pilot/apps/mcp-server/dist/index.cjs"`

### 3. 重新啟動 Claude Desktop

設定完成後，請重新啟動 Claude Desktop 以載入 MCP Server。

## 🔧 可用工具

SpecPilot MCP Server 提供以下工具：

### 📋 listSpecs
列出可用的 OpenAPI 規格檔案
```
參數：
- directory (選填): 規格檔案目錄，預設為 'specs'
```

### 📋 listFlows
列出可用的測試流程檔案
```
參數：
- directory (選填): 流程檔案目錄，預設為 'flows'
```

### ▶️ runFlow
執行測試流程並產生報表
```
參數：
- spec (必填): OpenAPI 規格檔案路徑或內容
- flow (必填): 測試流程檔案路徑或 YAML 內容
- baseUrl (選填): API 基礎 URL
- port (選填): API 埠號
- token (選填): API 認證 Token
- options (選填):
  - failFast (boolean): 遇到錯誤時立即停止（預設：false）✅ 已實作
  - retryCount (number): 重試次數（預設：3）✅ 已實作
  - timeout (number): 請求逾時時間，毫秒（預設：30000）✅ 已實作

使用範例：
  {
    "spec": "specs/petstore.yaml",
    "flow": "flows/user-test.yaml",
    "options": {
      "failFast": true,      // 第一個步驟失敗後立即停止
      "retryCount": 5,       // 設定重試次數為 5 次
      "timeout": 10000       // 設定請求逾時為 10 秒
    }
  }
```

### 📊 getReport
取得測試執行報表（含 AI 智能診斷）
```
參數：
- executionId (選填): 特定執行 ID，若未指定則取得最新報表
- format (選填): 報表格式 ('json' 或 'summary')

回應結構：
- reportPath: 報表檔案路徑
- executionId: 執行 ID
- status: 執行狀態 ('success' | 'partial' | 'failure')
- reportSummary: 測試摘要統計
- report: 完整測試報表
- diagnosticContext (失敗時): AI 診斷上下文
```

**✨ AI 智能診斷功能**：
當測試失敗時，`getReport` 會自動包含 `diagnosticContext` 欄位，提供：
- 智能錯誤分類（網路、認證、驗證、伺服器、未知）與信心度評分
- 錯誤模式偵測（連鎖失敗、連續認證失敗、全網路錯誤等）
- 診斷提示（快速診斷、可能原因、建議動作、問題引導）
- 環境資訊（baseUrl、認證命名空間、是否使用備援）

診斷上下文幫助 Claude 快速理解問題並提供精準的修復建議。

### 🔍 checkOperationIds
檢查 OpenAPI 規格中缺少 operationId 的端點 ✨ NEW (Phase 9.4)
```
參數：
- specPath (必填): OpenAPI 規格檔案路徑（相對於專案根目錄）

使用範例：
  {
    "specPath": "specs/user-management-api.yaml"
  }

回應內容：
- 檢測結果統計（總端點數、缺少 operationId 的端點數）
- 缺少 operationId 的端點清單與建議名稱
- 檔案可修改性檢查結果
- 根據檔案權限提供不同的解決方案建議：
  - 方案 1：自動修改規格檔案（檔案可寫入時）
  - 方案 2：使用 "METHOD /path" 格式過濾端點（檔案唯讀時）
  - 方案 3：產生所有端點（快速測試）
```

**使用時機**：
- 當使用 `generateFlow` 指定 `endpoints` 參數失敗時
- 當不確定 OpenAPI 規格是否定義 operationId
- 當需要了解自動產生的 operationId 名稱規則

**特色功能**：
- 智慧產生符合慣例的 operationId 建議（例如：POST /users → createUsers）
- 自動檢測檔案寫入權限，提供對應解決方案
- 提供三種不同場景的解決建議（可修改規格、不可修改規格、快速測試）
- Emoji 輔助的清晰輸出格式

## 🛠️ 除錯

### MCP Inspector
```bash
pnpm run inspect:mcp
```

### 手動測試
```bash
# 測試 MCP Server 啟動
node apps/mcp-server/dist/index.js

# 或使用開發模式
pnpm run start:mcp
```

### 常見問題

1. **找不到 tsx**：
   ```bash
   npm install -g tsx
   ```

2. **權限問題**：確保 `dist/index.js` 有執行權限

3. **路徑問題**：確保配置中的路徑是絕對路徑

## 📝 範例使用

在 Claude Desktop 中，您可以：

1. **列出規格檔案**：
   "請使用 listSpecs 工具查看可用的 API 規格"

2. **執行測試**：
   "請使用 runFlow 工具執行 specs/petstore.yaml 規格和 flows/crud_test.yaml 流程"

3. **使用 Fail-Fast 模式執行測試**：
   "請使用 runFlow 工具執行測試，並啟用 failFast 選項，這樣第一個步驟失敗就會立即停止"

4. **查看報表**：
   "請使用 getReport 工具以摘要格式顯示最新的測試結果"

5. **檢查規格的 operationId**：
   "請使用 checkOperationIds 工具檢查 specs/user-management-api.yaml 是否缺少 operationId"

6. **解決 operationId 問題後產生測試**：
   "根據 checkOperationIds 的建議，使用 'POST /auth/login' 格式重新執行 generateFlow"