# 目標 API Fallback 與模擬策略
- **主要測試環境**：預設連線至 `SPEC_PILOT_BASE_URL` 所指向的測試 API；CI 環境需提供可重複執行的 sandbox 或 staging。
- **模擬服務**：當目標 API 不可達或需隔離外部依賴時，CLI 與 MCP 可切換至 `flows/mock/` 內的流程，使用本地 Mock Server（建議以 `pnpm run mock` 啟動 nock/msw 伺服器）提供預錄回應。
- **Fallback 規則**：Flow 定義可為每個步驟設定 `fallback` 區段，指定替代 URL 或 Mock handler；當 HTTP 連線連續失敗並達到重試上限時，自動轉向 fallback。
- **資料一致性**：Mock 回應需同步更新至 `packages/testing/fixtures`，並在 PR 中註記來源與版本，避免與正式 API schema 偏離。
- **監控與警示**：啟用 fallback 時需於報表與 LOG 標示 `FALLBACK_USED` 事件，提醒維運人員調查實際 API 狀態。
- **恢復流程**：目標 API 恢復可用後，流程會在下一次執行前檢查健康狀態（可選擇 `healthcheck` 步驟）；確認成功即改回正式端點。

- Repository Structure：採 Monorepo 管理 CLI 執行器、MCP 伺服器與測試範例，便於共用型別、設定與腳本。
- Service Architecture：Node.js 單體應用，內部模組化拆分解析、執行、驗證、報表與 MCP 介面；短期不考慮微服務或無伺服器架構。
- Testing Requirements：採 Unit + Integration + End-to-End 策略；使用 Jest/Vitest 類測試框架並於 CI 自動執行。
- Additional Technical Assumptions and Requests：
  - 全面使用 TypeScript，搭配 `pnpm` 或 `npm` 管理依賴與鎖定檔。
  - HTTP 呼叫使用 `axios`，YAML 解析使用 `yaml`，Schema 驗證使用 `ajv`，OpenAPI 驗證使用 `swagger-parser`，CLI 框架使用 `commander`。
  - 透過輕量依賴注入（tsyringe 或等效方案）注入 Config、Logger、HTTP 客戶端，確保 CLI 與 MCP 共享模組。
  - 集中化設定檔或環境變數處理 baseUrl、port、token 等資訊；MCP `runFlow` 與 CLI 參數可覆寫。
  - 日誌採用 pino 套件，輸出 JSON Lines 格式，強制包含 executionId、component、timestamp 等必要欄位。
  - MCP 伺服器提供基本啟動腳本與簡易文件，說明核心 JSON-RPC 方法。
  - 所選套件均為主流且持續維護中，焦點於核心功能實現。
