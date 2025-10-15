# MCP Server 增強功能

## 版本資訊
- **版本**: v0.2.0
- **更新日期**: 2025-01-16
- **MCP SDK 版本**: 1.18.2

---

## 概述

SpecPilot MCP Server 在 v0.2.0 版本中新增了 6 個強大的工具方法,完整支援測試 Flow 的自動產生、驗證、品質檢查與儲存。這些工具專為 AI Agent（如 Claude）設計,透過 Model Context Protocol (MCP) 提供標準化的介面。

---

## 新增工具列表

| 工具名稱 | 功能描述 | 輸入 | 輸出 | 狀態 |
|---------|---------|-----|-----|------|
| `generateFlow` | 根據 OpenAPI 規格自動產生測試流程 | specPath, options | Flow YAML, 統計資訊 | ✅ |
| `validateFlow` | 驗證 Flow 定義的格式與語意 | flowContent, specPath | 驗證結果, 錯誤清單 | ✅ |
| `checkFlowQuality` | 檢查 Flow 品質並提供改進建議 | flowContent, specPath | 品質報告, 修正建議 | ✅ |
| `saveFlow` | 儲存 Flow YAML 至專案目錄 | flowContent, fileName | 儲存路徑 | ✅ |

---

## 1. generateFlow

### 功能描述
根據 OpenAPI 規格自動產生完整的測試流程 YAML,支援自訂產生選項。

### 輸入參數

```typescript
interface GenerateFlowParams {
  specPath: string;                     // OpenAPI 規格檔案路徑（相對於專案根目錄）
  options?: {
    endpoints?: string[];               // 要產生測試的端點 operationId 列表
    includeSuccessCases?: boolean;      // 包含成功案例（預設：true）
    includeErrorCases?: boolean;        // 包含錯誤案例（預設：false）
    includeEdgeCases?: boolean;         // 包含邊界測試（預設：false）
    generateFlows?: boolean;            // 產生流程串接測試（預設：false）
  };
}
```

### 輸出結果

```typescript
interface GenerateFlowResult {
  flowYaml: string;        // 產生的 Flow YAML 內容
  summary: {
    totalTests: number;    // 總測試數
    successTests: number;  // 成功案例數
    errorTests: number;    // 錯誤案例數
    edgeTests: number;     // 邊界測試數
    endpoints: string[];   // 涵蓋的端點列表
  };
}
```

### 使用範例

**基本使用**:
```json
{
  "specPath": "specs/user-api.yaml"
}
```

**進階使用**:
```json
{
  "specPath": "specs/user-api.yaml",
  "options": {
    "endpoints": ["createUser", "getUser", "updateUser"],
    "includeSuccessCases": true,
    "includeErrorCases": true,
    "includeEdgeCases": false,
    "generateFlows": true
  }
}
```

### 輸出範例

```
✅ 成功產生測試 Flow

📊 統計資訊：
- 總步驟數：15
- 端點數：3
- 成功案例：3
- 錯誤案例：12

📝 生成的 Flow YAML：
```yaml
name: 自動產生的測試套件
description: 包含 3 個端點的測試案例
version: 1.0.0
baseUrl: http://localhost:3000
steps:
  - name: 建立新使用者 - 成功案例
    request:
      method: POST
      path: /api/users
      body:
        name: 測試使用者
        email: test@example.com
    expect:
      statusCode: 201
  ...
```
```

---

## 2. validateFlow

### 功能描述
驗證 Flow YAML 的格式與語意正確性,確保 Flow 可以正確執行。

### 輸入參數

```typescript
interface ValidateFlowParams {
  flowContent: string;     // Flow YAML 內容
  specPath: string;        // OpenAPI 規格檔案路徑（用於語義驗證）
}
```

### 輸出結果

**驗證通過**:
```
✅ Flow 驗證通過！

📊 驗證結果：
- 總錯誤數：0
- 警告數：2

⚠️ 警告：
1. step[2]: 建議新增變數提取以便後續步驟使用
2. step[5]: 此端點需要認證,建議在 globals 中設定 token
```

**驗證失敗**:
```
❌ Flow 驗證失敗

📊 驗證結果：
- 總錯誤數：3
- 警告數：1

🔴 錯誤清單：
1. [steps[0].request.method] 必須是 GET, POST, PUT, PATCH, DELETE 之一
2. [steps[1].request.path] 引用了未定義的變數 'userId'
3. [steps[2].expect.statusCode] 必須在 100-599 之間

⚠️ 警告清單：
1. step[3]: 建議使用更具體的驗證規則
```

### 使用範例

```json
{
  "flowContent": "name: Test Flow\nsteps:\n  - name: Create User\n    request:\n      method: POST\n      path: /api/users\n      body: {...}\n    expect:\n      statusCode: 201",
  "specPath": "specs/user-api.yaml"
}
```

---

## 3. checkFlowQuality

### 功能描述
檢查 Flow 的品質,分析潛在問題並提供改進建議。

### 輸入參數

```typescript
interface CheckFlowQualityParams {
  flowContent: string;     // Flow YAML 內容
  specPath: string;        // OpenAPI 規格檔案路徑
}
```

