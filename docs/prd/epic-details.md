# Epic Details

### Epic 1：基礎架構與規格解析
目標：建立可運行的 Node.js/TypeScript 專案骨架，完成 OpenAPI 與 Flow YAML 的載入、解析與設定管理。

- Story 1.1 初始化專案骨架與設定管理  
  As a 系統維運者, I want 初始化 TypeScript 專案骨架與環境設定, so that 團隊能在一致結構下開發與執行測試。  
  Acceptance Criteria  
  1: 建立 TypeScript + Node.js 專案結構，含編譯設定、lint 與 npm script（`start`, `start:mcp`, `test`）。  
  2: 提供集中化設定檔或環境變數處理 baseUrl、port、token。  
  3: 引入並配置結構化 Logger（JSON Lines），可輸出檔案與主控台。  
  4: README 說明初始化流程、環境變數與主要 script。

- Story 1.2 實作 OpenAPI 規格載入與驗證  
  As a 開發者, I want 將 JSON/YAML OpenAPI 規格載入並轉為標準 JSON, so that 後續流程可共用一致格式。  
  Acceptance Criteria  
  1: 支援本地檔案 `swagger.json`、`openapi.yaml` 與 AI 傳入的 `specContent`。  
  2: `.json` 以 JSON.parse，`.yaml/.yml` 以 `yaml` 套件解析；錯誤需給出明確訊息。  
  3: 使用 `swagger-parser` 驗證規格完整性，若有錯誤需攔截並回報。  
  4: 解析成功與失敗都需記錄 LOG。

- Story 1.3 實作 Flow YAML 解析與基本驗證  
  As a 測試工程師, I want 解析 `flow.yaml` 並驗證基本欄位, so that 測試腳本可轉為程式可用結構。  
  Acceptance Criteria  
  1: 支援載入本地檔案與 AI 傳入的 `flowContent`。  
  2: 解析後包含步驟名稱、HTTP 方法、路徑、期望驗證設定。  
  3: 缺少必要欄位時丟出明確錯誤並記錄 LOG。  
  4: 解析結果具 TypeScript 型別定義。

- Story 1.4 基礎 CLI 指令與設定覆寫  
  As a DevOps 工程師, I want 透過 CLI 指定規格/流程與環境設定, so that 可在不同環境快速執行測試。  
  Acceptance Criteria  
  1: CLI 支援 `--spec`, `--flow`, `--baseUrl`, `--port`, `--token`。  
  2: CLI 能呼叫 Story 1.2、1.3 的功能並回報結果。  
  3: 預設值來自集中設定，CLI 參數可覆寫。  
  4: CLI 執行紀錄於 LOG，包含解析摘要。

### Epic 2：測試執行引擎與報表
目標：完成 YAML 流程執行、HTTP 呼叫、Schema/自訂驗證、Token 處理與結構化 LOG，並輸出統一 JSON 報表。

- Story 2.1 建立 HTTP 執行器與 Token 注入  
  As a 測試工程師, I want 執行 YAML 步驟定義的 HTTP 呼叫, so that 能模擬 API 使用情境。  
  Acceptance Criteria  
  1: 使用 `axios` 送出 GET/POST/PUT/PATCH/DELETE 請求。  
  2: 自動拼接 baseUrl 與 path，並支援變數替換。  
  3: 支援在流程中儲存與注入 JWT（登入或設定檔來源），於 `Authorization: Bearer <JWT>` header 中使用。  
  4: 提供預設逾時或重試設定，可透過設定檔覆寫。

- Story 2.2 實作回應驗證與自訂規則  
  As a QA, I want 驗證回應的狀態碼、Schema 與自訂條件, so that 測試能準確捕捉異常。  
  Acceptance Criteria  
  1: 驗證 `expect.status`，不符時回報錯誤。  
  2: 若設置 `expect.schema`，使用 `ajv` 對應 OpenAPI `components.schemas` 驗證。  
  3: 支援 `custom.notNull`, `custom.regex`, `custom.contains` 等規則，並提供擴充介面。  
  4: 驗證結果需寫入 LOG，含成功與失敗細節。

