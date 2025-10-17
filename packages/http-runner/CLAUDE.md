# @specpilot/http-runner - HTTP 執行引擎

## 模組概述

`@specpilot/http-runner` 是 SpecPilot 的 HTTP 請求執行引擎，基於 axios 實現，負責執行實際的 API 呼叫、處理重試邏輯、逾時控制、錯誤處理與認證管理。

## 核心職責

1. **HTTP 請求執行**: 發送各種類型的 HTTP 請求
2. **重試機制**: 失敗時自動重試，使用指數退避策略
3. **逾時控制**: 設定與管理請求逾時時間
4. **認證管理**: 自動注入與管理認證憑證
5. **錯誤處理**: 統一處理網路與 HTTP 錯誤
6. **請求/回應攔截**: 支援中介軟體模式的攔截器

## 技術堆疊

### 核心依賴
- `axios` (1.6.8) - HTTP 客戶端函式庫
- `@specpilot/config` - 讀取執行組態
- `@specpilot/shared` - 共用工具與型別

### 開發依賴
- `nock` (13.4.0) - HTTP 模擬測試工具

## 核心元件

### HttpRunner
主要執行器類別：

```typescript
import { HttpRunner } from '@specpilot/http-runner';

const runner = new HttpRunner({
  baseUrl: 'http://localhost:3000',
  timeout: 5000,
  retryCount: 3,
  retryDelay: 500
});

// 執行請求
const response = await runner.execute({
  method: 'POST',
  path: '/api/users',
  headers: {
    'Content-Type': 'application/json'
  },
  body: {
    name: '測試使用者',
    email: 'test@example.com'
  }
});
```

### RetryStrategy
重試策略管理器：

```typescript
class RetryStrategy {
  // 指數退避計算
  calculateDelay(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt), 10000);
  }

  // 判斷是否應該重試
  shouldRetry(error: HttpError, attempt: number): boolean {
    // 網路錯誤或 5xx 錯誤才重試
    return (
      error.isNetworkError ||
      (error.statusCode >= 500 && error.statusCode < 600)
    ) && attempt < this.maxRetries;
  }
}
```

### AuthManager
認證管理器：

```typescript
class AuthManager {
  private token?: string;

  // 設定 Token
  setToken(token: string): void;

  // 自動注入 Authorization Header
  injectAuth(headers: Record<string, string>): Record<string, string> {
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }
}
```

## 支援的功能

### HTTP 方法

支援所有標準 HTTP 方法：
- `GET` - 查詢資源
- `POST` - 建立資源
- `PUT` - 完整更新資源
- `PATCH` - 部分更新資源
- `DELETE` - 刪除資源
- `HEAD` - 取得 Header
- `OPTIONS` - 取得支援的方法

### 請求組態

```typescript
interface RequestConfig {
  method: HttpMethod;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, any>;      // Query parameters
  body?: any;                        // Request body
  timeout?: number;                  // 覆寫全域逾時
  retryCount?: number;               // 覆寫全域重試次數
  validateStatus?: (status: number) => boolean;  // 自訂狀態碼驗證
}
```

### 回應格式

```typescript
interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;                     // 已解析的回應內容
  raw: string;                   // 原始回應內容
  duration: number;              // 請求耗時 (ms)
  timestamp: Date;               // 回應時間
  retryCount: number;            // 重試次數
}
```

## 重試機制

### 預設策略

```typescript
// 指數退避 (Exponential Backoff)
const delays = [
  500,   // 第 1 次重試: 500ms
  1000,  // 第 2 次重試: 1s
  2000,  // 第 3 次重試: 2s
  4000,  // 第 4 次重試: 4s
  // ... 最多 10s
];
```

### 重試條件

自動重試的情況：
- ✅ 網路錯誤 (ECONNREFUSED, ETIMEDOUT 等)
- ✅ HTTP 5xx 錯誤 (伺服器錯誤)
- ✅ 請求逾時

不會重試的情況：
- ❌ HTTP 4xx 錯誤 (客戶端錯誤)
- ❌ HTTP 2xx/3xx (成功回應)
- ❌ 達到最大重試次數

### 自訂重試策略

```typescript
runner.setRetryStrategy({
  maxRetries: 5,
  retryDelay: 1000,
  shouldRetry: (error, attempt) => {
    // 自訂重試邏輯
    return error.statusCode === 429 || // Rate limit
           error.statusCode >= 500;    // Server error
  },
  calculateDelay: (attempt) => {
    // 線性退避
    return 1000 * attempt;
  }
});
```

## 錯誤處理

### 錯誤類型

```typescript
class HttpError extends Error {
  code: string;
  statusCode?: number;
  isNetworkError: boolean;
  isTimeout: boolean;
  request: RequestConfig;
  response?: HttpResponse;
  retryAttempts: number;
}
```

