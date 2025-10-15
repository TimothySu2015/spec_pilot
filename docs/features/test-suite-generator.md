# Test Suite Generator（測試套件自動產生器）

## 模組資訊
- **模組名稱**: `@specpilot/test-suite-generator`
- **版本**: v0.2.0
- **模組路徑**: `packages/test-suite-generator/`
- **主要維護者**: SpecPilot Team

---

## 概述

Test Suite Generator 是 SpecPilot 的自動化測試套件產生引擎,能夠根據 OpenAPI 規格自動產生完整的測試流程 YAML,涵蓋成功案例、錯誤處理、邊界測試及資源依賴串接。

### 設計目標

1. **完整覆蓋** - 自動產生所有端點的測試案例
2. **智能推導** - 根據 Schema 自動推導錯誤案例與邊界值
3. **依賴處理** - 自動解析資源依賴關係,產生正確的測試順序
4. **高品質** - 內建品質檢查機制,確保產生的測試符合最佳實踐

---

## 核心元件

### 1. SpecAnalyzer（規格分析器）

**職責**: 深度分析 OpenAPI 規格,提取端點資訊、Schema 定義、認證要求等

**主要方法**:
```typescript
class SpecAnalyzer {
  constructor(config: SpecAnalyzerConfig);

  // 提取所有端點
  extractEndpoints(): EndpointInfo[];

  // 取得認證流程
  getAuthenticationFlow(): AuthFlowInfo | null;

  // 取得 Schema 定義
  getSchemaByName(schemaName: string): JSONSchema | null;

  // 分析端點依賴關係
  analyzeEndpointDependencies(): DependencyGraph;
}
```

**端點資訊結構**:
```typescript
interface EndpointInfo {
  operationId: string;
  method: string;
  path: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterInfo[];
  requestBody?: {
    required: boolean;
    schema: JSONSchema;
  };
  responses: Record<string, {
    description: string;
    schema?: JSONSchema;
  }>;
  security?: Array<Record<string, string[]>>;
}
```

**使用範例**:
```typescript
const analyzer = new SpecAnalyzer({ spec: openApiDoc });

// 提取所有端點
const endpoints = analyzer.extractEndpoints();
console.log(`找到 ${endpoints.length} 個端點`);

// 取得認證流程
const authFlow = analyzer.getAuthenticationFlow();
if (authFlow) {
  console.log(`認證端點: ${authFlow.method} ${authFlow.path}`);
  console.log(`Token 欄位: ${authFlow.tokenField}`);
}
```

---

### 2. CRUDGenerator（CRUD 測試產生器）

**職責**: 產生 CRUD 操作的成功案例測試

**主要方法**:
```typescript
class CRUDGenerator {
  constructor(config?: CRUDGeneratorConfig);

  // 產生成功案例
  generateSuccessCases(endpoint: EndpointInfo): FlowStep[];

  // 產生測試資料
  generateTestData(schema: JSONSchema): any;
}
```

**產生策略**:
- **POST**: 使用 Schema 的 example 或自動產生符合 Schema 的資料
- **GET**: 產生基本讀取請求,支援查詢參數
- **PUT/PATCH**: 產生更新請求,使用生成的測試資料
- **DELETE**: 產生刪除請求

**範例**:
```typescript
const generator = new CRUDGenerator({ useExamples: true });

const endpoint = {
  operationId: 'createUser',
  method: 'POST',
  path: '/api/users',
  requestBody: {
    required: true,
    schema: {
      type: 'object',
      required: ['name', 'email'],
      properties: {
        name: { type: 'string', example: '測試使用者' },
        email: { type: 'string', format: 'email', example: 'test@example.com' },
        age: { type: 'number', minimum: 0, maximum: 150 }
      }
    }
  },
  responses: {
    201: { ... }
  }
};

const steps = generator.generateSuccessCases(endpoint);

// 產生的步驟:
// - name: 建立新使用者 - 成功案例
//   request:
//     method: POST
//     path: /api/users
//     body:
//       name: 測試使用者
//       email: test@example.com
//       age: 25
//   expect:
//     statusCode: 201
```

