# Flow Validator（流程驗證器）

## 模組資訊
- **模組名稱**: `@specpilot/flow-validator`
- **版本**: v0.2.0
- **模組路徑**: `packages/flow-validator/`
- **主要維護者**: SpecPilot Team

---

## 概述

Flow Validator 是 SpecPilot 的測試流程驗證引擎,負責確保產生或手動編輯的 Flow 定義符合格式規範與語意正確性。整合 JSON Schema 驗證與語意檢查,提供完整的驗證報告與修正建議。

### 設計目標

1. **格式正確性** - 確保 Flow 符合 SpecPilot 定義的 JSON Schema
2. **語意正確性** - 驗證 Flow 與 OpenAPI 規格的語意一致性
3. **可用性檢查** - 檢查變數引用、依賴關係等執行時問題
4. **清晰回饋** - 提供詳細的錯誤訊息與修正建議

---

## 核心元件

### 1. SchemaValidator（Schema 驗證器）

**職責**: 驗證 Flow 定義是否符合 JSON Schema 規範

**主要方法**:
```typescript
class SchemaValidator {
  constructor(options?: SchemaValidationOptions);

  // 驗證 Flow 格式
  validate(flow: FlowDefinition): ValidationError[];

  // 驗證步驟 ID 唯一性
  validateUniqueStepIds(flow: FlowDefinition): ValidationError[];
}
```

**驗證項目**:
1. **必要欄位檢查**
   - Flow 必須有 `name` 和 `steps`
   - 每個 Step 必須有 `name`、`request`、`expect`

2. **型別檢查**
   - 欄位型別符合定義（string, number, boolean, object, array）
   - 列舉值檢查（method 必須是 GET/POST/PUT/PATCH/DELETE 之一）

3. **格式檢查**
   - URL path 格式
   - 變數語法 `{{variableName}}`
   - HTTP 狀態碼範圍（100-599）

**驗證錯誤結構**:
```typescript
interface ValidationError {
  path: string;      // 錯誤位置,如 "steps[0].request.method"
  message: string;   // 錯誤訊息
  expected?: any;    // 期望值
  actual?: any;      // 實際值
}
```

**使用範例**:
```typescript
const validator = new SchemaValidator({ strict: true });

const flow = {
  name: 'Test Flow',
  steps: [
    {
      name: 'Create User',
      request: {
        method: 'POST',
        path: '/api/users',
        body: { name: 'test' }
      },
      expect: {
        statusCode: 201
      }
    }
  ]
};

const errors = validator.validate(flow);

if (errors.length > 0) {
  console.log('驗證失敗:');
  errors.forEach(err => {
    console.log(`  [${err.path}] ${err.message}`);
  });
} else {
  console.log('✅ Schema 驗證通過');
}
```

**常見錯誤範例**:

```typescript
// 錯誤 1: 缺少必要欄位
{
  name: 'Test',
  steps: [
    {
      request: { method: 'GET', path: '/api/users' }
      // 缺少 expect
    }
  ]
}
// 錯誤: steps[0]: 必須包含 'expect' 欄位

// 錯誤 2: 無效的 HTTP 方法
{
  name: 'Test',
  steps: [{
    name: 'test',
    request: { method: 'INVALID', path: '/api/users' },
    expect: { statusCode: 200 }
  }]
}
// 錯誤: steps[0].request.method: 必須是 GET, POST, PUT, PATCH, DELETE 之一

// 錯誤 3: 無效的狀態碼
{
  name: 'Test',
  steps: [{
    name: 'test',
    request: { method: 'GET', path: '/api/users' },
    expect: { statusCode: 999 }
  }]
}
// 錯誤: steps[0].expect.statusCode: 必須在 100-599 之間
```

---

### 2. SemanticValidator（語意驗證器）

**職責**: 驗證 Flow 與 OpenAPI 規格的語意一致性

