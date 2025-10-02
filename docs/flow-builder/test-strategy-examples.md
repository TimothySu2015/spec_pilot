# Flow Builder 測試策略與具體案例

## 文件目的

提供完整的測試案例與驗收標準,確保 Flow Builder UI 與 SpecPilot 整合的正確性。

---

## 測試金字塔

```
           /\
          /  \
         / E2E \      10% - 端對端測試
        /______\
       /        \
      / Integration\ 30% - 整合測試
     /____________\
    /              \
   /   Unit Tests   \  60% - 單元測試
  /__________________\
```

**目標覆蓋率:**
- 整體覆蓋率: ≥80%
- 關鍵模組: ≥85% (`packages/schemas`, `packages/flow-parser`)

---

## 1. 單元測試 (Unit Tests)

### 1.1 Zod Schema 定義測試

**測試檔案:** `packages/schemas/__tests__/flow-schema.test.ts`

**測試案例:**

```typescript
import { describe, it, expect } from 'vitest';
import { FlowDefinitionSchema, FlowStepSchema } from '../src/flow-schema';

describe('FlowDefinitionSchema', () => {
  it('應該驗證有效的 Flow 定義', () => {
    const validFlow = {
      name: '測試流程',
      description: '測試描述',
      version: '1.0.0',
      baseUrl: 'http://localhost:3000',
      variables: {
        admin_username: 'admin',
        admin_password: '123456',
      },
      steps: [
        {
          name: '登入測試',
          request: {
            method: 'POST',
            path: '/api/auth/login',
            body: {
              username: '{{admin_username}}',
              password: '{{admin_password}}',
            },
          },
          expect: {
            statusCode: 200,
          },
        },
      ],
    };

    const result = FlowDefinitionSchema.safeParse(validFlow);
    expect(result.success).toBe(true);
  });

  it('應該拒絕缺少必填欄位的 Flow', () => {
    const invalidFlow = {
      description: '缺少 name 欄位',
    };

    const result = FlowDefinitionSchema.safeParse(invalidFlow);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('name');
    }
  });

  it('應該接受變數插值語法', () => {
    const flowWithVariables = {
      name: '變數測試',
      baseUrl: 'http://localhost:3000',
      steps: [
        {
          name: '測試步驟',
          request: {
            method: 'GET',
            path: '/api/users/{{user_id}}',
          },
          expect: {
            statusCode: 200,
            body: {
              email: '{{test_email}}',
            },
          },
        },
      ],
    };

    const result = FlowDefinitionSchema.safeParse(flowWithVariables);
    expect(result.success).toBe(true);
  });
});
```

**驗收標準:**
- ✅ 所有 Schema 定義測試通過
- ✅ 覆蓋率 ≥85%
- ✅ 測試所有必填與選填欄位組合

---

### 1.2 Zod ↔ JSON Schema 轉換測試

**測試檔案:** `packages/schemas/__tests__/schema-conversion.test.ts`

**測試案例:**

