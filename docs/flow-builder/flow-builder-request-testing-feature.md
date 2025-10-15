# Flow Builder 請求測試與回應回填功能設計

## 📋 文件資訊

**版本:** v1.0.0
**建立日期:** 2025-01-16
**狀態:** 📝 規劃階段
**負責模組:** Flow Builder UI + Flow Builder Server

---

## 🎯 需求概述

### 核心需求

在 Flow Builder 中新增兩項核心功能:

1. **請求測試功能**: 在建立測試流程時,可直接發送 HTTP 請求並取得真實回應
2. **回應回填功能**: 將實際 API 回應智能回填至 Response Body 欄位,加速驗證規則撰寫

### 業務價值

- ✅ **提升效率**: 減少手動撰寫預期回應的時間
- ✅ **降低錯誤**: 基於真實 API 回應產生驗證規則
- ✅ **改善體驗**: 提供即時回饋與除錯能力
- ✅ **智能建議**: 自動偵測動態值與陣列結構

---

## 🏗️ 架構設計

### 系統架構圖

```
┌─────────────────────────────────────────────────────────┐
│  Flow Builder UI (前端)                                  │
│  ┌────────────────────┐  ┌──────────────────────────┐  │
│  │  測試請求觸發器      │  │  回應回填引擎             │  │
│  │  - 發送請求按鈕     │  │  - 精確模式               │  │
│  │  - 變數解析         │  │  - 智能模式               │  │
│  │  - 錯誤處理         │  │  - Schema 模式            │  │
│  └────────────────────┘  └──────────────────────────┘  │
│              │                        │                 │
│              ↓                        ↓                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │  請求記錄面板 (Request History Panel)            │   │
│  │  - Network Tab (請求/回應記錄)                   │   │
│  │  - Variables Tab (變數檢視)                     │   │
│  │  - Console Tab (錯誤日誌)                       │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/WebSocket
                     ↓
┌─────────────────────────────────────────────────────────┐
│  Flow Builder Server (後端)                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Proxy API                                       │   │
│  │  - CORS 處理                                     │   │
│  │  - 變數解析                                      │   │
│  │  - 請求轉發                                      │   │
│  │  - 敏感資料遮罩                                  │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓
              ┌──────────────┐
              │  目標 API     │
              │  (使用者的服務)│
              └──────────────┘
```

### UI 佈局設計

```
┌─────────────────────────────────────────────────────────┐
│  Header (Flow Builder)                                   │
├─────────┬──────────────────────┬─────────────────────────┤
│         │                      │                         │
│  左側    │   中間編輯區          │   右側資訊欄             │
│ OpenAPI │                      │                         │
│  列表   │  ┌────────────────┐  │  - Step 資訊            │
│         │  │ Request Body   │  │  - Validation Rules    │
│         │  │ {              │  │  - Extract Variables   │
│         │  │   "name": "..  │  │                         │
│         │  │ }              │  │                         │
│         │  └────────────────┘  │                         │
│         │                      │                         │
│         │  [🧪 測試請求]        │                         │
│         │  [📥 回填回應]        │                         │
│         │                      │                         │
├─────────┴──────────────────────┴─────────────────────────┤
│  🆕 請求記錄面板 (可收縮/最小化)      [▼ 展開] [－ 最小化] │
│  ┌─────────────────────────────────────────────────────┐│
│  │ [Network] [Variables] [Console]                     ││
│  │                                                      ││
│  │ POST /api/users → 201 Created (123ms)               ││
│  │ ┌──────────────────────────────────────────────┐    ││
│  │ │ Request Headers:                              │    ││
│  │ │   Authorization: Bearer ***                   │    ││
│  │ │   Content-Type: application/json              │    ││
│  │ │                                               │    ││
│  │ │ Response Body:                                │    ││
│  │ │   { "id": 123, "name": "test", ... }          │    ││
│  │ │                                               │    ││
│  │ │   [📥 回填此回應]  [📋 複製]  [🔄 重試]        │    ││
│  │ └──────────────────────────────────────────────┘    ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 功能一: 請求測試功能

### 功能規格

#### 1.1 測試請求觸發

**使用者操作:**
1. 在步驟編輯區設定 Request 參數
2. 點擊「🧪 測試請求」按鈕
3. 系統發送請求至目標 API
4. 回應顯示在「請求記錄面板」

**技術流程:**

```typescript
// 前端: flow-builder-ui/src/components/RequestTester.tsx
export function RequestTester({ step, flowVariables, baseUrl }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTestRequest() {
    setIsLoading(true);
    setError(null);

    try {
      // 1. 構建完整請求
      const request = {
        method: step.request.method,
        url: `${baseUrl}${step.request.path}`,
        headers: step.request.headers || {},
        body: step.request.body,
        params: step.request.params,
        query: step.request.query,
      };

      // 2. 發送到後端代理
      const response = await proxyAPI.sendRequest({
        ...request,
        variables: flowVariables,
      });

      // 3. 儲存到請求記錄
      requestHistoryStore.addRecord({
        id: generateId(),
        timestamp: Date.now(),
        request,
        response,
        duration: response.timing,
      });

      // 4. 顯示成功訊息
      toast.success(`請求成功 (${response.status})`);

    } catch (err) {
      setError(err.message);
      toast.error('請求失敗: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button
      onClick={handleTestRequest}
      loading={isLoading}
      disabled={!step.request.method || !step.request.path}
    >
      🧪 測試請求
    </Button>
  );
}
```

#### 1.2 後端代理服務

**目的:** 解決 CORS 跨域問題

```typescript
// 後端: apps/flow-builder-server/src/routes/proxy.ts
import express from 'express';
import axios from 'axios';

const router = express.Router();

interface ProxyRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, any>;
  query?: Record<string, any>;
  variables?: Record<string, any>;
}

router.post('/api/proxy/request', async (req, res) => {
  const request: ProxyRequest = req.body;

  try {
    // 1. 變數解析
    const resolvedRequest = resolveVariables(request, request.variables || {});

    // 2. 構建 Axios 請求
    const startTime = Date.now();
    const response = await axios({
      method: resolvedRequest.method,
      url: resolvedRequest.url,
      headers: resolvedRequest.headers,
      data: resolvedRequest.body,
      params: resolvedRequest.query,
      timeout: 30000, // 30 秒逾時
      validateStatus: () => true, // 允許所有狀態碼
    });
    const duration = Date.now() - startTime;

    // 3. 遮罩敏感資料
    const maskedResponse = maskSensitiveData({
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: response.data,
    });

    // 4. 回傳結果
    res.json({
      success: true,
      response: maskedResponse,
      timing: {
        duration,
        timestamp: Date.now(),
      },
    });

  } catch (error) {
    // 錯誤處理
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: error.code,
        details: error.response?.data,
      },
    });
  }
});

