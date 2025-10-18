---
**狀態**: 已完成
**歸檔日期**: 2025-10-19
**備註**: FlowBuilder 已在 flow-generator 中實作
---

# Flow Builder UI 實作計畫

## 專案概述

在 SpecPilot Monorepo 中新增 Flow Builder UI 應用程式，提供視覺化介面讓使用者建立測試流程，並產生符合 SpecPilot 規格的 Flow YAML 與 JSON Schema。

**目標:** 降低 Flow YAML 編寫門檻，提供即時驗證與錯誤提示，提升開發效率。

---

## 架構設計

### Monorepo 結構調整

```
spec_pilot/
├── apps/
│   ├── cli/                    # 現有 - CLI 介面
│   ├── mcp-server/            # 現有 - MCP Server
│   └── flow-builder/          # 🆕 新增 - Flow Builder UI
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       ├── public/
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── components/    # React 元件
│           ├── hooks/         # 自訂 Hooks
│           ├── services/      # API 服務
│           ├── utils/         # 工具函式
│           └── types/         # 型別定義
│
├── packages/
│   ├── config/                # 現有
│   ├── core-flow/            # 現有
│   ├── flow-parser/          # 現有
│   ├── http-runner/          # 現有
│   ├── reporting/            # 現有
│   ├── shared/               # 現有
│   ├── spec-loader/          # 現有
│   ├── testing/              # 現有
│   ├── validation/           # 現有
│   └── schemas/              # 🆕 新增 - 共用 Zod Schema
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── flow-schema.ts      # Flow 定義 Schema
│           ├── step-schema.ts      # Step 定義 Schema
│           ├── validation-schema.ts # Validation 規則 Schema
│           └── utils/
│               ├── export-json-schema.ts
│               └── export-yaml.ts
│
├── flows/                    # 現有 - Flow YAML 檔案
│   └── schemas/             # 🆕 新增 - JSON Schema 儲存位置
│
└── docs/
    ├── flow-builder-risk-assessment.md        # 已建立
    └── flow-builder-implementation-plan.md    # 本文件
```

---

## 分階段實作計畫

### Phase 0: 準備階段 (1 天)

**目標:** 建立專案骨架與基礎設定

#### 工作項目

1. **建立 `packages/schemas` 套件**
   - [ ] 建立 package.json
   - [ ] 建立 tsconfig.json
   - [ ] 設定 TypeScript 編譯輸出

2. **建立 `apps/flow-builder` 專案**
   - [ ] 建立 Vite + React + TypeScript 專案結構
   - [ ] 建立 package.json
   - [ ] 設定 tsconfig.json
   - [ ] 設定 vite.config.ts

3. **更新根目錄設定**
   - [ ] 更新 package.json scripts
   - [ ] 更新 tsup.config.ts (如需打包)
   - [ ] 確認 workspace 設定正確

#### 預期產出

- `packages/schemas/package.json`
- `apps/flow-builder/package.json`
- `apps/flow-builder/vite.config.ts`
- 根目錄 `package.json` 新增 script: `dev:builder`

---

### Phase 1: 共用 Schema 套件 (2-3 天)

**目標:** 建立型別安全的 Zod Schema，可同時給 Flow Builder UI 和 SpecPilot 使用

#### 工作項目

1. **定義基礎 Schema**
   - [ ] `HTTPMethodSchema` - HTTP 方法列舉
   - [ ] `ValidationRuleSchema` - 驗證規則 (notNull, regex, contains)
   - [ ] `FlowRequestSchema` - HTTP 請求定義
   - [ ] `FlowExpectSchema` - 預期回應定義
   - [ ] `FlowStepSchema` - 測試步驟定義
   - [ ] `FlowDefinitionSchema` - 完整 Flow 定義

2. **實作工具函式**
   - [ ] `exportToJsonSchema()` - 使用 zod-to-json-schema 轉換
   - [ ] `exportToYaml()` - 使用 yaml 套件格式化輸出
   - [ ] `validateZodToJsonSchemaConsistency()` - 驗證轉換一致性
   - [ ] **🆕 `VariableResolver`** - 變數插值解析器

3. **撰寫測試**
   - [ ] Schema 定義測試
   - [ ] Zod ↔ JSON Schema 轉換測試
   - [ ] YAML 格式輸出測試
   - [ ] **🆕 變數解析測試**

