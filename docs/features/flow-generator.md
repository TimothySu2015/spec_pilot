# Flow Generator（對話式流程產生器）

## 模組資訊
- **模組名稱**: `@specpilot/flow-generator`
- **版本**: v0.2.0
- **模組路徑**: `packages/flow-generator/`
- **主要維護者**: SpecPilot Team

---

## 概述

Flow Generator 是 SpecPilot 的對話式測試流程產生引擎，透過自然語言描述自動產生符合規範的測試 Flow YAML。支援多輪對話,可逐步完善測試細節,非常適合與 AI Agent 協作使用。

### 設計目標

1. **簡化測試撰寫** - 使用自然語言描述即可產生測試流程
2. **智能推薦** - 根據 OpenAPI 規格推薦最適合的端點與參數
3. **對話式體驗** - 支援多輪對話,逐步完善測試細節
4. **AI 優先** - 專為與 AI Agent 協作設計

---

## 核心元件

### 1. NLPFlowParser（自然語言解析器）

**職責**: 解析使用者的自然語言描述,提取測試意圖與參數

**主要方法**:
```typescript
class NLPFlowParser {
  constructor(config: NLPParserConfig);

  // 解析使用者輸入
  parse(input: string, context?: ConversationContext): Promise<ParsedIntent>;
}
```

**解析結果**:
```typescript
interface ParsedIntent {
  action: 'create' | 'read' | 'update' | 'delete' | 'list' | 'search' | 'unknown';
  resource: string;        // 資源名稱（如 'user', 'product'）
  entities: {
    parameters?: Record<string, any>;
    filters?: Record<string, any>;
    keywords?: string[];
  };
  confidence: number;      // 信心分數 0-1
}
```

**範例**:
```typescript
const parser = new NLPFlowParser({ spec: openApiDoc });

// 輸入: "我想測試建立新使用者的功能"
const intent = await parser.parse("我想測試建立新使用者的功能");

// 輸出:
{
  action: 'create',
  resource: 'user',
  entities: {
    keywords: ['建立', '新', '使用者']
  },
  confidence: 0.85
}
```

---

### 2. IntentRecognizer（意圖識別器）

**職責**: 根據解析的意圖推薦最符合的 API 端點

**主要方法**:
```typescript
class IntentRecognizer {
  constructor(config: IntentRecognizerConfig);

  // 推薦相關端點
  recommendEndpoints(intent: ParsedIntent): EndpointMatch[];
}
```

**推薦結果**:
```typescript
interface EndpointMatch {
  operationId: string;
  method: string;
  path: string;
  summary?: string;
  confidence: number;      // 匹配信心分數
  endpoint: EndpointInfo;  // 完整端點資訊
}
```

**匹配策略**:
1. **HTTP 方法匹配** - 根據 action 推斷方法（create→POST, read→GET 等）
2. **路徑關鍵字匹配** - 路徑中包含 resource 名稱
3. **標籤匹配** - OpenAPI 的 tags 欄位
4. **相似度計算** - summary/description 的文字相似度

**範例**:
```typescript
const recognizer = new IntentRecognizer({
  spec: openApiDoc,
  minConfidence: 0.3,
  maxResults: 5
});

const endpoints = recognizer.recommendEndpoints({
  action: 'create',
  resource: 'user',
  entities: {},
  confidence: 0.85
});

// 輸出:
[
  {
    operationId: 'createUser',
    method: 'POST',
    path: '/api/users',
    summary: '建立新使用者',
    confidence: 0.92,
    endpoint: { ... }
  },
  {
    operationId: 'registerUser',
    method: 'POST',
    path: '/auth/register',
    summary: '使用者註冊',
    confidence: 0.75,
    endpoint: { ... }
  }
]
```

---

### 3. ContextManager（對話上下文管理器）

**職責**: 管理多輪對話的上下文狀態

