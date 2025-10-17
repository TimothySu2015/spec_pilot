# SpecPilot 日誌系統架構

## 📖 概述

SpecPilot 專案使用**雙日誌系統**,根據不同的執行環境與需求,將日誌寫入不同的檔案:

1. **`logs/specpilot.log`** - 標準結構化日誌 (CLI 與核心套件)
2. **`logs/mcp-server.log`** - 靜默日誌 (MCP Server 專用)

## 🎯 為什麼需要兩種日誌?

### 問題背景

SpecPilot 有兩種執行模式:

1. **CLI 模式**: 直接在終端機執行,可以自由使用 stdout/stderr
2. **MCP Server 模式**: 透過 Stdio Transport 與 Claude Desktop 通訊,**stdout/stderr 被保留給 JSON-RPC 協議**

MCP Server 如果使用一般的 logger (輸出到 stdout),會導致:
- ❌ 干擾 MCP 協議通訊
- ❌ Claude Desktop 無法解析回應
- ❌ MCP Server 失效

**解決方案**:
- CLI 與核心套件使用標準 logger → `specpilot.log`
- MCP Server 使用靜默 logger → `mcp-server.log`

---

## 📊 日誌系統對照表

| 特性 | specpilot.log | mcp-server.log |
|------|---------------|----------------|
| **使用者** | CLI、核心套件 (core-flow, http-runner 等) | MCP Server 專用 |
| **實作方式** | `@specpilot/shared` 的 `createStructuredLogger` | MCP Server 內建靜默 logger |
| **技術棧** | pino + pino-multi-stream | 原生 fs.writeFileSync |
| **輸出目標** | stdout **+** 檔案 | **只有**檔案 |
| **格式** | JSON Lines (含 pid) | JSON Lines (無 pid) |
| **彩色輸出** | ✅ (開發模式) | ❌ |
| **執行 ID** | ✅ (全域追蹤) | ✅ (每個請求獨立) |
| **敏感資料遮罩** | ✅ (自動) | ✅ (手動) |
| **適用場景** | 一般 CLI/Node.js 應用 | Stdio Transport 環境 |

---

## 🏗️ 系統一: specpilot.log (標準日誌)

### 使用位置

所有**非 MCP Server** 的元件都使用這個日誌系統:

```typescript
// 範例: packages/http-runner/src/http-client.ts
import { createStructuredLogger } from '@specpilot/shared';

const logger = createStructuredLogger('http-runner');

logger.info('發送 HTTP 請求', {
  method: 'GET',
  url: 'https://api.example.com/users'
});
```

### 使用的套件清單

透過 `createStructuredLogger` 寫入此日誌的套件:

- `apps/cli` - CLI 主程式
- `packages/core-flow` - 流程協調引擎
- `packages/http-runner` - HTTP 請求執行器
- `packages/flow-parser` - YAML 流程解析器
- `packages/spec-loader` - OpenAPI 規格載入器
- `packages/validation` - 驗證引擎
- `packages/reporting` - 報表產生器
- `packages/config` - 組態管理

### 實作架構

```typescript
// packages/shared/src/logger.ts (100 行)
import pino from 'pino';
import pinoMultistream from 'pino-multi-stream';

export function createStructuredLogger(component: string): StructuredLogger {
  const streams = [
    // 1. 主控台輸出 (stdout)
    {
      stream: process.env.NODE_ENV === 'development'
        ? pino.destination({ sync: true, dest: 1 })
        : process.stdout
    },
    // 2. 檔案輸出 (logs/specpilot.log)
    {
      stream: pino.destination({
        dest: path.join(logDir, 'specpilot.log'),
        sync: true,
        mkdir: true,
      })
    }
  ];

  const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
  }, pinoMultistream.multistream(streams));

  return {
    info(message, context) {
      logger.info({
        executionId: currentExecutionId,
        component,
        message,
        context: maskSensitiveData(context),
        timestamp: new Date().toISOString(),
      });
    },
    // ... error, warn, debug
  };
}
```

### 日誌格式範例

```json
{
  "level": "info",
  "time": "2025-10-17T02:08:10.913Z",
  "pid": 31212,
  "timestamp": "2025-10-17T02:08:10.913Z",
  "executionId": "96fc0b1a-a35b-41d8-8bc7-8211fd3d0e9d",
  "component": "http-runner",
  "message": "HTTP 請求成功",
  "context": {
    "method": "GET",
    "url": "https://api.example.com/users",
    "statusCode": 200,
    "duration": 145
  }
}
```

### 特色功能

#### ✅ 雙輸出模式
同時寫入 stdout 與檔案,適合開發除錯與 CI/CD 環境。

#### ✅ 全域執行 ID
使用 `setExecutionId()` 追蹤整個測試流程:

```typescript
import { setExecutionId } from '@specpilot/shared';

setExecutionId('run-1759302744502-316s98t');
// 此後所有 logger 都會自動帶上這個 executionId
```