#### 技術規格

**限制 Zod 功能使用範圍:**
- ✅ 允許: `z.string()`, `z.number()`, `z.boolean()`, `z.object()`, `z.array()`, `z.enum()`, `z.union()`, `z.literal()`
- ❌ 禁止: `.transform()`, `.refine()`, `.superRefine()`, 複雜的條件邏輯

**變數插值支援策略:**

**1. Schema 定義階段 (允許變數語法):**
```typescript
// 允許變數或實際值
const PathSchema = z.string().regex(
  /^({{[^}]+}}|\/.*)/,
  '必須是有效的路徑或變數 {{variable}}'
);

const EmailSchema = z.string().regex(
  /^({{[^}]+}}|.+@.+\..+)$/,
  '必須是有效的 email 或變數 {{variable}}'
);
```

**2. 變數解析實作 (VariableResolver):**
```typescript
// packages/schemas/src/utils/variable-resolver.ts
export class VariableResolver {
  /**
   * 解析 Flow 資料中的所有變數插值
   * @param flowData - 原始 Flow 資料
   * @param variables - 變數定義表
   * @returns 解析後的 Flow 資料
   */
  resolve(flowData: unknown, variables: Record<string, any>): unknown {
    return this.traverseAndResolve(flowData, variables);
  }

  private traverseAndResolve(value: any, variables: Record<string, any>): any {
    // 處理字串變數插值
    if (typeof value === 'string') {
      return this.resolveString(value, variables);
    }

    // 遞迴處理物件
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        return value.map(item => this.traverseAndResolve(item, variables));
      }

      const resolved: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        resolved[key] = this.traverseAndResolve(val, variables);
      }
      return resolved;
    }

    return value;
  }

  private resolveString(str: string, variables: Record<string, any>): string {
    return str.replace(/{{([^}]+)}}/g, (match, varName) => {
      const trimmedName = varName.trim();
      if (trimmedName in variables) {
        return String(variables[trimmedName]);
      }
      // 未定義的變數保留原樣 (可選:拋出警告)
      return match;
    });
  }
}
```

**3. 使用時機:**

| 階段 | 處理方式 | 工具 |
|------|---------|------|
| UI 編輯 | 顯示變數名稱,不解析 | Flow Builder UI |
| YAML 匯出 | 保留 `{{variable}}` 語法 | exportToYaml() |
| SpecPilot 載入 | 保留原始變數 | Flow Parser |
| SpecPilot 執行前 | 解析所有變數 | VariableResolver |
| OpenAPI 驗證 | 使用解析後的值 | 多層驗證機制 |

**4. 未定義變數處理:**
```typescript
interface VariableResolutionResult {
  resolved: unknown;
  warnings: {
    path: string;
    variable: string;
    message: string;
  }[];
}

// 追蹤未定義的變數
export class VariableResolver {
  resolveWithValidation(
    flowData: unknown,
    variables: Record<string, any>
  ): VariableResolutionResult {
    const warnings: any[] = [];
    const resolved = this.resolve(flowData, variables, warnings);
    return { resolved, warnings };
  }
}
```

#### 預期產出

- `packages/schemas/src/flow-schema.ts`
- `packages/schemas/src/step-schema.ts`
- `packages/schemas/src/validation-schema.ts`
- `packages/schemas/src/utils/export-json-schema.ts`
- `packages/schemas/src/utils/export-yaml.ts`
- `packages/schemas/__tests__/` - 測試檔案

---

### Phase 2: Flow Builder UI - 基礎框架 (2-3 天)

**目標:** 建立 React 應用程式基礎框架與路由

#### 工作項目

1. **建立專案結構**
   - [ ] 設定 Vite 開發伺服器
   - [ ] 設定 React Router (可選)
   - [ ] 設定全域樣式 (CSS/Tailwind)

2. **建立核心元件**
   - [ ] `App.tsx` - 主應用程式
   - [ ] `Layout.tsx` - 版面配置 (三欄式佈局)
   - [ ] `Header.tsx` - 頁首 (64px 高度)
   - [ ] `Sidebar.tsx` - 左側邊欄 (240px 寬度)
   - [ ] `RightPanel.tsx` - 右側面板 (320px 寬度,可收合)

