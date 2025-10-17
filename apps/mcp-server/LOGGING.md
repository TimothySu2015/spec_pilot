# MCP Server 日誌系統詳解

## 📖 概述

MCP Server 使用**靜默日誌器（Silent Logger）**，將所有日誌寫入檔案而非 stdout/stderr，避免干擾 MCP 協議的 Stdio Transport。

## 🎯 設計原理

### 為什麼需要靜默日誌？

MCP (Model Context Protocol) 使用 **Stdio Transport** 進行通訊：
- **stdin**: 接收來自 Claude Desktop 的 JSON-RPC 請求
- **stdout**: 回傳給 Claude Desktop 的 JSON-RPC 回應

**問題**：如果使用 `console.log()` 或一般的日誌系統（輸出到 stdout/stderr），會：
1. ❌ 干擾 JSON-RPC 通訊協議
2. ❌ 導致 Claude Desktop 無法正確解析回應
3. ❌ 造成 MCP Server 失效

**解決方案**：使用檔案日誌系統 ✅

## 🏗️ 實作架構

### 1. Logger 物件定義

```typescript
// 位置：apps/mcp-server/src/index.ts (第 17-57 行)

const logger = {
  info: (message: string, context?: unknown): void => {
    const logsDir = path.join(process.cwd(), 'logs');
    const logPath = path.join(logsDir, 'mcp-server.log');

    try {
      // 1. 確保 logs 目錄存在
      if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true });
      }

      // 2. 格式化為 JSON Lines 格式
      const logEntry = JSON.stringify({
        level: 'info',
        time: new Date().toISOString(),
        message,
        context
      }) + '\n';

      // 3. 附加模式寫入檔案（不覆蓋）
      writeFileSync(logPath, logEntry, { flag: 'a' });
    } catch (e) {
      // 4. 靜默處理錯誤（避免影響主程式）
    }
  },

  error: (message: string, context?: unknown): void => {
    // 與 info 相同的實作，只是 level: 'error'
  }
};
```

### 2. 核心特性

#### ✅ JSON Lines 格式 (JSONL)
每一行都是獨立的 JSON 物件，易於：
- 串流處理
- grep/tail 分析
- 工具解析（如 `jq`）

#### ✅ 自動建立目錄
使用 `mkdirSync(logsDir, { recursive: true })` 確保 `logs/` 目錄存在。

#### ✅ 附加模式寫入
使用 `{ flag: 'a' }` 確保日誌不會覆蓋，而是持續累積。

#### ✅ 錯誤容錯
`try-catch` 包裹並靜默處理錯誤，避免日誌系統本身導致 Server 崩潰。

## 📊 日誌格式

### 標準日誌結構

```json
{
  "level": "info",                    // 日誌等級：info | error
  "time": "2025-10-17T02:08:10.809Z", // ISO 8601 時間戳
  "message": "runFlow 方法開始執行",   // 人類可讀訊息
  "context": {                         // 結構化上下文
    "executionId": "run-1759302744502-316s98t",
    "method": "runFlow",
    "event": "run_flow_start",
    "details": {
      "hasParams": true
    }
  }
}
```

### 欄位說明

| 欄位 | 類型 | 說明 | 範例 |
|------|------|------|------|
| `level` | string | 日誌等級 | `info`, `error` |
| `time` | string | ISO 8601 時間戳 | `2025-10-17T02:08:10.809Z` |
| `message` | string | 日誌訊息（繁體中文） | `listSpecs 方法開始執行` |
| `context` | object | 結構化上下文資料 | 見下方 |

### Context 結構

```typescript
context: {
  executionId?: string,    // 執行 ID（追蹤特定請求）
  method: string,          // 呼叫的方法名稱
  event: string,          // 事件代碼（用於過濾）
  details?: object        // 額外詳細資訊
}
```

## 🎬 日誌事件類型

### Server 生命週期
- `server_start` - Server 啟動成功
- `server_error` - Server 啟動失敗

