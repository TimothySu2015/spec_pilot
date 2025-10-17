# @specpilot/testing - 測試工具與 Fixtures 模組

## 模組概述

`@specpilot/testing` 是 SpecPilot 的測試支援模組，提供測試用的輔助函式、模擬資料 (Fixtures)、測試工具與共用測試設定，讓所有 packages 的單元測試與整合測試更容易撰寫與維護。

## 核心職責

1. **測試 Fixtures**: 提供標準化的測試資料與範例檔案
2. **Mock 工具**: HTTP 模擬、API 回應模擬
3. **測試輔助函式**: 簡化測試撰寫的工具函式
4. **測試設定**: 共用的 Vitest 設定與環境設定
5. **測試資料產生器**: 快速產生測試所需的資料結構

## 目錄結構

```
testing/
  ├── src/
  │   ├── fixtures/              # 測試 Fixtures
  │   │   ├── specs/            # OpenAPI 規格範例
  │   │   ├── flows/            # Flow 定義範例
  │   │   ├── responses/        # HTTP 回應範例
  │   │   └── data/             # 測試資料
  │   ├── mocks/                # Mock 工具
  │   │   ├── http-mock.ts      # HTTP 模擬
  │   │   └── api-mock.ts       # API 回應模擬
  │   ├── helpers/              # 測試輔助函式
  │   │   ├── assertions.ts     # 自訂斷言
  │   │   └── generators.ts     # 資料產生器
  │   └── index.ts              # 統一匯出
  └── __tests__/
      └── testing.test.ts       # 測試工具本身的測試
```

## Fixtures 資料

### OpenAPI 規格範例

```typescript
import { fixtures } from '@specpilot/testing';

// 簡單的 API 規格
const simpleSpec = fixtures.specs.simple;

// 完整的 API 規格 (含認證、多種端點)
const fullSpec = fixtures.specs.full;

// 無效的規格 (用於錯誤測試)
const invalidSpec = fixtures.specs.invalid;

// Swagger 2.0 規格
const swagger2Spec = fixtures.specs.swagger2;
```

### Flow 定義範例

```typescript
// 簡單的 CRUD 流程
const crudFlow = fixtures.flows.userCrud;

// 包含認證的流程
const authFlow = fixtures.flows.withAuth;

// 包含錯誤處理的流程
const errorHandlingFlow = fixtures.flows.withErrors;

// 無效的流程定義
const invalidFlow = fixtures.flows.invalid;
```

### HTTP 回應範例

```typescript
// 成功回應
const successResponse = fixtures.responses.success;

// 錯誤回應
const errorResponse = fixtures.responses.error;

// 驗證失敗回應
const validationErrorResponse = fixtures.responses.validationError;
```

### 測試資料

```typescript
// 使用者資料
const users = fixtures.data.users;
const validUser = fixtures.data.validUser;
const invalidUser = fixtures.data.invalidUser;

// 產品資料
const products = fixtures.data.products;

// 訂單資料
const orders = fixtures.data.orders;
```

## Mock 工具

### HTTP Mock

```typescript
import { HttpMock } from '@specpilot/testing';

describe('HTTP Runner', () => {
  let httpMock: HttpMock;

  beforeEach(() => {
    httpMock = new HttpMock('http://localhost:3000');
  });

  afterEach(() => {
    httpMock.cleanup();
  });

  it('應該成功發送 GET 請求', async () => {
    // 模擬 HTTP 回應
    httpMock.onGet('/users').reply(200, [
      { id: 1, name: '使用者1' },
      { id: 2, name: '使用者2' }
    ]);

    const response = await runner.get('/users');
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
  });

  it('應該處理錯誤回應', async () => {
    httpMock.onPost('/users').reply(400, {
      error: '無效的請求'
    });

    await expect(runner.post('/users', {})).rejects.toThrow();
  });
});
```

### API Mock Server

```typescript
import { ApiMockServer } from '@specpilot/testing';

describe('Integration Tests', () => {
  let mockServer: ApiMockServer;

  beforeAll(async () => {
    // 啟動模擬伺服器
    mockServer = new ApiMockServer({
      port: 3001,
      spec: fixtures.specs.full
    });
    await mockServer.start();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  it('應該通過完整流程測試', async () => {
    // 使用模擬伺服器進行測試
    const result = await runFlow(flow, {
      baseUrl: 'http://localhost:3001'
    });

    expect(result.success).toBe(true);
  });
});
```

## 測試輔助函式

### 自訂斷言

```typescript
import { assertions } from '@specpilot/testing';

describe('Validation Tests', () => {
  it('應該符合 Schema', () => {
    const data = { id: 1, name: '測試' };

    // 自訂斷言
    assertions.assertMatchesSchema(data, userSchema);
    assertions.assertValidFlow(flowDefinition);
    assertions.assertValidSpec(openApiSpec);
  });

  it('應該包含必要欄位', () => {
    const response = { status: 200, body: { id: 1 } };

    assertions.assertHasFields(response, ['status', 'body']);
    assertions.assertHasStatus(response, 200);
  });
});
```