3. **整合表單管理**
   - [ ] 安裝 react-hook-form
   - [ ] 安裝 @hookform/resolvers/zod
   - [ ] 建立基礎 Form Provider

4. **建立 UI 元件庫整合**
   - [ ] 選擇 UI 元件庫 (Shadcn/ui, Ant Design, MUI 等)
   - [ ] 設定主題系統
   - [ ] 建立基礎元件包裝器

#### 預期產出

- `apps/flow-builder/src/App.tsx`
- `apps/flow-builder/src/components/Layout.tsx`
- `apps/flow-builder/src/main.tsx`
- Vite 開發伺服器可正常運行
- 基礎 UI 框架搭建完成

---

### Phase 2.5: Toast 通知系統 (1 天)

**目標:** 建立全域 Toast 通知系統,用於顯示操作回饋

#### 工作項目

1. **Toast Context 與 Provider**
   - [ ] `ToastProvider.tsx` - Context Provider
   - [ ] `useToast.ts` - Custom Hook (提供 showToast 方法)

2. **Toast 元件**
   - [ ] `Toast.tsx` - Toast 訊息元件
   - [ ] 動畫效果 (滑入/淡出)
   - [ ] 多種類型支援 (success, warning, error, info)
   - [ ] 自動關閉機制 (預設 3 秒)

3. **整合至 Layout**
   - [ ] 在 `Layout.tsx` 引入 ToastProvider
   - [ ] 測試 Toast 顯示功能

#### 預期產出

- `apps/flow-builder/src/contexts/ToastProvider.tsx`
- `apps/flow-builder/src/hooks/useToast.ts`
- `apps/flow-builder/src/components/Toast.tsx`
- Toast 通知系統可正常運作

---

#### 技術選型

| 類別 | 推薦方案 | 替代方案 |
|------|---------|---------|
| UI 框架 | React 18 | - |
| 建置工具 | Vite | - |
| 表單管理 | React Hook Form + Zod | Formik |
| UI 元件 | Shadcn/ui | Ant Design, MUI |
| 樣式方案 | Tailwind CSS | CSS Modules |
| 程式碼編輯器 | Monaco Editor | CodeMirror |
| 狀態管理 | React Context (初期) | Zustand, Jotai |

---

### Phase 3: Flow 編輯器 - 基本功能 (3-4 天)

**目標:** 實作 Flow 基本資訊編輯與變數管理

#### 工作項目

1. **Flow 基本資訊編輯器**
   - [ ] `FlowBasicInfoForm.tsx` - Flow 名稱、描述、版本
   - [ ] `BaseUrlInput.tsx` - Base URL 輸入與驗證
   - [ ] `SchemaVersionSelector.tsx` - Schema 版本選擇器

2. **變數編輯器**
   - [ ] `VariableEditor.tsx` - 變數清單編輯
   - [ ] `VariableInput.tsx` - 單一變數編輯 (key-value)
   - [ ] `VariablePreview.tsx` - 變數預覽與使用說明

3. **Options 編輯器**
   - [ ] `FlowOptionsForm.tsx` - timeout, retryCount, failFast
   - [ ] `ReportingOptionsForm.tsx` - 報表設定

#### 表單驗證

使用 React Hook Form + Zod:
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FlowDefinitionSchema } from '@specpilot/schemas';

