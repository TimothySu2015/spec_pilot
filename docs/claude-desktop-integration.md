# Claude Desktop 整合指南

## 概述

本指南說明如何將 SpecPilot MCP 伺服器整合到 Claude Desktop 中，讓您可以直接在 Claude 對話中使用 API 測試功能。

## 前置作業

確保已安裝：
1. **Claude Desktop** - 從 [Claude 官網](https://claude.ai/download) 下載
2. **SpecPilot MCP** - 請參考 [安裝指南](installation-guide.md)

## 設定步驟

### 步驟 1：找到設定檔位置

Claude Desktop 設定檔位置：

| 作業系統 | 路徑 |
|----------|------|
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` |

### 步驟 2：建立或編輯設定檔

#### 方法 1：開發環境設定（從原始碼執行）

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
        "SPEC_PILOT_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

**Windows 路徑範例**：
```json
{
  "mcpServers": {
    "specpilot": {
      "command": "pnpm",
      "args": ["run", "start:mcp"],
      "cwd": "C:\\Users\\YourName\\specpilot",
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

#### 方法 2：已安裝版本設定（使用安裝腳本後）

```json
{
  "mcpServers": {
    "specpilot": {
      "command": "specpilot-mcp",
      "args": [],
      "env": {
        "NODE_ENV": "production",
        "SPEC_PILOT_BASE_URL": "https://your-api.example.com",
        "SPEC_PILOT_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

#### 方法 3：使用 Node.js 直接執行

```json
{
  "mcpServers": {
    "specpilot": {
      "command": "node",
      "args": ["apps/mcp-server/dist/index.js"],
      "cwd": "/path/to/specpilot",
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 步驟 3：設定環境變數

在設定檔的 `env` 區段中設定必要的環境變數：

```json
{
  "env": {
    "NODE_ENV": "production",
    "SPEC_PILOT_BASE_URL": "https://your-api.example.com",
    "SPEC_PILOT_PORT": "443",
    "SPEC_PILOT_TOKEN": "your-api-token-here",
    "LOG_LEVEL": "info"
  }
}
```

### 步驟 4：重啟 Claude Desktop

儲存設定檔後，完全關閉並重新啟動 Claude Desktop。

### 步驟 5：驗證連接

在 Claude Desktop 中測試連接：

1. 開啟新的對話
2. 詢問 Claude：「你可以使用哪些工具？」
3. 應該會看到 SpecPilot 相關的工具

## 使用範例

### 基本使用

```
你：列出可用的 API 規格檔案

Claude 會執行：listSpecs 方法
```

```
你：列出所有測試流程

Claude 會執行：listFlows 方法
```

```
你：執行用戶 CRUD 測試流程

Claude 會執行：runFlow 方法
```

```
你：取得最新的測試報表

Claude 會執行：getReport 方法
```

### 進階使用

```
你：請使用 specs/petstore.json 規格和 flows/user_crud.yaml 流程，
    對 https://api.example.com 執行測試，使用我的 API token: abc123

Claude 會：
1. 使用 runFlow 方法執行測試
2. 等待測試完成
3. 使用 getReport 方法取得結果
4. 分析測試結果並提供摘要
```

## 故障排除

### 問題 1：Claude Desktop 找不到 SpecPilot

**症狀**：Claude 無法使用 SpecPilot 工具

**解決方法**：
1. 檢查設定檔路徑是否正確
2. 檢查 JSON 格式是否有效
3. 確認 `cwd` 路徑正確
4. 重啟 Claude Desktop

**驗證指令**：
```bash
# 測試 MCP 伺服器是否可執行
cd /path/to/specpilot
pnpm run start:mcp
```

### 問題 2：權限錯誤

**症狀**：Claude 顯示權限錯誤

**解決方法**：
1. 確保 Claude Desktop 有執行 pnpm 的權限
2. 檢查 SpecPilot 目錄的讀取權限
3. 在 Windows 上可能需要以管理員身分執行

### 問題 3：環境變數未生效

**症狀**：API 呼叫失敗或設定未載入

**解決方法**：
1. 檢查 `.env.local` 檔案是否存在
2. 確認環境變數名稱正確
3. 檢查設定檔中的 `env` 區段

### 問題 4：路徑問題 (Windows)

**症狀**：找不到檔案或目錄

**解決方法**：
```json
{
  "cwd": "C:\\Users\\YourName\\specpilot"
}
```

使用雙反斜線或正斜線：
```json
{
  "cwd": "C:/Users/YourName/specpilot"
}
```

## 進階設定

### 多環境設定

```json
{
  "mcpServers": {
    "specpilot-dev": {
      "command": "pnpm",
      "args": ["run", "start:mcp"],
      "cwd": "/path/to/specpilot",
      "env": {
        "NODE_ENV": "development",
        "SPEC_PILOT_BASE_URL": "http://localhost:3000"
      }
    },
    "specpilot-prod": {
      "command": "pnpm",
      "args": ["run", "start:mcp"],
      "cwd": "/path/to/specpilot",
      "env": {
        "NODE_ENV": "production",
        "SPEC_PILOT_BASE_URL": "https://api.example.com",
        "SPEC_PILOT_TOKEN": "prod-token"
      }
    }
  }
}
```

### 日誌與除錯

啟用詳細日誌：
```json
{
  "env": {
    "LOG_LEVEL": "debug"
  }
}
```

查看日誌：
```bash
tail -f /path/to/specpilot/logs/specpilot.log
```

## 安全性考量

1. **API Token 保護**：
   - 不要在設定檔中硬編碼敏感的 API token
   - 使用環境變數或外部設定檔
   - 定期輪換 API token

2. **檔案權限**：
   - 確保設定檔只有適當的使用者可讀取
   - 限制 SpecPilot 目錄的存取權限

3. **網路安全**：
   - 使用 HTTPS 進行 API 呼叫
   - 驗證 SSL 憑證
   - 考慮使用 VPN 或防火牆限制存取

## 參考資源

- [MCP 介面文件](mcp-interface.md)
- [安裝指南](installation-guide.md)
- [JSON-RPC 範例](examples/)
- [Claude Desktop 官方文件](https://docs.anthropic.com/claude/desktop)

## 常見工作流程

### 1. API 開發測試流程

```
你：我需要測試新開發的用戶註冊 API

Claude：
1. 先列出可用的規格檔案
2. 選擇相關的測試流程
3. 執行測試並分析結果
4. 提供改善建議
```

### 2. CI/CD 整合驗證

```
你：驗證部署到 staging 環境的 API 是否正常

Claude：
1. 執行完整的回歸測試套件
2. 檢查所有關鍵端點
3. 驗證資料格式與錯誤處理
4. 生成測試報表
```

### 3. API 文件驗證

```
你：檢查 OpenAPI 規格是否與實際 API 行為一致

Claude：
1. 載入最新的 OpenAPI 規格
2. 執行對應的測試流程
3. 比較預期與實際回應
4. 標記不一致的地方
```