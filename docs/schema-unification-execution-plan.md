# SpecPilot Schema 統一格式執行計劃

**版本:** v1.0.0
**建立日期:** 2025-01-16
**狀態:** 📋 待執行
**預估工期:** 5 天

---

## 🎯 總體目標

將 SpecPilot 完全統一為 `@packages/schemas` 定義的格式：

- ✅ Flow Builder 產出的 YAML = SpecPilot 唯一格式
- ✅ 所有現有 Flow YAML 改寫為新格式
- ✅ 移除舊格式相容邏輯
- ✅ 簡化 `flow-parser` 為單向轉換器

### 核心策略

**放棄向後相容，統一格式：**
- ❌ 不再支援舊的 `expectations`、`field`、物件型 `capture` 等格式
- ✅ 所有 YAML 必須符合 `@packages/schemas` 定義
- ✅ `flow-parser` 改為：Zod 驗證 + 格式轉換（轉為內部執行格式）

---

## 📊 核心差異對照

### Flow Definition 層級

| 欄位 | 新格式 (schemas) | 舊格式 | 變更 |
|------|-----------------|--------|------|
| `baseUrl` | 頂層或 `globals.baseUrl` | `globals.baseUrl` | ⚠️ 位置可選 |
| `globals` | ✅ 支援（含 auth, headers, retryPolicy） | ✅ 支援 | 🟢 保持 |
| `options` | ✅ 支援（timeout, retryCount, failFast） | ❌ 無 | 🆕 新增 |
| `reporting` | ✅ 支援（outputPath, format, verbose） | ❌ 無 | 🆕 新增 |
| `version` | ✅ 支援（semver 格式） | ❌ 無 | 🆕 新增 |

### Step 層級

| 欄位 | 新格式 (schemas) | 舊格式 | 變更 |
|------|-----------------|--------|------|
| Request | `expect` | `expectations` | 🔴 欄位名不同 |
| 狀態碼 | `expect.statusCode` | `expectations.status` | 🔴 欄位名不同 |
| 驗證 | `validation: [{rule, path}]` | `expectations.custom: [{type, field}]` | 🔴 位置與欄位名不同 |
| Capture | `capture: [{variableName, path}]` | `capture: {varName: jsonPath}` | 🔴 結構不同（陣列 vs 物件） |
| Request | 支援 `url`, `query` | 支援 `url`, `query` | 🟢 保持 |
| Auth | 支援 `auth`, `retryPolicy` | 支援 `auth`, `retryPolicy` | 🟢 保持 |

### 格式範例對照

**新格式 (統一格式):**
```yaml
name: 測試流程
version: 1.0.0
baseUrl: http://localhost:3000

globals:
  auth:
    type: bearer
    token: xxx

variables:
  username: admin

steps:
  - name: 登入
    request:
      method: POST
      path: /auth/login
      body:
        username: '{{username}}'
    expect:                    # ← expect
      statusCode: 200          # ← statusCode
    validation:                # ← 獨立欄位
      - rule: notNull          # ← rule
        path: token            # ← path
    capture:                   # ← 陣列格式
      - variableName: token
        path: token

options:
  timeout: 5000
  retryCount: 3
  failFast: true
```

**舊格式 (已廢棄):**
```yaml
id: test-flow
globals:
  baseUrl: http://localhost:3000
  auth:
    type: bearer
    token: xxx

steps:
  - name: 登入
    request:
      method: POST
      path: /auth/login
    expectations:              # ❌ 舊
      status: 200              # ❌ 舊
      custom:                  # ❌ 舊
        - type: notNull        # ❌ 舊
          field: token         # ❌ 舊
    capture:                   # ❌ 物件格式
      admin_token: token
```

---

## 📅 詳細執行計劃

### **Day 1: Schema 擴充 - Auth & Globals**

#### **任務 1.1: 新增 Auth Schema**

**檔案:** `packages/schemas/src/auth-schema.ts`

**內容:**
```typescript
import { z } from 'zod';

/**
 * Token 提取設定
 */
export const TokenExtractionSchema = z.object({
  path: z.string().min(1, 'Token 提取路徑不可為空'),
  expiresIn: z.number().int().positive().optional(),
  namespace: z.string().optional(),
});

/**
 * 登入型態認證
 */
export const LoginAuthSchema = z.object({
  type: z.literal('login'),
  tokenExtraction: TokenExtractionSchema,
});

/**
 * 靜態認證項目
 */
export const StaticAuthItemSchema = z.object({
  namespace: z.string().min(1, 'Namespace 不可為空'),
  token: z.string().min(1, 'Token 不可為空'),
  expiresInSeconds: z.number().int().positive().optional(),
});

/**
 * Bearer Token 認證
 */
export const BearerAuthSchema = z.object({
  type: z.literal('bearer'),
  token: z.string().min(1, 'Token 不可為空'),
});

/**
 * Step 層級認證（只支援 login）
 */
export const StepAuthSchema = LoginAuthSchema;

/**
 * 全域認證（Bearer 或靜態 Token）
 */
export const GlobalAuthSchema = z.union([
  BearerAuthSchema,
  z.object({
    static: z.array(StaticAuthItemSchema),
  }),
]);

export type ITokenExtraction = z.infer<typeof TokenExtractionSchema>;
export type IStepAuth = z.infer<typeof StepAuthSchema>;
export type IGlobalAuth = z.infer<typeof GlobalAuthSchema>;
export type IStaticAuthItem = z.infer<typeof StaticAuthItemSchema>;
```

**測試檔案:** `packages/schemas/__tests__/auth-schema.test.ts`