### 輸出結果

```
📊 Flow 品質檢查報告

總評分：75/100
總問題數：8
  - 錯誤：2
  - 警告：4
  - 資訊：2

🔍 主要問題（顯示前 10 個）：

1. 🔴 [missing_test_data]
   位置：step 1: createUser
   問題：請求 Body 缺少必要欄位 'email'
   建議：根據 OpenAPI Schema 補充必要欄位

2. ⚠️ [missing_validation]
   位置：step 2: getUser
   問題：缺少回應驗證規則
   建議：新增 validation 欄位驗證關鍵欄位（如 id, name）

3. ⚠️ [missing_variable_extraction]
   位置：step 1: createUser
   問題：建議提取回應中的 'id' 欄位供後續步驟使用
   建議：新增 capture: [{ variableName: 'userId', path: 'id' }]

4. ℹ️ [status_code_suggestion]
   位置：step 1: createUser
   問題：POST 請求建議使用 201 Created 而非 200 OK
   建議：將 expect.statusCode 改為 201

💡 自動修正建議（顯示前 5 個）：

1. 步驟 0：request.body
   當前值：{"name":"test"}
   建議值：{"name":"test","email":"test@example.com"}
   原因：根據 OpenAPI Schema 補充必要欄位 'email'

2. 步驟 0：capture
   當前值：undefined
   建議值：[{"variableName":"userId","path":"id"}]
   原因：建議提取回應中的 'id' 欄位供後續步驟使用

3. 步驟 0：expect.statusCode
   當前值：200
   建議值：201
   原因：POST 請求建議使用 201 Created
```

### 品質評分標準

- **90-100 分**: 優秀 - 遵循最佳實踐,無重大問題
- **70-89 分**: 良好 - 基本正確,有改進空間
- **50-69 分**: 可接受 - 存在一些問題,需要改進
- **< 50 分**: 不佳 - 存在多個嚴重問題

---

## 4. saveFlow

### 功能描述
將 Flow YAML 內容儲存至專案的 `flows/` 目錄。

### 輸入參數

```typescript
interface SaveFlowParams {
  flowContent: string;     // Flow YAML 內容
  fileName: string;        // 檔案名稱（自動加上 .yaml 副檔名）
}
```

### 輸出結果

```
✅ Flow 已成功儲存

📁 儲存路徑：flows/user-crud-tests.yaml
📝 檔案大小：2048 bytes
```

### 使用範例

```json
{
  "flowContent": "name: User CRUD Tests\nsteps: [...]",
  "fileName": "user-crud-tests"
}
```

**注意事項**:
- 如果檔案名稱未包含 `.yaml` 或 `.yml` 副檔名,會自動加上 `.yaml`
- 如果 `flows/` 目錄不存在,會自動建立
- 如果檔案已存在,會直接覆寫

---

## 完整工作流程範例

### 場景：AI Agent 協助產生並驗證測試 Flow

```
User: 請幫我為使用者管理 API 產生測試 Flow

AI Agent:
  Step 1: 列出規格檔案
  → 呼叫 listSpecs()

  Step 2: 產生測試 Flow
  → 呼叫 generateFlow({
      specPath: "specs/user-management-api.yaml",
      options: {
        includeSuccessCases: true,
        includeErrorCases: true,
        generateFlows: true
      }
    })

  Step 3: 驗證產生的 Flow
  → 呼叫 validateFlow({
      flowContent: "<generated YAML>",
      specPath: "specs/user-management-api.yaml"
    })

  Step 4: 檢查品質
  → 呼叫 checkFlowQuality({
      flowContent: "<generated YAML>",
      specPath: "specs/user-management-api.yaml"
    })

  Step 5: 儲存 Flow
  → 呼叫 saveFlow({
      flowContent: "<generated YAML>",
      fileName: "user-management-tests"
    })

  Step 6: 執行測試
  → 呼叫 runFlow({
      spec: "specs/user-management-api.yaml",
      flow: "flows/user-management-tests.yaml",
      baseUrl: "http://localhost:3000"
    })

AI Response:
✅ 已成功為使用者管理 API 產生並驗證測試 Flow

產生的測試套件:
- 總步驟數: 41
- 成功案例: 8
- 錯誤案例: 28
- 流程串接: 5

品質檢查:
- 評分: 85/100
- 發現 3 個警告（已自動修正）

測試已儲存至: flows/user-management-tests.yaml

執行結果:
- 總步驟數: 41
- 成功: 38
- 失敗: 3
```

---

## 實作細節

### 技術架構

```
┌─────────────────────────────────────────┐
│  Claude Desktop / AI Agent              │
└──────────────────┬──────────────────────┘
                   │ MCP Protocol (stdio)
                   ↓
┌─────────────────────────────────────────┐
│  SpecPilot MCP Server                   │
│  (@modelcontextprotocol/sdk)            │
│  ┌───────────────────────────────────┐  │
│  │  Tool Handlers                    │  │
│  │  • handleGenerateFlow             │  │
│  │  • handleValidateFlow             │  │
│  │  • handleCheckFlowQuality         │  │
│  │  • handleSaveFlow                 │  │
│  └───────────────────────────────────┘  │
└──────────────────┬──────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    ↓              ↓              ↓
┌─────────┐  ┌──────────┐  ┌─────────────┐
│ Flow    │  │ Test     │  │ Flow        │
│ Generator│  │ Suite    │  │ Validator   │
│         │  │ Generator│  │             │
└─────────┘  └──────────┘  └─────────────┘
```