const form = useForm({
  resolver: zodResolver(FlowDefinitionSchema),
  defaultValues: { ... }
});
```

#### 預期產出

- `apps/flow-builder/src/components/FlowBasicInfoForm.tsx`
- `apps/flow-builder/src/components/VariableEditor.tsx`
- `apps/flow-builder/src/components/FlowOptionsForm.tsx`
- 可編輯 Flow 基本資訊與變數

---

### Phase 4: Step 編輯器 - 核心功能 (4-5 天)

**目標:** 實作測試步驟編輯器

#### 工作項目

1. **Step 列表管理**
   - [ ] `StepList.tsx` - 步驟清單顯示
   - [ ] `StepCard.tsx` - 單一步驟卡片
   - [ ] 步驟新增/刪除/排序功能
   - [ ] 步驟摺疊/展開功能

2. **Step 基本資訊**
   - [ ] `StepBasicForm.tsx` - 步驟名稱、描述
   - [ ] `StepTypeSelector.tsx` - 步驟類型選擇 (未來擴充用)

3. **Request 編輯器**
   - [ ] `RequestMethodSelector.tsx` - HTTP 方法選擇
   - [ ] `RequestPathInput.tsx` - 路徑輸入 (支援變數插值提示)
   - [ ] `RequestHeadersEditor.tsx` - Headers 編輯 (key-value pairs)
   - [ ] `RequestBodyEditor.tsx` - Request Body 編輯 (JSON)

4. **Expect 編輯器**
   - [ ] `ExpectStatusCodeInput.tsx` - 預期狀態碼
   - [ ] `ExpectBodyEditor.tsx` - 預期回應內容 (Table 表單模式)
   - [ ] `ExpectBodyTable.tsx` - Expect Body 表格元件
   - [ ] `ExpectBodyField.tsx` - 單一欄位編輯行
   - [ ] `ValidationModeSelector.tsx` - 驗證模式選擇器 (存在即可/精確匹配)

5. **Validation 編輯器**
   - [ ] `ValidationRuleList.tsx` - 驗證規則清單
   - [ ] `ValidationRuleEditor.tsx` - 單一規則編輯
   - [ ] `ValidationRuleSelector.tsx` - 規則類型選擇 (notNull, regex, contains)

6. **Capture 編輯器**
   - [ ] `CaptureEditor.tsx` - 變數擷取設定
   - [ ] `CaptureInput.tsx` - 擷取路徑與變數名稱

#### 進階功能

- 變數插值自動完成
- JSON 格式化與驗證
- JSON Path 建議

#### 預期產出

- `apps/flow-builder/src/components/step/` - Step 相關元件
- `apps/flow-builder/src/components/request/` - Request 相關元件
- `apps/flow-builder/src/components/validation/` - Validation 相關元件
- 可完整編輯測試步驟

---

### Phase 5: 預覽與匯出功能 (2-3 天)

**目標:** 實作 YAML 預覽、JSON Schema 產生與檔案匯出

#### 工作項目

1. **YAML 預覽**
   - [ ] `YamlPreview.tsx` - Monaco Editor 整合
   - [ ] 即時更新 YAML 預覽
   - [ ] 語法高亮
   - [ ] 格式化選項

2. **JSON Schema 預覽**
   - [ ] `SchemaPreview.tsx` - JSON Schema 顯示
   - [ ] Schema 版本資訊

3. **驗證與錯誤檢查**
   - [ ] `ValidationPanel.tsx` - 顯示驗證錯誤
   - [ ] Zod 驗證錯誤顯示
   - [ ] JSON Schema 驗證錯誤顯示
   - [ ] OpenAPI 衝突警告 (Phase 7 實作)

4. **匯出功能**
   - [ ] `ExportButton.tsx` - 匯出按鈕與選項
   - [ ] 匯出 YAML 檔案
   - [ ] 匯出 JSON Schema 檔案
   - [ ] 匯出為壓縮檔 (可選)
   - [ ] 複製到剪貼簿功能

5. **儲存功能**
   - [ ] `SaveButton.tsx` - 儲存按鈕
   - [ ] LocalStorage 自動儲存
   - [ ] 匯入已儲存的 Flow

#### 預期產出

- `apps/flow-builder/src/components/preview/YamlPreview.tsx`
- `apps/flow-builder/src/components/export/ExportButton.tsx`
- `apps/flow-builder/src/utils/export-handler.ts`
- 可預覽與匯出 YAML + JSON Schema

---

### Phase 6: SpecPilot 整合 - 最小修改 (1-2 天)

**目標:** SpecPilot 支援 JSON Schema 驗證 (向後相容)

#### 工作項目

1. **CLI 參數擴充**
   - [ ] `apps/cli/src/index.ts` - 新增 `--flow-schema` 參數
   - [ ] 參數說明與範例

2. **Flow Parser 擴充**
   - [ ] `packages/flow-parser/src/validator.ts` - 新增 `validateWithSchema()` 方法
   - [ ] 整合 AJV 驗證器
   - [ ] 錯誤訊息格式化

3. **測試**
   - [ ] 單元測試: Schema 驗證功能
   - [ ] 整合測試: CLI 參數測試
   - [ ] 向後相容測試: 確保不影響現有功能

4. **文件更新**
   - [ ] CLI 使用說明
   - [ ] Flow Schema 驗證說明

#### 技術實作

```typescript
// packages/flow-parser/src/validator.ts
export class FlowValidator {
  async validateWithSchema(flowData: unknown, schemaPath?: string) {
    if (!schemaPath) {
      // 使用內建驗證邏輯 (向後相容)
      return this.validateBuiltin(flowData);
    }

    // 使用外部 JSON Schema 驗證
    const schema = JSON.parse(await readFile(schemaPath, 'utf-8'));
    const ajv = new Ajv({ allErrors: true, verbose: true });
    const validate = ajv.compile(schema);

    if (!validate(flowData)) {
      throw new ValidationError('Flow 驗證失敗', {
        hint: '請檢查 YAML 格式與必填欄位',
        details: { errors: validate.errors },
      });
    }

    return flowData;
  }
}
```

#### 預期產出

- `apps/cli/src/index.ts` 修改
- `packages/flow-parser/src/validator.ts` 修改
- 測試檔案
- 更新文件

---

### Phase 7: OpenAPI 整合 (5-7 天，核心功能)

**目標:** 整合 OpenAPI Spec，提供智能建議與批次測試生成

#### 7.1 OpenAPI 上傳與解析 (2 天)

**工作項目:**

1. **上傳與狀態管理**
   - [ ] `OpenAPIUploadCard.tsx` - Sidebar 上傳區域元件
   - [ ] `OpenAPIStatusDisplay.tsx` - 已上傳狀態卡片
   - [ ] `OpenAPIContext.tsx` - OpenAPI 狀態管理 Context

2. **解析與結構化**
   - [ ] `OpenAPIParser.ts` - 解析 OpenAPI YAML/JSON
   - [ ] `OpenAPIEndpointExtractor.ts` - 提取 API 端點資訊
   - [ ] `OpenAPISchemaExtractor.ts` - 提取 Response Schema

3. **UI 整合**
   - [ ] `EndpointListModal.tsx` - API 端點清單對話框
   - [ ] `EndpointCard.tsx` - 單一端點卡片 (含 Method Badge)
   - [ ] 依 Tag 分組顯示

**預期產出:**
- Sidebar 顯示 OpenAPI 上傳狀態
- 可查看完整 API 端點清單
- 提取 Response Schema 供後續使用

---

#### 7.2 智能驗證建議 (2-3 天)

**工作項目:**

1. **建議引擎**
   - [ ] `ValidationSuggestionEngine.ts` - 分析 OpenAPI Schema 產生建議
   - [ ] OpenAPI → Validation 規則映射邏輯
     - `required` → `notNull`
     - `format: email` → `regex`
     - `format: date-time` → `regex`
     - `pattern` → `regex`

2. **UI 元件**
   - [ ] `ValidationSuggestionsPanel.tsx` - 建議面板 (Right Panel)
   - [ ] `ValidationSuggestionItem.tsx` - 單一建議項目
   - [ ] `SuggestionSourceBadge.tsx` - 來源標示 (OpenAPI/手動)
   - [ ] 套用/批次套用按鈕

3. **互動邏輯**
   - [ ] 單一建議套用功能
   - [ ] 批次套用功能
   - [ ] 已套用狀態顯示
   - [ ] 重新分析 Schema 功能

**預期產出:**
- Right Panel 顯示智能建議
- 可一鍵套用建議規則
- Toast 提示操作結果

---

#### 7.3 批次生成測試 (1-2 天)

**工作項目:**

1. **批次生成對話框**
   - [ ] `BatchGenerateModal.tsx` - 批次生成 Modal
   - [ ] `EndpointCheckbox.tsx` - 端點選擇清單
   - [ ] `GenerationOptionsForm.tsx` - 生成選項設定

2. **生成引擎**
   - [ ] `FlowGenerator.ts` - 從 OpenAPI 生成 Flow YAML
   - [ ] 自動產生 Request Body 範例
   - [ ] 自動產生 Validation 規則
   - [ ] 自動產生變數擷取邏輯

3. **衝突檢查 (可選)**
   - [ ] `OpenAPIConflictChecker.ts` - 檢查 Flow 與 OpenAPI 衝突
   - [ ] `ConflictWarning.tsx` - 顯示衝突警告

**預期產出:**
- 可批次選擇 API 端點生成測試
- 自動產生完整 Flow Steps
- 衝突檢查與警告提示

---

#### Phase 7 整體預期產出

- `apps/flow-builder/src/services/openapi-parser.ts`
- `apps/flow-builder/src/services/validation-suggestion-engine.ts`
- `apps/flow-builder/src/services/flow-generator.ts`
- `apps/flow-builder/src/components/openapi/` - OpenAPI 相關元件
- OpenAPI 整合功能完整可用

---

### Phase 8: 進階功能與優化 (3-5 天，可選)

**目標:** 提升使用者體驗與進階功能

#### 工作項目

1. **視覺化流程編輯器**
   - [ ] 整合 React Flow 或 xyflow
   - [ ] 節點拖拉排序
   - [ ] 視覺化流程預覽

2. **範本系統**
   - [ ] 內建 Flow 範本
   - [ ] 自訂範本儲存
   - [ ] 範本匯入/匯出

3. **匯入功能**
   - [ ] 匯入既有 Flow YAML
   - [ ] 匯入 Postman Collection (可選)
   - [ ] 匯入 OpenAPI 自動產生測試

4. **協作功能**
   - [ ] 匯出為分享連結
   - [ ] 團隊範本庫

5. **效能優化**
   - [ ] 大型 Flow 編輯效能優化
   - [ ] 虛擬滾動
   - [ ] Debounce 即時驗證

#### 預期產出

- 進階功能實作
- 使用者體驗優化

---

## 技術規格

### 套件依賴

#### `packages/schemas/package.json`

```json
{
  "name": "@specpilot/schemas",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "dependencies": {
    "zod": "~3.25.76",
    "zod-to-json-schema": "^3.23.5",
    "yaml": "^2.4.3"
  },
  "devDependencies": {
    "typescript": "5.4.5",
    "vitest": "1.6.0"
  }
}
```

#### `apps/flow-builder/package.json`

```json
{
  "name": "@specpilot/flow-builder",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@specpilot/schemas": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.53.2",
    "@hookform/resolvers": "^3.9.1",
    "zod": "~3.25.76",
    "@monaco-editor/react": "^4.6.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "5.4.5",
    "vite": "^5.4.11"
  }
}
```

### 根目錄 Script 更新

```json
{
  "scripts": {
    "dev": "pnpm exec tsx apps/cli/src/index.ts",
    "dev:builder": "pnpm --filter @specpilot/flow-builder dev",
    "start": "node dist/apps/cli/src/index.js",
    "start:mcp": "pnpm exec tsx apps/mcp-server/src/index.ts",
    "build:builder": "pnpm --filter @specpilot/flow-builder build"
  }
}
```

---

## 開發工作流程

### 日常開發

```bash
# 啟動 Flow Builder UI 開發伺服器
pnpm run dev:builder

