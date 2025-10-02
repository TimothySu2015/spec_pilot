# SpecPilot 專案風險評估與解決方案

## 📋 風險評估總表

| # | 風險項目 | 風險等級 | 影響範圍 | 發生機率 | 解決方案 | 優先級 |
|---|---------|---------|---------|---------|---------|-------|
| 1 | Zod ↔ JSON Schema 轉換限制 | 🔴 高 | Flow Builder UI + SpecPilot | 80% | 限制使用 JSON Schema 原生功能 | P0 |
| 2 | 變數插值與動態值驗證 | 🔴 高 | Flow 執行時期 | 90% | 變數解析前置處理 + Schema pattern 放寬 | P0 |
| 3 | Schema 版本演進問題 | 🔴 高 | 長期維護 | 70% | 使用 `$schema` 版本標記 | P1 |
| 4 | 自訂驗證規則實作差異 | 🟡 中 | 進階驗證功能 | 60% | SpecPilot 保留內建驗證邏輯 | P1 |
| 5 | UI 產生的 YAML 格式問題 | 🟡 中 | 使用者體驗 | 50% | 統一 YAML 序列化選項 | P2 |
| 6 | OpenAPI Schema 衝突 | 🟡 中 | 測試執行準確性 | 70% | 多層驗證機制 + UI 預警 | P1 |
| 7 | 檔案管理與同步問題 | 🟡 中 | 開發工作流程 | 60% | API 整合或 Git 自動化 | P2 |

---

## 🔍 詳細風險分析

### 風險 #1: Zod ↔ JSON Schema 轉換限制

**問題描述:**
- `zod-to-json-schema` 無法完整轉換 Zod 進階功能(如 `.transform()`, `.refine()`, 複雜的 union)
- 可能導致 UI 驗證通過但 SpecPilot 執行時失敗

**影響範圍:**
- Flow Builder UI 表單驗證
- SpecPilot JSON Schema 驗證器
- 型別一致性保證

**解決方案:**

| 方案 | 說明 | 工作量 | 建議 |
|------|------|--------|------|
| A. 限制 Zod 功能 | 只使用 `z.string()`, `z.number()`, `z.object()`, `z.array()`, `z.enum()` | 低 | ✅ 推薦 |
| B. 建立轉換測試 | 為每個 Schema 撰寫轉換測試,確保 Zod 和 JSON Schema 行為一致 | 中 | ✅ 必須 |
| C. 使用共用 Schema 套件 | 建立 `@specpilot/schemas` 統一管理 | 中 | ✅ 推薦 |

**實作檢查清單:**
- [ ] 建立 `packages/schemas` 套件
- [ ] 定義基礎 Schema(只用 JSON Schema 可轉換的 Zod 功能)
- [ ] 撰寫轉換一致性測試
- [ ] 在 Flow Builder UI 和 SpecPilot 中引用

**範例:**
```typescript
// ✅ 建議使用 - 可完美轉換的 Zod 功能
const SafeSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
  status: z.enum(['active', 'inactive']),
  tags: z.array(z.string()),
});

// ❌ 避免使用 - 難以轉換的 Zod 功能
const UnsafeSchema = z.object({
  email: z.string().transform(s => s.toLowerCase()),  // transform 無法轉換
  password: z.string().refine(s => s.length > 8),    // refine 無法轉換
  body: z.union([z.string(), z.object({})]),         // 複雜 union 可能失真
});
```

---

### 風險 #2: 變數插值與動態值驗證

**問題描述:**
- Flow YAML 支援 `{{variable}}` 插值,但 JSON Schema 在驗證時無法識別
- 例如: `email: '{{test_email}}'` 會因不符合 email format 而驗證失敗

**影響範圍:**
- 所有使用變數插值的 Flow 步驟
- 驗證準確性

**解決方案:**