#### ✅ 自動敏感資料遮罩
自動偵測並遮罩含有以下關鍵字的欄位:
- `token`
- `password`
- `secret`
- `key`
- `authorization`

```typescript
logger.info('登入成功', {
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
});
// 實際寫入: { token: '***' }
```

#### ✅ 子 Logger
建立繼承上下文的子 Logger:

```typescript
const parentLogger = createStructuredLogger('parent');
const childLogger = parentLogger.child({ userId: '123' });

childLogger.info('執行操作'); // 自動帶上 userId: '123'
```

---

## 🏗️ 系統二: mcp-server.log (靜默日誌)

### 使用位置

**僅** `apps/mcp-server/src/index.ts` 使用此系統。

### 為什麼不用標準 Logger?

MCP Server 使用 **Stdio Transport**,stdin/stdout 被保留給 JSON-RPC 協議:

```
stdin  → 接收 Claude Desktop 的請求
stdout → 回傳給 Claude Desktop 的回應
```

如果使用 `createStructuredLogger`,pino 會寫入 stdout,導致:

```json
// Claude Desktop 期望收到:
{"jsonrpc":"2.0","id":1,"result":{...}}

// 實際收到 (被日誌污染):
{"level":"info","message":"開始執行"}
{"jsonrpc":"2.0","id":1,"result":{...}}
```

結果: ❌ Claude Desktop 解析失敗,MCP Server 無法運作。

### 實作架構

```typescript
// apps/mcp-server/src/index.ts (17-57 行)
const logger = {
  info: (message: string, context?: unknown): void => {
    const logsDir = path.join(process.cwd(), 'logs');
    const logPath = path.join(logsDir, 'mcp-server.log');

    try {
      // 確保目錄存在
      if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true });
      }

      // 格式化為 JSON Lines
      const logEntry = JSON.stringify({
        level: 'info',
        time: new Date().toISOString(),
        message,
        context
      }) + '\n';

      // 同步寫入檔案 (不輸出到 stdout!)
      writeFileSync(logPath, logEntry, { flag: 'a' });
    } catch (e) {
      // 靜默處理錯誤,避免影響 MCP 協議
    }
  },

  error: (message: string, context?: unknown): void => {
    // 相同實作,只是 level: 'error'
  }
};
```

### 核心特性

#### ✅ 完全靜默
- **不使用** `console.log`
- **不使用** `process.stdout.write`
- **只寫入檔案**

#### ✅ 錯誤容錯
`try-catch` 包裹並靜默處理錯誤,確保日誌系統本身不會導致 MCP Server 崩潰。

#### ✅ 同步寫入
使用 `writeFileSync` 確保日誌順序正確,除錯時不會丟失日誌。

### 日誌格式範例

```json
{
  "level": "info",
  "time": "2025-10-17T02:03:21.818Z",
  "message": "SpecPilot MCP Server 已啟動",
  "context": {
    "event": "server_start",
    "details": {
      "transport": "stdio"
    }
  }
}
```

**差異對照**:

| 欄位 | specpilot.log | mcp-server.log |
|------|---------------|----------------|
| `level` | ✅ | ✅ |
| `time` | ✅ | ✅ |
| `pid` | ✅ | ❌ |
| `timestamp` | ✅ | ❌ (已有 time) |
| `executionId` | ✅ | ❌ (在 context 內) |
| `component` | ✅ | ❌ (固定為 mcp-server) |
| `message` | ✅ | ✅ |
| `context` | ✅ | ✅ |

---

## 🔍 如何區分日誌來源?

### 方法 1: 查看欄位結構

```bash
# specpilot.log 包含 pid 和 component
grep '"pid"' logs/specpilot.log | head -1

# mcp-server.log 不包含 pid
grep '"pid"' logs/mcp-server.log | head -1  # 無結果
```

### 方法 2: 查看時間戳欄位

```bash
# specpilot.log 有兩個時間欄位 (time + timestamp)
jq 'select(.timestamp != null)' logs/specpilot.log | head -1

# mcp-server.log 只有 time
jq 'select(.time != null and .timestamp == null)' logs/mcp-server.log | head -1
```

### 方法 3: 查看訊息內容

```bash
# mcp-server.log 的訊息都與 MCP 工具相關
grep 'MCP Server' logs/mcp-server.log
grep 'listSpecs' logs/mcp-server.log
grep 'runFlow' logs/mcp-server.log

# specpilot.log 的訊息來自各核心套件
grep 'http-runner' logs/specpilot.log
grep 'flow-parser' logs/specpilot.log
```

---

## 🎬 使用場景

### 場景 1: CLI 執行測試

```bash
pnpm run start -- --spec specs/openapi.yaml --flow flows/user_crud.yaml
```

**產生的日誌**:
- ✅ `specpilot.log` - 記錄 CLI、core-flow、http-runner 等套件的執行過程
- ❌ `mcp-server.log` - 無產生 (MCP Server 未啟動)