**主要方法**:
```typescript
class SemanticValidator {
  constructor(spec: OpenAPIDocument, options?: SemanticValidationOptions);

  // 執行完整語意驗證
  validate(flow: FlowDefinition): ValidationResult;

  // 驗證端點存在性
  validateEndpoints(flow: FlowDefinition): ValidationError[];

  // 驗證變數引用
  validateVariableReferences(flow: FlowDefinition): ValidationError[];

  // 驗證認證流程
  validateAuthFlow(flow: FlowDefinition): ValidationError[];
}
```

**驗證項目**:

#### 1. 端點存在性檢查
```typescript
// 檢查 Flow 中使用的端點是否在 OpenAPI 規格中定義

// 範例錯誤:
steps: [{
  name: 'Get User',
  request: {
    method: 'POST',  // OpenAPI 中定義為 GET
    path: '/api/users/123'
  }
}]

// 錯誤: steps[0]: POST /api/users/123 在 OpenAPI 規格中不存在
//      (規格中定義的是 GET /api/users/{id})
```

#### 2. 變數引用檢查
```typescript
// 檢查變數引用是否已定義

// 範例錯誤:
steps: [
  {
    name: 'Create User',
    request: { method: 'POST', path: '/api/users' },
    expect: { statusCode: 201 }
    // 未提取 userId 變數
  },
  {
    name: 'Get User',
    request: {
      method: 'GET',
      path: '/api/users/{{userId}}'  // 引用未定義的變數
    },
    expect: { statusCode: 200 }
  }
]

// 錯誤: steps[1].request.path: 引用了未定義的變數 'userId'
//      建議: 在 steps[0] 中新增 capture 提取此變數
```

#### 3. 認證流程檢查
```typescript
// 檢查需要認證的端點是否有正確的認證流程

// 範例錯誤:
steps: [
  {
    name: 'Get Protected Resource',
    request: {
      method: 'GET',
      path: '/api/protected'
      // 缺少 headers.Authorization
    },
    expect: { statusCode: 200 }
  }
]

// 警告: steps[0]: 此端點需要認證,但未提供 Authorization header
//       建議: 在此步驟前執行登入流程,或在 globals 中設定 token
```

#### 4. 請求 Body Schema 檢查
```typescript
// 檢查請求 Body 是否符合 OpenAPI 定義的 Schema

// 範例錯誤:
// OpenAPI 定義:
// requestBody:
//   schema:
//     required: ['name', 'email']
//     properties:
//       name: { type: 'string' }
//       email: { type: 'string', format: 'email' }

// Flow:
steps: [{
  name: 'Create User',
  request: {
    method: 'POST',
    path: '/api/users',
    body: {
      name: 'test'
      // 缺少 email
    }
  }
}]

// 錯誤: steps[0].request.body: 缺少必要欄位 'email'
```

**使用範例**:
```typescript
const semanticValidator = new SemanticValidator(openApiDoc, {
  checkOperationIds: true,
  checkVariableReferences: true,
  checkAuthFlow: true,
  checkRequestBodySchema: false  // 選擇性檢查
});

const flow = {
  name: 'User CRUD Flow',
  steps: [
    {
      name: 'Create User',
      request: {
        method: 'POST',
        path: '/api/users',
        body: { name: 'test', email: 'test@example.com' }
      },
      capture: [{
        variableName: 'userId',
        path: 'id'
      }],
      expect: { statusCode: 201 }
    },
    {
      name: 'Get User',
      request: {
        method: 'GET',
        path: '/api/users/{{userId}}'
      },
      expect: { statusCode: 200 }
    }
  ]
};

const result = semanticValidator.validate(flow);

if (!result.valid) {
  console.log('語意驗證失敗:');
  result.errors.forEach(err => {
    console.log(`  [${err.path}] ${err.message}`);
  });
}

if (result.warnings.length > 0) {
  console.log('\n警告:');
  result.warnings.forEach(warn => {
    console.log(`  [${warn.path}] ${warn.message}`);
  });
}
```

---

### 3. FlowValidator（整合驗證器）

**職責**: 整合 Schema 驗證與語意驗證,提供統一介面

**主要方法**:
```typescript
class FlowValidator {
  constructor(config: FlowValidatorConfig);

  // 執行完整驗證
  validate(flow: FlowDefinition): ValidationResult;

  // 快速驗證（僅 Schema）
  quickValidate(flow: FlowDefinition): ValidationResult;
}
```