---

### 3. ErrorCaseGenerator（錯誤案例產生器）

**職責**: 自動產生錯誤處理測試案例

**主要方法**:
```typescript
class ErrorCaseGenerator {
  constructor(config?: ErrorCaseGeneratorConfig);

  // 產生缺少必要欄位的錯誤案例
  generateMissingFieldCases(endpoint: EndpointInfo): FlowStep[];

  // 產生格式驗證錯誤案例
  generateFormatValidationCases(endpoint: EndpointInfo): FlowStep[];

  // 產生認證錯誤案例
  generateAuthErrorCases(endpoint: EndpointInfo): FlowStep[];
}
```

**錯誤案例類型**:

1. **缺少必要欄位**
```typescript
// Schema: { required: ['name', 'email'] }
// 產生:
// - 缺少 name
// - 缺少 email
```

2. **格式驗證錯誤**
```typescript
// Schema: { email: { type: 'string', format: 'email' } }
// 產生:
// - email: 'invalid-email' (無效格式)
// - email: '' (空字串)
// - email: 123 (錯誤型別)
```

3. **認證錯誤**
```typescript
// 如果端點需要認證
// 產生:
// - 無 Authorization Header (401)
// - 無效 Token (401/403)
```

**使用範例**:
```typescript
const generator = new ErrorCaseGenerator({
  includeMissingFields: true,
  includeInvalidFormats: true,
  includeAuthErrors: true
});

const endpoint = {
  operationId: 'createUser',
  method: 'POST',
  path: '/api/users',
  requestBody: {
    required: true,
    schema: {
      type: 'object',
      required: ['name', 'email'],
      properties: {
        name: { type: 'string', minLength: 1 },
        email: { type: 'string', format: 'email' }
      }
    }
  },
  security: [{ bearerAuth: [] }]
};

// 產生缺少欄位案例
const missingFieldSteps = generator.generateMissingFieldCases(endpoint);
// 產生: 缺少 name、缺少 email

// 產生格式驗證案例
const formatSteps = generator.generateFormatValidationCases(endpoint);
// 產生:
//   - name: '' (違反 minLength)
//   - email: 'invalid-email' (違反 format)
//   - email: 123 (錯誤型別)

// 產生認證錯誤案例
const authSteps = generator.generateAuthErrorCases(endpoint);
// 產生: 無認證 Header
```

---

### 4. EdgeCaseGenerator（邊界測試產生器）

**職責**: 產生邊界值測試案例

**主要方法**:
```typescript
class EdgeCaseGenerator {
  generateEdgeCases(endpoint: EndpointInfo): FlowStep[];
}
```

**邊界測試類型**:
- **數值邊界**: minimum、maximum、minimum-1、maximum+1
- **字串長度**: minLength、maxLength、minLength-1、maxLength+1
- **陣列長度**: minItems、maxItems、empty array、oversized array
- **特殊字元**: null、空字串、超長字串、特殊 Unicode

**範例**:
```typescript
const generator = new EdgeCaseGenerator();

const endpoint = {
  operationId: 'updateUser',
  method: 'PATCH',
  path: '/api/users/{id}',
  requestBody: {
    schema: {
      properties: {
        age: { type: 'number', minimum: 0, maximum: 150 },
        bio: { type: 'string', maxLength: 500 }
      }
    }
  }
};

const steps = generator.generateEdgeCases(endpoint);

// 產生的測試:
// - age: 0 (最小值)
// - age: 150 (最大值)
// - age: -1 (超出最小值)
// - age: 151 (超出最大值)
// - bio: (長度 500 的字串) (最大長度)
// - bio: (長度 501 的字串) (超出最大長度)
```

---

### 5. DependencyResolver（依賴解析器）

**職責**: 分析資源依賴關係,產生正確的測試執行順序

**主要方法**:
```typescript
class DependencyResolver {
  // 解析執行順序
  resolveExecutionOrder(endpoints: EndpointInfo[]): FlowStep[];

  // 建立依賴圖
  buildDependencyGraph(endpoints: EndpointInfo[]): DependencyGraph;
}
```