export default router;
```

#### 1.3 變數解析器

```typescript
// apps/flow-builder-server/src/utils/variable-resolver.ts
export function resolveVariables(
  request: ProxyRequest,
  variables: Record<string, any>
): ProxyRequest {
  const resolved = { ...request };

  // 遞迴替換所有 {{variable}} 語法
  function replaceVariables(obj: any): any {
    if (typeof obj === 'string') {
      return obj.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
        const value = variables[varName.trim()];
        if (value === undefined) {
          throw new Error(`變數 '${varName}' 未定義`);
        }
        return String(value);
      });
    }

    if (Array.isArray(obj)) {
      return obj.map(replaceVariables);
    }

    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = replaceVariables(value);
      }
      return result;
    }

    return obj;
  }

  resolved.headers = replaceVariables(resolved.headers);
  resolved.body = replaceVariables(resolved.body);
  resolved.query = replaceVariables(resolved.query);
  resolved.url = replaceVariables(resolved.url);

  return resolved;
}
```

#### 1.4 敏感資料遮罩

```typescript
// apps/flow-builder-server/src/utils/data-masker.ts
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'x-api-key',
  'x-auth-token',
];

const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'accessToken',
  'refreshToken',
];

export function maskSensitiveData(response: any): any {
  const masked = { ...response };

  // 遮罩 Headers
  if (masked.headers) {
    masked.headers = { ...masked.headers };
    for (const key of Object.keys(masked.headers)) {
      if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
        masked.headers[key] = '***';
      }
    }
  }

  // 遮罩 Body
  if (masked.body && typeof masked.body === 'object') {
    masked.body = maskObject(masked.body);
  }

  return masked;
}

function maskObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(maskObject);
  }

  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field))) {
        result[key] = '***';
      } else {
        result[key] = maskObject(value);
      }
    }
    return result;
  }

  return obj;
}
```

---

## 🎨 功能二: 回應回填功能

### 功能規格

#### 2.1 回填模式設計

**三種回填模式:**

| 模式 | 說明 | 適用情境 | 實作複雜度 |
|------|------|---------|-----------|
| **精確模式** | 完整複製回應內容 | 固定資料、單元測試 | 低 |
| **智能模式** | 自動處理動態值與陣列 | 一般 API 測試(推薦) | 中 |
| **結構模式** | 僅驗證 Schema 結構 | 資料內容經常變動 | 高 |

#### 2.2 智能回填演算法

```typescript
// flow-builder-ui/src/utils/response-filler.ts