**主要方法**:
```typescript
class ContextManager {
  static getInstance(): ContextManager;

  // 建立新對話
  createContext(config?: ContextManagerConfig): string;

  // 取得對話上下文
  getContext(contextId: string): ConversationContext | null;

  // 更新上下文
  updateContext(contextId: string, updates: Partial<ConversationContext>): void;

  // 新增對話輪次
  addConversationTurn(contextId: string, turn: ConversationTurn): void;
}
```

**上下文結構**:
```typescript
interface ConversationContext {
  contextId: string;
  createdAt: string;
  lastUpdatedAt: string;
  currentFlow?: FlowDefinition;
  variables: Record<string, any>;
  conversationHistory: ConversationTurn[];
}

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  parsedIntent?: ParsedIntent;
}
```

**使用場景**:
```typescript
const contextManager = ContextManager.getInstance();

// 建立對話
const contextId = contextManager.createContext();

// 第一輪對話
contextManager.addConversationTurn(contextId, {
  role: 'user',
  content: '建立使用者測試',
  timestamp: new Date().toISOString(),
  parsedIntent: { ... }
});

// 更新上下文
contextManager.updateContext(contextId, {
  currentFlow: generatedFlow
});

// 第二輪對話（可利用之前的上下文）
const context = contextManager.getContext(contextId);
```

---

### 4. FlowBuilder（流程建構器）

**職責**: 建構符合 SpecPilot 規範的 Flow 定義

**主要方法**:
```typescript
class FlowBuilder {
  // 設定 Flow 名稱與描述
  setName(name: string): this;
  setDescription(description: string): this;

  // 新增測試步驟
  addStep(stepConfig: FlowStepConfig): this;

  // 設定全域配置
  setGlobals(globals: FlowDefinition['globals']): this;

  // 建構最終 Flow
  build(): FlowDefinition;

  // 重置建構器
  reset(): this;
}
```

**步驟配置**:
```typescript
interface FlowStepConfig {
  name?: string;
  description?: string;
  operationId?: string;
  method?: string;
  path: string;
  expectedStatusCode?: number;
  parameters?: {
    body?: any;
    query?: Record<string, any>;
    headers?: Record<string, string>;
  };
  extractVariables?: Record<string, string>;
  validations?: Array<{
    field: string;
    rule: string;
    value?: any;
  }>;
}
```

**使用範例**:
```typescript
const builder = new FlowBuilder();

const flow = builder
  .setName('使用者 CRUD 測試')
  .setDescription('測試使用者的建立、讀取、更新、刪除操作')
  .addStep({
    name: '建立使用者',
    method: 'POST',
    path: '/api/users',
    parameters: {
      body: {
        name: 'Test User',
        email: 'test@example.com'
      }
    },
    expectedStatusCode: 201,
    extractVariables: {
      userId: 'id'
    }
  })
  .addStep({
    name: '讀取使用者',
    method: 'GET',
    path: '/api/users/{{userId}}',
    expectedStatusCode: 200
  })
  .build();

// 產生的 Flow:
// name: 使用者 CRUD 測試
// steps:
//   - name: 建立使用者
//     request:
//       method: POST
//       path: /api/users
//       body: {...}
//     capture:
//       - variableName: userId
//         path: id
//     expect:
//       statusCode: 201
//   - name: 讀取使用者
//     request:
//       method: GET
//       path: /api/users/{{userId}}
//     expect:
//       statusCode: 200
```

---

### 5. SuggestionEngine（建議引擎）

**職責**: 根據 OpenAPI 規格提供智能建議

**主要方法**:
```typescript
class SuggestionEngine {
  // 取得參數建議
  getSuggestions(
    currentStep: Partial<FlowStep>,
    endpointInfo: EndpointInfo
  ): Suggestion[];
}
```

**建議類型**:
```typescript
interface Suggestion {
  type: 'missing_parameter' | 'optional_parameter' | 'validation_rule' |
        'status_code' | 'variable_extraction' | 'info';
  message: string;
  field?: string;
  suggestedValue?: any;
}
```