### listSpecs 工具
- `list_specs_start` - 開始列出規格檔案
- `list_specs_success` - 成功列出（含檔案數量）
- `list_specs_error` - 執行失敗

### listFlows 工具
- `list_flows_start` - 開始列出流程檔案
- `list_flows_success` - 成功列出（含檔案數量）
- `list_flows_error` - 執行失敗

### runFlow 工具
- `run_flow_start` - 開始執行流程
- `config_override` - 覆寫配置參數
- `reading_report_for_diagnosis` - 讀取報表建立診斷
- `diagnostic_context_created` - 診斷上下文已建立
- `diagnostic_context_error` - 診斷建立失敗
- `run_flow_success` - 執行成功
- `run_flow_error` - 執行失敗

### getReport 工具
- `get_report_start` - 開始取得報表
- `get_report_success` - 成功取得報表
- `get_report_error` - 取得失敗

### generateFlow 工具
- `generate_flow_start` - 開始產生 Flow
- `generate_flow_success` - 成功產生（含步驟數）
- `generate_flow_error` - 產生失敗

### validateFlow 工具
- `validate_flow_start` - 開始驗證
- `validate_flow_success` - 驗證成功（含錯誤/警告數）
- `validate_flow_error` - 驗證失敗

### checkFlowQuality 工具
- `check_quality_start` - 開始品質檢查
- `check_quality_success` - 檢查完成（含評分）
- `check_quality_error` - 檢查失敗

### saveFlow 工具
- `save_flow_start` - 開始儲存
- `save_flow_success` - 儲存成功
- `save_flow_error` - 儲存失敗

## 🔍 使用範例

### 範例 1：追蹤特定執行

```bash
# 過濾特定 executionId 的所有日誌
grep "run-1759302744502-316s98t" logs/mcp-server.log
```

輸出：
```json
{"level":"info","time":"...","message":"runFlow 方法開始執行","context":{"executionId":"run-1759302744502-316s98t",...}}
{"level":"info","time":"...","message":"已覆寫配置","context":{"executionId":"run-1759302744502-316s98t",...}}
{"level":"info","time":"...","message":"runFlow 方法成功完成","context":{"executionId":"run-1759302744502-316s98t",...}}
```

### 範例 2：過濾特定事件

```bash
# 只看 Server 啟動事件
grep "server_start" logs/mcp-server.log
```

### 範例 3：即時監看日誌

```bash
# 即時追蹤新日誌（類似 tail -f）
tail -f logs/mcp-server.log
```

### 範例 4：統計錯誤數量

```bash
# 統計錯誤日誌數量
grep '"level":"error"' logs/mcp-server.log | wc -l
```

### 範例 5：使用 jq 美化輸出

```bash
# 美化顯示最後一筆日誌
tail -1 logs/mcp-server.log | jq '.'
```

輸出：
```json
{
  "level": "info",
  "time": "2025-10-17T02:08:10.809Z",
  "message": "SpecPilot MCP Server 已啟動",
  "context": {
    "event": "server_start",
    "details": {
      "transport": "stdio"
    }
  }
}
```

### 範例 6：提取特定欄位

```bash
# 只顯示訊息和時間
jq -r '"\(.time) - \(.message)"' logs/mcp-server.log
```

輸出：
```
2025-10-17T02:08:10.809Z - SpecPilot MCP Server 已啟動
2025-10-17T02:10:15.234Z - listSpecs 方法開始執行
2025-10-17T02:10:15.456Z - listSpecs 方法成功完成
```

## 🎨 日誌使用最佳實踐

### 1. 在關鍵路徑記錄

```typescript
// ✅ 好的做法：記錄開始、成功、失敗
logger.info('方法開始執行', { event: 'method_start' });
try {
  // 執行邏輯
  logger.info('方法成功完成', { event: 'method_success' });
} catch (error) {
  logger.error('方法執行失敗', { event: 'method_error' });
}
```

### 2. 提供結構化上下文