| 階段 | 處理方式 | 實作位置 |
|------|---------|---------|
| 1. Schema 定義 | 使用 regex pattern 允許變數語法 | `@specpilot/schemas` |
| 2. 前置處理 | 驗證前先解析變數 | `packages/flow-parser` |
| 3. 執行時驗證 | 解析變數後再用 OpenAPI Schema 驗證實際值 | `packages/core-flow` |

**Schema Pattern 範例:**
```typescript
// 允許變數或實際 email
const EmailOrVariableSchema = z.string().regex(
  /^({{[^}]+}}|.+@.+\..+)$/,
  '必須是有效的 email 或變數 {{variable}}'
);

// 允許變數或數字
const NumberOrVariableSchema = z.union([
  z.number(),
  z.string().regex(/^{{[^}]+}}$/),
]);
```

**變數解析流程:**
```typescript
// packages/flow-parser/src/variable-resolver.ts
export class VariableResolver {
  resolve(flowData: any, variables: Record<string, any>): any {
    const resolved = JSON.parse(JSON.stringify(flowData));

    // 遞迴替換所有 {{variable}}
    this.traverse(resolved, (value) => {
      if (typeof value === 'string') {
        return value.replace(/{{([^}]+)}}/g, (match, varName) => {
          return variables[varName] ?? match;
        });
      }
      return value;
    });

    return resolved;
  }
}
```

**實作檢查清單:**
- [ ] 更新 Schema 定義支援變數 pattern
- [ ] 實作 `VariableResolver` 類別
- [ ] 在 Flow Parser 中加入變數解析步驟
- [ ] 撰寫變數解析測試案例
- [ ] 處理未定義變數的錯誤情況

---

### 風險 #3: Schema 版本演進問題

**問題描述:**
- Flow Builder UI 更新後,舊的 Flow YAML 可能無法通過新版 Schema 驗證
- 缺乏版本追蹤機制

**影響範圍:**
- 既有 Flow YAML 檔案
- 向後相容性

**解決方案:**

| 元件 | 版本管理方式 |
|------|------------|
| Flow YAML | 加入 `$schema: "v1.0.0"` 欄位 |
| JSON Schema | 儲存在 `schemas/v1.0.0/flow-definition.schema.json` |
| SpecPilot | 根據 `$schema` 欄位載入對應版本 Schema |

**版本演進策略:**

| 變更類型 | 版本號變更 | 向後相容性 | 範例 |
|---------|-----------|-----------|------|
| 新增可選欄位 | PATCH (v1.0.x) | ✅ 相容 | 新增 `timeout` 欄位 |
| 新增必填欄位 | MAJOR (v2.0.0) | ❌ 不相容 | 要求所有 step 必須有 `description` |
| 修改欄位型別 | MAJOR (v2.0.0) | ❌ 不相容 | `statusCode` 從 number 改成 array |
| 修正驗證邏輯 | MINOR (v1.x.0) | ✅ 相容 | 放寬 path 的正則表達式 |

**Flow YAML 範例:**
```yaml
$schema: "v1.0.0"  # 明確指定使用的 Schema 版本
name: 使用者管理測試流程
description: 完整的使用者 CRUD 測試
version: 1.0.0
baseUrl: http://localhost:3000

variables:
  admin_username: admin
  admin_password: '123456'

steps:
  - name: 登入測試
    request:
      method: POST
      path: /auth/login
```

**SpecPilot Schema 載入器:**
```typescript
// packages/flow-parser/src/schema-loader.ts
export class SchemaLoader {
  private schemaCache: Map<string, object> = new Map();

  async loadSchema(version?: string): Promise<object> {
    const schemaVersion = version ?? this.getLatestVersion();

    if (this.schemaCache.has(schemaVersion)) {
      return this.schemaCache.get(schemaVersion)!;
    }

    const schemaPath = path.join(
      __dirname,
      `../../schemas/${schemaVersion}/flow-definition.schema.json`
    );

    const schema = JSON.parse(await readFile(schemaPath, 'utf-8'));
    this.schemaCache.set(schemaVersion, schema);

    return schema;
  }

  getLatestVersion(): string {
    // 讀取 schemas/ 目錄下最新版本
    return 'v1.0.0';
  }
}
```

