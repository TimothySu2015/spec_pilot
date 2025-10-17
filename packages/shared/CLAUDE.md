# @specpilot/shared - 共用工具與型別模組

## 模組概述

`@specpilot/shared` 是 SpecPilot 的基礎設施模組，提供所有其他模組共用的工具函式、型別定義、日誌系統、錯誤類別與常數定義。這是整個專案的基石模組。

## 核心職責

1. **結構化日誌**: 提供基於 pino 的 JSON Lines 日誌系統
2. **錯誤類別**: 定義標準化的錯誤類別與錯誤碼
3. **工具函式**: 提供常用的輔助函式
4. **型別定義**: 定義共用的 TypeScript 型別
5. **常數定義**: 集中管理專案常數

## 技術堆疊

- `pino` (9.0.0) - 高效能 JSON 日誌系統
- `pino-multi-stream` (6.0.0) - 多輸出串流支援
- `pino-pretty` (13.1.1) - 開發環境美化輸出
- `ajv` (^8.17.1) - JSON Schema 驗證
- `ajv-formats` (^3.0.1) - 格式驗證器

## 核心元件

### 1. StructuredLogger (結構化日誌)

```typescript
import { StructuredLogger } from '@specpilot/shared';

// 建立 Logger 實例
const logger = new StructuredLogger({
  level: 'info',
  component: 'http-runner',
  executionId: 'exec-123'
});

// 記錄日誌
logger.info('發送 HTTP 請求', {
  method: 'POST',
  url: '/api/users',
  duration: 250
});

logger.error('請求失敗', {
  error: error.message,
  statusCode: 500,
  retryCount: 3
});

// 日誌輸出格式 (JSON Lines)
// {"level":"info","time":1705478400000,"component":"http-runner","executionId":"exec-123","method":"POST","url":"/api/users","duration":250,"msg":"發送 HTTP 請求"}
```

### 日誌層級

- `debug` - 除錯資訊 (開發環境)
- `info` - 一般資訊 (預設)
- `warn` - 警告訊息
- `error` - 錯誤訊息
- `fatal` - 致命錯誤

### 日誌欄位標準

所有日誌必須包含：
- `timestamp` - 時間戳記 (自動加入)
- `level` - 日誌層級 (自動加入)
- `component` - 元件名稱
- `executionId` - 執行識別碼 (可選)
- `msg` - 日誌訊息

### 敏感資料遮罩

```typescript
// 自動遮罩敏感欄位
logger.info('使用者登入', {
  username: 'admin',
  password: 'secret123',  // 自動遮罩為 '***'
  token: 'abc123xyz'      // 自動遮罩為 '***'
});

// 輸出: {"username":"admin","password":"***","token":"***","msg":"使用者登入"}
```

### 2. 錯誤類別系統

```typescript
import {
  SpecPilotError,
  ConfigError,
  SpecError,
  FlowError,
  NetworkError,
  ValidationError,
  AuthError
} from '@specpilot/shared';

// 基礎錯誤類別
class SpecPilotError extends Error {
  code: string;
  details?: any;
  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'SpecPilotError';
    this.code = code;
    this.details = details;
  }
}

// 使用範例
throw new NetworkError(
  '1504',
  '連線失敗',
  { host: 'localhost', port: 3000 }
);
```

### 錯誤碼分類

| 範圍 | 類別 | 說明 |
|------|------|------|
| 1501 | ConfigError | 組態錯誤 |
| 1502 | SpecError | OpenAPI 規格錯誤 |
| 1503 | FlowError | 流程定義錯誤 |
| 1504-1505 | NetworkError | 網路連線錯誤 |
| 1506 | ValidationError | 驗證錯誤 |
| 1507 | AuthError | 認證錯誤 |
| 1508-1510 | NetworkError | SSL/DNS/連線錯誤 |

### 3. 工具函式

#### 字串處理

```typescript
import { maskSensitiveData, slugify } from '@specpilot/shared';

// 遮罩敏感資料
const masked = maskSensitiveData('password123');  // '***'

// 轉換為 slug
const slug = slugify('測試 Flow 名稱');  // 'test-flow-name'
```

#### 物件處理

