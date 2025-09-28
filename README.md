# SpecPilot

一套以 Node.js 與 TypeScript 打造的 API 測試與驗證工具，提供 CLI 與 MCP 兩種操作模式，支援 OpenAPI 規格、YAML 測試流程、自訂驗證規則與結構化報表。

## 專案結構

```
specpilot/
├── apps/
│   ├── cli/                    # CLI 介面應用程式
│   └── mcp-server/            # MCP JSON-RPC 伺服器
├── packages/
│   ├── core-flow/             # 流程協調引擎
│   ├── config/                # 組態管理
│   ├── shared/                # 共用工具與類型定義
│   └── testing/               # 測試工具與範例資料
├── specs/                     # OpenAPI 規格檔案
├── flows/                     # YAML 測試流程定義
├── reports/                   # 產生的測試報表
├── logs/                      # 結構化日誌檔案
└── docs/                      # 架構與需求文件
```

## 技術堆疊

- **程式語言**: TypeScript 5.4.5
- **執行環境**: Node.js 20.11.1 LTS
- **套件管理器**: pnpm 9.1
- **開發工具**: tsx 4.7.0、tsup 8.0.1
- **測試框架**: Vitest 1.6.0
- **程式碼品質**: ESLint 8.57.1、Prettier 3.6.2
- **日誌系統**: pino 9.0.0（JSON Lines 格式）
- **設定管理**: zod 3.23、dotenv-flow 3.3.0

## 快速開始

### 一鍵安裝

#### Windows (PowerShell)
```powershell
iwr -useb https://raw.githubusercontent.com/<your-repo>/main/scripts/install.ps1 | iex
```

#### macOS/Linux (Bash)
```bash
curl -fsSL https://raw.githubusercontent.com/<your-repo>/main/scripts/install.sh | bash
```

### 手動安裝

#### 安裝需求
1. 安裝 Node.js 20.11.1 LTS 與 pnpm 9.1，建議透過 `corepack enable` 鎖定版本。
2. 確保系統具備 TypeScript 5.4.5 支援。

#### 初始化流程
1. 取得程式碼：`git clone <repository-url>`，並切換至 `specpilot/` 目錄。
2. 安裝依賴：在專案根目錄執行 `pnpm install`。
3. 建立環境變數檔：`cp .env.example .env.local`，填寫必要欄位（詳見環境變數章節）。
4. 執行初始建置：`pnpm run build`。
5. 執行測試確認環境：`pnpm run test`。

#### 快速測試
```bash
# 測試 MCP 伺服器
echo '{"jsonrpc": "2.0", "method": "listSpecs", "id": "test"}' | pnpm run start:mcp
```

### 主要指令

#### 開發指令
- `pnpm run dev` - 啟動 CLI 開發模式（使用 tsx）
- `pnpm run start` - 執行編譯後的 CLI
- `pnpm run start:mcp` - 啟動 MCP JSON-RPC 伺服器
- `pnpm run build` - 編譯所有套件至 dist/

#### CLI 使用範例
```bash
# 基本測試執行
pnpm run start -- --spec specs/openapi.yaml --flow flows/user_crud.yaml --baseUrl http://localhost:3000

# 指定認證 Token
pnpm run start -- --spec specs/api.yaml --flow flows/auth_test.yaml --baseUrl https://api.example.com --token your-api-token

# 使用自訂埠號
pnpm run start -- --spec specs/local.yaml --flow flows/dev_test.yaml --baseUrl http://localhost --port 8080

# 啟用詳細輸出模式
pnpm run start -- --spec specs/debug.yaml --flow flows/test.yaml --baseUrl http://localhost:3000 --verbose

# 查看版本資訊
pnpm run start -- --version

# 查看幫助資訊
pnpm run start -- --help
```

#### CLI 指令參考

**必要參數**：
- `--spec <path>` - OpenAPI 規格檔案路徑 (支援 .json, .yaml, .yml)
- `--flow <path>` - YAML 測試流程檔案路徑

**選用參數**：
- `--baseUrl <url>` - API 基礎 URL (覆寫環境變數設定)
- `--port <number>` - API 埠號 (覆寫環境變數設定)
- `--token <token>` - API 認證 Token (覆寫環境變數設定)
- `--verbose` - 啟用詳細輸出模式
- `--version` - 顯示版本資訊
- `--help` - 顯示幫助資訊

**Exit Codes**：
- `0` - 測試成功
- `1` - 測試失敗或參數錯誤
- `2` - 系統錯誤

#### 品質控制指令  
- `pnpm run lint` - 執行程式碼檢查
- `pnpm run format` - 檢查程式碼格式
- `pnpm run test` - 執行單元與整合測試（含 coverage）

#### MCP 伺服器操作

MCP (Model Context Protocol) 伺服器提供 JSON-RPC 2.0 介面，讓 AI Agent 與自動化系統可以透過結構化協議呼叫 SpecPilot 功能。

**啟動 MCP 伺服器**：
```bash
# 啟動 MCP 伺服器（透過 STDIN/STDOUT 通訊）
pnpm run start:mcp
```

**支援的 JSON-RPC 方法**：

1. **listSpecs** - 列出可用的 OpenAPI 規格檔案
   ```json
   {"jsonrpc": "2.0", "method": "listSpecs", "id": "1"}
   ```

2. **listFlows** - 列出可用的測試流程檔案（支援篩選）
   ```json
   {"jsonrpc": "2.0", "method": "listFlows", "params": {"directory": "flows/", "prefix": "user"}, "id": "2"}
   ```