**實作檢查清單:**
- [ ] 在 Flow YAML Schema 加入 `$schema` 欄位
- [ ] 建立 Schema 版本目錄結構 `schemas/v1.0.0/`
- [ ] 實作 `SchemaLoader` 類別
- [ ] 撰寫版本相容性測試
- [ ] 建立版本升級指南文件

---

### 風險 #4: 自訂驗證規則實作差異

**問題描述:**
- Flow 支援 `notNull`, `regex`, `contains` 等自訂規則
- JSON Schema 無法表達條件式驗證邏輯(如"當 rule=regex 時,value 必須是正則表達式")

**影響範圍:**
- 自訂驗證規則的準確性
- UI 表單驗證與執行時驗證的一致性

**解決方案:**

| 層級 | 處理方式 | 工具 |
|------|---------|------|
| UI 驗證 | 使用 Zod discriminatedUnion | `z.discriminatedUnion('rule', [...])` |
| JSON Schema | 轉換為簡化版本(僅檢查欄位存在) | `zod-to-json-schema` |
| 執行時驗證 | SpecPilot 內建驗證引擎 | `packages/validation` |

**雙軌驗證策略:**

**Flow Builder UI - 嚴格驗證:**
```typescript
// 使用 discriminatedUnion 提供精確的型別檢查
const ValidationRuleSchema = z.discriminatedUnion('rule', [
  z.object({
    rule: z.literal('notNull'),
    path: z.string(),
  }),
  z.object({
    rule: z.literal('regex'),
    path: z.string(),
    value: z.string().regex(/^\/.*\/[gimsuy]*$/, '必須是正則表達式格式'),
  }),
  z.object({
    rule: z.literal('contains'),
    path: z.string(),
    value: z.union([z.string(), z.number()]),
  }),
]);
```

**SpecPilot - 內建驗證器:**
```typescript
// packages/validation/src/custom-validator.ts
export class CustomValidator {
  validate(rule: ValidationRule, actualValue: any): boolean {
    switch (rule.rule) {
      case 'notNull':
        return actualValue != null && actualValue !== '';

      case 'regex':
        try {
          const regex = new RegExp(rule.value);
          return regex.test(String(actualValue));
        } catch (e) {
          throw new ValidationError(`無效的正則表達式: ${rule.value}`);
        }

      case 'contains':
        if (Array.isArray(actualValue)) {
          return actualValue.includes(rule.value);
        }
        return String(actualValue).includes(String(rule.value));

      default:
        throw new ValidationError(`不支援的驗證規則: ${rule.rule}`);
    }
  }
}
```

**實作檢查清單:**
- [ ] 保留 SpecPilot 現有的 `CustomValidator`
- [ ] Flow Builder UI 使用 Zod discriminatedUnion
- [ ] 撰寫整合測試確保兩者行為一致
- [ ] 文件化所有支援的驗證規則

---

### 風險 #5: UI 產生的 YAML 格式問題

**問題描述:**
- JavaScript `YAML.stringify()` 可能產生與手寫不同的格式
- 數字字串可能被解析為數字
- 引號風格不一致

**影響範圍:**
- 使用者體驗
- Git diff 可讀性

**解決方案:**

| 問題 | YAML 序列化設定 |
|------|---------------|
| 數字字串 | `defaultStringType: 'QUOTE_SINGLE'` |
| 縮排不一致 | `indent: 2` |
| 引號風格 | `singleQuote: true` |
| 行寬限制 | `lineWidth: 0` |