**內容:**
```typescript
import { describe, it, expect } from 'vitest';
import {
  TokenExtractionSchema,
  LoginAuthSchema,
  BearerAuthSchema,
  StaticAuthItemSchema,
  GlobalAuthSchema,
} from '../src/auth-schema';

describe('Auth Schema', () => {
  describe('TokenExtractionSchema', () => {
    it('應該驗證有效的 token 提取設定', () => {
      const valid = {
        path: 'data.token',
        expiresIn: 3600,
        namespace: 'user',
      };
      expect(() => TokenExtractionSchema.parse(valid)).not.toThrow();
    });

    it('應該拒絕空的 path', () => {
      const invalid = { path: '' };
      expect(() => TokenExtractionSchema.parse(invalid)).toThrow();
    });
  });

  describe('LoginAuthSchema', () => {
    it('應該驗證有效的登入認證', () => {
      const valid = {
        type: 'login',
        tokenExtraction: {
          path: 'token',
          expiresIn: 3600,
        },
      };
      expect(() => LoginAuthSchema.parse(valid)).not.toThrow();
    });
  });

  describe('BearerAuthSchema', () => {
    it('應該驗證有效的 Bearer 認證', () => {
      const valid = {
        type: 'bearer',
        token: 'abc123',
      };
      expect(() => BearerAuthSchema.parse(valid)).not.toThrow();
    });
  });

  describe('StaticAuthItemSchema', () => {
    it('應該驗證有效的靜態認證項目', () => {
      const valid = {
        namespace: 'admin',
        token: 'xyz789',
        expiresInSeconds: 3600,
      };
      expect(() => StaticAuthItemSchema.parse(valid)).not.toThrow();
    });
  });

  describe('GlobalAuthSchema', () => {
    it('應該接受 Bearer 認證', () => {
      const valid = {
        type: 'bearer',
        token: 'abc123',
      };
      expect(() => GlobalAuthSchema.parse(valid)).not.toThrow();
    });

    it('應該接受靜態認證陣列', () => {
      const valid = {
        static: [
          { namespace: 'admin', token: 'xyz' },
          { namespace: 'user', token: 'abc' },
        ],
      };
      expect(() => GlobalAuthSchema.parse(valid)).not.toThrow();
    });
  });
});
```

---

#### **任務 1.2: 新增 Globals Schema**

**檔案:** `packages/schemas/src/globals-schema.ts`

**內容:**
```typescript
import { z } from 'zod';
import { GlobalAuthSchema } from './auth-schema';
import { HeadersSchema } from './step-schema';

/**
 * 重試政策
 */
export const RetryPolicySchema = z.object({
  maxRetries: z.number().int().min(0).max(5).optional(),
  delayMs: z.number().int().positive().optional(),
  backoffMultiplier: z.number().positive().optional(),
});

/**
 * 全域設定
 */
export const GlobalsSchema = z.object({
  baseUrl: z.string().url('必須是有效的 URL').optional(),
  headers: HeadersSchema.optional(),
  auth: GlobalAuthSchema.optional(),
  retryPolicy: RetryPolicySchema.optional(),
});

export type IGlobals = z.infer<typeof GlobalsSchema>;
export type IRetryPolicy = z.infer<typeof RetryPolicySchema>;
```

**測試檔案:** `packages/schemas/__tests__/globals-schema.test.ts`

**內容:**
```typescript
import { describe, it, expect } from 'vitest';
import { RetryPolicySchema, GlobalsSchema } from '../src/globals-schema';

describe('Globals Schema', () => {
  describe('RetryPolicySchema', () => {
    it('應該驗證有效的重試政策', () => {
      const valid = {
        maxRetries: 3,
        delayMs: 1000,
        backoffMultiplier: 2,
      };
      expect(() => RetryPolicySchema.parse(valid)).not.toThrow();
    });

    it('應該拒絕超過上限的重試次數', () => {
      const invalid = { maxRetries: 10 };
      expect(() => RetryPolicySchema.parse(invalid)).toThrow();
    });
  });

  describe('GlobalsSchema', () => {
    it('應該驗證完整的 globals 設定', () => {
      const valid = {
        baseUrl: 'https://api.example.com',
        headers: {
          'Content-Type': 'application/json',
        },
        auth: {
          type: 'bearer',
          token: 'abc123',
        },
        retryPolicy: {
          maxRetries: 3,
          delayMs: 1000,
        },
      };
      expect(() => GlobalsSchema.parse(valid)).not.toThrow();
    });
  });
});
```

---

#### **任務 1.3: 更新 index.ts**

**檔案:** `packages/schemas/src/index.ts`

**新增匯出:**
```typescript
// 🆕 Auth Schema
export {
  TokenExtractionSchema,
  LoginAuthSchema,
  BearerAuthSchema,
  StaticAuthItemSchema,
  StepAuthSchema,
  GlobalAuthSchema,
  type ITokenExtraction,
  type IStepAuth,
  type IGlobalAuth,
  type IStaticAuthItem,
} from './auth-schema';

// 🆕 Globals Schema
export {
  RetryPolicySchema,
  GlobalsSchema,
  type IRetryPolicy,
  type IGlobals,
} from './globals-schema';
```

---

#### **Day 1 驗收標準**

```bash
# 執行測試
pnpm --filter @specpilot/schemas test

# 預期結果
✅ auth-schema.test.ts - 所有測試通過
✅ globals-schema.test.ts - 所有測試通過
✅ 無 TypeScript 編譯錯誤
```

---

### **Day 2: Schema 擴充 - Step & Flow 調整**

#### **任務 2.1: 擴充 Step Schema**

**檔案:** `packages/schemas/src/step-schema.ts`

**修改內容:**

1. **擴充 Request Schema（支援 url, query）:**
```typescript
export const FlowRequestSchema = z.object({
  method: HTTPMethodSchema,
  path: z.string().min(1, 'path 不可為空').optional(),
  url: z.string().url('必須是有效的 URL').optional(),   // 🆕 新增
  query: z.record(z.string()).optional(),               // 🆕 新增
  headers: HeadersSchema.optional(),
  body: RequestBodySchema,
}).refine(
  (data) => data.path || data.url,
  { message: 'path 或 url 至少需要一個' }
);
```

