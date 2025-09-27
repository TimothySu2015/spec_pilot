# CLAUDE.md

此文件為 Claude Code (claude.ai/code) 在此專案中工作時提供指導方針。

## 語言與溝通規範

### 使用繁體中文
- **主要溝通語言**: 在此專案中，Claude Code 必須使用繁體中文進行所有對話與回覆
- **文件撰寫**: 所有文件、註解、README 檔案均需使用繁體中文撰寫
- **程式碼註解**: 函式、類別、重要邏輯的註解應使用繁體中文
- **錯誤訊息**: 自訂錯誤訊息與日誌內容應使用繁體中文
- **變數命名**: 程式碼變數與函式名稱仍使用英文，但相關說明需用繁體中文

### 溝通風格
- 保持專業但友善的語調
- 提供清晰、簡潔的技術說明
- 在解釋複雜概念時使用適當的技術術語
- 回答問題時直接切入重點，避免冗長的前言

## 專案概述

SpecPilot 是一套使用 Node.js 與 TypeScript 打造的 API 測試與驗證工具，提供 CLI 與 MCP（模型上下文協議）兩種介面。支援 OpenAPI 規格、YAML 測試流程、自訂驗證規則，以及為 AI 驅動開發流程設計的結構化報表功能。

## 開發指令

### 核心開發指令
- `pnpm install` - 安裝 Monorepo 依賴套件
- `pnpm run dev` - 啟動 CLI 開發模式
- `pnpm run start` - 執行編譯後的 CLI
- `pnpm run start:mcp` - 啟動 MCP JSON-RPC 伺服器
- `pnpm run lint` - 執行程式碼品質檢查
- `pnpm run test` - 執行單元與整合測試

### 測試指令
- `pnpm run mock` - 啟動本地模擬伺服器（開發用）
- `pnpm run mock:ci` - 啟動 CI 環境模擬伺服器
- `pnpm run test:integration` - 執行整合測試

### CLI 使用範例
```bash
pnpm run start -- --spec specs/openapi.yaml --flow flows/user_crud.yaml --baseUrl http://localhost:3000
```

## 架構與技術堆疊

### 核心架構
- **架構模式**: 模組化單體搭配六角式架構
- **程式語言**: TypeScript 5.4.5
- **執行環境**: Node.js 20.11.1 LTS
- **套件管理器**: pnpm 9.1
- **版本庫策略**: Monorepo 結構

### 關鍵技術
- **CLI 框架**: commander 11.1
- **HTTP 客戶端**: axios 1.6.8
- **YAML 解析器**: yaml 2.4.3
- **OpenAPI 驗證器**: @apidevtools/swagger-parser 10.1.0
- **Schema 驗證器**: ajv 8.12.0
- **日誌系統**: pino 9.0.0（JSON Lines 格式）
- **測試框架**: Vitest 1.6.0
- **HTTP 模擬**: nock 13.4.0
- **開發執行器**: tsx 4.7.0
- **打包工具**: tsup 8.0.1

### 專案結構
```
specpilot/
├── apps/
│   ├── cli/                    # CLI 介面應用程式
│   └── mcp-server/            # MCP JSON-RPC 伺服器
├── packages/
│   ├── core-flow/             # 流程協調引擎
│   ├── spec-loader/           # OpenAPI 規格解析
│   ├── flow-parser/           # YAML 流程解析
│   ├── http-runner/           # HTTP 執行引擎（axios）
│   ├── validation/            # Schema 與自訂規則驗證
│   ├── reporting/             # 報表產生與日誌
│   ├── config/                # 組態管理
│   ├── shared/                # 共用工具與類型定義
│   └── testing/               # 測試工具與範例資料
├── specs/                     # OpenAPI 規格檔案
├── flows/                     # YAML 測試流程定義
├── reports/                   # 產生的測試報表
├── logs/                      # 結構化日誌檔案
└── docs/                      # 架構與需求文件
```

## 核心工作流程

