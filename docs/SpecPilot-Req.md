# 📑 PRD – Node.js 版 AI 驅動 API 測試與驗證系統  
(支援 OpenAPI JSON / YAML)

## 1. 專案目標
開發一個 **Node.js (TypeScript/JavaScript)** 的 **API 測試系統**，能透過 **MCP (Model Context Protocol)** 與 AI Agent 整合。  

系統需具備以下能力：  
1. 載入 API 規格 (`swagger.json` 或 `openapi.yaml`)。  
2. 載入測試流程 (`flow.yaml`) 並執行 API 測試。  
3. 驗證回應是否符合 **HTTP 狀態碼**、**OpenAPI schema**、**自訂驗證規則**。  
4. 輸出統一 JSON 報表 (`reports/result.json`)。  
5. 提供 **MCP JSON-RPC 介面** (`listSpecs`, `listFlows`, `runFlow`, `getReport`)。  
6. 支援 **AI 即時傳入 specContent/flowContent** (不用存檔)。  

---

## 2. 功能需求 (Functional Requirements)

### 2.1 API 規格管理
- **輸入格式**：  
  - `swagger.json` (OpenAPI JSON)  
  - `openapi.yaml` (OpenAPI YAML)  
- **處理方式**：  
  - 自動判斷副檔名：`.json` → JSON.parse()；`.yaml` / `.yml` → YAML.parse()  
  - 內部統一轉成 **JSON 結構**  
- **AI 傳入模式**：  
  - `specContent` (string, JSON 或 YAML) → 轉換成 JSON 使用  

---

### 2.2 測試流程 (flow.yaml)
- **格式 (YAML)**：
```yaml
steps:
  - name: Create User
    call: POST /users
    body: { name: "Alice", email: "a@example.com" }
    expect:
      status: 201
      schema: User

  - name: Get User
    call: GET /users/1
    expect:
      status: 200
      schema: User
```

- **支援驗證項目**：  
  - `status` → 驗證 HTTP 狀態碼  
  - `schema` → 驗證 response schema (對應 OpenAPI `components.schemas`)  
  - `custom.notNull` → 驗證欄位必須存在  
  - `custom.regex` → 驗證欄位符合正則  

---

### 2.3 測試執行流程
1. 讀取 API 規格 (JSON/YAML)  
2. 讀取測試流程 (flow.yaml)  
3. 依序執行每個 step：  
   - 解析 `call` (HTTP 方法 + 路徑)  
   - 使用 `axios` 發送請求  
   - 驗證 `status`、`schema`、`custom`  
   - 錯誤時記錄 `ErrorMessage`  
4. 所有結果收集後 → 輸出 `reports/result.json`  

---

### 2.4 測試報表
- **格式** (JSON 陣列)：  
```json
[
  {
    "Step": "Create User",
    "StatusCode": 201,
    "Success": true,
    "ErrorMessage": null,
    "Timestamp": "2025-09-26T12:00:00.000Z"
  },
  {
    "Step": "Get User",
    "StatusCode": 404,
    "Success": false,
    "ErrorMessage": "Expected 200, got 404",
    "Timestamp": "2025-09-26T12:00:01.000Z"
  }
]
```

---

### 2.5 MCP Server 介面
系統需實作 JSON-RPC 2.0 (stdin/stdout)，支援以下方法：  

- `listSpecs` → 回傳 `specs/` 下所有 `.json`/`.yaml`  
```json
{"jsonrpc":"2.0","id":1,"result":["swagger.json","openapi.yaml"]}
```

- `listFlows` → 回傳 `specs/flows/` 下所有 `.yaml`  
```json
{"jsonrpc":"2.0","id":2,"result":["user_crud.yaml"]}
```

- `runFlow` → 執行測試流程  
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "runFlow",
  "params": {
    "spec": "swagger.json",
    "flow": "user_crud.yaml"
  }
}
```

- `runFlow (AI 傳入)` → 支援 `specContent` + `flowContent`  
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "runFlow",
  "params": {
    "specContent": "{...swagger json...}",
    "flowContent": "steps:\n - name: Create User..."
  }
}
```

- `getReport` → 回傳最新報表 JSON  
```json
{"jsonrpc":"2.0","id":5,"result":[{...}]}
```

---

## 3. 非功能需求 (Non-Functional Requirements)

1. **環境要求**  
   - Node.js 18+  
   - 不依賴 .NET Runtime  

2. **效能**  
   - 單一 flow.yaml ≤ 1 分鐘  
   - 支援大型 `openapi.yaml` (≥ 500 endpoints)  

3. **擴展性**  
   - 測試流程可跨步驟傳遞變數 (例：`{{ Create User.id }}`)  
   - 驗證規則可擴充  

4. **穩定性**  
   - 測試失敗時需完整輸出錯誤，不可讓 MCP Server 崩潰  
   - 所有錯誤回應需符合 JSON-RPC `error` 格式  

---

## 4. 技術選型

- **語言**：Node.js (TypeScript)  
- **主要套件**：  
  - `axios` → HTTP 請求  
  - `yaml` → Flow / OpenAPI YAML 解析  
  - `ajv` → JSON Schema 驗證  
  - `swagger-parser` → OpenAPI 規範驗證  
  - `commander` → CLI 工具  

---

## 5. Roadmap

### Sprint 1 (MVP)
- [ ] FlowExecutor：讀取 swagger.json / openapi.yaml + flow.yaml，執行測試  
- [ ] Reporter：輸出 reports/result.json  

### Sprint 2
- [ ] MCP Server：支援 `listSpecs`, `listFlows`, `runFlow`, `getReport`  

### Sprint 3
- [ ] 支援 `specContent` / `flowContent` (AI 即時傳入)  
- [ ] 支援跨步驟變數引用  

### Sprint 4
- [ ] 支援 `custom` 驗證規則 (regex, notNull, contains)  
- [ ] Docker 化，提供 `docker run` 一鍵啟動  
- [ ] HTML 報表輸出  

---

## 6. 成功衡量標準
- Claude/AI 能成功呼叫 `runFlow`，完成 CRUD 測試。  
- 報表 JSON 能正確被 AI 解析並用於程式修正。  
- 測試流程能同時支援 **swagger.json** 與 **openapi.yaml**。  
- 系統在 CI/CD pipeline 中可自動化執行並產生測試報表。  
