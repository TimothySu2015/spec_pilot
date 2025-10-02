# 靜態原型轉 React 實作指南

## 文件目的

提供從靜態 HTML 原型 (`prototypes/flow-builder-ui.html`) 轉換為 React + TypeScript 實作的詳細對應關係與實作指南。

---

## 原型概覽

**靜態原型位置:** `docs/flow-builder/prototypes/flow-builder-ui.html`

**已驗證的功能:**
- ✅ 完整佈局 (Header, Sidebar, Main Content, Right Panel)
- ✅ Tab 切換 (YAML 預覽 / 驗證 / 說明)
- ✅ Modal 對話框 (API 端點清單, 匯出 Flow)
- ✅ 互動元件 (Button, Input, Select, Table)
- ✅ 視覺設計 (色彩、字型、間距)

---

## 元件對應表

### 主要佈局元件

| 靜態原型區塊 | React 元件名稱 | 檔案路徑 | 優先級 |
|-------------|---------------|---------|--------|
| Header | `<Header />` | `src/components/layout/Header.tsx` | P0 |
| Left Sidebar | `<Sidebar />` | `src/components/layout/Sidebar.tsx` | P0 |
| Main Content | `<MainContent />` | `src/components/layout/MainContent.tsx` | P0 |
| Right Panel | `<RightPanel />` | `src/components/layout/RightPanel.tsx` | P1 |
| 整體佈局 | `<Layout />` | `src/components/layout/Layout.tsx` | P0 |

---

### Header 元件拆分

**原型結構:**
```html
<header>
  <div class="logo">SpecPilot 🚀</div>
  <div class="actions">
    <button>儲存</button>
    <button>匯出</button>
    <button>預覽</button>
  </div>
</header>
```

**React 元件對應:**

| 原型元素 | React 元件 | Props | 檔案路徑 |
|---------|-----------|-------|---------|
| Logo 區塊 | `<Logo />` | `{ title: string }` | `src/components/header/Logo.tsx` |
| 操作按鈕組 | `<ActionButtons />` | `{ onSave, onExport, onPreview }` | `src/components/header/ActionButtons.tsx` |
| 儲存按鈕 | `<SaveButton />` | `{ autoSaveStatus }` | `src/components/header/SaveButton.tsx` |
| 匯出按鈕 | `<ExportButton />` | `{ onClick }` | `src/components/header/ExportButton.tsx` |

**實作範例:**

```tsx
// src/components/layout/Header.tsx
import React from 'react';
import { Logo } from '../header/Logo';
import { ActionButtons } from '../header/ActionButtons';

export function Header() {
  const handleSave = () => {
    // 儲存邏輯
  };

  const handleExport = () => {
    // 匯出邏輯
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <Logo title="SpecPilot Flow Builder" />
      <ActionButtons
        onSave={handleSave}
        onExport={handleExport}
      />
    </header>
  );
}
```

---

### Sidebar 元件拆分

**原型結構:**
```html
<aside class="sidebar">
  <!-- OpenAPI 上傳狀態 -->
  <div class="openapi-status">...</div>

  <!-- 步驟列表 -->
  <div class="steps-list">
    <div class="step-item">...</div>
  </div>

  <!-- 範本庫 -->
  <div class="templates">...</div>
</aside>
```

**React 元件對應:**

| 原型區塊 | React 元件 | Props | 檔案路徑 |
|---------|-----------|-------|---------|
| OpenAPI 上傳卡片 | `<OpenAPIUploadCard />` | `{ onUpload, status }` | `src/components/sidebar/OpenAPIUploadCard.tsx` |
| OpenAPI 已上傳狀態 | `<OpenAPIStatusDisplay />` | `{ spec, onViewList }` | `src/components/sidebar/OpenAPIStatusDisplay.tsx` |
| 步驟列表 | `<StepList />` | `{ steps, activeStepId, onSelectStep }` | `src/components/sidebar/StepList.tsx` |
| 單一步驟項目 | `<StepListItem />` | `{ step, isActive, status }` | `src/components/sidebar/StepListItem.tsx` |
| 範本庫 | `<TemplateLibrary />` | `{ templates, onSelectTemplate }` | `src/components/sidebar/TemplateLibrary.tsx` |