2. **加入 Auth 與 RetryPolicy:**
```typescript
import { StepAuthSchema } from './auth-schema';
import { RetryPolicySchema } from './globals-schema';

export const FlowStepSchema = z.object({
  name: z.string().min(1, '步驟名稱不可為空'),
  description: z.string().optional(),
  request: FlowRequestSchema,
  expect: FlowExpectSchema,
  validation: z.array(ValidationRuleSchema).optional(),
  capture: z.array(CaptureSchema).optional(),
  auth: StepAuthSchema.optional(),             // 🆕 新增
  retryPolicy: RetryPolicySchema.optional(),   // 🆕 新增
});
```

**更新測試:** `packages/schemas/__tests__/step-schema.test.ts`

```typescript
describe('FlowRequestSchema', () => {
  it('應該支援 url 欄位', () => {
    const valid = {
      method: 'GET',
      url: 'https://api.example.com/users',
    };
    expect(() => FlowRequestSchema.parse(valid)).not.toThrow();
  });

  it('應該支援 query 欄位', () => {
    const valid = {
      method: 'GET',
      path: '/api/users',
      query: {
        page: '1',
        limit: '10',
      },
    };
    expect(() => FlowRequestSchema.parse(valid)).not.toThrow();
  });

  it('應該要求 path 或 url 至少一個', () => {
    const invalid = {
      method: 'GET',
    };
    expect(() => FlowRequestSchema.parse(invalid)).toThrow();
  });
});

describe('FlowStepSchema', () => {
  it('應該支援 auth 欄位', () => {
    const valid = {
      name: '登入',
      request: { method: 'POST', path: '/login' },
      expect: { statusCode: 200 },
      auth: {
        type: 'login',
        tokenExtraction: { path: 'token' },
      },
    };
    expect(() => FlowStepSchema.parse(valid)).not.toThrow();
  });

  it('應該支援 retryPolicy 欄位', () => {
    const valid = {
      name: '測試',
      request: { method: 'GET', path: '/test' },
      expect: { statusCode: 200 },
      retryPolicy: {
        maxRetries: 3,
        delayMs: 1000,
      },
    };
    expect(() => FlowStepSchema.parse(valid)).not.toThrow();
  });
});
```

---

#### **任務 2.2: 調整 Flow Schema**

**檔案:** `packages/schemas/src/flow-schema.ts`

**修改內容:**
```typescript
import { z } from 'zod';
import { GlobalsSchema } from './globals-schema';

export const FlowDefinitionSchema = z.object({
  $schema: z.string().optional(),
  name: z.string().min(1, '名稱不可為空'),
  description: z.string().optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, '版本號必須符合 semver 格式').optional(),

  // baseUrl 改為 optional（優先使用 globals.baseUrl）
  baseUrl: z.string().url('必須是有效的 URL')
    .or(z.string().regex(/^\{\{[^}]+\}\}$/, '必須是有效的 URL 或變數'))
    .optional(),  // 🔧 改為 optional

  variables: VariablesSchema.optional(),
  options: FlowOptionsSchema,
  reporting: ReportingOptionsSchema,
  globals: GlobalsSchema.optional(),  // 🆕 新增
  steps: z.array(z.any()).min(1, '至少需要一個測試步驟'),
});
```

**更新測試:** `packages/schemas/__tests__/flow-schema.test.ts`

```typescript
describe('FlowDefinitionSchema', () => {
  it('應該支援 globals 欄位', () => {
    const valid = {
      name: '測試流程',
      baseUrl: 'http://localhost:3000',
      globals: {
        auth: {
          type: 'bearer',
          token: 'abc123',
        },
      },
      steps: [
        {
          name: 'step1',
          request: { method: 'GET', path: '/test' },
          expect: { statusCode: 200 },
        },
      ],
    };
    expect(() => FlowDefinitionSchema.parse(valid)).not.toThrow();
  });

  it('baseUrl 可以是 optional', () => {
    const valid = {
      name: '測試流程',
      globals: {
        baseUrl: 'http://localhost:3000',
      },
      steps: [
        {
          name: 'step1',
          request: { method: 'GET', path: '/test' },
          expect: { statusCode: 200 },
        },
      ],
    };
    expect(() => FlowDefinitionSchema.parse(valid)).not.toThrow();
  });
});
```

---

#### **任務 2.3: 擴充 VariableResolver**

**檔案:** `packages/schemas/src/utils/variable-resolver.ts`

**新增方法:**
```typescript
export class VariableResolver {
  private variables: Map<string, unknown> = new Map();  // 🆕 新增

  /**
   * 載入全域變數
   */
  loadVariables(vars: Record<string, unknown>): void {  // 🆕 新增
    Object.entries(vars).forEach(([key, value]) => {
      this.variables.set(key, value);
    });
  }

  /**
   * 註冊 capture 變數
   */
  captureVariable(name: string, value: unknown): void {  // 🆕 新增
    this.variables.set(name, value);
  }

  /**
   * 從回應中提取值（JSON Path）
   */
  extractValueByPath(data: unknown, path: string): unknown {  // 🆕 新增
    if (!data || typeof path !== 'string' || path.trim() === '') {
      return undefined;
    }

    let normalizedPath = path.trim();
    if (normalizedPath.startsWith('$.')) {
      normalizedPath = normalizedPath.substring(2);
    } else if (normalizedPath.startsWith('$')) {
      normalizedPath = normalizedPath.substring(1);
    }

    const parts = normalizedPath.split('.');
    let current: unknown = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // 處理陣列索引（如 users[0]）
      const arrayMatch = /^(\w+)\[(\d+)\]$/.exec(part);
      if (arrayMatch) {
        const [, key, indexStr] = arrayMatch;
        const index = parseInt(indexStr, 10);

        if (typeof current === 'object' && key in (current as Record<string, unknown>)) {
          const arrayValue = (current as Record<string, unknown>)[key];
          if (Array.isArray(arrayValue) && index >= 0 && index < arrayValue.length) {
            current = arrayValue[index];
          } else {
            return undefined;
          }
        } else {
          return undefined;
        }
      } else {
        if (typeof current === 'object' && part in (current as Record<string, unknown>)) {
          current = (current as Record<string, unknown>)[part];
        } else {
          return undefined;
        }
      }
    }

    return current;
  }

  /**
   * 解析變數插值
   */
  resolve(flowData: unknown, variables?: Record<string, any>): unknown {
    if (variables) {
      this.loadVariables(variables);
    }
    return this.traverseAndResolve(flowData, this.variables, []);
  }

  // ... 其他既有方法保持 ...
}
```