**建議範例**:
```typescript
const engine = new SuggestionEngine();

const suggestions = engine.getSuggestions(
  {
    request: {
      method: 'POST',
      path: '/api/users',
      body: {
        name: 'Test'
      }
    }
  },
  {
    operationId: 'createUser',
    method: 'POST',
    path: '/api/users',
    requestBody: {
      required: true,
      schema: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          age: { type: 'number' }
        }
      }
    },
    responses: {
      201: { ... }
    }
  }
);

// 輸出建議:
[
  {
    type: 'missing_parameter',
    message: '缺少必要參數: email',
    field: 'body.email',
    suggestedValue: 'test@example.com'
  },
  {
    type: 'optional_parameter',
    message: '可選參數: age',
    field: 'body.age',
    suggestedValue: 25
  },
  {
    type: 'status_code',
    message: '建議使用狀態碼: 201 Created',
    suggestedValue: 201
  },
  {
    type: 'variable_extraction',
    message: '建議提取變數: id',
    field: 'capture',
    suggestedValue: { variableName: 'userId', path: 'id' }
  }
]
```

---

## 完整使用範例

### 範例 1: 基本流程產生

```typescript
import {
  NLPFlowParser,
  IntentRecognizer,
  FlowBuilder,
  ContextManager
} from '@specpilot/flow-generator';
import { loadSpec } from '@specpilot/spec-loader';

async function generateFlowFromDescription() {
  // 1. 載入 OpenAPI 規格
  const spec = await loadSpec({ filePath: 'specs/api.yaml' });

  // 2. 建立對話上下文
  const contextManager = ContextManager.getInstance();
  const contextId = contextManager.createContext();

  // 3. 解析使用者描述
  const parser = new NLPFlowParser({ spec: spec.document });
  const intent = await parser.parse(
    "我想測試建立新產品的功能",
    contextManager.getContext(contextId)
  );

  // 4. 推薦端點
  const recognizer = new IntentRecognizer({
    spec: spec.document,
    minConfidence: 0.3
  });
  const endpoints = recognizer.recommendEndpoints(intent);

  if (endpoints.length === 0) {
    console.log('找不到相關端點');
    return;
  }

  // 5. 使用最佳匹配建構 Flow
  const bestMatch = endpoints[0];
  const builder = new FlowBuilder();

  builder
    .setName('產品建立測試')
    .addStep({
      operationId: bestMatch.operationId,
      method: bestMatch.method,
      path: bestMatch.path,
      expectedStatusCode: 201
    });

  // 6. 建構並輸出 Flow
  const flow = builder.build();
  console.log(flow);

  // 7. 更新上下文
  contextManager.updateContext(contextId, {
    currentFlow: flow
  });
}
```

### 範例 2: 多輪對話建立完整 CRUD 測試

```typescript
async function buildCRUDFlowInteractively() {
  const spec = await loadSpec({ filePath: 'specs/api.yaml' });
  const contextManager = ContextManager.getInstance();
  const contextId = contextManager.createContext();
  const builder = new FlowBuilder();

  builder.setName('使用者 CRUD 完整測試');

  // 第一輪：建立
  const createIntent = await parseUserInput(
    "建立新使用者",
    spec,
    contextId
  );
  addStepFromIntent(builder, createIntent, spec);

  // 第二輪：讀取（利用前一步的 userId）
  const readIntent = await parseUserInput(
    "讀取剛建立的使用者",
    spec,
    contextId
  );
  addStepFromIntent(builder, readIntent, spec, {
    pathVariables: { id: '{{userId}}' }
  });

  // 第三輪：更新
  const updateIntent = await parseUserInput(
    "更新使用者資料",
    spec,
    contextId
  );
  addStepFromIntent(builder, updateIntent, spec, {
    pathVariables: { id: '{{userId}}' }
  });

  // 第四輪：刪除
  const deleteIntent = await parseUserInput(
    "刪除使用者",
    spec,
    contextId
  );
  addStepFromIntent(builder, deleteIntent, spec, {
    pathVariables: { id: '{{userId}}' }
  });

  return builder.build();
}
```