**依賴識別規則**:
1. 路徑參數依賴 - `GET /users/{id}` 依賴 `POST /users`
2. 請求 Body 參數依賴 - `POST /orders` 的 `userId` 依賴 `POST /users`
3. 操作順序 - DELETE 依賴 READ/UPDATE,UPDATE 依賴 CREATE

**範例**:
```typescript
const resolver = new DependencyResolver();

const endpoints = [
  { operationId: 'listUsers', method: 'GET', path: '/api/users' },
  { operationId: 'createUser', method: 'POST', path: '/api/users' },
  { operationId: 'getUser', method: 'GET', path: '/api/users/{id}' },
  { operationId: 'updateUser', method: 'PUT', path: '/api/users/{id}' },
  { operationId: 'deleteUser', method: 'DELETE', path: '/api/users/{id}' }
];

const flowSteps = resolver.resolveExecutionOrder(endpoints);

// 產生的順序:
// 1. 建立 createUser (提取 id 變數)
// 2. 取得 getUser (使用 {{resourceId}})
// 3. 更新 updateUser (使用 {{resourceId}})
// 4. 刪除 deleteUser (使用 {{resourceId}})
```

---

### 6. DataSynthesizer（測試資料合成器）

**職責**: 根據 JSON Schema 產生符合規範的測試資料

**主要方法**:
```typescript
class DataSynthesizer {
  // 產生符合 Schema 的資料
  synthesize(schema: JSONSchema, options?: SynthesizeOptions): any;

  // 產生邊界值資料
  generateBoundaryValues(schema: JSONSchema): any[];
}
```

**資料產生策略**:
1. **優先使用 example** - 如果 Schema 有 example 欄位
2. **根據 format 產生** - email→valid email, uuid→valid uuid
3. **根據 pattern 產生** - regex pattern matching
4. **根據型別產生** - string, number, boolean, array, object
5. **符合約束** - minLength, maxLength, minimum, maximum 等

**範例**:
```typescript
const synthesizer = new DataSynthesizer();

const schema = {
  type: 'object',
  required: ['name', 'email', 'age'],
  properties: {
    name: {
      type: 'string',
      minLength: 2,
      maxLength: 50
    },
    email: {
      type: 'string',
      format: 'email'
    },
    age: {
      type: 'number',
      minimum: 0,
      maximum: 150
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 5
    }
  }
};

const testData = synthesizer.synthesize(schema);

// 產生結果:
{
  name: '測',  // 符合 minLength: 2
  email: 'test@example.tw',  // 符合 email format
  age: 25,  // 符合 minimum, maximum
  tags: ['tag1']  // 符合 minItems: 1
}
```

---

### 7. FlowQualityChecker（Flow 品質檢查器）

**職責**: 檢查產生的 Flow 品質,提供改進建議

**主要方法**:
```typescript
class FlowQualityChecker {
  constructor(spec: OpenAPIDocument, flow: FlowDefinition);

  // 執行品質檢查
  check(): QualityReport;

  // 產生修正建議
  generateFixSuggestions(report: QualityReport): FixSuggestion[];
}
```

**檢查項目**:
```typescript
interface QualityIssue {
  type: 'missing_test_data' | 'invalid_status_code' |
        'missing_validation' | 'unreachable_step' |
        'missing_variable_extraction' | 'unused_variable';
  severity: 'error' | 'warning' | 'info';
  message: string;
  location: string;  // 問題位置 (e.g., "step 3: createUser")
  suggestion: string;
}
```

**品質報表**:
```typescript
interface QualityReport {
  score: number;  // 0-100 分
  totalIssues: number;
  errors: number;
  warnings: number;
  infos: number;
  issues: QualityIssue[];
}
```