**統一的 YAML 匯出函式:**
```typescript
// flow-builder-ui/src/utils/export-flow.ts
import YAML from 'yaml';

export function exportFlowToYaml(flowData: FlowDefinition): string {
  return YAML.stringify(flowData, {
    indent: 2,                      // 固定 2 空格縮排
    lineWidth: 0,                   // 不自動換行
    minContentWidth: 0,
    singleQuote: true,              // 統一使用單引號
    defaultStringType: 'QUOTE_SINGLE',
    defaultKeyType: 'PLAIN',
    nullStr: 'null',
    trueStr: 'true',
    falseStr: 'false',
  });
}
```

**格式一致性測試:**
```typescript
describe('YAML Export', () => {
  it('should maintain string type for numeric strings', () => {
    const flow = {
      variables: {
        password: '123456',
        port: '8080',
      }
    };
    const yaml = exportFlowToYaml(flow);

    expect(yaml).toContain("password: '123456'");
    expect(yaml).toContain("port: '8080'");
    expect(yaml).not.toContain('password: 123456'); // 不應該是數字
  });

  it('should use consistent indentation', () => {
    const flow = {
      steps: [
        { name: 'test', request: { method: 'GET', path: '/api' } }
      ]
    };
    const yaml = exportFlowToYaml(flow);
    const lines = yaml.split('\n');

    // 檢查每一層的縮排都是 2 空格
    expect(lines[1]).toMatch(/^  - name:/);
    expect(lines[2]).toMatch(/^    request:/);
  });
});
```

**實作檢查清單:**
- [ ] 建立統一的 `exportFlowToYaml()` 函式
- [ ] 撰寫 YAML 格式測試
- [ ] 提供 YAML 預覽功能(匯出前檢視)
- [ ] 支援格式化選項設定

---

### 風險 #6: OpenAPI Schema 與 Flow Schema 衝突

**問題描述:**
- Flow Schema 驗證結構正確性
- OpenAPI Schema 驗證業務邏輯正確性
- 兩者可能有衝突(例如 Flow 通過但違反 OpenAPI 規格)

**影響範圍:**
- 測試準確性
- 錯誤發現時機

**解決方案 - 多層驗證機制:**

| 驗證層級 | 目的 | 時機 | 工具 |
|---------|------|------|------|
| Layer 1: 結構驗證 | 檢查 YAML 格式是否正確 | 載入 Flow 時 | JSON Schema + AJV |
| Layer 2: 變數解析 | 替換所有變數插值 | 執行前 | VariableResolver |
| Layer 3: 業務邏輯驗證 | 檢查是否符合 OpenAPI 規格 | 執行前 | OpenAPI Validator |
| Layer 4: 執行時驗證 | 驗證實際 HTTP 回應 | 執行後 | Response Validator |

**SpecPilot 多層驗證實作:**
```typescript
// packages/core-flow/src/flow-executor.ts
export class FlowExecutor {
  async executeStep(step: IFlowStep, context: ExecutionContext) {
    // Layer 1: Flow Schema 驗證(已在 Parser 階段完成)

    // Layer 2: 變數解析
    const resolvedStep = this.variableResolver.resolve(step, context.variables);

    // Layer 3: OpenAPI Schema 驗證
    if (this.openApiSpec) {
      const requestSpec = this.getRequestSpec(
        resolvedStep.request.path,
        resolvedStep.request.method
      );

      this.validateRequestBody(resolvedStep.request.body, requestSpec);
    }

    // Layer 4: 執行 HTTP 請求
    const response = await this.httpRunner.execute(resolvedStep.request);

    // Layer 5: 驗證回應
    await this.validateResponse(response, resolvedStep.expect);

    return response;
  }

  private validateRequestBody(body: any, requestSpec: any) {
    if (!requestSpec?.requestBody?.content?.['application/json']?.schema) {
      return;
    }

    const schema = requestSpec.requestBody.content['application/json'].schema;
    const ajv = new Ajv();
    const validate = ajv.compile(schema);

    if (!validate(body)) {
      throw new ValidationError('請求內容不符合 OpenAPI 規格', {
        hint: '請檢查請求欄位是否正確',
        details: { errors: validate.errors },
      });
    }
  }
}
```