# 在瀏覽器開啟 http://localhost:5173
```

### 建置與測試

```bash
# 建置 schemas 套件
pnpm --filter @specpilot/schemas build

# 建置 Flow Builder UI
pnpm run build:builder

# 執行測試
pnpm --filter @specpilot/schemas test
```

### 整合測試流程

```bash
# 1. 在 Flow Builder UI 建立測試流程
# 2. 匯出檔案
#    - 下載 my-flow.yaml
#    - 下載 my-flow.schema.json

# 3. 移動到 SpecPilot flows 目錄
mv ~/Downloads/my-flow.yaml flows/
mv ~/Downloads/my-flow.schema.json flows/schemas/

# 4. 使用 SpecPilot CLI 執行
pnpm run start -- \
  --spec samples/api-server/openapi.yaml \
  --flow flows/my-flow.yaml \
  --flow-schema flows/schemas/my-flow.schema.json \
  --baseUrl http://127.0.0.1:3000
```

---

## 測試策略

### 單元測試

| 模組 | 測試內容 | 工具 |
|------|---------|------|
| `@specpilot/schemas` | Zod Schema 定義、轉換一致性 | Vitest |
| Flow Builder UI | 元件邏輯、表單驗證 | Vitest + Testing Library |

### 整合測試

| 測試場景 | 驗證項目 |
|---------|---------|
| 匯出 YAML | 格式正確、可被 YAML 解析器解析 |
| 匯出 JSON Schema | 可被 AJV 編譯、驗證邏輯正確 |
| SpecPilot 整合 | CLI 可載入 Schema、驗證功能正常 |

### 端對端測試

1. 在 Flow Builder UI 建立完整 Flow
2. 匯出 YAML 與 Schema
3. 用 SpecPilot CLI 執行
4. 驗證測試結果正確

---

## 里程碑與時程規劃

### Sprint 1 (第 1 週): 基礎建設

- 🚧 Phase 0: 準備階段 (規劃完成,待實作)
- 🚧 Phase 1: 共用 Schema 套件 (規劃完成,待實作)
- ⏸️ Phase 2: Flow Builder UI 框架 (待開始)

**交付項目:**
- ⏸️ Monorepo 結構調整完成
- ⏸️ `@specpilot/schemas` 套件基礎功能
- ⏸️ Flow Builder UI 可啟動

**當前狀態:** 📋 設計與規劃階段,尚未開始實作

### Sprint 2 (第 2 週): 核心編輯功能

- ⏸️ Phase 1: 共用 Schema 套件 (待開始)
- ⏸️ Phase 3: Flow 編輯器基本功能 (待開始)
- ⏸️ Phase 4: Step 編輯器核心功能 (待開始)

**交付項目:**
- ⏸️ Flow 基本資訊可編輯
- ⏸️ 變數編輯器可用
- ⏸️ Step 列表管理

**當前狀態:** ⏸️ 待開始

### Sprint 3 (第 3 週): 完整編輯器

- ⏸️ Phase 4: Step 編輯器核心功能 (待開始)
  - 包含 Expect Body Table 設計 (存在即可/精確匹配模式)
- ⏸️ Phase 5: 預覽與匯出功能 (待開始)

**交付項目:**
- ⏸️ Request/Expect/Validation/Capture 編輯器完成
- ⏸️ Expect Body 表格模式完成
- ⏸️ YAML 預覽功能
- ⏸️ 檔案匯出功能

**當前狀態:** ⏸️ 待開始

---

### Sprint 4 (第 4 週): 預覽匯出與 SpecPilot 整合

- ⏸️ Phase 5: 預覽與匯出功能 (待開始)
- ⏸️ Phase 6: SpecPilot 整合 (待開始)
- ⏸️ Phase 7.1: OpenAPI 上傳與解析 (待開始)
- ⏸️ 整合測試 (待開始)
- 📋 文件撰寫 (設計規劃已完成)

**交付項目:**
- ⏸️ SpecPilot 支援 JSON Schema 驗證
- ⏸️ OpenAPI 上傳功能完成
- ⏸️ API 端點清單可查看
- ⏸️ 完整的整合測試通過
- 📋 使用文件完成 (設計文件已完成)

**當前狀態:** ⏸️ 待開始

---

### Sprint 5 (第 5 週): OpenAPI 整合

- ⏸️ Phase 7.1: OpenAPI 上傳與解析 (待開始)
- ⏸️ Phase 7.2: 智能驗證建議 (待開始)
- ⏸️ Phase 7.3: 批次生成測試 (待開始)
- ⏸️ Toast 通知系統整合 (待開始)

**交付項目:**
- ⏸️ 智能驗證建議功能完成
- ⏸️ 批次生成測試功能完成
- ⏸️ OpenAPI 整合功能完整可用
- ⏸️ Toast 操作回饋系統

**當前狀態:** ⏸️ 待開始

---

### Sprint 6+ (第 6 週以後): 進階功能 (可選)

- ⏸️ Phase 8: 進階功能與優化 (待開始)

**交付項目:**
- ⏸️ 視覺化流程編輯器
- ⏸️ 範本系統
- ⏸️ 協作功能

**當前狀態:** ⏸️ 待開始

---

## 風險管理

### 技術風險

| 風險 | 影響 | 緩解措施 | 負責人 |
|------|------|---------|--------|
| Zod ↔ JSON Schema 轉換不一致 | 高 | 限制 Zod 功能使用、撰寫轉換測試 | 開發團隊 |
| 變數插值驗證困難 | 中 | 使用 regex pattern、前置處理 | 開發團隊 |
| UI 效能問題 (大型 Flow) | 低 | 虛擬滾動、Debounce | 開發團隊 |

### 專案風險

| 風險 | 影響 | 緩解措施 | 負責人 |
|------|------|---------|--------|
| 時程延遲 | 中 | 優先實作 MVP、進階功能可選 | PM |
| 使用者體驗不佳 | 中 | 早期使用者測試、快速迭代 | UX/UI |
| SpecPilot 整合失敗 | 高 | Phase 6 提早實作、持續整合測試 | 開發團隊 |

---

## 成功標準

### MVP 成功標準 (Sprint 1-4)

- ⏸️ 可建立包含多個 Step 的完整 Flow
- ⏸️ 支援所有 Flow YAML 欄位編輯
- ⏸️ Zod 即時驗證無誤
- ⏸️ 可匯出格式正確的 YAML 與 JSON Schema
- ⏸️ SpecPilot CLI 可載入並執行產生的 Flow
- ⏸️ 匯出的 YAML 可通過 JSON Schema 驗證

**當前進度:** 📋 設計階段完成,實作尚未開始

### 進階版成功標準 (Sprint 5+)

- ⏸️ OpenAPI 上傳與解析可用
- ⏸️ 智能驗證建議可用
- ⏸️ 批次生成測試可用
- ⏸️ Toast 通知系統運作正常
- ⏸️ 視覺化流程編輯器可用 (Phase 8)
- ⏸️ 範本系統可用 (Phase 8)
- ⏸️ 效能符合預期 (編輯 100+ steps 不卡頓)

**當前進度:** ⏸️ 待開始

---

## 附錄

### 參考文件

- [Flow Builder 風險評估文件](./flow-builder-risk-assessment.md)
- [SpecPilot CLAUDE.md](../CLAUDE.md)
- [API 錯誤處理指南](./guides/api-errors/error-handler-nodejs.md)

### 相關 Issue / PR

- (待補充)

### 聯絡人

- 專案負責人: (待補充)
- 技術架構: (待補充)
- UI/UX 設計: (待補充)

---

**文件版本:** v1.2.0
**最後更新:** 2025-01-16
**狀態:** 📋 設計規劃階段 (實作尚未開始)

---

## 更新歷程

### v1.2.0 (2025-01-16)

**修正項目:**

1. **進度狀態同步**
   - 更新所有 Sprint 狀態為「⏸️ 待開始」或「🚧 規劃中」
   - 移除不實的「✅ 已完成」標記
   - 明確標註當前階段:設計與規劃階段

2. **文件內容修正**
   - 修正文件更新日期 (2025-10-02 → 2025-01-16)
   - 補充當前實際專案狀態說明

**結論:**
- 所有設計文件已完成,包含 UI 設計、風險評估、實作計畫
- 專案尚未進入實作階段
- 建議優先實作 Phase 0 與 Phase 1

### v1.1.0 (2025-01-15)

**主要更新:**

1. **Phase 2 擴充** - 補充三欄式佈局細節 (Header 64px, Sidebar 240px, Right Panel 320px)
2. **新增 Phase 2.5** - Toast 通知系統實作規劃
3. **Phase 4 調整** - Expect Body 從 JSON Editor 改為 Table 表單模式
   - 新增 `ExpectBodyTable.tsx`
   - 新增 `ExpectBodyField.tsx`
   - 新增 `ValidationModeSelector.tsx` (存在即可/精確匹配)
4. **Phase 7 重大調整** - 從「可選」升級為「核心功能」,拆分為 3 個子階段
   - 7.1: OpenAPI 上傳與解析 (2天)
   - 7.2: 智能驗證建議 (2-3天)
   - 7.3: 批次生成測試 (1-2天)
   - 總時程: 2-3天 → 5-7天
5. **Sprint 規劃調整**
   - Sprint 3: 明確標註 Expect Body Table 設計
   - Sprint 4: 加入 Phase 7.1 開始時程
   - 新增 Sprint 5: 專注 OpenAPI 整合功能
   - Sprint 6+: 進階功能 (原 Sprint 5+)

**更新原因:**
- 反映靜態原型設計改進 (Table form > JSON Editor)
- 提升 OpenAPI 整合優先級 (設計已完成,應納入核心功能)
- 補充遺漏的 Toast 通知系統規劃

### v1.0.0 (2025-01-15)

初版發布