export interface FillOptions {
  mode: 'exact' | 'smart' | 'schema-only';
  arrayStrategy: 'first' | 'all' | 'schema';
  detectDynamic: boolean;
  maxArrayItems?: number; // 預設 1
}

export class ResponseFiller {
  fill(responseData: any, options: FillOptions): FillResult {
    const startTime = Date.now();
    let result: any;

    switch (options.mode) {
      case 'exact':
        result = responseData;
        break;

      case 'smart':
        result = this.smartFill(responseData, options);
        break;

      case 'schema-only':
        result = this.generateSchemaValidation(responseData);
        break;
    }

    const duration = Date.now() - startTime;

    return {
      data: result,
      metadata: {
        mode: options.mode,
        duration,
        stats: this.collectStats(responseData, result),
      },
    };
  }

  private smartFill(data: any, options: FillOptions): any {
    if (data == null) return data;

    // 處理陣列
    if (Array.isArray(data)) {
      return this.fillArray(data, options);
    }

    // 處理物件
    if (typeof data === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(data)) {
        // 偵測動態值
        if (options.detectDynamic && this.isDynamicField(key, value)) {
          result[key] = this.convertToDynamic(key, value);
        } else {
          result[key] = this.smartFill(value, options);
        }
      }
      return result;
    }

    // 基本型別直接回傳
    return data;
  }

  private fillArray(arr: any[], options: FillOptions): any {
    if (arr.length === 0) {
      return [];
    }

    switch (options.arrayStrategy) {
      case 'first':
        // 只保留第一筆
        return [this.smartFill(arr[0], options)];

      case 'all':
        const maxItems = options.maxArrayItems || arr.length;
        return arr
          .slice(0, maxItems)
          .map(item => this.smartFill(item, options));

      case 'schema':
        // 轉換為 Schema 驗證
        return {
          _schemaValidation: true,
          _arrayItemSchema: this.extractSchema(arr[0]),
          _minItems: 0,
          _maxItems: 999,
          _example: this.smartFill(arr[0], options),
        };

      default:
        return arr;
    }
  }

  private isDynamicField(key: string, value: any): boolean {
    // 檢查欄位名稱模式
    const dynamicPatterns = [
      /^id$/i,
      /^.*[_-]id$/i,
      /^uuid$/i,
      /^.*[_-]?uuid$/i,
      /^created[_-]?at$/i,
      /^updated[_-]?at$/i,
      /^timestamp$/i,
      /^.*[_-]?time$/i,
      /^token$/i,
      /^.*[_-]?token$/i,
      /^session$/i,
      /^.*[_-]?key$/i,
    ];

    if (dynamicPatterns.some(pattern => pattern.test(key))) {
      return true;
    }

    // 檢查值的格式
    if (typeof value === 'string') {
      // ISO 8601 時間格式
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        return true;
      }

      // UUID v4 格式
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        return true;
      }

      // JWT Token
      if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(value)) {
        return true;
      }
    }

    return false;
  }

  private convertToDynamic(key: string, value: any): any {
    const keyLower = key.toLowerCase();

    // ID 欄位
    if (keyLower === 'id' || keyLower.endsWith('_id') || keyLower.endsWith('-id')) {
      return {
        _dynamic: true,
        _type: 'id',
        _validation: { rule: 'notNull' },
        _originalValue: value,
        _note: '動態 ID,每次執行可能不同',
      };
    }

    // 時間戳記
    if (keyLower.includes('at') || keyLower.includes('time')) {
      return {
        _dynamic: true,
        _type: 'timestamp',
        _validation: {
          rule: 'regex',
          pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}',
        },
        _originalValue: value,
        _note: 'ISO 8601 時間格式',
      };
    }

    // UUID
    if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return {
        _dynamic: true,
        _type: 'uuid',
        _validation: {
          rule: 'regex',
          pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        },
        _originalValue: value,
        _note: 'UUID v4 格式',
      };
    }

    // Token
    if (keyLower.includes('token')) {
      return {
        _dynamic: true,
        _type: 'token',
        _validation: { rule: 'notNull' },
        _originalValue: '***',
        _note: '敏感資料已遮罩',
      };
    }

    // 預設: 標記為動態但保留原值
    return {
      _dynamic: true,
      _type: 'unknown',
      _originalValue: value,
      _note: '偵測為動態值,請確認',
    };
  }

  private extractSchema(data: any): any {
    if (data == null) {
      return { type: 'null' };
    }

    if (Array.isArray(data)) {
      return {
        type: 'array',
        items: data.length > 0 ? this.extractSchema(data[0]) : { type: 'any' },
      };
    }

    if (typeof data === 'object') {
      const properties: any = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(data)) {
        properties[key] = this.extractSchema(value);
        if (value != null) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required,
      };
    }

    // 基本型別
    const typeMap: any = {
      string: 'string',
      number: 'number',
      boolean: 'boolean',
    };

    return { type: typeMap[typeof data] || 'any' };
  }

  private collectStats(original: any, processed: any): FillStats {
    return {
      totalFields: this.countFields(original),
      dynamicFields: this.countDynamicFields(processed),
      arrays: this.countArrays(original),
      simplifiedArrays: this.countSimplifiedArrays(processed),
    };
  }

  private countFields(obj: any): number {
    if (obj == null || typeof obj !== 'object') return 0;

    let count = 0;
    for (const value of Object.values(obj)) {
      count += 1;
      if (typeof value === 'object') {
        count += this.countFields(value);
      }
    }
    return count;
  }

  private countDynamicFields(obj: any): number {
    if (obj == null || typeof obj !== 'object') return 0;

    let count = 0;
    for (const value of Object.values(obj)) {
      if (value && typeof value === 'object' && '_dynamic' in value) {
        count += 1;
      } else if (typeof value === 'object') {
        count += this.countDynamicFields(value);
      }
    }
    return count;
  }

  private countArrays(obj: any): number {
    if (obj == null || typeof obj !== 'object') return 0;

    let count = 0;
    if (Array.isArray(obj)) {
      count += 1;
    }

    for (const value of Object.values(obj)) {
      if (typeof value === 'object') {
        count += this.countArrays(value);
      }
    }
    return count;
  }

  private countSimplifiedArrays(obj: any): number {
    if (obj == null || typeof obj !== 'object') return 0;

    let count = 0;
    if (obj._schemaValidation) {
      count += 1;
    }

    for (const value of Object.values(obj)) {
      if (typeof value === 'object') {
        count += this.countSimplifiedArrays(value);
      }
    }
    return count;
  }
}