**新增測試:** `packages/schemas/__tests__/variable-resolver.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { VariableResolver } from '../src/utils/variable-resolver';

describe('VariableResolver', () => {
  describe('loadVariables', () => {
    it('應該載入全域變數', () => {
      const resolver = new VariableResolver();
      resolver.loadVariables({ username: 'admin', token: 'abc123' });

      const result = resolver.resolve('{{username}}');
      expect(result).toBe('admin');
    });
  });

  describe('captureVariable', () => {
    it('應該註冊 capture 變數', () => {
      const resolver = new VariableResolver();
      resolver.captureVariable('userId', '12345');

      const result = resolver.resolve('{{userId}}');
      expect(result).toBe('12345');
    });
  });

  describe('extractValueByPath', () => {
    it('應該提取簡單路徑的值', () => {
      const resolver = new VariableResolver();
      const data = { token: 'abc123' };

      const result = resolver.extractValueByPath(data, 'token');
      expect(result).toBe('abc123');
    });

    it('應該提取巢狀路徑的值', () => {
      const resolver = new VariableResolver();
      const data = { user: { id: 123, name: 'John' } };

      const result = resolver.extractValueByPath(data, 'user.name');
      expect(result).toBe('John');
    });

    it('應該提取陣列元素', () => {
      const resolver = new VariableResolver();
      const data = { users: [{ id: 1 }, { id: 2 }] };

      const result = resolver.extractValueByPath(data, 'users[0].id');
      expect(result).toBe(1);
    });

    it('應該處理路徑不存在的情況', () => {
      const resolver = new VariableResolver();
      const data = { token: 'abc' };

      const result = resolver.extractValueByPath(data, 'user.name');
      expect(result).toBeUndefined();
    });
  });
});
```

---

#### **Day 2 驗收標準**

```bash
# 執行測試
pnpm --filter @specpilot/schemas test

# 執行編譯
pnpm --filter @specpilot/schemas build

# 預期結果
✅ 所有測試通過
✅ 編譯成功，無 TypeScript 錯誤
✅ 型別定義正確匯出
```

---

### **Day 3: Flow Parser 重構**

#### **任務 3.1: 重構 Loader（移除規範化，改用轉換）**

**檔案:** `packages/flow-parser/src/loader.ts`

**主要改動:**

1. **移除舊的規範化方法:**
```typescript
// ❌ 刪除以下方法
private normalizeFlowStructure() { ... }
private normalizeStep() { ... }
private convertValidationToCustomRules() { ... }
```

2. **改用 Zod 驗證:**
```typescript
import { FlowDefinitionSchema } from '@specpilot/schemas';

async loadFlowFromContent(content: string, executionId?: string): Promise<IFlowDefinition> {
  this.logger.info('FLOW_LOAD_START', '開始載入 Flow 內容', {
    contentLength: content.length,
    executionId,
    component: 'flow-parser'
  });

  try {
    // 解析 YAML
    let flowData: unknown;
    try {
      flowData = parseYaml(content);
    } catch (error) {
      throw FlowParseError.yamlFormatError(error as Error, executionId);
    }

    // ✅ 使用 Zod 驗證
    const validationResult = FlowDefinitionSchema.safeParse(flowData);

    if (!validationResult.success) {
      throw new FlowValidationError(
        'Flow YAML 格式錯誤',
        {
          errors: validationResult.error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message,
            code: err.code
          }))
        },
        '請檢查 YAML 格式是否符合 Schema 定義',
        { executionId, component: 'flow-parser' }
      );
    }

    // ✅ 轉換為內部格式
    const flowDefinition = this.convertToInternalFormat(
      validationResult.data,
      content,
      executionId
    );

    this.logger.info('FLOW_LOAD_SUCCESS', 'Flow 載入成功', {
      flowId: flowDefinition.id,
      stepCount: flowDefinition.steps.length,
      hasGlobals: !!flowDefinition.globals,
      executionId,
      component: 'flow-parser'
    });

    return flowDefinition;
  } catch (error) {
    this.logger.error('FLOW_LOAD_FAILURE', 'Flow 內容載入失敗', {
      contentLength: content.length,
      error: error instanceof Error ? error.message : String(error),
      executionId,
      component: 'flow-parser'
    });
    throw error;
  }
}
```

