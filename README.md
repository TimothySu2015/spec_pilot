# SpecPilot

一套以 Node.js 與 TypeScript 打造的 API 測試與驗證工具，提供 CLI 與 MCP 兩種操作模式，支援 OpenAPI 規格、YAML 測試流程、自訂驗證規則與結構化報表。

## 快速開始
1. 安裝 Node.js 20.11.1 LTS 與 pnpm 9.1，建議透過 `corepack enable` 鎖定版本。
2. 取得程式碼：`git clone <repository-url>`，並切換至 `specpilot/` 目錄。
3. 安裝依賴：在專案根目錄執行 `pnpm install`。
4. 建立環境變數檔：`cp .env.example .env.local`，填寫 `SPEC_PILOT_BASE_URL`、`SPEC_PILOT_PORT`、`SPEC_PILOT_TOKEN` 等欄位（禁止提交到版本控制）。
5. 常用指令：
   - `pnpm run dev`：啟動 CLI 開發模式。
   - `pnpm run start -- --spec specs/openapi.yaml --flow flows/user_crud.yaml --baseUrl http://localhost:3000`
   - `pnpm run start:mcp`：啟動 MCP JSON-RPC 伺服器。
   - `pnpm run lint`、`pnpm run test`：執行程式碼品質檢查與測試。

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