---

## MCP 整合

Flow Generator 透過 MCP Server 的 `generateFlow` 工具暴露給 AI Agent:

```typescript
// MCP Server Handler
async function handleGenerateFlow(request: {
  description: string;
  spec?: string;
  specContent?: string;
  contextId?: string;
  autoValidate?: boolean;
}) {
  // 1. 載入規格
  const specDoc = await loadSpec({ content: request.specContent });

  // 2. 取得或建立上下文
  const contextManager = ContextManager.getInstance();
  const contextId = request.contextId || contextManager.createContext();

  // 3. 解析意圖
  const parser = new NLPFlowParser({ spec: specDoc });
  const intent = await parser.parse(
    request.description,
    contextManager.getContext(contextId)
  );

  // 4. 推薦端點
  const recognizer = new IntentRecognizer({ spec: specDoc });
  const endpoints = recognizer.recommendEndpoints(intent);

  // 5. 建構 Flow
  const builder = new FlowBuilder();
  builder.setName('對話式產生的測試流程');
  builder.addStep({
    operationId: endpoints[0].operationId,
    parameters: intent.entities.parameters
  });

  // 6. 產生建議
  const suggestionEngine = new SuggestionEngine();
  const suggestions = suggestionEngine.getSuggestions(
    builder.getCurrentStep(),
    endpoints[0].endpoint
  );

  // 7. 驗證（如果啟用）
  if (request.autoValidate) {
    const validator = new FlowValidator({ spec: specDoc });
    const validationResult = validator.validate(builder.build());
    // ... 處理驗證結果
  }

  return {
    flowYaml: stringify(builder.build()),
    contextId,
    suggestions,
    confidence: endpoints[0].confidence
  };
}
```

---

## 配置選項

### NLPParserConfig
```typescript
interface NLPParserConfig {
  spec: OpenAPIDocument;
  language?: 'zh-TW' | 'en';  // 預設: 'zh-TW'
}
```

### IntentRecognizerConfig
```typescript
interface IntentRecognizerConfig {
  spec: OpenAPIDocument;
  minConfidence?: number;      // 預設: 0.3
  maxResults?: number;         // 預設: 5
}
```

### ContextManagerConfig
```typescript
interface ContextManagerConfig {
  ttl?: number;               // 上下文存活時間（毫秒），預設: 1 小時
  maxHistoryLength?: number;  // 保留的對話輪次，預設: 50
}
```

---

## 測試

### 單元測試範例

```typescript
describe('FlowBuilder', () => {
  it('should build a valid flow', () => {
    const builder = new FlowBuilder();

    const flow = builder
      .setName('Test Flow')
      .addStep({
        path: '/api/test',
        method: 'GET'
      })
      .build();

    expect(flow.name).toBe('Test Flow');
    expect(flow.steps).toHaveLength(1);
    expect(flow.steps[0].request.path).toBe('/api/test');
  });

  it('should throw error when building without steps', () => {
    const builder = new FlowBuilder();
    builder.setName('Empty Flow');

    expect(() => builder.build()).toThrow('Flow 必須至少包含一個步驟');
  });
});
```

---

## 限制與已知問題

### 當前限制
1. **NLP 能力有限** - 目前使用簡單的關鍵字匹配,尚未整合完整 NLP 模型
2. **語言支援** - 主要支援繁體中文,英文支援較弱
3. **上下文管理** - 記憶體儲存,重啟後遺失

### 規劃改進
1. 整合 OpenAI/Claude API 進行語意理解
2. 支援多語言
3. 持久化上下文儲存（Redis/Database）
4. 更智能的參數推薦

---

## 相關文件

- [總覽](./overview.md)
- [Test Suite Generator](./test-suite-generator.md)
- [Flow Validator](./flow-validator.md)
- [MCP Server 增強功能](./mcp-server-enhancements.md)

---

**最後更新**: 2025-01-16
**模組版本**: v0.2.0