**Flow Builder UI 整合 OpenAPI:**
```tsx
// flow-builder-ui/src/components/RequestBodyEditor.tsx
import { useOpenAPIValidation } from '@/hooks/useOpenAPIValidation';

export function RequestBodyEditor({
  openApiSpec,
  currentPath,
  currentMethod,
  value,
  onChange
}) {
  const { conflicts } = useOpenAPIValidation(
    value,
    openApiSpec,
    currentPath,
    currentMethod
  );

  return (
    <div>
      <JsonEditor value={value} onChange={onChange} />

      {conflicts.map((conflict, index) => (
        <Alert key={index} severity="warning">
          ⚠️ {conflict.field}: {conflict.message}
          <br />
          <small>
            OpenAPI 要求: {conflict.requirement}
            <br />
            目前值: {conflict.actualValue}
          </small>
        </Alert>
      ))}
    </div>
  );
}
```

**衝突檢查範例:**
```typescript
// flow-builder-ui/src/utils/openapi-conflict-checker.ts
export function checkOpenAPIConflicts(
  requestBody: any,
  openApiSpec: any,
  path: string,
  method: string
): Conflict[] {
  const conflicts: Conflict[] = [];
  const schema = openApiSpec.paths[path]?.[method]?.requestBody?.content?.['application/json']?.schema;

  if (!schema) return conflicts;

  // 檢查必填欄位
  if (schema.required) {
    for (const field of schema.required) {
      if (!(field in requestBody)) {
        conflicts.push({
          field,
          message: '缺少必填欄位',
          requirement: 'required',
          actualValue: undefined,
        });
      }
    }
  }

  // 檢查欄位型別與格式
  for (const [field, value] of Object.entries(requestBody)) {
    const fieldSchema = schema.properties?.[field];
    if (!fieldSchema) continue;

    // 檢查最小長度
    if (fieldSchema.minLength && typeof value === 'string') {
      if (value.length < fieldSchema.minLength) {
        conflicts.push({
          field,
          message: '長度不足',
          requirement: `至少 ${fieldSchema.minLength} 字元`,
          actualValue: `${value.length} 字元`,
        });
      }
    }

    // 檢查 email 格式
    if (fieldSchema.format === 'email' && typeof value === 'string') {
      if (!value.match(/^.+@.+\..+$/)) {
        conflicts.push({
          field,
          message: '格式不正確',
          requirement: 'email 格式',
          actualValue: value,
        });
      }
    }
  }

  return conflicts;
}
```

**實作檢查清單:**
- [ ] 實作 `OpenAPIConflictChecker`
- [ ] Flow Builder UI 整合 OpenAPI Spec 上傳功能
- [ ] 提供即時衝突警告 UI
- [ ] SpecPilot 實作多層驗證流程
- [ ] 撰寫驗證層級整合測試

---

### 風險 #7: 檔案管理與同步問題

**問題描述:**
- 使用者需手動複製 Flow YAML 和 Schema JSON 到 SpecPilot
- 容易忘記同步更新
- 檔案版本不一致

**影響範圍:**
- 開發工作流程效率
- 錯誤發生率

**解決方案比較:**

| 方案 | 優點 | 缺點 | 實作複雜度 | 建議階段 |
|------|------|------|-----------|---------|
| A. 手動複製 | 簡單、無依賴 | 容易出錯 | 低 | MVP |
| B. 共用資料夾 | 即時同步 | 僅適用本機開發 | 低 | MVP |
| C. API 整合 | 自動化、可遠端 | 需要 SpecPilot 提供 API | 中 | Phase 2 |
| D. Git 整合 | 版本控制完整 | 需要 Git 權限設定 | 高 | Phase 3 |
| E. MCP 整合 | 與 Claude 整合 | 依賴 MCP Server | 中 | Phase 3 |

**方案 A+B: MVP 實作 - 手動匯出 + 共用資料夾**