**使用範例**:
```typescript
const checker = new FlowQualityChecker(openApiDoc, generatedFlow);

const report = checker.check();

console.log(`品質評分: ${report.score}/100`);
console.log(`總問題數: ${report.totalIssues}`);

report.issues.forEach((issue, i) => {
  console.log(`${i + 1}. [${issue.severity}] ${issue.location}`);
  console.log(`   問題: ${issue.message}`);
  console.log(`   建議: ${issue.suggestion}`);
});

// 產生修正建議
const suggestions = checker.generateFixSuggestions(report);

suggestions.forEach(suggestion => {
  console.log(`步驟 ${suggestion.stepIndex}: ${suggestion.fieldPath}`);
  console.log(`  當前值: ${suggestion.currentValue}`);
  console.log(`  建議值: ${suggestion.suggestedValue}`);
  console.log(`  原因: ${suggestion.reason}`);
});
```

---

### 8. TestSuiteGenerator（主產生器）

**職責**: 整合所有產生器,產生完整測試套件

**主要方法**:
```typescript
class TestSuiteGenerator {
  constructor(specAnalyzer: SpecAnalyzer, options?: GenerationOptions);

  // 產生測試套件
  generate(options?: GenerationOptions): FlowDefinition;

  // 取得摘要資訊
  getSummary(flow: FlowDefinition): TestSuiteSummary;
}
```

**產生選項**:
```typescript
interface GenerationOptions {
  endpoints?: string[];             // 指定端點,若未指定則全部產生
  includeSuccessCases?: boolean;    // 預設: true
  includeErrorCases?: boolean;      // 預設: false
  includeEdgeCases?: boolean;       // 預設: false
  includeAuthTests?: boolean;       // 預設: true
  generateFlows?: boolean;          // 產生流程串接,預設: false
}
```

**完整範例**:
```typescript
import { loadSpec } from '@specpilot/spec-loader';
import { SpecAnalyzer, TestSuiteGenerator } from '@specpilot/test-suite-generator';
import { stringify } from 'yaml';

async function generateTestSuite() {
  // 1. 載入規格
  const spec = await loadSpec({ filePath: 'specs/user-api.yaml' });

  // 2. 分析規格
  const analyzer = new SpecAnalyzer({ spec: spec.document });
  const endpoints = analyzer.extractEndpoints();
  console.log(`找到 ${endpoints.length} 個端點`);

  // 3. 產生測試套件
  const generator = new TestSuiteGenerator(analyzer);

  const testSuite = generator.generate({
    includeSuccessCases: true,
    includeErrorCases: true,
    includeEdgeCases: false,
    generateFlows: true  // 啟用 CRUD 流程串接
  });

  // 4. 取得摘要
  const summary = generator.getSummary(testSuite);
  console.log('測試套件摘要:');
  console.log(`  總測試數: ${summary.totalTests}`);
  console.log(`  成功案例: ${summary.successTests}`);
  console.log(`  錯誤案例: ${summary.errorTests}`);
  console.log(`  邊界測試: ${summary.edgeTests}`);
  console.log(`  涵蓋端點: ${summary.endpoints.join(', ')}`);

  // 5. 輸出 YAML
  const yamlContent = stringify(testSuite);
  console.log('\n產生的 Flow:');
  console.log(yamlContent);

  return testSuite;
}
```

---

## 完整使用案例

### 案例 1: 產生使用者管理 API 測試套件