```typescript
import { describe, it, expect } from 'vitest';
import { zodToJsonSchema } from 'zod-to-json-schema';
import Ajv from 'ajv';
import { FlowDefinitionSchema } from '../src/flow-schema';

describe('Zod ↔ JSON Schema 轉換一致性', () => {
  const ajv = new Ajv({ allErrors: true });

  it('應該正確轉換 FlowDefinitionSchema 為 JSON Schema', () => {
    const jsonSchema = zodToJsonSchema(FlowDefinitionSchema, {
      name: 'FlowDefinition',
    });

    expect(jsonSchema).toHaveProperty('$schema');
    expect(jsonSchema).toHaveProperty('properties');
    expect(jsonSchema.properties).toHaveProperty('name');
    expect(jsonSchema.properties).toHaveProperty('baseUrl');
  });

  it('Zod 與 JSON Schema 驗證結果應該一致 - 有效資料', () => {
    const validData = {
      name: '測試流程',
      baseUrl: 'http://localhost:3000',
      steps: [],
    };

    // Zod 驗證
    const zodResult = FlowDefinitionSchema.safeParse(validData);

    // JSON Schema 驗證
    const jsonSchema = zodToJsonSchema(FlowDefinitionSchema);
    const ajvValidate = ajv.compile(jsonSchema);
    const ajvResult = ajvValidate(validData);

    expect(zodResult.success).toBe(true);
    expect(ajvResult).toBe(true);
  });

  it('Zod 與 JSON Schema 驗證結果應該一致 - 無效資料', () => {
    const invalidData = {
      // 缺少 name
      baseUrl: 'http://localhost:3000',
      steps: [],
    };

    // Zod 驗證
    const zodResult = FlowDefinitionSchema.safeParse(invalidData);

    // JSON Schema 驗證
    const jsonSchema = zodToJsonSchema(FlowDefinitionSchema);
    const ajvValidate = ajv.compile(jsonSchema);
    const ajvResult = ajvValidate(invalidData);

    expect(zodResult.success).toBe(false);
    expect(ajvResult).toBe(false);
  });

  it('應該正確轉換變數插值的 regex pattern', () => {
    const jsonSchema = zodToJsonSchema(FlowDefinitionSchema);
    const pathSchema = jsonSchema.properties?.steps?.items?.properties?.request?.properties?.path;

    expect(pathSchema).toHaveProperty('pattern');
    // 確認 pattern 包含變數插值的正則表達式
    expect(pathSchema.pattern).toMatch(/{{.*}}/);
  });
});
```

**驗收標準:**
- ✅ Zod 與 JSON Schema 驗證結果 100% 一致
- ✅ 所有 Schema 欄位都能正確轉換
- ✅ 變數插值 pattern 轉換正確

---

### 1.3 變數解析測試

**測試檔案:** `packages/schemas/__tests__/variable-resolver.test.ts`

**測試案例:**

```typescript
import { describe, it, expect } from 'vitest';
import { VariableResolver } from '../src/utils/variable-resolver';

describe('VariableResolver', () => {
  const resolver = new VariableResolver();

  it('應該正確解析字串中的變數', () => {
    const input = '/api/users/{{user_id}}';
    const variables = { user_id: '123' };

    const result = resolver.resolve(input, variables);

    expect(result).toBe('/api/users/123');
  });

  it('應該正確解析物件中的所有變數', () => {
    const input = {
      path: '/api/users/{{user_id}}',
      body: {
        email: '{{test_email}}',
        name: '{{test_name}}',
      },
    };

    const variables = {
      user_id: '456',
      test_email: 'test@example.com',
      test_name: '測試使用者',
    };

    const result = resolver.resolve(input, variables);

    expect(result).toEqual({
      path: '/api/users/456',
      body: {
        email: 'test@example.com',
        name: '測試使用者',
      },
    });
  });

  it('應該正確解析陣列中的變數', () => {
    const input = [
      '/api/users/{{user_id}}',
      '/api/posts/{{post_id}}',
    ];

    const variables = {
      user_id: '123',
      post_id: '456',
    };

    const result = resolver.resolve(input, variables);

    expect(result).toEqual([
      '/api/users/123',
      '/api/posts/456',
    ]);
  });

  it('未定義的變數應該保留原樣', () => {
    const input = '/api/users/{{user_id}}/posts/{{post_id}}';
    const variables = { user_id: '123' }; // post_id 未定義

    const result = resolver.resolve(input, variables);

    expect(result).toBe('/api/users/123/posts/{{post_id}}');
  });

  it('應該追蹤未定義的變數並產生警告', () => {
    const input = {
      path: '/api/users/{{user_id}}',
      email: '{{undefined_var}}',
    };

    const variables = { user_id: '123' };

    const result = resolver.resolveWithValidation(input, variables);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({
      variable: 'undefined_var',
      message: expect.stringContaining('未定義'),
    });
  });
});
```

**驗收標準:**
- ✅ 所有變數類型都能正確解析 (字串、物件、陣列)
- ✅ 未定義變數處理正確
- ✅ 警告機制運作正常

---

## 2. 整合測試 (Integration Tests)

### 2.1 YAML 匯出整合測試

**測試檔案:** `packages/schemas/__tests__/integration/yaml-export.test.ts`