```typescript
// flow-builder-ui/src/config/export-config.ts
export interface ExportConfig {
  outputDirectory: string;
  autoSave: boolean;
  createBackup: boolean;
}

// flow-builder-ui/src/utils/file-exporter.ts
export class FileExporter {
  constructor(private config: ExportConfig) {}

  async exportFlow(flowData: FlowDefinition) {
    const yaml = exportFlowToYaml(flowData);
    const schema = zodToJsonSchema(FlowDefinitionSchema);

    const flowPath = path.join(
      this.config.outputDirectory,
      `${flowData.name}.yaml`
    );
    const schemaPath = path.join(
      this.config.outputDirectory,
      'schemas',
      `${flowData.name}.schema.json`
    );

    // 建立備份
    if (this.config.createBackup && existsSync(flowPath)) {
      await copyFile(flowPath, `${flowPath}.backup`);
    }

    // 寫入檔案
    await writeFile(flowPath, yaml, 'utf-8');
    await writeFile(schemaPath, JSON.stringify(schema, null, 2), 'utf-8');

    return { flowPath, schemaPath };
  }
}
```

**方案 C: Phase 2 - SpecPilot API 整合**

```typescript
// SpecPilot 提供 REST API
// apps/api-server/src/routes/flows.ts
app.post('/api/flows', async (req, res) => {
  const { name, yaml_content, schema } = req.body;

  // 驗證 YAML 格式
  const flowData = parseYaml(yaml_content);
  const ajv = new Ajv();
  const validate = ajv.compile(schema);

  if (!validate(flowData)) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Flow 驗證失敗',
      details: validate.errors,
    });
  }

  // 儲存檔案
  const flowPath = path.join(__dirname, '../../flows', `${name}.yaml`);
  const schemaPath = path.join(__dirname, '../../flows/schemas', `${name}.schema.json`);

  await writeFile(flowPath, yaml_content);
  await writeFile(schemaPath, JSON.stringify(schema, null, 2));

  res.status(201).json({
    message: 'Flow 儲存成功',
    paths: { flow: flowPath, schema: schemaPath },
  });
});
```