export interface FillResult {
  data: any;
  metadata: {
    mode: string;
    duration: number;
    stats: FillStats;
  };
}

export interface FillStats {
  totalFields: number;
  dynamicFields: number;
  arrays: number;
  simplifiedArrays: number;
}
```

#### 2.3 UI 互動設計

```tsx
// flow-builder-ui/src/components/ResponseFillButton.tsx
export function ResponseFillButton({ responseData, onFill }) {
  const [showModal, setShowModal] = useState(false);
  const [options, setOptions] = useState<FillOptions>({
    mode: 'smart',
    arrayStrategy: 'first',
    detectDynamic: true,
    maxArrayItems: 1,
  });
  const [preview, setPreview] = useState<FillResult | null>(null);

  function handleOpenModal() {
    // 產生預覽
    const filler = new ResponseFiller();
    const result = filler.fill(responseData, options);
    setPreview(result);
    setShowModal(true);
  }

  function handleApplyFill() {
    if (preview) {
      onFill(preview.data, preview.metadata);
      setShowModal(false);
    }
  }

  return (
    <>
      <Button onClick={handleOpenModal} disabled={!responseData}>
        📥 回填回應
      </Button>

      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <ModalHeader>
          <h2>回應回填設定</h2>
        </ModalHeader>

        <ModalBody>
          {/* 模式選擇 */}
          <FormSection>
            <Label>回填模式</Label>
            <RadioGroup value={options.mode} onChange={(mode) => {
              setOptions({ ...options, mode });
              // 重新產生預覽
              const filler = new ResponseFiller();
              const result = filler.fill(responseData, { ...options, mode });
              setPreview(result);
            }}>
              <Radio value="exact">
                <strong>🎯 精確模式</strong>
                <p className="text-sm text-gray-600">
                  完整複製回應內容,不做任何處理
                </p>
              </Radio>

              <Radio value="smart">
                <strong>🧠 智能模式 (推薦)</strong>
                <p className="text-sm text-gray-600">
                  自動偵測動態值、簡化陣列結構
                </p>
              </Radio>

              <Radio value="schema-only">
                <strong>📋 結構模式</strong>
                <p className="text-sm text-gray-600">
                  僅驗證資料結構,不驗證具體值
                </p>
              </Radio>
            </RadioGroup>
          </FormSection>

          {/* 智能模式選項 */}
          {options.mode === 'smart' && (
            <>
              <FormSection>
                <Label>陣列處理策略</Label>
                <Select
                  value={options.arrayStrategy}
                  onChange={(e) => {
                    const arrayStrategy = e.target.value as any;
                    setOptions({ ...options, arrayStrategy });
                    const filler = new ResponseFiller();
                    const result = filler.fill(responseData, { ...options, arrayStrategy });
                    setPreview(result);
                  }}
                >
                  <option value="first">僅保留第一筆元素</option>
                  <option value="all">保留所有元素</option>
                  <option value="schema">轉為 Schema 驗證</option>
                </Select>
              </FormSection>

              <FormSection>
                <Checkbox
                  checked={options.detectDynamic}
                  onChange={(checked) => {
                    setOptions({ ...options, detectDynamic: checked });
                    const filler = new ResponseFiller();
                    const result = filler.fill(responseData, { ...options, detectDynamic: checked });
                    setPreview(result);
                  }}
                >
                  自動偵測動態值 (id, timestamp, uuid 等)
                </Checkbox>
              </FormSection>
            </>
          )}

          {/* 預覽 */}
          {preview && (
            <FormSection>
              <Label>預覽結果</Label>
              <div className="bg-gray-50 rounded p-4">
                <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                  <InfoIcon />
                  <span>
                    偵測到 {preview.metadata.stats.dynamicFields} 個動態欄位,
                    {preview.metadata.stats.simplifiedArrays} 個陣列已簡化
                  </span>
                </div>

                <CodeEditor
                  value={JSON.stringify(preview.data, null, 2)}
                  language="json"
                  readOnly
                  maxHeight="300px"
                />
              </div>
            </FormSection>
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            取消
          </Button>
          <Button variant="primary" onClick={handleApplyFill}>
            確認回填
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
```

---

## 📊 功能三: 請求記錄面板

### UI 設計

```tsx
// flow-builder-ui/src/components/RequestHistoryPanel.tsx
export function RequestHistoryPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'network' | 'variables' | 'console'>('network');
  const requestHistory = useRequestHistoryStore((state) => state.records);

  if (isMinimized) {
    return (
      <div className="fixed bottom-0 left-0 right-0 h-10 bg-gray-800 text-white flex items-center justify-between px-4">
        <span className="text-sm">
          📊 請求記錄 ({requestHistory.length})
        </span>
        <button onClick={() => setIsMinimized(false)}>
          ⬆️ 展開
        </button>
      </div>
    );
  }

  return (
    <div className={`border-t border-gray-200 bg-white transition-all ${
      isCollapsed ? 'h-12' : 'h-96'
    }`}>
      {/* Header */}
      <div className="h-12 border-b border-gray-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold">請求記錄</h3>
          <span className="text-sm text-gray-500">
            {requestHistory.length} 筆記錄
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => requestHistoryStore.clear()}>
            🗑️ 清除
          </button>
          <button onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? '▼ 展開' : '▲ 收合'}
          </button>
          <button onClick={() => setIsMinimized(true)}>
            － 最小化
          </button>
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="h-[calc(100%-3rem)]">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <TabButton
              active={activeTab === 'network'}
              onClick={() => setActiveTab('network')}
            >
              🌐 Network
            </TabButton>
            <TabButton
              active={activeTab === 'variables'}
              onClick={() => setActiveTab('variables')}
            >
              📦 Variables
            </TabButton>
            <TabButton
              active={activeTab === 'console'}
              onClick={() => setActiveTab('console')}
            >
              📝 Console
            </TabButton>
          </div>

          {/* Tab Content */}
          <div className="h-[calc(100%-3rem)] overflow-auto">
            {activeTab === 'network' && (
              <NetworkTab records={requestHistory} />
            )}
            {activeTab === 'variables' && (
              <VariablesTab />
            )}
            {activeTab === 'console' && (
              <ConsoleTab />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NetworkTab({ records }) {
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);

  return (
    <div className="flex h-full">
      {/* 請求列表 */}
      <div className="w-1/3 border-r border-gray-200 overflow-auto">
        {records.map((record) => (
          <RequestCard
            key={record.id}
            record={record}
            selected={selectedRecord === record.id}
            onClick={() => setSelectedRecord(record.id)}
          />
        ))}
      </div>

      {/* 請求詳情 */}
      <div className="w-2/3 p-4 overflow-auto">
        {selectedRecord && (
          <RequestDetails
            record={records.find(r => r.id === selectedRecord)}
          />
        )}
      </div>
    </div>
  );
}

function RequestCard({ record, selected, onClick }) {
  const statusColor = getStatusColor(record.response.status);

  return (
    <div
      className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
        selected ? 'bg-blue-50' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-sm font-semibold">
          {record.request.method}
        </span>
        <span className={`text-sm font-semibold ${statusColor}`}>
          {record.response.status}
        </span>
      </div>

      <div className="text-sm text-gray-600 truncate">
        {record.request.url}
      </div>

      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
        <span>{record.duration}ms</span>
        <span>•</span>
        <span>{formatTimestamp(record.timestamp)}</span>
      </div>
    </div>
  );
}

function RequestDetails({ record }) {
  const [activeSection, setActiveSection] = useState<'headers' | 'body'>('body');

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold">
          {record.request.method} {record.request.url}
        </h4>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => copyToClipboard(record)}>
            📋 複製
          </Button>
          <Button size="sm" onClick={() => retryRequest(record)}>
            🔄 重試
          </Button>
          <ResponseFillButton
            responseData={record.response.body}
            onFill={(data, metadata) => {
              // 回填到編輯器
              console.log('Fill response:', data, metadata);
            }}
          />
        </div>
      </div>

      {/* Request */}
      <Section title="Request">
        <Tabs>
          <Tab
            active={activeSection === 'headers'}
            onClick={() => setActiveSection('headers')}
          >
            Headers
          </Tab>
          <Tab
            active={activeSection === 'body'}
            onClick={() => setActiveSection('body')}
          >
            Body
          </Tab>
        </Tabs>

        {activeSection === 'headers' && (
          <CodeEditor
            value={JSON.stringify(record.request.headers, null, 2)}
            language="json"
            readOnly
          />
        )}

        {activeSection === 'body' && (
          <CodeEditor
            value={JSON.stringify(record.request.body, null, 2)}
            language="json"
            readOnly
          />
        )}
      </Section>

      {/* Response */}
      <Section title="Response">
        <div className="mb-2 text-sm">
          <span className={getStatusColor(record.response.status)}>
            {record.response.status} {record.response.statusText}
          </span>
          <span className="ml-4 text-gray-500">
            {record.duration}ms
          </span>
        </div>

        <CodeEditor
          value={JSON.stringify(record.response.body, null, 2)}
          language="json"
          readOnly
        />
      </Section>
    </div>
  );
}
```

---

## ⚠️ 風險評估

### 高風險項目

| 風險項目 | 風險等級 | 發生機率 | 影響範圍 | 緩解措施 |
|---------|---------|---------|---------|---------|
| CORS 跨域限制 | 🔴 高 | 90% | 所有請求功能 | **必須實作後端代理服務** |
| 敏感資料外洩 | 🔴 高 | 60% | 安全性 | 實作資料遮罩機制 |
| 變數解析失敗 | 🟡 中 | 40% | 請求執行 | 完善錯誤處理與提示 |
| 大型回應效能 | 🟡 中 | 30% | UI 流暢度 | 限制回應大小與記錄筆數 |

### 緩解策略

#### CORS 問題解決方案

**實作後端代理服務 (強制要求):**
```
Browser → Flow Builder Server (Proxy) → Target API
        ✅ 同源請求              ✅ 伺服器端請求 (無 CORS)
```

#### 敏感資料保護

1. **自動遮罩機制**
   - Headers: `Authorization`, `Cookie`, `X-API-Key`
   - Body: `password`, `token`, `secret`, `apiKey`

2. **僅記憶體儲存**
   - 請求記錄不寫入 localStorage
   - 關閉分頁自動清除

3. **手動清除功能**
   - 提供「清除記錄」按鈕
   - 敏感操作完成後提示清除

---

## 📅 實作時程規劃

### Phase 1: 基礎功能 (2 週)

**Week 1: 請求測試功能**
- [ ] 後端代理 API 實作
- [ ] 變數解析器
- [ ] 前端請求觸發器
- [ ] 基礎錯誤處理

**Week 2: 請求記錄面板**
- [ ] UI 佈局與收縮功能
- [ ] Network Tab
- [ ] Variables Tab
- [ ] Console Tab

### Phase 2: 智能回填 (2 週)

**Week 3: 回填核心**
- [ ] 精確模式
- [ ] 智能模式(基礎)
- [ ] 動態值偵測
- [ ] 陣列策略(僅第一筆)

**Week 4: 進階功能**
- [ ] 完整陣列策略
- [ ] Schema 模式
- [ ] 回填預覽 UI
- [ ] 統計資訊顯示

### Phase 3: 優化與測試 (1 週)

**Week 5: 整合測試**
- [ ] 端對端測試
- [ ] 效能優化
- [ ] 錯誤處理完善
- [ ] 使用者文件

---

## 🧪 測試策略

### 單元測試

```typescript
// ResponseFiller 測試
describe('ResponseFiller', () => {
  const filler = new ResponseFiller();

  describe('精確模式', () => {
    it('應該完整複製回應', () => {
      const input = { id: 1, name: 'test' };
      const result = filler.fill(input, { mode: 'exact' });
      expect(result.data).toEqual(input);
    });
  });

  describe('智能模式 - 動態值偵測', () => {
    it('應該偵測 ID 欄位', () => {
      const input = { id: 123, userId: 456 };
      const result = filler.fill(input, {
        mode: 'smart',
        detectDynamic: true,
        arrayStrategy: 'first',
      });

      expect(result.data.id._dynamic).toBe(true);
      expect(result.data.id._type).toBe('id');
      expect(result.data.userId._dynamic).toBe(true);
    });

    it('應該偵測 ISO 8601 時間格式', () => {
      const input = {
        createdAt: '2025-01-16T10:30:00Z',
        updated_at: '2025-01-16T11:00:00Z',
      };
      const result = filler.fill(input, {
        mode: 'smart',
        detectDynamic: true,
        arrayStrategy: 'first',
      });

      expect(result.data.createdAt._dynamic).toBe(true);
      expect(result.data.createdAt._type).toBe('timestamp');
    });

    it('應該偵測 UUID', () => {
      const input = { uuid: 'a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789' };
      const result = filler.fill(input, {
        mode: 'smart',
        detectDynamic: true,
        arrayStrategy: 'first',
      });

      expect(result.data.uuid._dynamic).toBe(true);
      expect(result.data.uuid._type).toBe('uuid');
    });
  });

  describe('智能模式 - 陣列處理', () => {
    it('應該只保留第一筆元素', () => {
      const input = {
        users: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
          { id: 3, name: 'Charlie' },
        ],
      };
      const result = filler.fill(input, {
        mode: 'smart',
        detectDynamic: false,
        arrayStrategy: 'first',
      });

      expect(result.data.users.length).toBe(1);
      expect(result.data.users[0].name).toBe('Alice');
    });

    it('應該轉換為 Schema 驗證', () => {
      const input = {
        items: [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
        ],
      };
      const result = filler.fill(input, {
        mode: 'smart',
        detectDynamic: false,
        arrayStrategy: 'schema',
      });

      expect(result.data.items._schemaValidation).toBe(true);
      expect(result.data.items._arrayItemSchema).toBeDefined();
    });
  });

  describe('結構模式', () => {
    it('應該產生 Schema', () => {
      const input = {
        user: {
          id: 1,
          name: 'test',
          tags: ['a', 'b'],
        },
      };
      const result = filler.fill(input, { mode: 'schema-only' });

      expect(result.data._mode).toBe('schema_validation');
      expect(result.data._schema.type).toBe('object');
    });
  });
});
```

### 整合測試

```typescript
// 請求代理測試
describe('Proxy API', () => {
  it('應該成功轉發請求', async () => {
    const response = await request(app)
      .post('/api/proxy/request')
      .send({
        method: 'GET',
        url: 'http://localhost:3000/api/users',
        variables: {},
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('應該解析變數', async () => {
    const response = await request(app)
      .post('/api/proxy/request')
      .send({
        method: 'POST',
        url: 'http://localhost:3000/api/users',
        body: { name: '{{userName}}' },
        variables: { userName: 'testUser' },
      });

    expect(response.status).toBe(200);
    // 驗證請求中的變數已被替換
  });

  it('應該遮罩敏感資料', async () => {
    const response = await request(app)
      .post('/api/proxy/request')
      .send({
        method: 'POST',
        url: 'http://localhost:3000/api/login',
        body: { password: 'secret123' },
        variables: {},
      });

    expect(response.body.response.body.password).toBe('***');
  });
});
```

---

## 📚 使用者文件

### 快速開始

#### 1. 測試請求

```markdown
1. 在步驟編輯區設定 Request 參數
   - Method: POST
   - Path: /api/users
   - Body: { "name": "test" }

2. 點擊「🧪 測試請求」按鈕

3. 查看請求記錄面板中的回應
```

#### 2. 回填回應

```markdown
1. 在請求記錄中找到目標請求

2. 點擊「📥 回填回應」按鈕

3. 選擇回填模式:
   - 精確模式: 完整複製
   - 智能模式: 自動處理動態值(推薦)
   - 結構模式: 僅驗證 Schema

4. 預覽回填結果

5. 點擊「確認回填」
```

### 進階使用

#### 動態值偵測規則

系統會自動偵測以下動態值:

| 類型 | 偵測規則 | 轉換結果 |
|------|---------|---------|
| ID | 欄位名稱為 `id`, `*_id`, `*-id` | `{ _validation: { rule: 'notNull' } }` |
| 時間戳記 | 欄位名稱包含 `at`, `time` 或符合 ISO 8601 格式 | `{ _validation: { rule: 'regex', pattern: '...' } }` |
| UUID | 符合 UUID v4 格式 | `{ _validation: { rule: 'regex', pattern: '...' } }` |
| Token | 欄位名稱包含 `token`, `key`, `secret` | 自動遮罩為 `***` |

#### 陣列處理策略

**僅保留第一筆 (推薦):**
```json
// 原始回應
{ "users": [{"id": 1}, {"id": 2}, {"id": 3}] }

// 回填結果
{ "users": [{"id": 1}] }
```

**保留全部:**
```json
// 完整複製所有元素
{ "users": [{"id": 1}, {"id": 2}, {"id": 3}] }
```

**轉為 Schema:**
```json
{
  "users": {
    "_schemaValidation": true,
    "_arrayItemSchema": { "type": "object", "properties": {...} },
    "_minItems": 0,
    "_example": {"id": 1}
  }
}
```

---

## 🎯 成功指標

### 功能性指標

- ✅ 請求測試成功率 > 95%
- ✅ 變數解析準確率 = 100%
- ✅ 動態值偵測準確率 > 90%
- ✅ 回填功能可用性 > 98%

### 效能指標

- ⚡ 請求代理延遲 < 100ms (不含目標 API 時間)
- ⚡ 回填處理時間 < 500ms (1MB JSON)
- ⚡ UI 渲染時間 < 50ms
- ⚡ 請求記錄上限: 50 筆

### 使用者體驗指標

- 😊 減少測試撰寫時間 > 50%
- 😊 降低驗證規則錯誤率 > 70%
- 😊 使用者滿意度 > 4.5/5

---

## 📝 附錄

### A. 技術棧

**前端:**
- React 18
- TypeScript 5.4
- Zustand (狀態管理)
- TanStack Query (API 呼叫)
- Monaco Editor (程式碼編輯器)

**後端:**
- Node.js 20
- Express 4
- Axios 1.6
- TypeScript 5.4

### B. API 規格

#### POST /api/proxy/request

**Request:**
```json
{
  "method": "POST",
  "url": "http://localhost:3000/api/users",
  "headers": {
    "Authorization": "Bearer {{token}}"
  },
  "body": {
    "name": "{{userName}}"
  },
  "variables": {
    "token": "abc123",
    "userName": "testUser"
  }
}
```

**Response (成功):**
```json
{
  "success": true,
  "response": {
    "status": 201,
    "statusText": "Created",
    "headers": {...},
    "body": {...}
  },
  "timing": {
    "duration": 123,
    "timestamp": 1705401000000
  }
}
```

**Response (失敗):**
```json
{
  "success": false,
  "error": {
    "message": "Network Error",
    "code": "ECONNREFUSED",
    "details": {...}
  }
}
```

### C. 資料結構

```typescript
// 請求記錄
interface RequestRecord {
  id: string;
  timestamp: number;
  request: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: any;
  };
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: any;
  };
  duration: number;
}

// 回填選項
interface FillOptions {
  mode: 'exact' | 'smart' | 'schema-only';
  arrayStrategy: 'first' | 'all' | 'schema';
  detectDynamic: boolean;
  maxArrayItems?: number;
}

// 回填結果
interface FillResult {
  data: any;
  metadata: {
    mode: string;
    duration: number;
    stats: FillStats;
  };
}

interface FillStats {
  totalFields: number;
  dynamicFields: number;
  arrays: number;
  simplifiedArrays: number;
}
```

---

## ✅ 檢查清單

### Phase 1 實作檢查清單

**後端代理服務:**
- [ ] 建立 Express 路由 `/api/proxy/request`
- [ ] 實作變數解析器
- [ ] 實作敏感資料遮罩
- [ ] 錯誤處理與日誌
- [ ] 單元測試

**前端請求觸發:**
- [ ] 建立 `RequestTester` 元件
- [ ] 整合到步驟編輯區
- [ ] 錯誤顯示與提示
- [ ] Loading 狀態處理

**請求記錄面板:**
- [ ] UI 佈局實作
- [ ] 收縮/最小化功能
- [ ] Network Tab
- [ ] Variables Tab
- [ ] Console Tab
- [ ] 清除記錄功能

### Phase 2 實作檢查清單

**回填核心:**
- [ ] 實作 `ResponseFiller` 類別
- [ ] 精確模式
- [ ] 智能模式
- [ ] Schema 模式
- [ ] 動態值偵測邏輯
- [ ] 陣列處理策略

**UI 互動:**
- [ ] 回填按鈕元件
- [ ] 模式選擇對話框
- [ ] 預覽功能
- [ ] 統計資訊顯示
- [ ] 還原功能

### Phase 3 實作檢查清單

**測試:**
- [ ] 單元測試 (覆蓋率 > 80%)
- [ ] 整合測試
- [ ] 端對端測試
- [ ] 效能測試

**文件:**
- [ ] 使用者指南
- [ ] API 規格文件
- [ ] 範例與教學
- [ ] FAQ

**優化:**
- [ ] 效能優化
- [ ] 錯誤訊息改善
- [ ] 可訪問性 (a11y)
- [ ] 多語系支援

---

**文件版本:** v1.0.0
**最後更新:** 2025-01-16
**狀態:** 📝 規劃階段