**實作範例:**

```tsx
// src/components/sidebar/StepListItem.tsx
import React from 'react';
import { IFlowStep } from '@specpilot/schemas';

interface StepListItemProps {
  step: IFlowStep;
  isActive: boolean;
  status: 'valid' | 'warning' | 'error' | 'editing';
  onClick: () => void;
}

export function StepListItem({ step, isActive, status, onClick }: StepListItemProps) {
  const statusIcons = {
    valid: '✅',
    warning: '⚠️',
    error: '❌',
    editing: '📝',
  };

  return (
    <div
      className={`
        p-3 rounded cursor-pointer transition-colors
        ${isActive ? 'bg-blue-50 border-l-2 border-blue-500' : 'hover:bg-gray-50'}
      `}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <span>{statusIcons[status]}</span>
        <span className="flex-1 text-sm font-medium">{step.name}</span>
      </div>
    </div>
  );
}
```

---

### Main Content 元件拆分

**原型結構:**
```html
<main>
  <!-- Flow 基本資訊 -->
  <section class="flow-basic-info">...</section>

  <!-- Step 編輯器 -->
  <section class="step-editor">
    <div class="request-section">...</div>
    <div class="expect-section">...</div>
    <div class="validation-section">...</div>
    <div class="capture-section">...</div>
  </section>
</main>
```

**React 元件對應:**

| 原型區塊 | React 元件 | 狀態管理 | 檔案路徑 |
|---------|-----------|---------|---------|
| Flow 基本資訊表單 | `<FlowBasicInfoForm />` | React Hook Form | `src/components/flow/FlowBasicInfoForm.tsx` |
| 變數編輯器 | `<VariableEditor />` | React Hook Form | `src/components/flow/VariableEditor.tsx` |
| Step 編輯器 | `<StepEditor />` | React Hook Form | `src/components/step/StepEditor.tsx` |
| Request 區塊 | `<RequestSection />` | 子表單 | `src/components/step/RequestSection.tsx` |
| **Expect Body Table** | **`<ExpectBodyTable />`** | **Array Field** | **`src/components/step/ExpectBodyTable.tsx`** |
| Validation 規則列表 | `<ValidationRuleList />` | Array Field | `src/components/step/ValidationRuleList.tsx` |
| Capture 變數設定 | `<CaptureSection />` | Array Field | `src/components/step/CaptureSection.tsx` |

**核心實作: Expect Body Table**

```tsx
// src/components/step/ExpectBodyTable.tsx
import React from 'react';
import { useFieldArray, useFormContext } from 'react-hook-form';

interface ExpectBodyField {
  fieldName: string;
  expectedValue: string;
  validationMode: 'any' | 'exact';
}

export function ExpectBodyTable() {
  const { control, register } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'expect.bodyFields',
  });

  const addField = () => {
    append({
      fieldName: '',
      expectedValue: '',
      validationMode: 'any',
    });
  };

  return (
    <div className="border border-gray-200 rounded-lg">
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Response Body (可選)</h3>
          <button
            type="button"
            onClick={addField}
            className="text-blue-600 hover:text-blue-700"
          >
            + 新增欄位
          </button>
        </div>
      </div>

      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">欄位名稱</th>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">預期值</th>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">驗證模式</th>
            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">操作</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field, index) => (
            <tr key={field.id} className="border-b">
              <td className="px-4 py-2">
                <input
                  {...register(`expect.bodyFields.${index}.fieldName`)}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="id"
                />
              </td>
              <td className="px-4 py-2">
                <input
                  {...register(`expect.bodyFields.${index}.expectedValue`)}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  placeholder="(任意值)"
                />
              </td>
              <td className="px-4 py-2">
                <select
                  {...register(`expect.bodyFields.${index}.validationMode`)}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                >
                  <option value="any">存在即可</option>
                  <option value="exact">精確匹配</option>
                </select>
              </td>
              <td className="px-4 py-2">
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  🗑️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {fields.length === 0 && (
        <div className="p-8 text-center text-gray-500">
          尚未新增欄位,點擊「+ 新增欄位」開始
        </div>
      )}

      <div className="p-4 bg-gray-50 text-sm text-gray-600">
        💡 提示:
        <ul className="mt-2 space-y-1">
          <li>• 存在即可: 欄位存在即通過 (YAML: null)</li>
          <li>• 精確匹配: 必須完全相同 (YAML: "具體值")</li>
          <li>• 需要模糊匹配時,請使用下方 Validation 規則</li>
        </ul>
      </div>
    </div>
  );
}
```