### 錯誤碼

- `1504` - 網路連線失敗
- `1505` - 請求逾時
- `1508` - SSL/TLS 錯誤
- `1509` - DNS 解析失敗
- `1510` - 連線被拒絕

### 錯誤處理範例

```typescript
try {
  const response = await runner.execute(request);
} catch (error) {
  if (error instanceof HttpError) {
    if (error.isTimeout) {
      console.error('請求逾時');
    } else if (error.isNetworkError) {
      console.error('網路錯誤:', error.message);
    } else if (error.statusCode) {
      console.error(`HTTP ${error.statusCode}:`, error.message);
    }
  }
}
```

## 攔截器系統

### 請求攔截器

```typescript
runner.addRequestInterceptor((config) => {
  // 在發送請求前修改組態
  console.log(`發送請求: ${config.method} ${config.path}`);

  // 加入自訂 Header
  config.headers['X-Request-ID'] = generateRequestId();

  return config;
});
```

### 回應攔截器

```typescript
runner.addResponseInterceptor((response) => {
  // 在接收回應後處理
  console.log(`收到回應: ${response.status} (${response.duration}ms)`);

  // 記錄慢速請求
  if (response.duration > 1000) {
    logger.warn('慢速請求', { path: response.request.path });
  }

  return response;
});
```

### 錯誤攔截器

```typescript
runner.addErrorInterceptor((error) => {
  // 統一處理錯誤
  logger.error('請求失敗', {
    path: error.request.path,
    status: error.statusCode,
    message: error.message
  });

  // 可以修改錯誤或重新拋出
  throw error;
});
```

## 使用範例

### 基本使用

```typescript
import { HttpRunner } from '@specpilot/http-runner';

const runner = new HttpRunner({
  baseUrl: 'http://localhost:3000',
  timeout: 5000
});

// GET 請求
const users = await runner.get('/api/users');

// POST 請求
const newUser = await runner.post('/api/users', {
  body: { name: '新使用者', email: 'new@example.com' }
});

// PUT 請求
await runner.put(`/api/users/${newUser.body.id}`, {
  body: { name: '更新的名稱' }
});

// DELETE 請求
await runner.delete(`/api/users/${newUser.body.id}`);
```

### 認證流程

```typescript
// 登入取得 Token
const loginResponse = await runner.post('/auth/login', {
  body: {
    username: 'admin',
    password: 'password'
  }
});

// 設定 Token
runner.setAuthToken(loginResponse.body.token);

// 後續請求自動帶 Authorization Header
const profile = await runner.get('/api/profile');
// Header 會自動包含: Authorization: Bearer <token>
```

### 進階組態

```typescript
const runner = new HttpRunner({
  baseUrl: 'https://api.example.com',
  timeout: 10000,
  retryCount: 3,
  retryDelay: 500,
  headers: {
    'User-Agent': 'SpecPilot/1.0',
    'Accept': 'application/json'
  },
  validateStatus: (status) => {
    // 自訂哪些狀態碼視為成功
    return status >= 200 && status < 300;
  }
});
```

## 開發指令

```bash
# 編譯模組
pnpm run build

# 開發模式 (watch)
pnpm run dev

# 執行測試
pnpm run test

# 清理編譯產物
pnpm run clean
```

## 測試支援

### 使用 nock 模擬 HTTP

```typescript
import nock from 'nock';

// 模擬 API 回應
nock('http://localhost:3000')
  .post('/api/users')
  .reply(201, {
    id: 1,
    name: '測試使用者'
  });

// 執行測試
const response = await runner.post('/api/users', {
  body: { name: '測試使用者' }
});

expect(response.status).toBe(201);
expect(response.body.id).toBe(1);
```

## 架構設計原則

1. **可靠性優先**: 內建重試與錯誤處理機制
2. **可觀測性**: 詳細的請求/回應日誌
3. **可測試性**: 易於模擬與測試
4. **可擴充性**: 攔截器系統支援客製化
5. **效能考量**: 連線池管理與逾時控制

## 依賴關係

### 被依賴於
- `@specpilot/core-flow` - 執行測試步驟
- 所有需要發送 HTTP 請求的模組

### 依賴於
- `@specpilot/config` - 讀取組態
- `@specpilot/shared` - 共用工具

## 未來擴充方向

1. HTTP/2 與 HTTP/3 支援
2. WebSocket 連線支援
3. 串流回應處理 (Stream)
4. 請求快取機制
5. 連線池進階管理
6. 速率限制 (Rate Limiting)
7. 請求優先順序控制
8. 批次請求優化
9. gRPC 支援
10. GraphQL 支援