3. **新增格式轉換方法:**
```typescript
/**
 * 轉換為內部格式
 * 將 schemas 格式轉為 core-flow 需要的執行格式
 */
private convertToInternalFormat(
  schemaData: any,
  rawContent: string,
  executionId?: string
): IFlowDefinition {
  return {
    id: schemaData.name,  // 使用 name 作為 id
    rawContent,
    steps: schemaData.steps.map((step: any) => this.convertStep(step, executionId)),
    globals: this.convertGlobals(schemaData),
    variables: schemaData.variables
  };
}

/**
 * 轉換單個 Step
 * 關鍵轉換：
 * - expect.statusCode → expectations.status
 * - validation → expectations.custom
 * - bodyFields → expectations.custom
 * - capture 陣列 → capture 物件
 */
private convertStep(schemaStep: any, executionId?: string): IFlowStep {
  return {
    name: schemaStep.name,
    description: schemaStep.description,
    request: {
      method: schemaStep.request.method,
      path: schemaStep.request.path,
      url: schemaStep.request.url,
      query: schemaStep.request.query,
      headers: schemaStep.request.headers,
      body: schemaStep.request.body
    },
    expectations: {
      // ✅ 轉換：statusCode → status
      status: schemaStep.expect.statusCode,

      // ✅ 合併 validation 和 bodyFields 為 custom
      custom: [
        // 從 bodyFields 轉換
        ...(schemaStep.expect.bodyFields || []).map((field: any) => ({
          type: field.validationMode === 'exact' && field.expectedValue
            ? 'contains'
            : 'notNull',
          field: field.fieldName,
          value: field.expectedValue
        })),

        // 從 validation 轉換（rule → type, path → field）
        ...(schemaStep.validation || []).map((rule: any) => ({
          type: rule.rule,      // ✅ rule → type
          field: rule.path,     // ✅ path → field
          value: rule.value,
          message: rule.message
        }))
      ]
    },

    // ✅ 轉換 capture：陣列 → 物件
    capture: (schemaStep.capture || []).reduce((acc: any, item: any) => {
      acc[item.variableName] = item.path;
      return acc;
    }, {}),

    auth: schemaStep.auth,
    retryPolicy: schemaStep.retryPolicy
  };
}

/**
 * 轉換 Globals
 */
private convertGlobals(schemaData: any): IFlowGlobals | undefined {
  if (!schemaData.globals && !schemaData.baseUrl) {
    return undefined;
  }

  return {
    baseUrl: schemaData.globals?.baseUrl || schemaData.baseUrl,
    headers: schemaData.globals?.headers,
    auth: schemaData.globals?.auth,
    retryPolicy: schemaData.globals?.retryPolicy
  };
}
```

---

#### **任務 3.2: 更新測試**

**檔案:** `packages/flow-parser/__tests__/flow-parser.test.ts`

**測試新格式解析:**
```typescript
import { describe, it, expect } from 'vitest';
import { FlowLoader } from '../src/loader';

describe('FlowLoader - 新格式', () => {
  const loader = new FlowLoader();

  it('應該成功解析新格式 YAML', async () => {
    const yaml = `
name: 測試流程
version: 1.0.0
baseUrl: http://localhost:3000

steps:
  - name: 登入
    request:
      method: POST
      path: /auth/login
    expect:
      statusCode: 200
    validation:
      - rule: notNull
        path: token
    capture:
      - variableName: token
        path: token
`;

    const result = await loader.loadFlowFromContent(yaml);

    expect(result.id).toBe('測試流程');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].expectations.status).toBe(200);
    expect(result.steps[0].expectations.custom).toHaveLength(1);
    expect(result.steps[0].expectations.custom[0].type).toBe('notNull');
    expect(result.steps[0].expectations.custom[0].field).toBe('token');
    expect(result.steps[0].capture).toEqual({ token: 'token' });
  });

  it('應該正確轉換 bodyFields', async () => {
    const yaml = `
name: 測試
baseUrl: http://localhost:3000

steps:
  - name: 測試步驟
    request:
      method: GET
      path: /test
    expect:
      statusCode: 200
      bodyFields:
        - fieldName: users
          validationMode: any
        - fieldName: total
          expectedValue: "10"
          validationMode: exact
`;

    const result = await loader.loadFlowFromContent(yaml);

    const custom = result.steps[0].expectations.custom;
    expect(custom).toHaveLength(2);
    expect(custom[0]).toEqual({ type: 'notNull', field: 'users', value: '' });
    expect(custom[1]).toEqual({ type: 'contains', field: 'total', value: '10' });
  });

  it('應該拒絕不符合 schema 的 YAML', async () => {
    const invalidYaml = `
name: 測試
steps:
  - name: 測試步驟
    request:
      method: INVALID_METHOD
      path: /test
    expect:
      statusCode: 999
`;

    await expect(loader.loadFlowFromContent(invalidYaml)).rejects.toThrow('Flow YAML 格式錯誤');
  });

  it('應該支援 globals 設定', async () => {
    const yaml = `
name: 測試
baseUrl: http://localhost:3000

globals:
  auth:
    type: bearer
    token: abc123
  headers:
    X-API-Key: xyz

steps:
  - name: 測試
    request:
      method: GET
      path: /test
    expect:
      statusCode: 200
`;

    const result = await loader.loadFlowFromContent(yaml);

    expect(result.globals).toBeDefined();
    expect(result.globals?.auth).toEqual({ type: 'bearer', token: 'abc123' });
    expect(result.globals?.headers).toEqual({ 'X-API-Key': 'xyz' });
  });
});
```

---

#### **Day 3 驗收標準**

```bash
# 執行測試
pnpm --filter @specpilot/flow-parser test

# 預期結果
✅ 所有測試通過
✅ 新格式 YAML 可正確解析
✅ 格式轉換正確（expect→expectations, capture 陣列→物件）
✅ Zod 驗證錯誤訊息清晰
```

---

### **Day 4: 整合測試 & YAML 範例改寫**

#### **任務 4.1: 改寫範例 YAML**

**檔案清單:**
1. `flows/user-management-complete-flow.yaml`
2. `flows/user-management-basic-flow.yaml`
3. `flows/simple-health-check.yaml`

**改寫範例 (user-management-complete-flow.yaml):**

**舊格式:**
```yaml
id: user-management-test
name: 使用者管理完整測試流程
globals:
  baseUrl: http://localhost:3000

variables:
  admin_username: admin
  admin_password: '1234562'

steps:
  - name: 管理者登入
    request:
      method: POST
      path: /auth/login
      body:
        username: '{{admin_username}}'
        password: '{{admin_password}}'
    expectations:              # ❌ 舊格式
      status: 200              # ❌ 舊格式
      custom:                  # ❌ 舊格式
        - type: notNull
          field: token
    capture:                   # ❌ 物件格式
      admin_token: token
```