---

### Right Panel 元件拆分

**原型結構:**
```html
<aside class="right-panel">
  <div class="tabs">
    <button class="tab active">YAML 預覽</button>
    <button class="tab">驗證</button>
    <button class="tab">說明</button>
  </div>

  <div class="tab-content">
    <!-- YAML 預覽 -->
    <div class="yaml-preview">...</div>
  </div>
</aside>
```

**React 元件對應:**

| 原型區塊 | React 元件 | 狀態 | 檔案路徑 |
|---------|-----------|------|---------|
| Tab 切換 | `<Tabs />` | `activeTab` | `src/components/ui/Tabs.tsx` (Shadcn/ui) |
| YAML 預覽 | `<YamlPreview />` | 即時計算 | `src/components/preview/YamlPreview.tsx` |
| 驗證結果顯示 | `<ValidationPanel />` | Zod 驗證結果 | `src/components/preview/ValidationPanel.tsx` |
| 說明文件 | `<HelpPanel />` | 靜態內容 | `src/components/preview/HelpPanel.tsx` |

**實作範例:**

```tsx
// src/components/preview/YamlPreview.tsx
import React, { useMemo } from 'react';
import { useWatch } from 'react-hook-form';
import { exportToYaml } from '@specpilot/schemas';
import Editor from '@monaco-editor/react';

export function YamlPreview() {
  const flowData = useWatch(); // 監聽整個表單

  const yamlContent = useMemo(() => {
    try {
      return exportToYaml(flowData);
    } catch (error) {
      return '# YAML 產生錯誤\n' + error.message;
    }
  }, [flowData]);

  return (
    <div className="h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">YAML 預覽</h3>
        <button
          onClick={() => navigator.clipboard.writeText(yamlContent)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          複製
        </button>
      </div>

      <Editor
        height="calc(100% - 60px)"
        language="yaml"
        value={yamlContent}
        theme="vs-light"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  );
}
```

---

## Modal 元件實作

### API 端點清單 Modal

**原型觸發:** 點擊 Sidebar 「查看清單」按鈕

**React 實作:**