```typescript
import { deepClone, deepMerge, pick, omit } from '@specpilot/shared';

// 深拷貝
const cloned = deepClone(originalObject);

// 深度合併
const merged = deepMerge(obj1, obj2);

// 選取欄位
const picked = pick(user, ['id', 'name', 'email']);

// 排除欄位
const omitted = omit(user, ['password', 'token']);
```

#### 非同步處理

```typescript
import { retry, timeout, sleep } from '@specpilot/shared';

// 重試機制
const result = await retry(
  () => fetchData(),
  { maxAttempts: 3, delay: 500 }
);

// 逾時控制
const result = await timeout(
  longRunningTask(),
  5000  // 5 秒逾時
);

// 延遲執行
await sleep(1000);  // 等待 1 秒
```

#### 驗證工具

```typescript
import { isValidUrl, isValidEmail, isValidUUID } from '@specpilot/shared';

// URL 驗證
if (isValidUrl('http://localhost:3000')) {
  console.log('✅ 有效的 URL');
}

// Email 驗證
if (isValidEmail('test@example.com')) {
  console.log('✅ 有效的 Email');
}

// UUID 驗證
if (isValidUUID('123e4567-e89b-12d3-a456-426614174000')) {
  console.log('✅ 有效的 UUID');
}
```

### 4. 共用型別定義

```typescript
// HTTP 方法
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

// 日誌層級
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// 執行狀態
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

// 步驟狀態
export type StepStatus = 'passed' | 'failed' | 'skipped';

// 錯誤嚴重程度
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// 通用回應格式
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
```

### 5. 常數定義

```typescript
// HTTP 狀態碼
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503
} as const;

// 預設組態
export const DEFAULT_CONFIG = {
  TIMEOUT: 5000,
  RETRY_COUNT: 3,
  RETRY_DELAY: 500,
  LOG_LEVEL: 'info',
  HTTP_PORT: 80,
  HTTPS_PORT: 443
} as const;

// 事件代碼
export const EVENT_CODES = {
  STEP_START: 'STEP_START',
  STEP_SUCCESS: 'STEP_SUCCESS',
  STEP_FAILURE: 'STEP_FAILURE',
  FLOW_START: 'FLOW_START',
  FLOW_COMPLETE: 'FLOW_COMPLETE',
  FALLBACK_USED: 'FALLBACK_USED'
} as const;
```

## 開發指令

```bash
# 編譯模組
pnpm run build

# 開發模式 (watch)
pnpm run dev
```

## 日誌使用範例

### 基本日誌

```typescript
import { StructuredLogger } from '@specpilot/shared';

const logger = new StructuredLogger({
  component: 'my-component',
  level: process.env.LOG_LEVEL || 'info'
});

logger.debug('除錯訊息', { detail: 'value' });
logger.info('一般訊息');
logger.warn('警告訊息', { warning: 'something' });
logger.error('錯誤訊息', { error: error.message });
```

### 執行上下文日誌

```typescript
// 為整個執行流程建立 Logger
const executionLogger = new StructuredLogger({
  component: 'flow-orchestrator',
  executionId: crypto.randomUUID()
});

// 所有日誌都會包含 executionId
executionLogger.info('開始執行流程');
executionLogger.info('步驟 1 完成');
executionLogger.error('步驟 2 失敗');
```

### 多輸出目標

```typescript
const logger = new StructuredLogger({
  component: 'app',
  streams: [
    { stream: process.stdout },              // 輸出到 console
    { stream: fs.createWriteStream('app.log') }  // 輸出到檔案
  ]
});
```

## 架構設計原則

1. **零依賴業務邏輯**: 只提供基礎工具，不涉及業務邏輯
2. **型別安全**: 完整的 TypeScript 型別定義
3. **效能優先**: 使用高效能的 pino 日誌系統
4. **標準化**: 統一的錯誤處理與日誌格式
5. **易用性**: 簡單清晰的 API 設計

## 依賴關係

### 被依賴於
- 幾乎所有其他 packages
- 提供基礎設施支援

### 依賴於
- 無 (基礎模組)

## 未來擴充方向

1. 效能監控工具 (Performance Monitor)
2. 快取管理器 (Cache Manager)
3. 事件系統 (Event Emitter)
4. 配置管理器增強
5. 國際化支援 (i18n)
6. 更多工具函式
7. 型別守衛函式庫
8. 日誌聚合與分析工具整合