### 資料產生器

```typescript
import { generators } from '@specpilot/testing';

describe('Data Generation', () => {
  it('應該產生有效的測試資料', () => {
    // 產生使用者資料
    const user = generators.user();
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('email');

    // 產生多筆資料
    const users = generators.users(5);
    expect(users).toHaveLength(5);

    // 根據 Schema 產生資料
    const data = generators.fromSchema(userSchema);
    expect(data).toMatchSchema(userSchema);
  });

  it('應該產生無效資料用於負面測試', () => {
    const invalidData = generators.invalidUser();
    expect(() => validateUser(invalidData)).toThrow();
  });
});
```

### 等待工具

```typescript
import { waitFor, waitForCondition } from '@specpilot/testing';

describe('Async Tests', () => {
  it('應該等待非同步操作完成', async () => {
    let completed = false;

    setTimeout(() => { completed = true; }, 1000);

    await waitForCondition(() => completed, {
      timeout: 2000,
      interval: 100
    });

    expect(completed).toBe(true);
  });

  it('應該等待 API 回應', async () => {
    await waitFor(async () => {
      const response = await fetch('/api/status');
      return response.status === 200;
    });
  });
});
```

## 測試設定

### Vitest 共用設定

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { getTestConfig } from '@specpilot/testing';

export default defineConfig({
  test: getTestConfig({
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/__tests__/**', '**/dist/**']
    }
  })
});
```

### 測試環境設定

```typescript
import { setupTestEnv, cleanupTestEnv } from '@specpilot/testing';

// 全域設定
beforeAll(async () => {
  await setupTestEnv({
    mockServer: true,
    database: false,
    cache: true
  });
});

afterAll(async () => {
  await cleanupTestEnv();
});
```

## 使用範例

### 單元測試

```typescript
import { describe, it, expect } from 'vitest';
import { fixtures, generators } from '@specpilot/testing';
import { FlowParser } from '@specpilot/flow-parser';

describe('FlowParser', () => {
  const parser = new FlowParser();

  it('應該成功解析有效的流程', () => {
    const flow = parser.parse(fixtures.flows.userCrud);

    expect(flow).toBeDefined();
    expect(flow.name).toBe('User CRUD Test');
    expect(flow.steps).toHaveLength(4);
  });

  it('應該拒絕無效的流程', () => {
    expect(() => {
      parser.parse(fixtures.flows.invalid);
    }).toThrow();
  });
});
```

### 整合測試

```typescript
import { ApiMockServer, fixtures } from '@specpilot/testing';
import { FlowOrchestrator } from '@specpilot/core-flow';

describe('Flow Execution', () => {
  let mockServer: ApiMockServer;

  beforeAll(async () => {
    mockServer = new ApiMockServer({
      spec: fixtures.specs.full
    });
    await mockServer.start();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  it('應該成功執行完整流程', async () => {
    const orchestrator = new FlowOrchestrator({
      spec: fixtures.specs.full,
      flow: fixtures.flows.userCrud,
      config: { baseUrl: mockServer.url }
    });

    const result = await orchestrator.execute();

    expect(result.success).toBe(true);
    expect(result.passedSteps).toBe(4);
  });
});
```

## 開發指令

```bash
# 編譯模組
pnpm run build

# 開發模式 (watch)
pnpm run dev
```

## 架構設計原則

1. **易用性**: 簡化測試撰寫流程
2. **可重用性**: 提供可重用的測試資料與工具
3. **一致性**: 統一的測試風格與慣例
4. **隔離性**: 測試間互不影響
5. **效能**: 快速的測試執行

## 依賴關係

### 被依賴於
- 所有需要撰寫測試的 packages

### 依賴於
- `@specpilot/shared` - 共用工具

## Fixtures 清單

### OpenAPI Specs
- `specs/simple.yaml` - 簡單的 API
- `specs/full.yaml` - 完整的 API (含認證)
- `specs/swagger2.yaml` - Swagger 2.0 格式
- `specs/invalid.yaml` - 無效的規格

### Flow Definitions
- `flows/user-crud.yaml` - 使用者 CRUD
- `flows/with-auth.yaml` - 包含認證
- `flows/with-errors.yaml` - 錯誤處理
- `flows/invalid.yaml` - 無效流程

### Test Data
- `data/users.json` - 使用者資料
- `data/products.json` - 產品資料
- `data/orders.json` - 訂單資料

## 未來擴充方向

1. 視覺化測試報告產生器
2. 測試資料工廠 (Factory)
3. 快照測試支援
4. 效能測試工具
5. E2E 測試輔助工具
6. 測試覆蓋率分析工具
7. 測試資料版本管理
8. 多環境測試支援