```tsx
// src/components/modals/APIEndpointListModal.tsx
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IOpenAPISpec } from '@/types/openapi';

interface APIEndpointListModalProps {
  isOpen: boolean;
  onClose: () => void;
  openApiSpec: IOpenAPISpec;
  onSelectEndpoint: (path: string, method: string) => void;
}

export function APIEndpointListModal({
  isOpen,
  onClose,
  openApiSpec,
  onSelectEndpoint,
}: APIEndpointListModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMethod, setFilterMethod] = useState<string>('all');

  const endpoints = extractEndpoints(openApiSpec);
  const filteredEndpoints = endpoints.filter(ep => {
    const matchesSearch = ep.path.includes(searchQuery);
    const matchesMethod = filterMethod === 'all' || ep.method === filterMethod;
    return matchesSearch && matchesMethod;
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>API 端點清單</DialogTitle>
        </DialogHeader>

        {/* 搜尋與篩選 */}
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            placeholder="🔍 搜尋 API..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded"
          />

          <div className="flex gap-2">
            <button onClick={() => setFilterMethod('all')}>全部</button>
            <button onClick={() => setFilterMethod('GET')}>GET</button>
            <button onClick={() => setFilterMethod('POST')}>POST</button>
            <button onClick={() => setFilterMethod('PUT')}>PUT</button>
            <button onClick={() => setFilterMethod('DELETE')}>DELETE</button>
          </div>
        </div>

        {/* 端點清單 (依 Tag 分組) */}
        <div className="space-y-4 overflow-y-auto">
          {Object.entries(groupByTag(filteredEndpoints)).map(([tag, endpoints]) => (
            <div key={tag}>
              <h3 className="font-semibold mb-2">{tag} ({endpoints.length})</h3>
              {endpoints.map((ep) => (
                <div key={`${ep.method}-${ep.path}`} className="flex items-center justify-between p-2 hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className={`method-badge method-${ep.method.toLowerCase()}`}>
                      {ep.method}
                    </span>
                    <span>{ep.path}</span>
                  </div>
                  <button
                    onClick={() => {
                      onSelectEndpoint(ep.path, ep.method);
                      onClose();
                    }}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    + 新增測試
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 狀態管理策略

### React Hook Form 整合

**Form Provider 設定:**

```tsx
// src/App.tsx
import React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FlowDefinitionSchema } from '@specpilot/schemas';
import { Layout } from './components/layout/Layout';

export function App() {
  const methods = useForm({
    resolver: zodResolver(FlowDefinitionSchema),
    defaultValues: {
      name: '',
      baseUrl: '',
      variables: {},
      steps: [],
    },
  });

  return (
    <FormProvider {...methods}>
      <Layout />
    </FormProvider>
  );
}
```

---

## CSS 轉 Tailwind CSS

### 色彩系統對應

| 原型 CSS | Tailwind CSS | 用途 |
|---------|-------------|------|
| `--primary: #3B82F6` | `bg-blue-500` | 主要按鈕 |
| `--gray-50: #F9FAFB` | `bg-gray-50` | 背景 |
| `--gray-200: #E5E7EB` | `border-gray-200` | 邊框 |
| `--success: #10B981` | `text-green-600` | 成功狀態 |
| `--error: #EF4444` | `text-red-600` | 錯誤狀態 |

### 間距對應

| 原型 CSS | Tailwind CSS |
|---------|-------------|
| `padding: 16px` | `p-4` |
| `margin-bottom: 24px` | `mb-6` |
| `gap: 8px` | `gap-2` |

---

## 實作檢查清單

### Phase 2: 基礎框架

- [ ] 建立 `Layout.tsx` (Header + Sidebar + Main + Right Panel)
- [ ] 實作 `Header.tsx` 與子元件
- [ ] 實作 `Sidebar.tsx` (不含 OpenAPI 功能)
- [ ] 整合 React Hook Form + Zod
- [ ] 設定 Tailwind CSS 主題

### Phase 3: Flow 編輯器

- [ ] 實作 `FlowBasicInfoForm.tsx`
- [ ] 實作 `VariableEditor.tsx`
- [ ] 設定表單驗證規則

### Phase 4: Step 編輯器

- [ ] 實作 `StepEditor.tsx`
- [ ] 實作 `RequestSection.tsx`
- [ ] **🆕 實作 `ExpectBodyTable.tsx` (Table 模式)**
- [ ] 實作 `ValidationRuleList.tsx`
- [ ] 實作 `CaptureSection.tsx`

### Phase 5: 預覽與匯出

- [ ] 實作 `YamlPreview.tsx` (Monaco Editor)
- [ ] 實作 `ValidationPanel.tsx`
- [ ] 實作 `ExportModal.tsx`
- [ ] 整合 `exportToYaml()` 工具函式

### Phase 7: OpenAPI 整合

- [ ] 實作 `OpenAPIUploadCard.tsx`
- [ ] 實作 `APIEndpointListModal.tsx`
- [ ] 實作 OpenAPI 解析器
- [ ] 實作智能驗證建議功能

---

**文件版本:** v1.0.0
**最後更新:** 2025-01-16
**狀態:** ✅ 完成