```typescript
// ✅ 好的做法：提供豐富的上下文
logger.info('執行完成', {
  executionId,
  method: 'runFlow',
  event: 'run_flow_success',
  details: {
    totalSteps: 10,
    successSteps: 8,
    failedSteps: 2
  }
});

// ❌ 不好的做法：缺乏上下文
logger.info('完成');
```

### 3. 使用有意義的事件代碼

```typescript
// ✅ 好的做法：使用標準化事件代碼
event: 'list_specs_start'
event: 'list_specs_success'
event: 'list_specs_error'

// ❌ 不好的做法：隨意命名
event: 'start'
event: 'done'
event: 'oops'
```

### 4. 錯誤時記錄詳細資訊

```typescript
// ✅ 好的做法：記錄錯誤細節
logger.error('操作失敗', {
  method: 'validateFlow',
  event: 'validate_error',
  details: {
    error: error instanceof Error ? error.message : '未知錯誤',
    stack: error instanceof Error ? error.stack : undefined,
    input: { flowContent: '...' }
  }
});
```

## 🛠️ 與標準 Logger 的比較

### SpecPilot 的雙日誌系統

SpecPilot 專案實際上使用**兩種日誌系統**：

1. **`logs/mcp-server.log`** - MCP Server 靜默日誌 (本文件說明的系統)
2. **`logs/specpilot.log`** - 標準結構化日誌 (CLI 與核心套件使用)

### SpecPilot 的專案標準 Logger

專案有 `@specpilot/shared` 套件提供的 `createStructuredLogger`：

```typescript
// 標準用法（其他套件）
import { createStructuredLogger } from '@specpilot/shared';
const logger = createStructuredLogger('component-name');
logger.info('message', { context });
```

這個 logger 會同時輸出到：
- **stdout** (終端機顯示)
- **`logs/specpilot.log`** (檔案記錄)

### 為什麼 MCP Server 不使用標準 Logger?

`createStructuredLogger` 預設會輸出到 **stdout**，這會：
1. 干擾 MCP Stdio Transport
2. 破壞 JSON-RPC 通訊

所以 MCP Server 使用自訂的靜默日誌器,**只寫入檔案**。

### 對照表

| 特性 | mcp-server.log | specpilot.log |
|------|----------------|---------------|
| **使用者** | MCP Server 專用 | CLI、核心套件 |
| **實作** | 自訂靜默 logger | pino + pino-multi-stream |
| **輸出位置** | 只有檔案 | stdout **+** 檔案 |
| **適用場景** | Stdio Transport 環境 | 一般 CLI/Server |
| **格式** | JSON Lines | JSON Lines |
| **彩色輸出** | ❌ | ✅ (開發模式) |
| **執行 ID** | ✅ (context 內) | ✅ (頂層欄位) |
| **敏感資料遮罩** | ✅ (手動) | ✅ (自動) |

### 何時產生哪個日誌?

**CLI 模式執行測試**:
```bash
pnpm run start -- --spec specs/openapi.yaml --flow flows/user_crud.yaml
```
- ✅ 產生 `specpilot.log` (CLI 與核心套件)
- ❌ 不產生 `mcp-server.log` (MCP Server 未啟動)

**MCP Server 執行測試**:
```bash
# Claude Desktop 呼叫 runFlow 工具
```
- ✅ 產生 `mcp-server.log` (MCP Server 工具呼叫)
- ✅ 產生 `specpilot.log` (核心套件執行過程)

### 同時監看兩個日誌

```bash
# 同時追蹤兩個日誌檔案
tail -f logs/mcp-server.log logs/specpilot.log

# 或使用 multitail (需安裝)
multitail logs/mcp-server.log logs/specpilot.log
```

詳細的雙日誌系統架構說明,請參考 `docs/LOGGING-ARCHITECTURE.md`。

## 📁 檔案位置

