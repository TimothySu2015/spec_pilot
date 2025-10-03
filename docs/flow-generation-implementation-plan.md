# Flow 產生功能實作計畫

> **專案**: SpecPilot
> **版本**: v0.2.0
> **建立日期**: 2025-10-03
> **負責人**: Development Team

---

## 📋 目錄

1. [功能概述](#功能概述)
2. [核心需求](#核心需求)
3. [架構設計](#架構設計)
4. [實作階段](#實作階段)
5. [技術規格](#技術規格)
6. [測試策略](#測試策略)
7. [風險評估](#風險評估)
8. [時程規劃](#時程規劃)

---

## 功能概述

### 目標

為 SpecPilot 新增兩種 Flow 產生能力，讓使用者可以透過自然語言或 OpenAPI 規格自動產生測試流程：

1. **方案 A - 對話式 Flow 產生器**
   透過自然語言描述測試場景，使用 AI 輔助產生與完善測試流程

2. **方案 B - 自動化測試套件產生器**
   分析 OpenAPI 規格自動產生完整的測試案例集（CRUD、邊界測試、錯誤處理）

### 價值主張

- ⚡ **提升效率**: 減少手動撰寫 YAML 流程的時間成本
- 🎯 **提高覆蓋率**: 自動產生邊界與錯誤測試案例
- 💬 **降低門檻**: 透過自然語言即可定義複雜測試場景
- 🔄 **整合現有架構**: 完全相容現有 Flow 執行引擎

---

## 核心需求

### 方案 A: 對話式 Flow 產生器

#### 功能需求

| 編號 | 需求描述 | 優先級 |
|------|---------|--------|
| A-1  | 接收自然語言描述，解析測試意圖 | P0 |
| A-2  | 根據 OpenAPI 規格推薦可用的 API 端點 | P0 |
| A-3  | 自動識別參數依賴與變數串接需求 | P0 |
| A-4  | 支援多輪對話逐步完善測試細節 | P1 |
| A-5  | 驗證產生的 Flow 符合 Schema 規範 | P0 |
| A-6  | 管理對話上下文與已產生步驟狀態 | P1 |
| A-7  | 提供智能建議（必填欄位、預設值） | P2 |

#### 使用案例

```
使用者: 我想測試使用者登入後取得個人資訊的流程
系統: 好的，我已識別出以下步驟：
      1. 呼叫 POST /auth/login 進行登入
      2. 從回應中提取 token
      3. 使用 token 呼叫 GET /users/me 取得個人資訊

      請提供登入帳號密碼，或使用預設測試帳號？

使用者: 使用帳號 testuser 密碼 test123
系統: 已產生測試流程，是否需要新增驗證條件？
      例如：驗證回應狀態碼、檢查特定欄位等

使用者: 驗證 user.email 欄位不為空
系統: ✅ 已完成！產生的 Flow 包含 2 個步驟與 1 個自訂驗證規則
```

### 方案 B: 自動化測試套件產生器

#### 功能需求

| 編號 | 需求描述 | 優先級 |
|------|---------|--------|
| B-1  | 解析 OpenAPI 規格提取端點、Schema、範例 | P0 |
| B-2  | 產生基本 CRUD 操作的成功測試案例 | P0 |
| B-3  | 產生參數驗證失敗的錯誤測試案例 | P1 |
| B-4  | 產生邊界值測試（最大長度、空值等） | P1 |
| B-5  | 自動識別認證需求並插入登入步驟 | P0 |
| B-6  | 分析資源依賴關係產生流程串接 | P1 |
| B-7  | 使用 OpenAPI examples 作為測試資料 | P2 |
| B-8  | 支援可配置的產生策略（覆蓋度選項） | P2 |

#### 產生範例

從以下 OpenAPI 定義：

```yaml
paths:
  /users:
    post:
      summary: 建立新使用者
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        201:
          description: 建立成功
        400:
          description: 參數錯誤
```

自動產生測試流程：

```yaml
name: User API 自動測試套件
steps:
  # 成功案例
  - id: create_user_success
    name: 建立使用者 - 成功案例
    operationId: createUser
    request:
      body:
        username: "testuser"
        email: "test@example.com"
    expect:
      status: 201

  # 錯誤案例：缺少必填欄位
  - id: create_user_missing_field
    name: 建立使用者 - 缺少 email
    operationId: createUser
    request:
      body:
        username: "testuser"
    expect:
      status: 400

  # 錯誤案例：無效格式
  - id: create_user_invalid_email
    name: 建立使用者 - 無效 email 格式
    operationId: createUser
    request:
      body:
        username: "testuser"
        email: "invalid-email"
    expect:
      status: 400
```

---

## 架構設計

### 系統架構圖

```
┌─────────────────────────────────────────────────────────────┐
│                        MCP Server                            │
│  ┌──────────────────┐  ┌─────────────────────────────┐     │
│  │   generateFlow   │  │  generateTestSuite          │     │
│  │  (方案 A 工具)    │  │  (方案 B 工具)              │     │
│  └────────┬─────────┘  └─────────┬───────────────────┘     │
└───────────┼─────────────────────┼──────────────────────────┘
            │                     │
            ▼                     ▼
┌───────────────────────┐  ┌────────────────────────────┐
│ FlowGenerator         │  │ TestSuiteGenerator         │
│ (新增套件)            │  │ (新增套件)                 │
├───────────────────────┤  ├────────────────────────────┤
│ • NLPFlowParser       │  │ • SpecAnalyzer             │
│ • IntentRecognizer    │  │ • CRUDGenerator            │
│ • ContextManager      │  │ • EdgeCaseGenerator        │
│ • FlowBuilder         │  │ • DependencyResolver       │
└───────┬───────────────┘  └─────────┬──────────────────┘
        │                            │
        └─────────────┬──────────────┘
                      ▼
        ┌─────────────────────────┐
        │   FlowValidator         │
        │   (Schema 驗證)         │
        └─────────────┬───────────┘
                      │
                      ▼
        ┌─────────────────────────┐
        │   Existing Modules      │
        ├─────────────────────────┤
        │ • spec-loader           │
        │ • flow-parser           │
        │ • schemas (驗證)        │
        │ • core-flow (執行)      │
        └─────────────────────────┘
```

### 新增套件結構

```
packages/
├── flow-generator/              # 方案 A: 對話式產生器
│   ├── src/
│   │   ├── nlp-parser.ts       # 自然語言解析
│   │   ├── intent-recognizer.ts # 意圖識別
│   │   ├── context-manager.ts  # 對話上下文管理
│   │   ├── flow-builder.ts     # Flow YAML 建構器
│   │   ├── suggestion-engine.ts # 智能建議引擎
│   │   └── types.ts
│   └── __tests__/
│
├── test-suite-generator/        # 方案 B: 自動化產生器
│   ├── src/
│   │   ├── spec-analyzer.ts    # OpenAPI 規格分析
│   │   ├── crud-generator.ts   # CRUD 測試產生
│   │   ├── edge-case-generator.ts # 邊界測試產生
│   │   ├── error-case-generator.ts # 錯誤測試產生
│   │   ├── dependency-resolver.ts # 依賴分析
│   │   ├── data-synthesizer.ts # 測試資料合成
│   │   └── types.ts
│   └── __tests__/
│
└── flow-validator/              # 共用驗證模組
    ├── src/
    │   ├── schema-validator.ts  # Flow Schema 驗證
    │   ├── semantic-validator.ts # 語意驗證
    │   └── types.ts
    └── __tests__/
```

---

## 實作階段

### 階段一: 基礎建設 (Week 1-2)

#### 任務清單

- [ ] **Task 1.1**: 建立 `packages/flow-generator` 套件骨架
  - 初始化 package.json、tsconfig.json
  - 設定 vitest 測試環境
  - 定義核心型別介面

- [ ] **Task 1.2**: 建立 `packages/test-suite-generator` 套件骨架
  - 初始化專案結構
  - 定義產生策略介面

- [ ] **Task 1.3**: 建立 `packages/flow-validator` 共用驗證模組
  - 實作 Schema 驗證器（使用現有 schemas 套件）
  - 實作語意驗證（檢查 operationId 存在、變數參考有效等）

- [ ] **Task 1.4**: 擴充 MCP Server 工具註冊
  - 新增 `generateFlow` 工具定義
  - 新增 `generateTestSuite` 工具定義
  - 設計輸入 Schema

#### 驗收標準

- ✅ 所有新套件可成功編譯
- ✅ 測試框架正常運作
- ✅ MCP Server 可列出新工具（透過 `claude mcp list` 驗證）

---

### 階段二: 方案 B 實作 (Week 3-4)

> **優先實作方案 B**，因為它不依賴外部 AI 能力，可先建立完整工作流程

#### Task 2.1: OpenAPI 規格分析器

```typescript
// packages/test-suite-generator/src/spec-analyzer.ts

export interface EndpointInfo {
  path: string;
  method: HttpMethod;
  operationId: string;
  summary?: string;
  requestSchema?: JSONSchema;
  responseSchemas: Record<number, JSONSchema>;
  security?: SecurityRequirement[];
  examples?: Record<string, unknown>;
}

export class SpecAnalyzer {
  constructor(private spec: OpenAPIDocument) {}

  /**
   * 提取所有 API 端點資訊
   */
  extractEndpoints(): EndpointInfo[] {
    // 解析 spec.paths，提取必要資訊
  }

  /**
   * 分析端點依賴關係（例如: DELETE /users/{id} 依賴 POST /users）
   */
  analyzeDependencies(): DependencyGraph {
    // 識別路徑參數、回應中的 ID 欄位等
  }

  /**
   * 識別認證需求
   */
  getAuthenticationFlow(): AuthFlowInfo | null {
    // 檢查 security、components.securitySchemes
  }
}
```

#### Task 2.2: CRUD 測試產生器

```typescript
// packages/test-suite-generator/src/crud-generator.ts

export class CRUDGenerator {
  /**
   * 產生基本 CRUD 成功案例
   */
  generateSuccessCases(endpoint: EndpointInfo): FlowStep[] {
    // 根據 HTTP method 產生對應測試
    // POST -> 201, GET -> 200, PUT -> 200, DELETE -> 204
  }

  /**
   * 使用 OpenAPI examples 作為測試資料
   */
  synthesizeTestData(schema: JSONSchema, examples?: unknown): unknown {
    // 優先使用 examples，否則根據 schema 產生假資料
  }
}
```

#### Task 2.3: 錯誤案例產生器

```typescript
// packages/test-suite-generator/src/error-case-generator.ts

export class ErrorCaseGenerator {
  /**
   * 產生必填欄位缺失測試
   */
  generateMissingFieldCases(endpoint: EndpointInfo): FlowStep[] {
    // 遍歷 required 欄位，逐一產生缺失測試
  }

  /**
   * 產生格式驗證錯誤測試
   */
  generateFormatValidationCases(endpoint: EndpointInfo): FlowStep[] {
    // email 格式錯誤、數字範圍超出等
  }

  /**
   * 產生認證錯誤測試
   */
  generateAuthErrorCases(endpoint: EndpointInfo): FlowStep[] {
    // 401 (無 token), 403 (權限不足)
  }
}
```

#### Task 2.4: 依賴解析與流程串接

```typescript
// packages/test-suite-generator/src/dependency-resolver.ts

export class DependencyResolver {
  /**
   * 分析資源依賴，產生串接流程
   * 例如: POST /users -> GET /users/{id} -> DELETE /users/{id}
   */
  resolveExecutionOrder(endpoints: EndpointInfo[]): FlowStep[] {
    // 1. 找到建立資源的端點 (POST)
    // 2. 插入 extract 步驟提取 ID
    // 3. 將 ID 注入後續步驟的路徑參數
  }
}
```

#### Task 2.5: 整合與 MCP 介面

```typescript
// apps/mcp-server/src/handlers/generate-test-suite.ts

async function handleGenerateTestSuite(params: {
  spec: string;
  options?: GenerationOptions;
}): Promise<{ content: Array<{ type: string; text: string }> }> {
  // 1. 載入 OpenAPI 規格
  const specDoc = await loadSpec({ content: params.spec });

  // 2. 分析規格
  const analyzer = new SpecAnalyzer(specDoc);
  const endpoints = analyzer.extractEndpoints();
  const dependencies = analyzer.analyzeDependencies();

  // 3. 產生測試案例
  const generator = new TestSuiteGenerator(endpoints, dependencies);
  const testSuite = generator.generate(params.options);

  // 4. 驗證產生的 Flow
  const validator = new FlowValidator();
  const validationResult = validator.validate(testSuite);

  if (!validationResult.valid) {
    return { content: [{ type: "text", text: `驗證失敗: ${validationResult.errors}` }] };
  }

  // 5. 轉換為 YAML 並回傳
  const yamlContent = stringify(testSuite);
  return {
    content: [{
      type: "text",
      text: `✅ 已產生測試套件！\n\n包含 ${testSuite.steps.length} 個測試案例\n\n${yamlContent}`
    }]
  };
}
```

#### 驗收標準

- ✅ 可從 OpenAPI 規格產生基本 CRUD 測試
- ✅ 可產生至少 3 種錯誤測試案例
- ✅ 產生的 Flow 可通過 Schema 驗證
- ✅ 產生的 Flow 可被 `runFlow` 成功執行
- ✅ 單元測試覆蓋率 ≥ 80%

---

### 階段三: 方案 A 實作 (Week 5-6)

#### Task 3.1: 自然語言解析器

```typescript
// packages/flow-generator/src/nlp-parser.ts

export interface ParsedIntent {
  action: 'create_flow' | 'add_step' | 'modify_step' | 'add_validation';
  entities: {
    endpoint?: string;        // "登入" -> /auth/login
    method?: HttpMethod;      // "取得" -> GET
    parameters?: Record<string, unknown>;
    validations?: ValidationRule[];
  };
  confidence: number;
}

export class NLPFlowParser {
  /**
   * 解析使用者輸入，識別測試意圖
   */
  async parse(userInput: string, context: ConversationContext): Promise<ParsedIntent> {
    // 實作策略:
    // 1. 使用關鍵字比對（登入、查詢、建立、刪除等）
    // 2. 參考 OpenAPI 的 summary/description 進行語意比對
    // 3. 提取實體（帳號、密碼、參數值）
  }
}
```

#### Task 3.2: 意圖識別與端點推薦

```typescript
// packages/flow-generator/src/intent-recognizer.ts

export class IntentRecognizer {
  constructor(private spec: OpenAPIDocument) {}

  /**
   * 根據自然語言推薦最相關的 API 端點
   */
  recommendEndpoints(intent: ParsedIntent): EndpointMatch[] {
    // 比對策略:
    // 1. 關鍵字比對 (summary, description, operationId)
    // 2. HTTP method 比對
    // 3. 路徑相似度計算

    return [
      {
        operationId: 'userLogin',
        confidence: 0.95,
        reason: 'summary 包含「登入」關鍵字'
      }
    ];
  }
}
```

#### Task 3.3: 對話上下文管理

```typescript
// packages/flow-generator/src/context-manager.ts

export interface ConversationContext {
  contextId: string;
  currentFlow: Partial<FlowDefinition>;
  extractedVariables: Record<string, string>;  // 已定義的變數
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}

export class ContextManager {
  private contexts = new Map<string, ConversationContext>();

  /**
   * 建立新對話
   */
  createContext(): string {
    const contextId = generateContextId();
    this.contexts.set(contextId, {
      contextId,
      currentFlow: { steps: [] },
      extractedVariables: {},
      conversationHistory: []
    });
    return contextId;
  }

  /**
   * 更新對話狀態
   */
  updateContext(contextId: string, updates: Partial<ConversationContext>): void {
    const context = this.contexts.get(contextId);
    if (context) {
      Object.assign(context, updates);
    }
  }

  /**
   * 取得當前 Flow 狀態
   */
  getCurrentFlow(contextId: string): Partial<FlowDefinition> | undefined {
    return this.contexts.get(contextId)?.currentFlow;
  }
}
```

#### Task 3.4: Flow 建構器

```typescript
// packages/flow-generator/src/flow-builder.ts

export class FlowBuilder {
  private flow: Partial<FlowDefinition> = { steps: [] };

  /**
   * 新增測試步驟
   */
  addStep(stepConfig: {
    operationId: string;
    parameters?: Record<string, unknown>;
    extractVariables?: Record<string, string>;
    validations?: ValidationRule[];
  }): this {
    const step: FlowStep = {
      id: generateStepId(),
      operationId: stepConfig.operationId,
      request: {
        body: stepConfig.parameters?.body,
        params: stepConfig.parameters?.params,
        query: stepConfig.parameters?.query,
        headers: stepConfig.parameters?.headers
      }
    };

    if (stepConfig.extractVariables) {
      step.extract = stepConfig.extractVariables;
    }

    if (stepConfig.validations) {
      step.validate = stepConfig.validations;
    }

    this.flow.steps?.push(step);
    return this;
  }

  /**
   * 建構最終 Flow 定義
   */
  build(): FlowDefinition {
    if (!this.flow.name) {
      this.flow.name = '自動產生的測試流程';
    }
    return this.flow as FlowDefinition;
  }
}
```

#### Task 3.5: 智能建議引擎

```typescript
// packages/flow-generator/src/suggestion-engine.ts

export class SuggestionEngine {
  /**
   * 根據當前步驟提供智能建議
   */
  getSuggestions(
    currentStep: Partial<FlowStep>,
    endpoint: EndpointInfo
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // 1. 檢查必填欄位
    const missingRequired = this.findMissingRequiredFields(currentStep, endpoint);
    if (missingRequired.length > 0) {
      suggestions.push({
        type: 'missing_required',
        message: `缺少必填欄位: ${missingRequired.join(', ')}`,
        action: 'prompt_for_values'
      });
    }

    // 2. 推薦可用變數
    const availableVars = this.getAvailableVariables(currentStep);
    if (availableVars.length > 0) {
      suggestions.push({
        type: 'variable_suggestion',
        message: `可使用前面步驟提取的變數: ${availableVars.join(', ')}`
      });
    }

    // 3. 推薦驗證條件
    suggestions.push({
      type: 'validation_suggestion',
      message: '建議新增驗證: 檢查回應狀態碼為 200'
    });

    return suggestions;
  }
}
```

#### Task 3.6: 整合 MCP 工具

```typescript
// apps/mcp-server/src/handlers/generate-flow.ts

async function handleGenerateFlow(params: {
  description: string;
  contextId?: string;
  spec: string;
}): Promise<{ content: Array<{ type: string; text: string }> }> {
  // 1. 載入規格
  const specDoc = await loadSpec({ content: params.spec });

  // 2. 取得或建立對話上下文
  const contextManager = ContextManager.getInstance();
  const contextId = params.contextId || contextManager.createContext();

  // 3. 解析使用者意圖
  const parser = new NLPFlowParser(specDoc);
  const intent = await parser.parse(params.description, contextManager.getContext(contextId));

  // 4. 推薦端點
  const recognizer = new IntentRecognizer(specDoc);
  const endpoints = recognizer.recommendEndpoints(intent);

  if (endpoints.length === 0) {
    return {
      content: [{
        type: "text",
        text: "抱歉，無法從描述中識別出相關的 API 端點。請提供更多細節。"
      }]
    };
  }

  // 5. 建構 Flow 步驟
  const builder = new FlowBuilder();
  builder.addStep({
    operationId: endpoints[0].operationId,
    parameters: intent.entities.parameters
  });

  // 6. 提供智能建議
  const suggestionEngine = new SuggestionEngine();
  const suggestions = suggestionEngine.getSuggestions(
    builder.getCurrentStep(),
    endpoints[0]
  );

  // 7. 更新上下文
  contextManager.updateContext(contextId, {
    currentFlow: builder.build(),
    conversationHistory: [
      ...contextManager.getContext(contextId).conversationHistory,
      { role: 'user', content: params.description, timestamp: new Date().toISOString() }
    ]
  });

  // 8. 回傳結果與建議
  const flow = builder.build();
  const yamlContent = stringify(flow);

  return {
    content: [{
      type: "text",
      text: `✅ 已識別出測試步驟！\n\n` +
            `推薦端點: ${endpoints[0].operationId} (信心度: ${endpoints[0].confidence})\n\n` +
            `${yamlContent}\n\n` +
            `💡 建議:\n${suggestions.map(s => `• ${s.message}`).join('\n')}\n\n` +
            `繼續對話請提供 contextId: ${contextId}`
    }]
  };
}
```

#### 驗收標準

- ✅ 可正確識別常見測試意圖（登入、查詢、建立、刪除）
- ✅ 支援多輪對話逐步完善 Flow
- ✅ 可自動推薦相關 API 端點（準確率 ≥ 80%）
- ✅ 產生的 Flow 可通過驗證並執行
- ✅ 單元測試覆蓋率 ≥ 75%

---

### 階段四: 整合測試與優化 (Week 7-8)

#### Task 4.1: 端對端測試

```typescript
// tests/e2e/flow-generation.e2e.spec.ts

describe('Flow 產生功能 E2E 測試', () => {
  test('方案 B: 自動產生測試套件', async () => {
    // 1. 準備 OpenAPI 規格
    const spec = readFileSync('specs/user-management-api.yaml', 'utf-8');

    // 2. 呼叫 MCP 工具
    const result = await mcpClient.callTool('generateTestSuite', {
      spec,
      options: {
        includeEdgeCases: true,
        includeErrorCases: true
      }
    });

    // 3. 驗證產生的測試套件
    expect(result).toContain('建立使用者 - 成功案例');
    expect(result).toContain('建立使用者 - 缺少 email');

    // 4. 執行產生的測試
    const flowYaml = extractYamlFromResult(result);
    const runResult = await mcpClient.callTool('runFlow', {
      spec,
      flow: flowYaml,
      baseUrl: 'http://localhost:3000'
    });

    expect(runResult).toContain('✅ 成功');
  });

  test('方案 A: 對話式產生流程', async () => {
    // 第一輪對話
    const round1 = await mcpClient.callTool('generateFlow', {
      description: '我想測試使用者登入',
      spec: readFileSync('specs/user-management-api.yaml', 'utf-8')
    });

    const contextId = extractContextId(round1);
    expect(round1).toContain('推薦端點: userLogin');

    // 第二輪對話：補充參數
    const round2 = await mcpClient.callTool('generateFlow', {
      description: '使用帳號 testuser 密碼 test123',
      contextId,
      spec: readFileSync('specs/user-management-api.yaml', 'utf-8')
    });

    expect(round2).toContain('username: "testuser"');

    // 第三輪對話：新增驗證
    const round3 = await mcpClient.callTool('generateFlow', {
      description: '驗證 token 欄位不為空',
      contextId,
      spec: readFileSync('specs/user-management-api.yaml', 'utf-8')
    });

    expect(round3).toContain('notNull');
  });
});
```

#### Task 4.2: 效能優化

- **優化點 1**: OpenAPI 規格解析快取
  - 避免重複解析相同規格
  - 使用記憶體快取或檔案快取

- **優化點 2**: 批次產生測試案例
  - 平行處理多個端點的測試產生
  - 使用 Worker Threads 加速

- **優化點 3**: 智能去重
  - 避免產生重複的測試案例
  - 合併相似的錯誤測試

#### Task 4.3: 錯誤處理與邊界案例

```typescript
// 處理無效的 OpenAPI 規格
test('應正確處理無效的 OpenAPI 規格', async () => {
  const result = await mcpClient.callTool('generateTestSuite', {
    spec: 'invalid yaml content'
  });

  expect(result).toContain('錯誤：無效的 OpenAPI 規格');
});

// 處理空規格（無端點）
test('應處理沒有端點的規格', async () => {
  const emptySpec = 'openapi: 3.0.0\ninfo:\n  title: Empty\npaths: {}';
  const result = await mcpClient.callTool('generateTestSuite', { spec: emptySpec });

  expect(result).toContain('找不到可產生測試的端點');
});

// 處理對話上下文過期
test('應處理不存在的 contextId', async () => {
  const result = await mcpClient.callTool('generateFlow', {
    description: '繼續',
    contextId: 'non-existent-id'
  });

  expect(result).toContain('對話上下文不存在或已過期');
});
```

#### Task 4.4: 文件撰寫

- **使用手冊**: `docs/flow-generation-guide.md`
  - 快速開始範例
  - 兩種方案的使用場景說明
  - 常見問題 FAQ

- **API 文件**: 更新 `docs/mcp-interface.md`
  - `generateFlow` 工具參數說明
  - `generateTestSuite` 工具參數說明
  - 回傳格式說明

- **架構文件**: `docs/flow-generation-architecture.md`
  - 技術架構圖
  - 核心演算法說明
  - 擴充指南

#### 驗收標準

- ✅ E2E 測試全部通過
- ✅ 效能符合要求（產生 10 個端點的測試套件 < 2 秒）
- ✅ 錯誤處理完善，無未捕獲例外
- ✅ 文件完整且範例可執行

---

## 技術規格

### MCP 工具定義

#### 1. generateFlow (方案 A)

```typescript
{
  name: "generateFlow",
  title: "對話式產生測試流程",
  description: "透過自然語言描述產生 API 測試流程，支援多輪對話逐步完善",
  inputSchema: {
    description: z.string().describe("測試場景的自然語言描述"),
    spec: z.string().describe("OpenAPI 規格檔案路徑或內容"),
    contextId: z.string().optional().describe("對話上下文 ID（續接前次對話）"),
    autoValidate: z.boolean().optional().describe("是否自動新增基本驗證（預設: true）")
  },
  outputSchema: {
    flowYaml: string;          // 產生的 Flow YAML
    contextId: string;         // 對話上下文 ID（供下次呼叫使用）
    suggestions: Suggestion[]; // 智能建議
    confidence: number;        // 識別信心度 (0-1)
  }
}
```

**範例呼叫**:

```json
// 第一輪
{
  "description": "測試使用者登入後取得個人資料",
  "spec": "specs/user-management-api.yaml"
}

// 第二輪（續接）
{
  "description": "登入使用帳號 admin 密碼 admin123",
  "spec": "specs/user-management-api.yaml",
  "contextId": "ctx-abc123"
}
```

#### 2. generateTestSuite (方案 B)

```typescript
{
  name: "generateTestSuite",
  title: "自動產生測試套件",
  description: "根據 OpenAPI 規格自動產生完整的測試案例集",
  inputSchema: {
    spec: z.string().describe("OpenAPI 規格檔案路徑或內容"),
    options: z.object({
      includeSuccessCases: z.boolean().optional().describe("包含成功案例（預設: true）"),
      includeErrorCases: z.boolean().optional().describe("包含錯誤案例（預設: true）"),
      includeEdgeCases: z.boolean().optional().describe("包含邊界測試（預設: true）"),
      includeAuthTests: z.boolean().optional().describe("包含認證測試（預設: true）"),
      generateFlows: z.boolean().optional().describe("產生資源流程串接測試（預設: false）"),
      endpoints: z.array(z.string()).optional().describe("限定產生特定端點的測試（預設: 全部）")
    }).optional()
  },
  outputSchema: {
    flowYaml: string;       // 產生的測試套件 YAML
    summary: {
      totalTests: number;
      successTests: number;
      errorTests: number;
      edgeTests: number;
      endpoints: string[];
    }
  }
}
```

**範例呼叫**:

```json
{
  "spec": "specs/user-management-api.yaml",
  "options": {
    "includeSuccessCases": true,
    "includeErrorCases": true,
    "includeEdgeCases": false,
    "endpoints": ["createUser", "getUser", "deleteUser"]
  }
}
```

### 資料結構

#### FlowDefinition (擴充)

```typescript
interface FlowDefinition {
  name: string;
  description?: string;
  metadata?: {
    generatedBy?: 'auto' | 'nlp';           // 產生方式
    generatedAt?: string;                    // 產生時間
    sourceDescription?: string;              // 原始自然語言描述（方案 A）
    generationOptions?: GenerationOptions;   // 產生選項（方案 B）
  };
  steps: FlowStep[];
  globals?: GlobalConfig;
}
```

#### ConversationContext

```typescript
interface ConversationContext {
  contextId: string;
  currentFlow: Partial<FlowDefinition>;
  extractedVariables: Record<string, string>;
  conversationHistory: ConversationTurn[];
  createdAt: string;
  expiresAt: string;  // 30 分鐘後過期
}

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  parsedIntent?: ParsedIntent;
}
```

### 演算法設計

#### 端點推薦演算法

```typescript
function recommendEndpoints(
  userDescription: string,
  spec: OpenAPIDocument
): EndpointMatch[] {
  const endpoints = extractEndpoints(spec);
  const scores: EndpointMatch[] = [];

  for (const endpoint of endpoints) {
    let score = 0;

    // 1. 關鍵字比對 (權重 40%)
    const keywords = extractKeywords(userDescription);
    const summaryMatch = calculateKeywordMatch(keywords, endpoint.summary);
    score += summaryMatch * 0.4;

    // 2. HTTP method 比對 (權重 30%)
    const methodMatch = matchHttpMethod(userDescription, endpoint.method);
    score += methodMatch * 0.3;

    // 3. 路徑語意相似度 (權重 20%)
    const pathSimilarity = calculatePathSimilarity(userDescription, endpoint.path);
    score += pathSimilarity * 0.2;

    // 4. 參數相關性 (權重 10%)
    const paramRelevance = calculateParamRelevance(userDescription, endpoint.parameters);
    score += paramRelevance * 0.1;

    if (score > 0.3) {  // 閾值過濾
      scores.push({ endpoint, score });
    }
  }

  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);  // 回傳前 5 名
}
```

#### 測試資料合成策略

```typescript
function synthesizeTestData(schema: JSONSchema): unknown {
  if (schema.examples && schema.examples.length > 0) {
    // 優先使用 examples
    return schema.examples[0];
  }

  switch (schema.type) {
    case 'string':
      if (schema.format === 'email') return 'test@example.com';
      if (schema.format === 'date-time') return new Date().toISOString();
      if (schema.enum) return schema.enum[0];
      return schema.pattern ? generateFromRegex(schema.pattern) : 'test-value';

    case 'number':
    case 'integer':
      if (schema.minimum !== undefined) return schema.minimum;
      if (schema.maximum !== undefined) return schema.maximum;
      return schema.type === 'integer' ? 42 : 3.14;

    case 'boolean':
      return true;

    case 'array':
      return [synthesizeTestData(schema.items)];

    case 'object':
      const obj: Record<string, unknown> = {};
      for (const [key, propSchema] of Object.entries(schema.properties || {})) {
        obj[key] = synthesizeTestData(propSchema);
      }
      return obj;

    default:
      return null;
  }
}
```

---

## 測試策略

### 單元測試

| 模組 | 測試重點 | 目標覆蓋率 |
|------|---------|-----------|
| SpecAnalyzer | 正確解析各種 OpenAPI 格式 | ≥ 85% |
| CRUDGenerator | 產生正確的 CRUD 測試案例 | ≥ 85% |
| ErrorCaseGenerator | 涵蓋所有錯誤類型 | ≥ 80% |
| NLPFlowParser | 意圖識別準確率 | ≥ 75% |
| FlowBuilder | 產生有效的 Flow 結構 | ≥ 90% |
| FlowValidator | Schema 驗證正確性 | ≥ 90% |

### 整合測試

- 測試 `generateTestSuite` 產生的 Flow 可被 `runFlow` 執行
- 測試 `generateFlow` 產生的 Flow 通過 Schema 驗證
- 測試多輪對話的上下文保持正確

### 端對端測試

- 使用真實的 OpenAPI 規格（如 `specs/user-management-api.yaml`）
- 驗證產生的測試可對模擬伺服器執行
- 驗證對話流程的完整性

### 效能測試

| 場景 | 目標效能 |
|------|---------|
| 產生 10 個端點的測試套件 | < 2 秒 |
| 產生 50 個端點的測試套件 | < 8 秒 |
| 單輪對話回應時間 | < 1 秒 |
| OpenAPI 規格解析（首次） | < 500ms |

---

## 風險評估

### 高風險項目

| 風險 | 影響 | 機率 | 緩解策略 |
|------|------|------|---------|
| 自然語言意圖識別準確率不足 | 高 | 中 | 1. 提供明確的使用範例<br>2. 支援關鍵字提示<br>3. 允許手動選擇端點 |
| OpenAPI 規格格式多樣性 | 中 | 高 | 1. 使用成熟的 swagger-parser<br>2. 充分測試各種格式<br>3. 提供錯誤提示 |
| 產生的測試資料不符合業務邏輯 | 中 | 中 | 1. 優先使用 examples<br>2. 提供覆寫機制<br>3. 文件說明需手動調整 |

### 中風險項目

| 風險 | 影響 | 機率 | 緩解策略 |
|------|------|------|---------|
| 對話上下文管理複雜度 | 中 | 中 | 1. 設定合理的過期時間<br>2. 提供清除機制<br>3. 限制上下文大小 |
| 效能問題（大型 API 規格） | 中 | 低 | 1. 實作快取機制<br>2. 支援分批產生<br>3. 非同步處理 |

---

## 時程規劃

### 甘特圖

```
Week 1-2  [███████████████] 階段一: 基礎建設
Week 3-4  [███████████████] 階段二: 方案 B 實作
Week 5-6  [███████████████] 階段三: 方案 A 實作
Week 7    [████████░░░░░░░] 階段四: 整合測試
Week 8    [░░░░░░░░████████] 階段四: 優化與文件
```

### 里程碑

| 里程碑 | 日期 | 交付物 |
|--------|------|--------|
| M1: 基礎架構完成 | Week 2 結束 | • 3 個新套件可編譯<br>• MCP 工具已註冊 |
| M2: 方案 B MVP | Week 4 結束 | • 可產生基本 CRUD 測試<br>• 可執行產生的測試 |
| M3: 方案 A MVP | Week 6 結束 | • 可識別基本意圖<br>• 支援多輪對話 |
| M4: 正式發布 | Week 8 結束 | • 所有測試通過<br>• 文件完整<br>• v0.2.0 發布 |

---

## 附錄

### A. 關鍵字映射表（方案 A 用）

| 自然語言關鍵字 | HTTP Method | 常見 operationId 模式 |
|---------------|-------------|---------------------|
| 登入、登陸 | POST | login, signin, authenticate |
| 註冊、建立帳號 | POST | signup, register, createAccount |
| 查詢、取得、獲取 | GET | get*, list*, fetch* |
| 建立、新增、創建 | POST | create*, add*, insert* |
| 更新、修改、編輯 | PUT/PATCH | update*, edit*, modify* |
| 刪除、移除 | DELETE | delete*, remove*, destroy* |

### B. 錯誤案例產生矩陣

| Schema 約束 | 產生的錯誤測試 | 預期狀態碼 |
|-------------|---------------|-----------|
| `required: [field]` | 缺少該欄位 | 400 |
| `type: string` | 傳入數字 | 400 |
| `format: email` | 傳入無效 email | 400 |
| `minLength: 8` | 傳入 7 個字元 | 400 |
| `minimum: 0` | 傳入 -1 | 400 |
| `security` 定義 | 不帶 token | 401 |

### C. 相依套件版本

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "@specpilot/spec-loader": "workspace:*",
    "@specpilot/flow-parser": "workspace:*",
    "@specpilot/schemas": "workspace:*",
    "@specpilot/shared": "workspace:*",
    "yaml": "^2.4.3",
    "ajv": "^8.12.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "vitest": "^1.6.0",
    "@types/node": "^20.11.1"
  }
}
```

### D. 參考資料

- [OpenAPI Specification 3.0](https://spec.openapis.org/oas/v3.0.0)
- [MCP Protocol Specification](https://spec.modelcontextprotocol.io/)
- [JSON Schema Validation](https://json-schema.org/draft/2020-12/json-schema-validation.html)
- [SpecPilot 現有架構文件](./SpecPilot-Req.md)

---

## 變更歷史

| 版本 | 日期 | 變更內容 | 作者 |
|------|------|---------|------|
| 1.0 | 2025-10-03 | 初版建立 | Development Team |

---

**文件狀態**: ✅ 已核准
**下次審查日期**: 實作開始後 2 週
