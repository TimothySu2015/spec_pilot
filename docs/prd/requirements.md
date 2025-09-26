# Requirements

### Functional Requirements
1. FR1：系統必須支援載入 OpenAPI 規格檔，含 JSON (`swagger.json`) 與 YAML (`openapi.yaml`) 兩種格式，並能自動判斷與解析。
2. FR2：系統必須支援由 YAML 格式撰寫的測試流程 (`flow.yaml`)，包含步驟名稱、HTTP 呼叫與驗證設定。
3. FR3：每個測試步驟需依序執行對應的 HTTP 呼叫，並驗證回應的 HTTP 狀態碼。
4. FR4：系統需可根據 OpenAPI `components.schemas` 驗證回應結構是否符合指定 Schema。
5. FR5：系統需支援基本自訂驗證規則（如 `custom.notNull`、`custom.regex`、`custom.contains`），提供必填欄位檢查、字串格式比對與陣列長度等常見驗證功能。
6. FR6：測試結果需輸出統一的 JSON 報表 (`reports/result.json`)，包含每個步驟的狀態、錯誤訊息與時間戳。
7. FR7：系統需提供 MCP JSON-RPC 介面，至少支援 `listSpecs`、`listFlows`、`runFlow`、`getReport` 方法。
8. FR8：`runFlow` 需支援 AI 即時傳入的 `specContent` 與 `flowContent`，無須事先寫入檔案即可執行。
9. FR9：`runFlow` 執行過程中若出現錯誤，系統需回傳符合 JSON-RPC 規範的錯誤物件，避免 MCP 崩潰。
10. FR10：系統需支援登入與 Token 管理，可透過流程中的登入步驟取得 JWT Token，或在專案設定／文件中指定 Token；系統需自動依標準格式（如 `Authorization: Bearer <JWT>`）加入後續請求 Header。
11. FR11：系統需支援設定 API 測試環境的 `baseUrl` 與 `port`，可透過 `flow.yaml`、共用設定檔或 `runFlow` 參數傳入（含 AI 即時傳入模式），執行時自動組合完整請求 URL；未提供埠號時需採用預設值（HTTP: 80、HTTPS: 443）。
12. FR12：系統需在執行每個測試步驟時記錄結構化 LOG（步驟名稱、請求細節、回應摘要、錯誤訊息、執行時間），使用 pino 套件輸出 JSON Lines 格式，強制包含 executionId、component 等識別欄位，並支援輸出至檔案與程式介面查閱。

### Non-Functional Requirements
1. NFR1：系統需在 Node.js 20.11.1 LTS 環境執行，且不得依賴 .NET Runtime。
2. NFR2：單一測試流程 (`flow.yaml`) 的執行時間應在 1 分鐘以內，並以標準開發環境（4 核心 CPU、8 GB RAM、本地或等效 Docker）為測試基準。
3. NFR3：系統需能處理大型 OpenAPI 規格（如 ≥500 endpoints），若因資源限制導致錯誤或效能瓶頸，需顯示明確警示或錯誤訊息，避免靜默失敗。
4. NFR4：支援基本跨步驟變數傳遞功能，確保資料在流程中正確傳遞。
5. NFR5：自訂驗證規則採用內建實作方式，確保驗證功能的穩定性和可靠性。
6. NFR6：所有錯誤情境應被完整記錄在報表與 LOG 中，同時維持 MCP 服務穩定運作。
