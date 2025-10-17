# SpecPilot MCP Server（官方 SDK 版本）

這是 SpecPilot 的 MCP (Model Context Protocol) Server 實作，使用官方 `@modelcontextprotocol/sdk` 建構。

## 📦 架構說明

### 目前版本
- **使用技術**: 官方 MCP TypeScript SDK
- **主程式**: `src/index.ts`
- **傳輸協議**: Stdio Transport
- **Schema 驗證**: Zod

### 遷移說明
舊版的自訂 JSON-RPC 實作已移至 `src/legacy/` 目錄保存，僅供參考。

## 🛠️ 開發指令

### 編譯與執行
```bash
# 首次使用：安裝依賴（會自動編譯）
pnpm install

# 或手動編譯 MCP Server
pnpm run build

# 開發模式執行
pnpm run dev

# 使用 MCP Inspector 除錯
pnpm run inspector
```

**重要提示**：
- 首次編譯前需確保所有 workspace 依賴已編譯
- 執行 `pnpm install` 會自動觸發 `prepare` 腳本完成編譯
- 編譯產物位於 `dist/index.cjs` (約 658 KB)

### 測試
```bash
# 執行單元測試
pnpm -w run test apps/mcp-server/__tests__/mcp-server-sdk.test.ts --run

# 完整測試（包含 coverage）
pnpm -w run test apps/mcp-server/__tests__/
```

## 📋 可用工具

MCP Server 提供 8 個工具：

1. **listSpecs** - 列出可用的 OpenAPI 規格檔案
2. **listFlows** - 列出可用的測試流程檔案
3. **runFlow** - 執行測試流程並產生報表
4. **getReport** - 取得測試執行報表（含 AI 智能診斷）
5. **generateFlow** - 自動產生測試流程 YAML
6. **validateFlow** - 驗證 Flow 格式與語義
7. **checkFlowQuality** - 檢查 Flow 品質並提供建議
8. **saveFlow** - 儲存 Flow 檔案到 flows 目錄

詳細使用方式請參考根目錄的 `MCP-SETUP.md`。

## 🔧 整合設定

### Claude Desktop 設定

將以下配置加入 Claude Desktop 設定檔：

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
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

**macOS/Linux**: `~/Library/Application Support/Claude/claude_desktop_config.json`
```json
{
  "mcpServers": {
    "specpilot": {
      "command": "node",
      "args": ["/path/to/spec_pilot/apps/mcp-server/dist/index.cjs"],
      "cwd": "/path/to/spec_pilot"
    }
  }
}
```

## ✨ 特色功能

### AI 智能診斷
當測試失敗時，`getReport` 和 `runFlow` 會自動產生診斷上下文：
- 智能錯誤分類（網路、認證、驗證、伺服器等）
- 錯誤模式偵測（連鎖失敗、連續認證失敗等）
- 可能原因與建議動作
- 問題引導式提示

### 靜默日誌系統 + 自動輪轉
為避免干擾 Stdio Transport，所有日誌寫入 `logs/mcp-server.log`。

**✨ 新功能**: 整合 `rotating-file-stream` 實作自動日誌輪轉:
- 📦 每個檔案最大 10MB 或每日輪轉
- 🗜️ 自動壓縮舊日誌 (節省 ~90% 空間)
- 📅 保留最多 7 個舊檔案
- ✅ 完全不影響 MCP Stdio Transport

詳見: [LOG-ROTATION-USAGE.md](./LOG-ROTATION-USAGE.md)

### 雙模式支援
所有需要規格/流程輸入的工具都支援：
- 檔案路徑模式（相對於專案根目錄）
- 內嵌內容模式（直接傳入 YAML/JSON 字串）

## 📁 檔案結構

```
apps/mcp-server/
├── src/
│   ├── index.ts              # 主程式（官方 SDK 版本）
│   └── legacy/               # 舊版實作（保留供參考）
│       ├── bootstrap.ts
│       ├── rpc-handler.ts
│       └── handlers/
├── __tests__/
│   ├── mcp-server-sdk.test.ts    # 新版測試（28 個測試）
│   └── legacy/                    # 舊版測試（保留）
│       ├── mcp-server.test.ts
│       └── handlers/
├── dist/
│   └── index.cjs             # 編譯產物（給 Claude Desktop 使用）
├── package.json
├── tsup.config.ts
└── README.md
```

## 🧪 測試狀態

✅ **28/28 測試通過** (100%)

測試涵蓋範圍：
- MCP Server 結構驗證
- 工具 Schema 定義驗證
- 工具回應格式驗證
- 錯誤處理驗證
- 日誌系統驗證
- 依賴項目驗證
- 特殊功能驗證（診斷上下文、Flow 產生）
- Server 啟動驗證
- 程式碼品質檢查

## 🐛 除錯

### 使用 MCP Inspector
```bash
pnpm run inspect:mcp
```

### 查看日誌
```bash
tail -f logs/mcp-server.log
```

### 常見問題

1. **工具呼叫失敗**
   - 確認 MCP Server 已正確編譯
   - 檢查 `logs/mcp-server.log` 查看詳細錯誤

2. **找不到檔案**
   - 確認 `cwd` 設定指向專案根目錄
   - 檔案路徑應相對於 `cwd`

3. **診斷上下文為空**
   - 診斷上下文僅在測試失敗時產生
   - 確認報表檔案存在於 `reports/result.json`

## 📝 開發指南

### 新增工具

1. 在 `index.ts` 中建立處理函數：
```typescript
async function handleMyTool(params: MyParams): Promise<{ content: Array<{ type: string; text: string }> }> {
  // 實作邏輯
  return {
    content: [{
      type: "text",
      text: "結果"
    }]
  };
}
```

2. 註冊工具：
```typescript
server.registerTool("myTool", {
  title: "工具標題",
  description: "工具描述",
  inputSchema: {
    param1: z.string().describe("參數說明"),
    param2: z.number().optional()
  }
}, async (params) => {
  return handleMyTool(params);
});
```

3. 新增測試：
在 `__tests__/mcp-server-sdk.test.ts` 中新增測試案例。

### 程式碼規範

- ✅ 使用繁體中文撰寫錯誤訊息與日誌
- ✅ 使用 `logger` 而非 `console.log`
- ✅ 所有工具回應格式必須符合 MCP 規範
- ✅ 使用 Zod 定義 Schema
- ✅ 函式命名使用 camelCase
- ✅ 完整的錯誤處理（try-catch）

## 📚 相關文件

- [MCP-SETUP.md](../../MCP-SETUP.md) - Claude Desktop 設定指南
- [CLAUDE.md](../../CLAUDE.md) - 專案開發指導方針
- [官方 MCP SDK 文件](https://github.com/modelcontextprotocol/sdk)