1. **規格載入**: 使用 swagger-parser 解析 OpenAPI 規格（JSON/YAML）
2. **流程定義**: 解析定義 HTTP 呼叫與驗證的 YAML 測試流程
3. **測試執行**: 透過 axios 執行 HTTP 請求，具備重試與逾時處理
4. **驗證管線**: 使用 ajv 對回應進行 Schema 與自訂規則驗證
5. **報表產生**: 輸出結構化 JSON 報表與 JSON Lines 日誌

## 組態設定與環境

### 環境變數（.env.local）
- `SPEC_PILOT_BASE_URL` - 目標 API 基礎 URL
- `SPEC_PILOT_PORT` - API 埠號（預設值：HTTP=80, HTTPS=443）
- `SPEC_PILOT_TOKEN` - API 呼叫認證憑證

### 組態優先順序
1. 環境變數（.env.local）
2. CLI 參數（覆寫環境變數）
3. Flow YAML 設定
4. MCP runFlow 參數（最高優先級）

## 主要功能

### CLI 介面
- 支援 `--spec`、`--flow`、`--baseUrl`、`--port`、`--token` 參數
- 執行測試流程並輸出結構化報表
- 退出碼：0（成功）、1（測試失敗）、2（系統錯誤）

### MCP 介面（JSON-RPC 2.0）
- `listSpecs` - 列出可用的 OpenAPI 規格
- `listFlows` - 列出可用的測試流程
- `runFlow` - 執行測試（支援檔案路徑或內嵌內容）
- `getReport` - 取得最新的測試報表

### 驗證系統
- HTTP 狀態碼驗證
- 對照 OpenAPI 元件的 JSON Schema 驗證
- 自訂驗證規則：`notNull`、`regex`、`contains`
- 可擴充的驗證引擎使用 ajv 自訂關鍵字

### 認證與安全性
- JWT 憑證管理，自動注入 Header
- Bearer token 支援 API 認證
- 日誌與報表中的敏感資料遮罩
- 支援測試序列內的登入流程

### 模擬與備援系統
- 透過 nock/msw 支援離線測試的模擬伺服器
- 目標 API 無法使用時的自動備援機制
- 測試執行前的健康檢查機制
- `FALLBACK_USED` 事件日誌供監控使用

## 錯誤處理

### 錯誤分類
- **組態錯誤**（1501）：遺失/無效的組態檔案
- **規格錯誤**（1502）：無效的 OpenAPI 規格
- **流程錯誤**（1503）：YAML 語法/格式問題
- **網路錯誤**（1504-1505）：連線失敗與逾時
- **驗證錯誤**（1506）：Schema/自訂規則失敗
- **認證錯誤**（1507）：無效/過期的憑證

### 恢復策略
- HTTP 重試的指數退避（500ms, 1s, 2s）
- 連續失敗的斷路器機制
- 優雅降級至備援/模擬服務
- 具執行上下文的結構化錯誤日誌

## 開發指導原則

### 程式碼標準
- 啟用 TypeScript 嚴格模式
- 使用 ESLint + Prettier 進行程式碼格式化
- 命名規範：檔案使用 kebab-case、類別使用 PascalCase、函式使用 camelCase
- 禁用：`console.log/error`（改用 StructuredLogger）
- 必須：匯出函式需要型別註解

### 測試策略
- 測試金字塔：60% 單元測試、30% 整合測試、10% 端對端測試
- 覆蓋率目標：≥80% 整體、≥85% 關鍵模組
- 使用 nock/msw 模擬外部依賴
- 測試資料透過 `packages/testing/fixtures` 管理

### 日誌要求
- 使用 pino 進行結構化 JSON Lines 日誌
- 必要欄位：`timestamp`、`executionId`、`component`、`level`
- 使用 `***` 遮罩敏感資料（憑證、密碼）
- 事件代碼：`STEP_START`、`STEP_FAILURE`、`FALLBACK_USED` 等

## 重要註記

- 這是專注於 API 測試的全新綠地專案
- 設計用於透過 MCP 協議整合 AI Agent
- 支援本地開發與 CI/CD 自動化
- 無既有程式碼基礎 - 架構文件定義實作計畫
- 優先考慮可靠性、可觀測性與 AI 整合能力