3. **runFlow** - 執行測試流程（支援檔案模式與內容模式）
   ```json
   {
     "jsonrpc": "2.0",
     "method": "runFlow",
     "params": {
       "spec": "specs/openapi.yaml",
       "flow": "flows/user_crud.yaml",
       "baseUrl": "http://localhost:3000",
       "token": "your-api-token"
     },
     "id": "3"
   }
   ```

4. **getReport** - 取得最新測試報表
   ```json
   {"jsonrpc": "2.0", "method": "getReport", "id": "4"}
   ```

**MCP 介面特性**：
- 遵循 JSON-RPC 2.0 標準，支援標準錯誤碼（-32700 到 -32603）
- 支援檔案路徑與內容直接傳入兩種模式
- 提供完整的結構化回應與錯誤處理
- 包含安全防護（路徑遍歷防護、內容大小限制）
- 自動遮罩敏感資料於日誌中

**測試與範例**：
```bash
# 使用範例腳本測試 MCP 功能
node docs/examples/mcp-test-script.js

# 查看 JSON-RPC 範例檔案
ls docs/examples/*.json
```

**詳細文件**：完整的 MCP 介面說明請參考 [`docs/mcp-interface.md`](docs/mcp-interface.md)，包含所有方法的詳細參數、回應範例與錯誤處理指引。

## 環境變數與設定

### 必要環境變數
建立 `.env.local` 檔案並設定以下變數：

```bash
# API 基礎 URL（必要）
SPEC_PILOT_BASE_URL=https://api.example.com

# API 埠號（選用，預設值：443 for HTTPS, 80 for HTTP）  
SPEC_PILOT_PORT=3000

# API 認證 Token（選用，用於需要認證的 API）
SPEC_PILOT_TOKEN=your-api-token-here

# 執行環境（選用，預設值：development）
NODE_ENV=development

# 日誌層級（選用，預設值：info）
LOG_LEVEL=debug
```

### 設定覆寫優先順序
1. 環境變數（`.env.local`）
2. CLI 參數（覆寫環境變數）
3. Flow YAML 設定
4. MCP runFlow 參數（最高優先級）

## 日誌與報表

### 日誌輸出
- **檔案位置**: `logs/specpilot.log`（JSON Lines 格式）
- **主控台輸出**: 開發模式下同時輸出至終端
- **日誌欄位**: `timestamp`、`level`、`executionId`、`component`、`message`、`context`
- **敏感資料遮罩**: 自動以 `***` 遮罩 token、password、secret 等欄位

### 測試報表
- **輸出位置**: `reports/result.json`
- **格式**: 結構化 JSON，包含測試步驟、驗證結果、執行時間等資訊
- **錯誤追蹤**: 完整的錯誤堆疊與執行上下文

## 測試

### 測試架構
- **測試框架**: Vitest 1.6.0
- **覆蓋率工具**: @vitest/coverage-v8
- **測試策略**: 60% 單元測試、30% 整合測試、10% 端對端測試

### 測試指令與覆蓋率
```bash
# 執行所有測試（含覆蓋率報告）
pnpm run test

# 執行特定套件測試
pnpm exec vitest packages/config

# 開啟覆蓋率報告（HTML 格式）
open coverage/index.html
```

### 覆蓋率門檻
- **整體專案**: 語句與函式 ≥ 80%、分支 ≥ 75%
- **核心模組** (`packages/config`、`packages/shared`): 所有指標 ≥ 85%
- **測試位置**: 
  - 單元測試: `packages/*/tests/unit/` 或 `packages/*/__tests__/`
  - 整合測試: `tests/integration/`

### Git Hooks
專案使用 husky 與 lint-staged 進行提交前檢查：
- 自動執行 ESLint 修正
- 自動套用 Prettier 格式化
- 只處理異動的檔案以提升效能

## 目標 API Fallback 與模擬操作
當外部 API 無法連線或需要隔離依賴時，遵循以下流程：

1. **啟動 Mock 服務**
   - 執行 `pnpm run mock`（本地）或 `pnpm run mock:ci`（CI）啟動 nock/msw Mock Server。
   - 對應的 handler 與範例資料位於 `packages/testing` 與 `packages/testing/fixtures`。

2. **設定 Flow Fallback**
   - 在 Flow YAML 的步驟中新增 `fallback` 區段，例如：
     ```yaml
     steps:
       - name: Get User
         call: GET /users/1
         fallback:
           handler: mock-get-user
     ```
   - Orchestrator 於 HTTP 重試達上限後會自動切換至 `fallback`。

3. **觀察執行結果**
   - 啟用 fallback 時，報表與 LOG 會標示 `FALLBACK_USED` 事件，協助辨識測試環境是否異常。
   - Run Context 會記錄 `fallback: true`，並可於報表中檢視 Mock 回應。

4. **恢復至正式端點**
   - Mock 結束後，確認目標 API 的健康檢查步驟（如 `healthcheck`）已通過，再執行實際流程，確保修正成果在真實環境下仍可通過。

## 參考文件
- `docs/prd.md`：產品需求文件，詳述功能、非功能需求與 Epic/Story。
- `docs/architecture.md`：系統架構、模組切分、部署與安全策略。
- `docs/SpecPilot-Req.md`：原始需求彙總。

如需進一步協助，請依文件指引或聯絡專案維運人員。