**配置選項**:
```typescript
interface FlowValidatorConfig {
  spec: OpenAPIDocument;
  schemaOptions?: SchemaValidationOptions;
  semanticOptions?: SemanticValidationOptions;
}

interface SchemaValidationOptions {
  strict?: boolean;  // 嚴格模式,預設: true
}

interface SemanticValidationOptions {
  checkOperationIds?: boolean;      // 檢查端點存在性,預設: true
  checkVariableReferences?: boolean; // 檢查變數引用,預設: true
  checkAuthFlow?: boolean;           // 檢查認證流程,預設: false
  checkRequestBodySchema?: boolean;  // 檢查請求 Body Schema,預設: false
}
```

**驗證結果**:
```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}
```

**完整使用範例**:
```typescript
import { FlowValidator } from '@specpilot/flow-validator';
import { loadSpec } from '@specpilot/spec-loader';
import { loadFlow } from '@specpilot/flow-parser';

async function validateFlowFile() {
  // 1. 載入 OpenAPI 規格
  const spec = await loadSpec({ filePath: 'specs/api.yaml' });

  // 2. 載入 Flow
  const flow = await loadFlow({ filePath: 'flows/user-crud.yaml' });

  // 3. 建立驗證器
  const validator = new FlowValidator({
    spec: spec.document,
    schemaOptions: {
      strict: true
    },
    semanticOptions: {
      checkOperationIds: true,
      checkVariableReferences: true,
      checkAuthFlow: true,
      checkRequestBodySchema: false
    }
  });

  // 4. 執行驗證
  const result = validator.validate(flow);

  // 5. 處理結果
  if (result.valid) {
    console.log('✅ Flow 驗證通過');

    if (result.warnings.length > 0) {
      console.log(`\n⚠️  發現 ${result.warnings.length} 個警告:`);
      result.warnings.forEach((warn, i) => {
        console.log(`  ${i + 1}. [${warn.path}]`);
        console.log(`     ${warn.message}`);
        if (warn.suggestion) {
          console.log(`     建議: ${warn.suggestion}`);
        }
      });
    }
  } else {
    console.log(`❌ Flow 驗證失敗,發現 ${result.errors.length} 個錯誤:`);
    result.errors.forEach((err, i) => {
      console.log(`  ${i + 1}. [${err.path}]`);
      console.log(`     ${err.message}`);
    });

    process.exit(1);
  }
}

validateFlowFile().catch(console.error);
```

---

## MCP 整合

Flow Validator 透過 MCP Server 的 `validateFlow` 工具暴露:

```typescript
server.registerTool("validateFlow", {
  title: "驗證 Flow 格式",
  description: "驗證測試 Flow 的格式與語義是否正確",
  inputSchema: {
    flowContent: z.string().describe("Flow YAML 內容"),
    specPath: z.string().describe("OpenAPI 規格檔案路徑")
  }
}, async (params) => {
  // 載入規格
  const spec = await loadSpec({ filePath: params.specPath });

  // 解析 Flow
  const { parse: yamlParse } = await import('yaml');
  const flowData = yamlParse(params.flowContent);

  // 建立驗證器
  const validator = new FlowValidator({
    spec: spec.document,
    schemaOptions: { strict: false },
    semanticOptions: {
      checkOperationIds: true,
      checkVariableReferences: true,
      checkAuthFlow: false
    }
  });

  // 執行驗證
  const result = validator.validate(flowData);

  if (result.valid) {
    return {
      content: [{
        type: "text",
        text: `✅ Flow 驗證通過！\n\n` +
              `總錯誤數：0\n` +
              `警告數：${result.warnings.length}\n` +
              (result.warnings.length > 0
                ? `\n⚠️ 警告：\n${result.warnings.map((w, i) => `${i + 1}. ${w.message}`).join('\n')}`
                : '')
      }]
    };
  } else {
    return {
      content: [{
        type: "text",
        text: `❌ Flow 驗證失敗\n\n` +
              `總錯誤數：${result.errors.length}\n` +
              `警告數：${result.warnings.length}\n\n` +
              `🔴 錯誤清單：\n${result.errors.map((e, i) => `${i + 1}. [${e.path || 'flow'}] ${e.message}`).join('\n')}`
      }]
    };
  }
});
```