```typescript
// Flow Builder UI 呼叫 API
// flow-builder-ui/src/services/specpilot-api.ts
export class SpecPilotAPI {
  constructor(private baseUrl: string) {}

  async saveFlow(flowData: FlowDefinition) {
    const yaml = exportFlowToYaml(flowData);
    const schema = zodToJsonSchema(FlowDefinitionSchema);

    const response = await fetch(`${this.baseUrl}/api/flows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: flowData.name,
        yaml_content: yaml,
        schema,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    return response.json();
  }
}
```

**方案 E: Phase 3 - MCP 整合**

```typescript
// flow-builder-ui/src/services/mcp-client.ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export class MCPClient {
  private client: Client;

  async saveFlowViaMCP(flowData: FlowDefinition) {
    const yaml = exportFlowToYaml(flowData);
    const schema = zodToJsonSchema(FlowDefinitionSchema);

    // 呼叫 SpecPilot MCP Server 的 saveFlow tool
    const result = await this.client.callTool({
      name: 'saveFlow',
      arguments: {
        name: flowData.name,
        yamlContent: yaml,
        schema: JSON.stringify(schema),
      },
    });

    return result;
  }
}
```

**實作檢查清單:**

**Phase 1 (MVP):**
- [ ] 實作檔案匯出功能
- [ ] 提供匯出目錄設定 UI
- [ ] 支援匯出前預覽
- [ ] 建立備份機制

**Phase 2 (API 整合):**
- [ ] SpecPilot 實作 REST API
- [ ] Flow Builder UI 整合 API 呼叫
- [ ] 處理網路錯誤與重試
- [ ] 提供同步狀態顯示

**Phase 3 (MCP 整合):**
- [ ] SpecPilot MCP Server 新增 `saveFlow` tool
- [ ] Flow Builder UI 整合 MCP Client
- [ ] 實作 MCP 連線管理
- [ ] 提供離線模式備援

---

## 🎯 MVP 實作優先順序

### P0 - 必須實作(阻斷性風險)

| 項目 | 預估時間 | 依賴 | 負責模組 |
|------|---------|------|---------|
| 建立共用 Schema 套件 | 2 天 | - | `packages/schemas` |
| 限制 Zod 功能使用範圍 | 1 天 | Schema 套件 | `packages/schemas` |
| 實作變數解析前置處理 | 2 天 | - | `packages/flow-parser` |
| SpecPilot 支援 `--flow-schema` 參數 | 1 天 | - | `apps/cli` |
| Zod ↔ JSON Schema 轉換測試 | 1 天 | Schema 套件 | `packages/schemas` |

**P0 總計: 7 天**

### P1 - 應該實作(高價值功能)

| 項目 | 預估時間 | 依賴 | 負責模組 |
|------|---------|------|---------|
| Schema 版本管理 (`$schema` 欄位) | 2 天 | Schema 套件 | `packages/schemas` |
| 實作 SchemaLoader | 1 天 | Schema 版本管理 | `packages/flow-parser` |
| 多層驗證機制 | 3 天 | 變數解析 | `packages/core-flow` |
| **🆕 OpenAPI 上傳與解析** | **2 天** | **-** | **Flow Builder UI** |
| **🆕 OpenAPI 衝突檢查器** | **2 天** | **OpenAPI 解析** | **Flow Builder UI** |
| **🆕 智能驗證建議引擎** | **2-3 天** | **OpenAPI 解析** | **Flow Builder UI** |
| **🆕 批次生成測試功能** | **1-2 天** | **OpenAPI 解析** | **Flow Builder UI** |
| 自訂驗證規則雙軌驗證 | 2 天 | - | `packages/validation` |

**P1 總計: 17-19 天** (含 OpenAPI 整合 7-9 天)

### P2 - 可以延後(改善體驗)

| 項目 | 預估時間 | 依賴 | 負責模組 |
|------|---------|------|---------|
| YAML 格式統一 | 1 天 | - | Flow Builder UI |
| 檔案匯出功能 | 1 天 | - | Flow Builder UI |
| API 整合 | 3 天 | SpecPilot API Server | Flow Builder UI + SpecPilot |
| 視覺化流程編輯器 | 5 天 | 基礎表單編輯器 | Flow Builder UI |
| MCP 整合 | 3 天 | SpecPilot MCP Server | Flow Builder UI |

**P2 總計: 13 天**

---

## 🎯 實作里程碑

### Milestone 1: 基礎架構 (P0, 1-2 週)

**目標:** 建立 Zod + JSON Schema 驗證的基礎架構

**交付項目:**
- ⏸️ `packages/schemas` 套件
- ⏸️ 變數解析器
- ⏸️ SpecPilot 支援外部 JSON Schema 驗證
- ⏸️ 轉換一致性測試套件

**驗收標準:**
- Zod Schema 可成功轉換為 JSON Schema
- SpecPilot 可使用外部 Schema 驗證 Flow YAML
- 所有轉換測試通過

**當前狀態:** ⏸️ 待開始

### Milestone 2: 核心功能與 OpenAPI 整合 (P1, 3-4 週)

**目標:** 實作版本管理、多層驗證與 OpenAPI 整合功能

**交付項目:**
- ⏸️ Schema 版本管理系統
- ⏸️ 多層驗證機制
- ⏸️ **🆕 OpenAPI 上傳與解析**
- ⏸️ **🆕 OpenAPI 衝突檢查器**
- ⏸️ **🆕 智能驗證建議引擎**
- ⏸️ **🆕 批次生成測試功能**

**驗收標準:**
- 可載入不同版本的 Schema
- 驗證流程包含結構、變數、業務邏輯三層
- Flow Builder UI 可顯示 OpenAPI 衝突警告
- **可從 OpenAPI 自動生成測試步驟**
- **智能建議驗證規則可正常運作**

**當前狀態:** ⏸️ 待開始

### Milestone 3: 使用者體驗優化 (P2, 2-3 週)

**目標:** 改善工作流程與整合

**交付項目:**
- ⏸️ YAML 格式統一
- ⏸️ 檔案匯出功能
- ⏸️ API 整合(可選)

**驗收標準:**
- YAML 輸出格式一致
- 可一鍵匯出 Flow YAML 與 Schema
- (可選) 可透過 API 直接儲存到 SpecPilot

**當前狀態:** ⏸️ 待開始

---

## ✅ 可行性結論

**整體評估: ✅ 可行,但需要謹慎設計**

### 成功關鍵因素:

1. **✅ 限制技術範圍**
   - 只使用 JSON Schema 原生支援的 Zod 功能
   - 避免使用 `.transform()`, `.refine()` 等難以轉換的功能
   - 建立 Zod 功能白名單

2. **✅ 共用 Schema 套件**
   - 建立 `@specpilot/schemas` 作為單一事實來源
   - 前後端共用相同的 Schema 定義
   - 確保型別一致性

3. **✅ 多層驗證**
   - 結構驗證 → 變數解析 → 業務邏輯驗證 → 執行時驗證
   - 提早發現問題,減少執行時錯誤
   - 提供清晰的錯誤訊息

4. **✅ 版本管理**
   - 使用 `$schema` 欄位追蹤版本
   - 支援多版本共存
   - 提供版本升級路徑

5. **✅ 完整測試**
   - Zod ↔ JSON Schema 轉換測試
   - 變數解析測試
   - 多層驗證整合測試
   - 版本相容性測試

### 風險緩解措施:

- **📝 建立詳細的技術文件**
  - Schema 定義規範
  - 驗證流程說明
  - 版本升級指南

- **🧪 撰寫完整的整合測試**
  - 涵蓋所有風險場景
  - 確保前後端行為一致
  - 持續整合(CI)自動執行

- **🔄 採用漸進式開發**
  - MVP 先驗證核心概念
  - 逐步加入進階功能
  - 快速迭代與調整

- **📊 收集使用者回饋**
  - Beta 測試階段收集意見
  - 追蹤常見問題
  - 持續優化使用體驗

### 預期挑戰與應對:

| 挑戰 | 應對策略 |
|------|---------|
| Zod 轉換限制 | 建立功能白名單,提供 Linter 檢查 |
| 變數驗證複雜 | 實作專用的 VariableResolver,分離關注點 |
| 版本演進困難 | 採用語義化版本,提供自動升級工具 |
| 學習曲線陡峭 | 提供詳細文件、範例與教學影片 |

### 建議實作順序:

1. **第 1-2 週:** 完成 P0 項目,建立基礎架構
2. **第 3-6 週:** 完成 P1 項目,加入進階驗證與 OpenAPI 整合 (新增時程)
3. **第 7-9 週:** 完成 P2 項目,優化使用者體驗
4. **第 10 週以後:** 持續優化與新功能開發

**總結: 這個架構設計在技術上可行,關鍵是要嚴格限制 Zod 功能使用範圍,並建立完善的測試體系。OpenAPI 整合已升級為 P1 核心功能,將大幅提升使用者體驗與開發效率。建議先實作 MVP 驗證概念,再逐步擴充功能!**

---

## 📝 文件版本資訊

**版本:** v1.1.0
**最後更新:** 2025-01-16
**狀態:** 📋 已更新 (同步 OpenAPI 整合優先級)

### 更新歷程

**v1.1.0 (2025-01-16):**
- 🆕 將 OpenAPI 整合功能從 P2 提升至 P1
- 🆕 調整 Milestone 2 內容,納入 OpenAPI 相關功能
- 🆕 更新時程規劃,P1 階段延長至 3-4 週
- 🆕 更新所有進度標記為實際狀態 (⏸️ 待開始)