### 核心實作

```typescript
// apps/mcp-server/src/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "specpilot-server",
  version: "0.1.0"
});

// 註冊工具
server.registerTool("generateFlow", {
  title: "產生測試 Flow",
  description: "根據 OpenAPI 規格自動產生測試流程 YAML",
  inputSchema: {
    specPath: z.string(),
    options: z.object({
      endpoints: z.array(z.string()).optional(),
      includeSuccessCases: z.boolean().optional(),
      includeErrorCases: z.boolean().optional(),
      includeEdgeCases: z.boolean().optional(),
      generateFlows: z.boolean().optional()
    }).optional()
  }
}, handleGenerateFlow);

server.registerTool("validateFlow", {
  title: "驗證 Flow 格式",
  description: "驗證測試 Flow 的格式與語義是否正確",
  inputSchema: {
    flowContent: z.string(),
    specPath: z.string()
  }
}, handleValidateFlow);

server.registerTool("checkFlowQuality", {
  title: "檢查 Flow 品質",
  description: "檢查測試 Flow 的合理性並提供改進建議",
  inputSchema: {
    flowContent: z.string(),
    specPath: z.string()
  }
}, handleCheckFlowQuality);

server.registerTool("saveFlow", {
  title: "儲存 Flow 檔案",
  description: "將測試 Flow YAML 儲存到 flows 目錄",
  inputSchema: {
    flowContent: z.string(),
    fileName: z.string()
  }
}, handleSaveFlow);

// 啟動伺服器
async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

startServer();
```

---

## 錯誤處理

### 錯誤類型

| 錯誤碼 | 錯誤類型 | 描述 | 範例 |
|-------|---------|------|------|
| 1501 | Config Error | 配置檔案錯誤 | 找不到規格檔案 |
| 1502 | Spec Error | OpenAPI 規格錯誤 | 無效的 OpenAPI 格式 |
| 1503 | Flow Error | Flow 定義錯誤 | Flow YAML 語法錯誤 |
| 1506 | Validation Error | 驗證錯誤 | Schema 驗證失敗 |

### 錯誤回應格式

```json
{
  "content": [{
    "type": "text",
    "text": "產生 Flow 時發生錯誤：找不到規格檔案 'specs/invalid.yaml'"
  }]
}
```

---

## Claude Desktop 整合

### 配置範例

```json
{
  "mcpServers": {
    "specpilot": {
      "command": "node",
      "args": ["D:/codes/SpecPilot/apps/mcp-server/dist/index.js"],
      "env": {
        "SPEC_PILOT_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

### 使用提示詞範例

**產生測試**:
```
請使用 generateFlow 工具為 specs/user-api.yaml 產生完整測試套件,
包含成功案例和錯誤案例
```

**驗證 Flow**:
```
請驗證以下 Flow 是否正確:

[貼上 Flow YAML 內容]

使用的規格檔案: specs/user-api.yaml
```

**檢查品質**:
```
請檢查這個 Flow 的品質並提供改進建議:

[貼上 Flow YAML 內容]
```

---

## 效能指標

| 操作 | 平均執行時間 | 記憶體使用 |
|-----|-------------|-----------|
| generateFlow (10 端點) | < 500ms | < 50MB |
| validateFlow | < 50ms | < 10MB |
| checkFlowQuality | < 200ms | < 30MB |
| saveFlow | < 20ms | < 5MB |

---

## 日誌記錄

所有 MCP Server 操作都會記錄到 `logs/mcp-server.log`:

```json
{
  "level": "info",
  "time": "2025-01-16T10:30:00.000Z",
  "message": "generateFlow 方法開始執行",
  "method": "generateFlow",
  "event": "generate_flow_start",
  "details": {
    "specPath": "specs/user-api.yaml",
    "options": {
      "includeSuccessCases": true,
      "includeErrorCases": true
    }
  }
}
```

---

## 限制與已知問題

### 當前限制
1. **檔案系統存取** - 僅支援本地檔案系統,不支援遠端 URL
2. **大型規格處理** - 超過 100 個端點的規格可能較慢
3. **並行執行** - 不支援並行執行多個工具方法

### 規劃改進
1. 支援遠端 OpenAPI 規格 URL
2. 效能優化（快取、lazy loading）
3. 支援批次操作
4. 提供進度回報機制

---

## 相關文件

- [總覽](./overview.md)
- [Flow Generator](./flow-generator.md)
- [Test Suite Generator](./test-suite-generator.md)
- [Flow Validator](./flow-validator.md)
- [MCP 介面文件](../mcp-interface.md)
- [Claude Desktop 整合指南](../claude-desktop-integration.md)

---

**最後更新**: 2025-01-16
**MCP SDK 版本**: 1.18.2