**測試案例:**

```typescript
import { describe, it, expect } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { exportToYaml } from '../../src/utils/export-yaml';
import { FlowDefinitionSchema } from '../../src/flow-schema';

describe('YAML 匯出整合測試', () => {
  it('應該匯出格式正確的 YAML', () => {
    const flowData = {
      name: '使用者管理測試',
      version: '1.0.0',
      baseUrl: 'http://localhost:3000',
      variables: {
        admin_username: 'admin',
        admin_password: '123456',
      },
      steps: [
        {
          name: '登入測試',
          request: {
            method: 'POST',
            path: '/api/auth/login',
          },
          expect: {
            statusCode: 200,
          },
        },
      ],
    };

    const yaml = exportToYaml(flowData);

    // YAML 應該可以被解析
    expect(() => parseYaml(yaml)).not.toThrow();

    // 解析後的資料應該與原始資料一致
    const parsed = parseYaml(yaml);
    expect(parsed).toEqual(flowData);
  });

  it('匯出的 YAML 應該通過 Zod 驗證', () => {
    const flowData = {
      name: '測試流程',
      baseUrl: 'http://localhost:3000',
      steps: [],
    };

    const yaml = exportToYaml(flowData);
    const parsed = parseYaml(yaml);

    const result = FlowDefinitionSchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it('應該正確處理數字字串 (不轉換為數字)', () => {
    const flowData = {
      name: '測試',
      baseUrl: 'http://localhost:3000',
      variables: {
        port: '8080',        // 應該保持字串
        password: '123456',  // 應該保持字串
      },
      steps: [],
    };

    const yaml = exportToYaml(flowData);

    expect(yaml).toContain("port: '8080'");
    expect(yaml).toContain("password: '123456'");
    expect(yaml).not.toContain('port: 8080'); // 不應該是數字
  });
});
```

**驗收標準:**
- ✅ 匯出的 YAML 可以被 YAML 解析器正確解析
- ✅ 往返轉換 (Flow → YAML → Flow) 資料無損失
- ✅ 數字字串格式正確

---

### 2.2 SpecPilot CLI 整合測試

**測試檔案:** `apps/cli/__tests__/integration/flow-schema-validation.test.ts`

**測試案例:**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, unlink } from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { FlowDefinitionSchema } from '@specpilot/schemas';

describe('SpecPilot CLI --flow-schema 整合測試', () => {
  const testFlowPath = path.join(__dirname, 'fixtures/test-flow.yaml');
  const testSchemaPath = path.join(__dirname, 'fixtures/test-flow.schema.json');

  beforeAll(async () => {
    // 產生測試用的 Flow YAML
    const flowYaml = `
name: CLI 整合測試
baseUrl: http://localhost:3000
steps:
  - name: 健康檢查
    request:
      method: GET
      path: /health
    expect:
      statusCode: 200
`;
    await writeFile(testFlowPath, flowYaml, 'utf-8');

    // 產生測試用的 JSON Schema
    const jsonSchema = zodToJsonSchema(FlowDefinitionSchema);
    await writeFile(testSchemaPath, JSON.stringify(jsonSchema, null, 2), 'utf-8');
  });

  afterAll(async () => {
    await unlink(testFlowPath);
    await unlink(testSchemaPath);
  });

  it('應該使用 --flow-schema 驗證 Flow YAML', () => {
    const command = `pnpm run start -- --flow ${testFlowPath} --flow-schema ${testSchemaPath} --baseUrl http://localhost:3000`;

    // 執行 CLI 指令
    expect(() => {
      execSync(command, { encoding: 'utf-8' });
    }).not.toThrow();
  });

  it('應該拒絕不符合 Schema 的 Flow YAML', async () => {
    const invalidFlowYaml = `
name: 無效的 Flow
# 缺少 baseUrl (必填)
steps: []
`;
    const invalidFlowPath = path.join(__dirname, 'fixtures/invalid-flow.yaml');
    await writeFile(invalidFlowPath, invalidFlowYaml, 'utf-8');

    const command = `pnpm run start -- --flow ${invalidFlowPath} --flow-schema ${testSchemaPath} --baseUrl http://localhost:3000`;

    expect(() => {
      execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
    }).toThrow();

    await unlink(invalidFlowPath);
  });
});
```

**驗收標準:**
- ✅ SpecPilot CLI 可載入外部 JSON Schema
- ✅ Schema 驗證失敗時拋出錯誤
- ✅ 錯誤訊息清晰易懂

---

## 3. 端對端測試 (E2E Tests)

### 3.1 完整流程測試

**測試檔案:** `tests/e2e/flow-builder-to-specpilot.e2e.test.ts`

**測試案例:**

```typescript
import { describe, it, expect } from 'vitest';
import { chromium, Browser, Page } from 'playwright';