- Story 2.3 支援登入步驟與 Token 管理  
  As a 測試工程師, I want 在流程中執行登入並重用 Token, so that 可驗證需身份認證的 API。  
  Acceptance Criteria  
  1: 支援在 YAML 步驟標記登入類型（如 `auth: login`）並指定取得 Token 的欄位路徑。  
  2: 支援在設定或 `flow.yaml` 指定靜態 Token，自動加入 Header。  
  3: Token 儲存需區分不同服務/命名空間，避免互相覆寫。  
  4: Token 缺失或失效時在 LOG 與報表中明示。

- Story 2.4 結構化 LOG 與報表輸出  
  As a 系統維運者, I want 紀錄測試過程並輸出報表, so that 能快速追蹤錯誤來源。  
  Acceptance Criteria  
  1: 每步驟在 LOG 紀錄請求摘要（方法、URL、Header、Body hash）與回應摘要（狀態碼、驗證結果、錯誤）。  
  2: LOG 支援時間戳與檔案輪替或區分，以免單檔過大。  
  3: 產生 `reports/result.json`，格式符合需求文件範例。  
  4: CLI 結束時在主控台輸出報表位置與失敗計數。

- Story 2.5 CLI 端到端測試涵蓋核心流程  
  As a 開發者, I want 自動化驗證 CLI 完整流程, so that 新增功能不會破壞既有行為。  
  Acceptance Criteria  
  1: 建立整合測試，模擬載入規格、解析流程、執行、驗證、輸出報表。  
  2: 測試涵蓋成功與失敗案例，包含錯誤時的 JSON-RPC 格式。  
  3: 測試納入 CI，自動檢查 NFR2 規定時間。  
  4: 測試資料放在 `specs/`、`flows/`、`reports/` 範例目錄。

### Epic 3：MCP 介面與遠端整合
目標：建置 JSON-RPC MCP 服務，支援列出資源、執行流程、查詢報表，並可覆寫環境設定。

- Story 3.1 建立 MCP 伺服器骨架  
  As a AI Agent 整合者, I want 啟動 MCP JSON-RPC 伺服器, so that AI 能透過 STDIN/STDOUT 呼叫測試服務。  
  Acceptance Criteria  
  1: `npm run start:mcp` 可啟動服務。  
  2: 服務遵循 JSON-RPC 2.0，可解析請求與回應。  
  3: 啟動時輸出健康狀態 LOG。  
  4: 異常需被捕捉並安全終止，不致崩潰。

- Story 3.2 實作 `listSpecs` 與 `listFlows`  
  As a AI Agent, I want 查詢可用的規格與流程清單, so that 能快速選擇測試資源。  
  Acceptance Criteria  
  1: `listSpecs` 回傳 `specs/` 目錄下 `.json`/`.yaml` 檔案清單。  
  2: `listFlows` 預設回傳所有 `.yaml`，並支援以參數指定目錄、檔名前綴或完整檔名進行篩選。  
  3: 回應格式為 JSON 陣列，若無符合項目需回傳清楚錯誤訊息。  
  4: 操作過程需記錄在 MCP LOG 中。

- Story 3.3 實作 `runFlow` 支援檔案與即時內容  
  As a AI Agent, I want 遠端觸發測試流程, so that 可以自動驗證 API。  
  Acceptance Criteria  
  1: `runFlow` 支援 `spec` + `flow`（檔案模式）與 `specContent` + `flowContent`（字串模式）。  
  2: 可傳入 `baseUrl`、`port`、`token` 等覆寫設定。  
  3: 執行流程重用 Epic 2 的引擎，回傳執行狀態與報表摘要。  
  4: 錯誤需以 JSON-RPC `error` 格式回傳並記錄 LOG。

- Story 3.4 實作 `getReport` 基本功能  
  As a AI Agent, I want 取得最新測試報表, so that 能快速檢視結果。  
  Acceptance Criteria  
  1: `getReport` 預設回傳最近一次 `runFlow` 產生的 `reports/result.json`。  
  2: 若無任何報表，回傳明確錯誤。  
  3: 提供基本檔案讀取功能。

- Story 3.5 MCP 介面文件與範例  
  As a 使用者, I want 了解 MCP 介面如何呼叫, so that 能整合到自動化流程。  
  Acceptance Criteria  
  1: 文件說明 MCP 啟動方式、支援方法與參數、回應範例。  
  2: 提供 JSON-RPC 範例請求檔或腳本。  
  3: 說明錯誤格式與常見錯誤碼。  
  4: README 更新 MCP 章節。