**新格式:**
```yaml
name: 使用者管理完整測試流程
description: |
  完整測試 SpecPilot Mock Server 的使用者管理與認證功能
  包含健康檢查、認證登入、使用者 CRUD 操作以及錯誤情境測試
version: 1.0.0
baseUrl: http://localhost:3000

# 全域變數
variables:
  admin_username: admin
  admin_password: '1234562'
  test_email_prefix: newtestuser99
  test_domain: example.com

steps:
  # ====== 健康檢查 ======
  - name: 健康檢查
    description: 驗證 API 服務狀態
    request:
      method: GET
      path: /api/health
    expect:                      # ✅ 新格式
      statusCode: 200            # ✅ 新格式
      body:
        status: ok
        environment: development
    validation:                  # ✅ 獨立欄位
      - rule: notNull            # ✅ rule
        path: timestamp          # ✅ path
      - rule: notNull
        path: features.adminAccount.username

  # ====== 認證測試 ======
  - name: 管理者登入
    description: 使用預設管理者帳號登入取得 token
    request:
      method: POST
      path: /auth/login
      headers:
        Content-Type: application/json
      body:
        username: '{{admin_username}}'
        password: '{{admin_password}}'
    expect:
      statusCode: 200
    validation:
      - rule: notNull
        path: token
      - rule: contains
        path: tokenType
        value: Bearer
      - rule: notNull
        path: user.name
    capture:                     # ✅ 陣列格式
      - variableName: admin_token
        path: token
      - variableName: admin_user_name
        path: user.name

  # ====== 使用者列表查詢 ======
  - name: 取得使用者列表
    description: 使用 token 取得所有使用者列表
    request:
      method: GET
      path: /api/users
      headers:
        Authorization: Bearer {{admin_token}}
    expect:
      statusCode: 200
    validation:
      - rule: notNull
        path: users
      - rule: notNull
        path: total
    capture:
      - variableName: initial_user_count
        path: total
      - variableName: first_user_id
        path: users[0].id

  # ====== 建立新使用者 ======
  - name: 建立新使用者
    description: 建立一個新的測試使用者
    request:
      method: POST
      path: /api/users
      headers:
        Authorization: Bearer {{admin_token}}
        Content-Type: application/json
      body:
        name: API 測試使用者
        email: '{{test_email_prefix}}@{{test_domain}}'
        role: user
        status: active
    expect:
      statusCode: 201
    validation:
      - rule: notNull
        path: id
      - rule: contains
        path: name
        value: API 測試使用者
      - rule: contains
        path: email
        value: '{{test_email_prefix}}@{{test_domain}}'
    capture:
      - variableName: new_user_id
        path: id
      - variableName: new_user_email
        path: email

# 測試執行選項
options:
  timeout: 5000
  retryCount: 0
  failFast: true

# 測試報表設定
reporting:
  format: json
  verbose: true
```

---

#### **任務 4.2: CLI 整合測試**

**測試腳本:**
```bash
# 1. 啟動模擬伺服器
pnpm run mock

# 2. 執行測試（新格式 YAML）
pnpm run start -- \
  --spec samples/api-server/openapi.yaml \
  --flow flows/user-management-complete-flow.yaml \
  --baseUrl http://127.0.0.1:3000

# 預期結果
✅ 測試全部通過
✅ 報表產生成功
✅ Capture 變數正常運作
```

---

#### **任務 4.3: MCP 整合測試**

**測試步驟:**

1. 啟動 MCP Server
2. 使用 Claude Desktop 測試 `runFlow`
3. 驗證新格式 YAML 可正常執行

**測試範例:**
```typescript
// 使用 MCP runFlow 工具
{
  spec: "samples/api-server/openapi.yaml",
  flow: "flows/user-management-complete-flow.yaml",
  baseUrl: "http://127.0.0.1:3000"
}

// 預期輸出
✅ 測試執行完成（真實 HTTP 測試）！
執行 ID: run-xxx
結果: ✅ 成功
總步驟數: 15
成功步驟: 15
失敗步驟: 0
```

---

#### **任務 4.4: E2E 測試更新**

**檔案:** `tests/e2e/cli-success-flow.e2e.spec.ts`

**更新測試使用新格式 YAML:**
```typescript
describe('CLI E2E - 成功流程', () => {
  it('應該成功執行新格式 Flow YAML', async () => {
    const result = await runCLI([
      '--spec', 'samples/api-server/openapi.yaml',
      '--flow', 'flows/user-management-complete-flow.yaml',
      '--baseUrl', 'http://127.0.0.1:3000'
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('✅ 測試執行完成');
    expect(result.stdout).toContain('所有步驟通過');
  });
});
```

---

#### **Day 4 驗收標準**

```bash
# 1. YAML 改寫完成
✅ user-management-complete-flow.yaml - 改為新格式
✅ user-management-basic-flow.yaml - 改為新格式
✅ simple-health-check.yaml - 改為新格式

# 2. CLI 測試通過
pnpm run start -- --spec ... --flow flows/user-management-complete-flow.yaml
✅ 執行成功，所有步驟通過

# 3. MCP 測試通過
✅ runFlow 可正常執行新格式 YAML

# 4. E2E 測試通過
pnpm run test:e2e
✅ 所有 E2E 測試通過
```

---

### **Day 5: 剩餘 YAML 改寫 & 文件更新**

#### **任務 5.1: 改寫剩餘 YAML**

**檔案清單:**
- `flows/user_crud.yaml`
- `flows/minimal_flow.yaml`
- `flows/invalid_flow.yaml` (錯誤格式範例)

**改寫策略:**