---

## CI/CD 整合

### GitHub Actions 範例

```yaml
name: Validate Flows

on:
  push:
    paths:
      - 'flows/**/*.yaml'
  pull_request:
    paths:
      - 'flows/**/*.yaml'

jobs:
  validate:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install Dependencies
        run: pnpm install

      - name: Validate All Flows
        run: |
          for flow in flows/*.yaml; do
            echo "Validating $flow..."
            pnpm run validate-flow -- --flow "$flow" --spec specs/api.yaml
          done
```

### 驗證 CLI 腳本

```typescript
// scripts/validate-flow.ts
import { FlowValidator } from '@specpilot/flow-validator';
import { loadSpec } from '@specpilot/spec-loader';
import { loadFlow } from '@specpilot/flow-parser';

async function main() {
  const args = process.argv.slice(2);
  const flowPath = args.find(a => a.startsWith('--flow='))?.split('=')[1];
  const specPath = args.find(a => a.startsWith('--spec='))?.split('=')[1];

  if (!flowPath || !specPath) {
    console.error('Usage: validate-flow --flow=<path> --spec=<path>');
    process.exit(1);
  }

  const spec = await loadSpec({ filePath: specPath });
  const flow = await loadFlow({ filePath: flowPath });

  const validator = new FlowValidator({
    spec: spec.document,
    schemaOptions: { strict: true },
    semanticOptions: {
      checkOperationIds: true,
      checkVariableReferences: true
    }
  });

  const result = validator.validate(flow);

  if (!result.valid) {
    console.error(`❌ ${flowPath} 驗證失敗`);
    result.errors.forEach(err => {
      console.error(`  [${err.path}] ${err.message}`);
    });
    process.exit(1);
  }

  console.log(`✅ ${flowPath} 驗證通過`);
}

main().catch(console.error);
```

---

## 測試

### 單元測試範例

```typescript
describe('SchemaValidator', () => {
  it('should pass valid flow', () => {
    const validator = new SchemaValidator();
    const flow = {
      name: 'Test',
      steps: [{
        name: 'step1',
        request: { method: 'GET', path: '/api/test' },
        expect: { statusCode: 200 }
      }]
    };

    const errors = validator.validate(flow);
    expect(errors).toHaveLength(0);
  });

  it('should detect missing name', () => {
    const validator = new SchemaValidator();
    const flow = {
      steps: [{
        name: 'step1',
        request: { method: 'GET', path: '/api/test' },
        expect: { statusCode: 200 }
      }]
    };

    const errors = validator.validate(flow);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('name');
  });

  it('should detect invalid HTTP method', () => {
    const validator = new SchemaValidator();
    const flow = {
      name: 'Test',
      steps: [{
        name: 'step1',
        request: { method: 'INVALID', path: '/api/test' },
        expect: { statusCode: 200 }
      }]
    };

    const errors = validator.validate(flow);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toContain('method');
  });
});
```

---

## 限制與已知問題

### 當前限制
1. **Schema 驗證限制** - 僅檢查基本格式,不檢查深層 Schema 結構
2. **變數引用檢查** - 僅檢查簡單的 `{{varName}}` 語法,不支援 JSON Path
3. **認證流程檢查** - 目前僅檢查 Bearer token,不支援其他認證方式

### 規劃改進
1. 支援更完整的 JSON Schema 驗證
2. 支援複雜的變數引用語法（如 `{{response.data.id}}`）
3. 支援多種認證方式的檢查（OAuth2, API Key 等）
4. 提供自訂驗證規則擴充機制

---

## 相關文件

- [總覽](./overview.md)
- [Flow Generator](./flow-generator.md)
- [Test Suite Generator](./test-suite-generator.md)
- [MCP Server 增強功能](./mcp-server-enhancements.md)

---

**最後更新**: 2025-01-16
**模組版本**: v0.2.0