```
專案根目錄/
└── logs/
    ├── mcp-server.log          # 當前日誌 (< 10MB)
    ├── mcp-server.log.1.gz     # 昨天的日誌 (壓縮)
    ├── mcp-server.log.2.gz     # 前天的日誌
    └── ...                     # 最多保留 7 個舊檔案
```

**特性**：
- ✅ 自動建立（首次寫入時）
- ✅ 自動輪轉（10MB 或每日）
- ✅ 自動壓縮舊檔案 (gzip)
- ✅ 自動清理過期檔案 (保留 7 天)
- ✅ JSON Lines 格式

**✨ 新功能 - 日誌輪轉**:
現已整合 `rotating-file-stream` 實作自動日誌管理,詳見 [LOG-ROTATION-USAGE.md](./LOG-ROTATION-USAGE.md)

## 🧹 日誌維護

### 自動輪轉 (✅ 已實作)

MCP Server 現已整合 `rotating-file-stream`,提供自動日誌管理:

- ✅ **自動輪轉**: 檔案 ≥ 10MB 或每日自動輪轉
- ✅ **自動壓縮**: 舊日誌自動壓縮為 .gz (節省 90% 空間)
- ✅ **自動清理**: 保留最多 7 個舊檔案,自動刪除過期日誌
- ✅ **零配置**: 無需手動維護

詳細使用說明: [LOG-ROTATION-USAGE.md](./LOG-ROTATION-USAGE.md)

### 手動操作 (選用)

```bash
# 查看所有日誌檔案
ls -lh logs/mcp-server*

# 查看壓縮的舊日誌
zcat logs/mcp-server.log.1.gz | jq '.'

# 刪除所有舊日誌 (保留當前)
rm logs/mcp-server.log.*.gz

# 完全重新開始
rm logs/mcp-server.log*
```

## 🎯 效能考量

### 同步寫入 vs 非同步寫入

目前使用 **同步寫入** (`writeFileSync`)：

**優點**：
- ✅ 實作簡單
- ✅ 確保日誌順序
- ✅ 除錯時不會丟失日誌

**缺點**：
- ⚠️ 阻塞 Event Loop（但影響極小）

**改進建議**：
如果日誌量大，可改用非同步寫入：

```typescript
import { appendFile } from 'fs/promises';

const logger = {
  info: async (message: string, context?: unknown): Promise<void> => {
    const logEntry = JSON.stringify({...}) + '\n';
    await appendFile(logPath, logEntry).catch(() => {});
  }
};
```

## 🔐 安全性考量

### 1. 敏感資料處理

**注意**：日誌中不應包含：
- API Token
- 密碼
- 私鑰
- 個人識別資訊 (PII)

**目前狀況**：
```typescript
// ✅ 好的做法：只記錄是否存在
logger.info('已覆寫配置', {
  details: {
    hasBaseUrl: !!baseUrl,  // 只記錄布林值
    hasToken: !!token       // 不記錄實際 token
  }
});
```

### 2. 檔案權限

預設權限由作業系統決定。建議設定：
```bash
chmod 600 logs/mcp-server.log  # 只有擁有者可讀寫
```

## 📚 相關資源

- [MCP 官方文檔](https://github.com/modelcontextprotocol/protocol)
- [JSON Lines 格式規範](https://jsonlines.org/)
- [Pino Logger](https://github.com/pinojs/pino)
- [SpecPilot Shared Logger](../../packages/shared/src/logger.ts)

## 🎓 總結

MCP Server 的靜默日誌系統是專為 **Stdio Transport 環境**設計的最佳實踐：

1. ✅ **避免干擾 MCP 協議**：寫入檔案而非 stdout
2. ✅ **結構化日誌**：使用 JSON Lines 格式
3. ✅ **易於分析**：支援 grep、jq 等工具
4. ✅ **容錯設計**：日誌錯誤不影響主程式
5. ✅ **追蹤能力**：透過 executionId 追蹤請求
6. ✅ **標準化事件**：統一的事件命名規範

這種設計確保了 MCP Server 在 Claude Desktop 中的穩定運作，同時保留完整的除錯能力。