每個檔案改寫後立即測試：
```bash
# 改寫 user_crud.yaml
# 測試
pnpm run start -- \
  --spec samples/api-server/openapi.yaml \
  --flow flows/user_crud.yaml \
  --baseUrl http://127.0.0.1:3000

# 確認通過後繼續下一個
```

---

#### **任務 5.2: 清理舊程式碼**

**檢查項目:**

1. **移除不再使用的規範化邏輯:**
```bash
# 搜尋並確認已移除
grep -r "normalizeStep" packages/flow-parser/
grep -r "convertValidationToCustomRules" packages/flow-parser/

# 預期：無結果或只在測試/註解中
```

2. **檢查型別匯入:**
```bash
# 確認使用 schemas 的型別
grep -r "from '@specpilot/schemas'" packages/
```

---

#### **任務 5.3: 文件更新**

**必須更新的文件:**

1. **CLAUDE.md**
   - Flow YAML 格式範例（改為新格式）
   - 移除舊格式說明
   - 新增欄位對照表

2. **README.md**
   - 快速開始範例（改為新格式）
   - CLI 使用範例

3. **MCP-SETUP.md**
   - `runFlow` 參數範例（改為新格式）

4. **docs/auth-guide.md**
   - Auth 設定範例（改為新格式）

5. **docs/mcp-interface.md**
   - MCP 工具範例（改為新格式）

6. **docs/flow-builder/flow-builder-implementation-plan.md**
   - 標記 Phase 0-1 完成
   - 更新進度狀態

**文件更新範本:**

**CLAUDE.md 更新範例:**
```markdown
## Flow YAML 格式

SpecPilot 使用統一的 Flow YAML 格式，由 `@packages/schemas` 定義。

### 完整範例

```yaml
name: 使用者管理測試
version: 1.0.0
baseUrl: http://localhost:3000

# 全域設定
globals:
  auth:
    type: bearer
    token: '{{admin_token}}'

# 全域變數
variables:
  admin_username: admin

steps:
  - name: 登入
    request:
      method: POST
      path: /auth/login
      body:
        username: '{{admin_username}}'
    expect:                      # ← expect (非 expectations)
      statusCode: 200            # ← statusCode (非 status)
    validation:                  # ← 獨立欄位 (非 expectations.custom)
      - rule: notNull            # ← rule (非 type)
        path: token              # ← path (非 field)
    capture:                     # ← 陣列格式 (非物件)
      - variableName: token
        path: token

options:
  timeout: 5000
  retryCount: 3
  failFast: true
```

### 欄位說明

| 欄位 | 必填 | 說明 |
|------|------|------|
| `name` | ✅ | Flow 名稱 |
| `version` | ❌ | 版本號（semver 格式） |
| `baseUrl` | ❌ | API 基礎 URL（可在 globals 設定） |
| `globals` | ❌ | 全域設定（auth, headers, retryPolicy） |
| `variables` | ❌ | 全域變數 |
| `steps` | ✅ | 測試步驟陣列 |
| `options` | ❌ | 執行選項 |
| `reporting` | ❌ | 報表設定 |

### Step 欄位說明

| 欄位 | 必填 | 說明 |
|------|------|------|
| `request.method` | ✅ | HTTP 方法 |
| `request.path` | ⚠️ | 請求路徑（與 url 二選一） |
| `request.url` | ⚠️ | 完整 URL（與 path 二選一） |
| `request.query` | ❌ | 查詢參數 |
| `expect.statusCode` | ✅ | 預期狀態碼 |
| `expect.bodyFields` | ❌ | Body 欄位驗證（Table 模式） |
| `validation` | ❌ | 自訂驗證規則陣列 |
| `capture` | ❌ | 變數擷取設定（陣列格式） |
```

---

#### **任務 5.4: 最終測試**

**完整測試流程:**
```bash
# 1. 單元測試
pnpm run test

# 2. 整合測試
pnpm run test:integration

# 3. E2E 測試
pnpm run test:e2e

# 4. Lint 檢查
pnpm run lint

# 5. 編譯檢查
pnpm run build

# 6. CLI 手動測試
pnpm run start -- \
  --spec samples/api-server/openapi.yaml \
  --flow flows/user-management-complete-flow.yaml \
  --baseUrl http://127.0.0.1:3000

# 7. MCP 手動測試
# 使用 Claude Desktop 測試 runFlow 工具
```

---

#### **Day 5 驗收標準**

```bash
# 1. 所有 YAML 改寫完成
✅ flows/*.yaml - 全部為新格式

# 2. 舊程式碼清理完成
✅ 無殘留的規範化邏輯

# 3. 文件更新完成
✅ CLAUDE.md - 範例更新
✅ README.md - 範例更新
✅ MCP-SETUP.md - 範例更新
✅ docs/auth-guide.md - 範例更新
✅ docs/mcp-interface.md - 範例更新

# 4. 所有測試通過
✅ pnpm run test
✅ pnpm run test:integration
✅ pnpm run lint

# 5. 功能驗證
✅ CLI 執行成功
✅ MCP 執行成功
✅ 變數系統正常
✅ Capture 功能正常
✅ Auth 功能正常
```

---

## 🎯 完整驗收標準

### **程式碼品質**

```bash
# TypeScript 編譯
pnpm run build
✅ 無編譯錯誤
✅ 無型別錯誤

# Lint 檢查
pnpm run lint
✅ 無 ESLint 錯誤
✅ 無 Prettier 格式問題

# 測試覆蓋率
pnpm run test -- --coverage
✅ schemas 套件 > 80%
✅ flow-parser 套件 > 80%
```

### **功能驗證**