```typescript
import { loadSpec } from '@specpilot/spec-loader';
import { SpecAnalyzer, TestSuiteGenerator, FlowQualityChecker } from '@specpilot/test-suite-generator';
import { FlowValidator } from '@specpilot/flow-validator';
import { stringify } from 'yaml';
import * as fs from 'fs/promises';

async function generateUserManagementTests() {
  // 1. 載入規格
  const spec = await loadSpec({ filePath: 'specs/user-management-api.yaml' });

  // 2. 分析規格
  const analyzer = new SpecAnalyzer({ spec: spec.document });

  // 3. 產生完整測試套件
  const generator = new TestSuiteGenerator(analyzer);
  const testSuite = generator.generate({
    includeSuccessCases: true,
    includeErrorCases: true,
    includeEdgeCases: true,
    includeAuthTests: true,
    generateFlows: true
  });

  console.log(`產生了 ${testSuite.steps.length} 個測試步驟`);

  // 4. 品質檢查
  const qualityChecker = new FlowQualityChecker(spec.document, testSuite);
  const qualityReport = qualityChecker.check();

  console.log(`\n品質檢查:`);
  console.log(`  評分: ${qualityReport.score}/100`);
  console.log(`  問題數: ${qualityReport.totalIssues}`);

  if (qualityReport.totalIssues > 0) {
    console.log(`\n發現的問題:`);
    qualityReport.issues.slice(0, 5).forEach((issue, i) => {
      console.log(`  ${i + 1}. [${issue.severity}] ${issue.message}`);
    });
  }

  // 5. 驗證 Flow
  const validator = new FlowValidator({
    spec: spec.document,
    schemaOptions: { strict: false },
    semanticOptions: {
      checkOperationIds: true,
      checkVariableReferences: true
    }
  });

  const validationResult = validator.validate(testSuite);

  if (!validationResult.valid) {
    console.log('\n驗證失敗:');
    validationResult.errors.forEach(err => {
      console.log(`  - ${err.message}`);
    });
    return;
  }

  console.log('\n✅ 驗證通過');

  // 6. 儲存到檔案
  const yamlContent = stringify(testSuite);
  await fs.writeFile('flows/user-management-tests.yaml', yamlContent, 'utf-8');

  console.log('\n測試套件已儲存至: flows/user-management-tests.yaml');
}

generateUserManagementTests().catch(console.error);
```

---

## MCP 整合

Test Suite Generator 透過 MCP Server 的 `generateFlow` 工具暴露:

```typescript
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
}, async (params) => {
  // 載入規格
  const spec = await loadSpec({ filePath: params.specPath });

  // 產生測試套件
  const analyzer = new SpecAnalyzer({ spec: spec.document });
  const generator = new TestSuiteGenerator(analyzer, params.options);
  const flow = generator.generate(params.options);

  // 驗證
  const validator = new FlowValidator({ spec: spec.document });
  const validationResult = validator.validate(flow);

  if (!validationResult.valid) {
    return {
      content: [{
        type: "text",
        text: `產生的測試套件驗證失敗:\n${validationResult.errors.map(e => e.message).join('\n')}`
      }]
    };
  }

  // 回傳
  const summary = generator.getSummary(flow);
  const yamlContent = stringify(flow);

  return {
    content: [{
      type: "text",
      text: `✅ 成功產生測試 Flow\n\n` +
            `總步驟數:${flow.steps.length}\n` +
            `成功案例:${summary.successTests}\n` +
            `錯誤案例:${summary.errorTests}\n\n` +
            `\`\`\`yaml\n${yamlContent}\n\`\`\``
    }]
  };
});
```

---

## 測試覆蓋率

### 模組測試覆蓋率
- **SpecAnalyzer**: 90%
- **CRUDGenerator**: 85%
- **ErrorCaseGenerator**: 82%
- **DependencyResolver**: 78%
- **FlowQualityChecker**: 80%

### 測試檔案
- `packages/test-suite-generator/__tests__/spec-analyzer.test.ts`
- `packages/test-suite-generator/__tests__/crud-generator.test.ts`
- `tests/e2e/flow-generation.e2e.spec.ts`

---

## 限制與已知問題

### 當前限制
1. **複雜依賴處理** - 目前僅支援簡單的資源依賴（如 Create→Read→Update→Delete）
2. **邊界測試完整性** - 部分複雜 Schema 約束的邊界測試可能不完整
3. **測試資料真實性** - 產生的測試資料可能不符合業務邏輯約束

### 規劃改進
1. 支援更複雜的資源依賴關係（如多對多關係）
2. 整合 Faker.js 產生更真實的測試資料
3. 支援自訂測試資料產生器
4. 改進錯誤案例推導演算法

---

## 相關文件

- [總覽](./overview.md)
- [Flow Generator](./flow-generator.md)
- [Flow Validator](./flow-validator.md)
- [MCP Server 增強功能](./mcp-server-enhancements.md)

---

**最後更新**: 2025-01-16
**模組版本**: v0.2.0