describe('Flow Builder → SpecPilot 端對端測試', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
    await page.goto('http://localhost:5173'); // Flow Builder UI
  });

  afterAll(async () => {
    await browser.close();
  });

  it('完整流程: 建立 Flow → 匯出 → SpecPilot 執行', async () => {
    // Step 1: 填寫 Flow 基本資訊
    await page.fill('input[name="flowName"]', 'E2E 測試流程');
    await page.fill('input[name="baseUrl"]', 'http://localhost:3000');

    // Step 2: 新增測試步驟
    await page.click('button:has-text("新增步驟")');
    await page.fill('input[name="stepName"]', '健康檢查');
    await page.selectOption('select[name="method"]', 'GET');
    await page.fill('input[name="path"]', '/health');
    await page.fill('input[name="statusCode"]', '200');

    // Step 3: 驗證 YAML 預覽
    const yamlPreview = await page.textContent('.yaml-preview');
    expect(yamlPreview).toContain('name: E2E 測試流程');
    expect(yamlPreview).toContain('method: GET');

    // Step 4: 匯出 YAML
    await page.click('button:has-text("匯出")');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("確認匯出")'),
    ]);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();

    // Step 5: 使用 SpecPilot 執行 (模擬)
    // (實際測試會執行 CLI 指令)
  });
});
```

**驗收標準:**
- ✅ 可在 Flow Builder UI 建立完整 Flow
- ✅ YAML 預覽即時更新
- ✅ 匯出檔案格式正確
- ✅ SpecPilot CLI 可執行匯出的 Flow

---

## 4. 測試執行指令

### 執行所有測試

```bash
# 執行所有測試
pnpm run test

# 執行特定套件測試
pnpm --filter @specpilot/schemas test

# 執行整合測試
pnpm run test:integration

# 執行 E2E 測試
pnpm run test:e2e

# 產生覆蓋率報告
pnpm run test -- --coverage
```

---

## 5. 持續整合 (CI)

### GitHub Actions 設定範例

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 9.1
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run unit tests
        run: pnpm run test

      - name: Run integration tests
        run: pnpm run test:integration

      - name: Generate coverage report
        run: pnpm run test -- --coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
```

---

## 6. 測試檢查清單

### Phase 1: Schema 套件測試

- [ ] Zod Schema 定義測試 (10 個案例)
- [ ] Zod ↔ JSON Schema 轉換測試 (8 個案例)
- [ ] 變數解析測試 (6 個案例)
- [ ] YAML 匯出測試 (5 個案例)
- [ ] 覆蓋率 ≥85%

### Phase 2: SpecPilot 整合測試

- [ ] CLI `--flow-schema` 參數測試 (3 個案例)
- [ ] Schema 驗證錯誤訊息測試 (5 個案例)
- [ ] 向後相容性測試 (3 個案例)

### Phase 3: Flow Builder UI 測試

- [ ] 元件單元測試 (20+ 個元件)
- [ ] 表單驗證測試 (15 個案例)
- [ ] YAML 預覽即時更新測試 (5 個案例)
- [ ] 匯出功能測試 (3 個案例)

### Phase 4: E2E 測試

- [ ] 完整流程測試 (3 個案例)
- [ ] OpenAPI 整合測試 (5 個案例)
- [ ] 錯誤處理測試 (8 個案例)

---

**文件版本:** v1.0.0
**最後更新:** 2025-01-16
**狀態:** ✅ 完成