| 功能 | 測試方法 | 預期結果 |
|------|---------|---------|
| Flow YAML 解析 | 載入新格式 YAML | ✅ 成功解析 |
| Zod 驗證 | 載入錯誤格式 YAML | ✅ 拋出清晰錯誤 |
| 格式轉換 | 檢查內部格式 | ✅ expect→expectations, capture 陣列→物件 |
| 變數解析 | 使用 {{variable}} | ✅ 正確替換 |
| Capture 功能 | 擷取 response 值 | ✅ 正確擷取並註冊 |
| Auth 功能 | 使用 globals.auth | ✅ Token 正確注入 |
| CLI 執行 | 執行完整 Flow | ✅ 所有步驟通過 |
| MCP 執行 | runFlow 工具 | ✅ 正常執行並回傳結果 |

### **文件完整性**

- ✅ CLAUDE.md 包含新格式範例
- ✅ README.md 快速開始使用新格式
- ✅ MCP-SETUP.md 範例更新
- ✅ 所有文件中的 YAML 範例一致
- ✅ 無舊格式殘留說明

---

## 📊 風險管理

### **風險矩陣**

| 風險 | 等級 | 影響 | 緩解措施 |
|------|------|------|---------|
| 型別不相容 | 🔴 高 | 編譯失敗 | Day 2 提早驗證型別轉換 |
| 測試失敗 | 🟡 中 | 延遲交付 | 逐步調整，保持測試綠燈 |
| YAML 改寫錯誤 | 🟢 低 | 功能異常 | 每個改完立即測試 |
| 文件遺漏 | 🟢 低 | 使用困擾 | Day 5 集中檢查 |
| 回歸問題 | 🟡 中 | 破壞現有功能 | 完整 E2E 測試 |

### **應對策略**

1. **每日驗收:** 確保當天任務完成且測試通過
2. **增量更新:** 一次改一個檔案，立即測試
3. **備份機制:** Git commit 每個小階段
4. **回滾計畫:** 如遇阻塞問題，可回退到前一個 commit

---

## 📋 工作檢查清單

### **Day 1 檢查清單**
```bash
[x] 建立 auth-schema.ts
[x] 建立 auth-schema.test.ts
[x] 建立 globals-schema.ts
[x] 建立 globals-schema.test.ts
[x] 更新 index.ts 匯出
[x] 執行測試通過
```

### **Day 2 檢查清單**
```bash
[x] 擴充 step-schema.ts (url, query, auth, retryPolicy)
[x] 調整 flow-schema.ts (globals)
[x] 擴充 variable-resolver.ts (新增方法)
[x] 更新所有測試
[x] 執行測試通過
[x] 編譯成功
```

### **Day 3 檢查清單**
```bash
[x] 重構 loader.ts (移除規範化，改用 Zod)
[x] 新增格式轉換方法
[x] 更新測試
[x] 執行測試通過
```

### **Day 4 檢查清單**
```bash
[x] 改寫 user-management-complete-flow.yaml
[x] 改寫 user-management-basic-flow.yaml
[x] 改寫 simple-health-check.yaml
[x] CLI 整合測試通過
[x] MCP 整合測試通過
[x] E2E 測試更新並通過
```

### **Day 5 檢查清單**
```bash
[x] 改寫剩餘 YAML 檔案
[x] 清理舊程式碼
[x] 更新 CLAUDE.md
[x] 更新 README.md
[x] 更新 MCP-SETUP.md
[x] 更新 docs/auth-guide.md
[x] 更新 docs/mcp-interface.md
[x] 執行完整測試套件
[x] 功能驗證通過
```

---

## 📝 附錄

### **A. 需要改寫的 YAML 檔案清單**

| 檔案路徑 | 優先級 | 預估時間 |
|---------|--------|---------|
| `flows/user-management-complete-flow.yaml` | P0 | 30 分鐘 |
| `flows/user-management-basic-flow.yaml` | P0 | 20 分鐘 |
| `flows/simple-health-check.yaml` | P1 | 10 分鐘 |
| `flows/user_crud.yaml` | P1 | 15 分鐘 |
| `flows/minimal_flow.yaml` | P2 | 5 分鐘 |
| `flows/invalid_flow.yaml` | P2 | 5 分鐘 |

### **B. 欄位對照表**

| 層級 | 舊欄位 | 新欄位 | 轉換說明 |
|------|--------|--------|---------|
| Step | `expectations` | `expect` | 重新命名 |
| Expect | `status` | `statusCode` | 重新命名 |
| Validation | `expectations.custom` | `validation` | 位置變更 |
| Validation | `type` | `rule` | 重新命名 |
| Validation | `field` | `path` | 重新命名 |
| Capture | `{varName: path}` | `[{variableName, path}]` | 結構變更 |
| Flow | `id` | `name` | 使用 name 作為識別 |
| Flow | - | `version` | 新增欄位 |
| Flow | - | `options` | 新增欄位 |
| Flow | - | `reporting` | 新增欄位 |

### **C. 常見問題處理**

**Q1: 如果 Zod 驗證失敗，如何除錯？**

A: 檢查 `validationResult.error.errors`，會提供詳細的路徑與錯誤訊息。

**Q2: 如何確認格式轉換正確？**

A: 在測試中打印 `convertStep()` 的輸出，對比預期結果。

**Q3: 如果發現測試失敗？**

A:
1. 檢查是否使用舊格式 YAML
2. 檢查轉換邏輯是否正確
3. 檢查型別定義是否匹配

---

## ✅ 結論

本執行計劃旨在將 SpecPilot 完全統一為 `@packages/schemas` 定義的格式，放棄舊格式相容。

**預期成果:**
- ✅ 統一的 Flow YAML 格式
- ✅ 型別安全的 Zod Schema 驗證
- ✅ 簡化的 flow-parser（單向轉換）
- ✅ 完整的測試覆蓋
- ✅ 更新的文件與範例

**總工期:** 5 天
**下一步:** 開始執行 Day 1 任務

---

**文件版本:** v1.0.0
**最後更新:** 2025-01-16
**維護者:** SpecPilot Team