**追蹤方式**:
```bash
tail -f logs/specpilot.log
```

### 場景 2: MCP Server 執行測試

```bash
# Claude Desktop 呼叫 runFlow 工具
```

**產生的日誌**:
- ✅ `specpilot.log` - 記錄核心套件的執行過程 (由 MCP Server 內部呼叫)
- ✅ `mcp-server.log` - 記錄 MCP Server 本身的工具呼叫與生命週期

**追蹤方式**:
```bash
# 同時監看兩個日誌
tail -f logs/mcp-server.log logs/specpilot.log
```

### 場景 3: 開發除錯

**除錯 MCP Server 工具邏輯**:
```bash
# 查看 MCP Server 收到的請求與回應
tail -f logs/mcp-server.log | jq '.'
```

**除錯核心套件行為**:
```bash
# 查看 http-runner、flow-parser 等的詳細執行
tail -f logs/specpilot.log | jq 'select(.component == "http-runner")'
```

---

## 📚 完整事件類型對照

### mcp-server.log 事件

詳見 `apps/mcp-server/LOGGING.md`,包含:

- `server_start` - Server 啟動
- `list_specs_start/success/error` - 列出規格
- `list_flows_start/success/error` - 列出流程
- `run_flow_start/success/error` - 執行流程
- `get_report_start/success/error` - 取得報表
- `generate_flow_start/success/error` - 產生 Flow
- `validate_flow_start/success/error` - 驗證 Flow
- ... 等

### specpilot.log 事件

由各套件自訂,常見事件:

- `HTTP_REQUEST_START` - 開始發送 HTTP 請求
- `HTTP_REQUEST_SUCCESS` - HTTP 請求成功
- `HTTP_REQUEST_FAILURE` - HTTP 請求失敗
- `VALIDATION_START` - 開始驗證
- `VALIDATION_SUCCESS` - 驗證成功
- `VALIDATION_FAILURE` - 驗證失敗
- `STEP_START` - 測試步驟開始
- `STEP_SUCCESS` - 測試步驟成功
- `STEP_FAILURE` - 測試步驟失敗
- `FLOW_START` - 流程開始
- `FLOW_COMPLETE` - 流程完成

---

## 🛠️ 維護與最佳實踐

### 日誌清理

```bash
# 清空所有日誌
> logs/specpilot.log
> logs/mcp-server.log

# 或刪除並重新建立
rm -rf logs/
mkdir logs
```

### 日誌輪轉 (未實作)

目前兩個日誌檔案都**無大小限制**,建議:

1. 使用外部工具 (如 `logrotate`)
2. 實作基於大小/時間的輪轉邏輯
3. 改用 `pino-roll` 套件 (僅適用於 specpilot.log)

### 安全性注意事項

#### ✅ 敏感資料遮罩

**specpilot.log**: 自動遮罩 (透過 `maskSensitiveData`)

**mcp-server.log**: 手動遮罩,需注意:

```typescript
// ✅ 好的做法
logger.info('已覆寫配置', {
  details: {
    hasBaseUrl: !!baseUrl,  // 只記錄布林值
    hasToken: !!token       // 不記錄實際值
  }
});

// ❌ 不好的做法
logger.info('已覆寫配置', {
  details: {
    baseUrl: baseUrl,  // 可能洩漏內部 URL
    token: token       // 洩漏 Token!
  }
});
```

### 效能考量

#### specpilot.log
- 使用 pino (高效能日誌庫)
- 非同步寫入檔案
- 開發模式可能有輕微效能影響 (pretty format)

#### mcp-server.log
- 使用同步寫入 (`writeFileSync`)
- 可能阻塞 Event Loop
- 但日誌量小,影響可忽略
- 改進建議: 如果日誌量大,可改用非同步 `appendFile`

---

## 🎓 總結

SpecPilot 的雙日誌系統是針對**不同執行環境**設計的最佳實踐:

### specpilot.log (標準日誌)
- 🎯 **目的**: 記錄核心套件與 CLI 的執行細節
- 🛠️ **技術**: pino + pino-multi-stream
- 📍 **輸出**: stdout + 檔案
- 🧩 **適用**: 一般 Node.js 應用程式

### mcp-server.log (靜默日誌)
- 🎯 **目的**: 記錄 MCP Server 工具呼叫與生命週期
- 🛠️ **技術**: 原生 fs.writeFileSync
- 📍 **輸出**: 只有檔案
- 🧩 **適用**: Stdio Transport 環境 (MCP 協議)

這種設計確保:
1. ✅ MCP Server 在 Claude Desktop 中穩定運作
2. ✅ CLI 模式保留完整的終端機輸出
3. ✅ 兩種模式都有完整的除錯能力
4. ✅ 日誌格式統一 (JSON Lines),易於分析

當您執行不同模式時,可依據上述說明選擇監看對應的日誌檔案。
