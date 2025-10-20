# SpecPilot Flow Builder

視覺化 Flow YAML 編輯器,提供直覺的介面來建立 SpecPilot 測試流程。

## 功能特色

### ✅ Phase 0-5 已完成功能

- ✅ **Flow 基本資訊編輯**: 名稱、Base URL、描述、版本號
- ✅ **變數管理**: 支援 key-value 變數定義,可在 Flow 中使用 `{{variable}}` 語法
- ✅ **Step 列表管理**: 新增/刪除/排序測試步驟
- ✅ **Request 編輯器**: HTTP Method、Path、Request Body
- ✅ **Expect Body Table**: 表格模式定義預期回應欄位 (存在即可/精確匹配)
- ✅ **即時 YAML 預覽**: Monaco Editor 語法高亮顯示
- ✅ **匯出功能**: 匯出 YAML 檔案與 JSON Schema

### ⭐ Phase 12 新增功能

- ⭐ **Custom Rules 驗證規則編輯器** (推薦使用)
  - 支援所有 8 種驗證規則
  - 智能建議功能（基於 OpenAPI Schema）
  - 使用新格式 `expect.body.customRules`
- ⚠️ **舊版 Validation 編輯器** (已標記為不推薦)
  - 仍可使用但建議遷移至 Custom Rules
  - 顯示棄用警告與遷移指引

## 快速開始

### 安裝依賴

```bash
# 從專案根目錄
pnpm install
```

### 啟動開發伺服器

```bash
# 方式 1: 從根目錄
pnpm run dev:builder

# 方式 2: 從 flow-builder 目錄
cd apps/flow-builder
pnpm run dev
```

專案將在 http://localhost:5173 啟動。

## 使用指南

### 1. 編輯 Flow 基本資訊

1. 填寫 **Flow 名稱** (必填)
2. 填寫 **Base URL** (必填)
3. 選填 **描述** 與 **版本號**
4. 在 **變數定義** 區塊新增變數 (可選)

### 2. 新增測試步驟

1. 點擊左側 Sidebar 的「+ 新增步驟」按鈕
2. 步驟會自動新增並顯示在列表中
3. 點擊步驟可進入編輯模式

### 3. 編輯步驟內容

#### Request 設定
- 選擇 HTTP Method (GET, POST, PUT, PATCH, DELETE...)
- 填寫 API Path (支援變數插值,例如: `/api/users/{{user_id}}`)
- 如果是 POST/PUT/PATCH,可填寫 Request Body (JSON 格式)

#### Expect 設定
- 填寫 **預期狀態碼** (例如: 200, 201, 404...)
- 點擊「+ 新增欄位」來定義預期回應欄位
  - **欄位名稱**: Response Body 的欄位名稱 (例如: `id`, `username`)
  - **預期值**: 可填具體值或留空
  - **驗證模式**:
    - **存在即可**: 只檢查欄位存在,不檢查值
    - **精確匹配**: 必須完全相同

#### Custom Rules 驗證 (✅ 推薦使用)
- 在 Expect 區塊中找到「自訂驗證規則 (Custom Rules)」面板
- 支援 **8 種驗證規則**:
  - **notNull**: 欄位不可為 null
  - **regex**: 正則表達式驗證
  - **contains**: 包含特定值
  - **equals**: 精確值比對
  - **notContains**: 不包含特定值
  - **greaterThan**: 數值大於
  - **lessThan**: 數值小於
  - **length**: 長度驗證
- 點擊「+ 新增規則」來新增驗證規則
- 如果上傳了 OpenAPI 規格,可使用「智能建議」功能

### 4. 即時預覽與匯出

- **右側面板** 會即時顯示 YAML 預覽 (Monaco Editor)
- 點擊 **📋 複製** 可複製到剪貼簿
- 點擊 Header 的 **📤 匯出** 按鈕:
  - **📄 僅匯出 YAML**: 下載 `.yaml` 檔案
  - **📦 匯出 YAML + Schema**: 同時下載 `.yaml` 和 `.schema.json`

### 5. 儲存與載入

- 點擊 **💾 儲存** 會將資料儲存到瀏覽器 LocalStorage
- 重新載入頁面時會自動讀取 (未實作,需擴充)

## 變數插值範例

### 定義變數
```
api_token: abc123
user_id: 12345
```

### 在 Flow 中使用
- Base URL: `{{api_url}}`
- Path: `/api/users/{{user_id}}`
- Request Body: `{"token": "{{api_token}}"}`

## 技術架構

### 前端框架
- **React 18** + TypeScript
- **Vite** 建置工具
- **React Hook Form** + Zod 表單驗證
- **Tailwind CSS** 樣式框架
- **Monaco Editor** 程式碼編輯器

### 核心套件
- **@specpilot/schemas**: 共用 Zod Schema 定義
  - 提供型別安全的 Flow 定義
  - exportToYaml() 工具函式
  - VariableResolver 變數解析器

### 目錄結構
```
apps/flow-builder/
├── src/
│   ├── components/
│   │   ├── layout/       # Layout 元件 (Header, Sidebar, MainContent, RightPanel)
│   │   ├── flow/         # Flow 編輯器 (VariableEditor)
│   │   ├── step/         # Step 編輯器 (StepList, StepEditor, RequestEditor, ExpectEditor)
│   │   └── preview/      # 預覽元件 (YamlPreview)
│   ├── contexts/         # React Context (StepContext)
│   ├── utils/            # 工具函式 (export-handler)
│   ├── App.tsx           # 主應用程式
│   └── main.tsx          # 入口點
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## 開發指令

```bash
# 啟動開發伺服器
pnpm run dev

# 建置生產版本
pnpm run build

# 預覽生產版本
pnpm run preview
```

## 未來擴充方向

### Phase 6: SpecPilot 整合
- [ ] CLI 支援 `--flow-schema` 參數
- [ ] Flow Parser 整合 JSON Schema 驗證

### Phase 7: OpenAPI 整合
- [ ] OpenAPI 上傳與解析
- [ ] 智能驗證建議
- [ ] 批次生成測試

### Phase 8: 進階功能
- [ ] Validation 規則編輯器 (notNull, regex, contains)
- [ ] Capture 變數擷取設定
- [ ] 視覺化流程編輯器
- [ ] 範本系統
- [ ] 多語言支援

## 已知限制

1. Request Headers 編輯器尚未實作
2. Validation 規則編輯器尚未實作
3. Capture 變數擷取編輯器尚未實作
4. LocalStorage 自動載入功能尚未實作
5. Request Body 目前為純文字輸入,未來可改用 JSON Editor

## 授權

MIT License
