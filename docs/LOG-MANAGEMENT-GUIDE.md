# 日誌管理指南

## 📖 概述

本文件說明如何管理 SpecPilot 的日誌檔案,特別是針對 `logs/mcp-server.log` 可能快速增長的問題提供解決方案。

## 🎯 日誌大小問題分析

### 當前狀況
- **檔案**: `logs/mcp-server.log`
- **增長速度**: 每次 MCP 工具呼叫產生 2-4 行日誌
- **預估**: 100 次呼叫 ≈ 300 行 ≈ 60-100 KB

### 何時需要關注?
- 🟢 **< 1 MB**: 正常,無需處理
- 🟡 **1-10 MB**: 建議定期清理
- 🔴 **> 10 MB**: 需要立即實作輪轉機制

## 🛠️ 解決方案

### 方案 1: 手動清理 (最簡單)

適合開發環境或日誌量不大的情況。

```bash
# 清空日誌 (保留檔案)
> logs/mcp-server.log

# 或備份後清空
mv logs/mcp-server.log logs/mcp-server.log.bak
touch logs/mcp-server.log

# 或刪除舊日誌 (MCP Server 會自動建立新檔案)
rm logs/mcp-server.log
```

**優點**:
- ✅ 實作簡單,無需修改程式碼
- ✅ 適合開發環境

**缺點**:
- ❌ 需要手動操作
- ❌ 清空時會丟失歷史記錄

---

### 方案 2: 日誌輪轉 (推薦) ⭐⭐⭐⭐⭐

實作基於檔案大小或時間的自動輪轉機制。

> **✅ 安全性已驗證**: rotating-file-stream 不會輸出到 stdout/stderr,不會干擾 MCP Stdio Transport。
> 詳見 [ROTATING-FILE-STREAM-SAFETY.md](./ROTATING-FILE-STREAM-SAFETY.md)

#### 實作方式 1: 使用 rotating-file-stream (純 JavaScript)

**安裝依賴**:
```bash
cd apps/mcp-server
pnpm add rotating-file-stream
```

**修改 logger 實作**:
```typescript
// apps/mcp-server/src/index.ts
import rfs from 'rotating-file-stream';
import path from 'path';

// 建立輪轉日誌串流
const logStream = rfs.createStream('mcp-server.log', {
  size: '10M',      // 每個檔案最大 10MB
  interval: '1d',   // 或每天輪轉一次
  compress: 'gzip', // 壓縮舊檔案
  path: path.join(process.cwd(), 'logs'),
  maxFiles: 7,      // 保留最多 7 個舊檔案
});

const logger = {
  info: (message: string, context?: unknown): void => {
    try {
      const logEntry = JSON.stringify({
        level: 'info',
        time: new Date().toISOString(),
        message,
        context
      }) + '\n';

      logStream.write(logEntry);
    } catch (e) {
      // 靜默處理錯誤
    }
  },

  error: (message: string, context?: unknown): void => {
    try {
      const logEntry = JSON.stringify({
        level: 'error',
        time: new Date().toISOString(),
        message,
        context
      }) + '\n';

      logStream.write(logEntry);
    } catch (e) {
      // 靜默處理錯誤
    }
  }
};
```

**產生的檔案結構**:
```
logs/
├── mcp-server.log              # 當前日誌
├── mcp-server.log.1.gz         # 昨天的日誌 (壓縮)
├── mcp-server.log.2.gz         # 前天的日誌
└── ...
```

**優點**:
- ✅ 自動管理,無需手動介入
- ✅ 壓縮舊檔案節省空間
- ✅ 保留歷史記錄
- ✅ 純 JavaScript,跨平台相容

**缺點**:
- ⚠️ 需要安裝額外依賴
- ⚠️ 非同步寫入可能在程序異常終止時丟失少量日誌

---

#### 實作方式 2: 使用系統工具 logrotate (Linux/macOS)

**建立設定檔** `/etc/logrotate.d/specpilot-mcp`:
```
/path/to/spec_pilot/logs/mcp-server.log {
    daily                # 每日輪轉
    rotate 7             # 保留 7 天
    compress             # 壓縮舊檔案
    delaycompress        # 延遲壓縮 (保留最新的舊檔案不壓縮)
    missingok            # 檔案不存在時不報錯
    notifempty           # 檔案為空時不輪轉
    create 0644 user group  # 建立新檔案的權限
}
```

**手動測試輪轉**:
```bash
logrotate -f /etc/logrotate.d/specpilot-mcp
```

**優點**:
- ✅ 系統級解決方案,穩定可靠
- ✅ 無需修改程式碼
- ✅ 可設定複雜的輪轉策略

**缺點**:
- ❌ 僅限 Linux/macOS
- ❌ 需要系統管理員權限
- ❌ Windows 不支援

---

### 方案 3: 日誌層級過濾 (減少日誌量)

透過環境變數控制日誌輸出層級。

**修改 logger 實作**:
```typescript
// apps/mcp-server/src/index.ts
const LOG_LEVEL = process.env.MCP_LOG_LEVEL || 'info';

// 日誌層級優先級
const LOG_LEVELS: Record<string, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const shouldLog = (level: string): boolean => {
  return LOG_LEVELS[level] <= LOG_LEVELS[LOG_LEVEL];
};

const logger = {
  info: (message: string, context?: unknown): void => {
    if (!shouldLog('info')) return; // 跳過

    // ... 原本的寫入邏輯
  },

  error: (message: string, context?: unknown): void => {
    if (!shouldLog('error')) return;

    // ... 原本的寫入邏輯
  }
};
```

**使用方式**:
```bash
# 只記錄 error
MCP_LOG_LEVEL=error node apps/mcp-server/dist/index.cjs

# 記錄 error + warn + info (預設)
MCP_LOG_LEVEL=info node apps/mcp-server/dist/index.cjs

# 記錄所有層級 (包含 debug)
MCP_LOG_LEVEL=debug node apps/mcp-server/dist/index.cjs
```

**優點**:
- ✅ 實作簡單
- ✅ 靈活控制日誌詳細度
- ✅ 生產環境可設定為 `error`,大幅減少日誌量

**缺點**:
- ⚠️ 減少日誌可能降低除錯能力

---

### 方案 4: 精簡日誌內容 (優化)

移除不必要的日誌欄位或合併日誌事件。

#### 優化前 (每次 runFlow 產生 3-4 行):
```json
{"level":"info","time":"...","message":"runFlow 方法開始執行","context":{...}}
{"level":"info","time":"...","message":"已覆寫配置","context":{...}}
{"level":"info","time":"...","message":"嘗試讀取報表以建立診斷上下文","context":{...}}
{"level":"info","time":"...","message":"runFlow 方法成功完成","context":{...}}
```

#### 優化後 (每次 runFlow 只產生 1 行):
```json
{"level":"info","time":"...","message":"runFlow 完成","context":{"executionId":"...","duration":123,"totalSteps":10,"success":true}}
```

**實作方式**:
```typescript
// 移除中間過程的日誌,只記錄最終結果
async function handleRunFlow(params: RunFlowParams) {
  const startTime = Date.now();
  const executionId = generateExecutionId();

  try {
    // ... 執行邏輯 (不記錄中間步驟)

    const result = await orchestrator.run();

    // 只在成功時記錄一次
    logger.info('runFlow 完成', {
      executionId,
      event: 'run_flow_complete',
      duration: Date.now() - startTime,
      totalSteps: result.totalSteps,
      success: result.success,
    });

    return result;
  } catch (error) {
    // 錯誤時才記錄
    logger.error('runFlow 失敗', {
      executionId,
      event: 'run_flow_error',
      error: error.message,
    });
    throw error;
  }
}
```

**優點**:
- ✅ 大幅減少日誌量 (減少 70-80%)
- ✅ 日誌更簡潔易讀
- ✅ 無需額外依賴

**缺點**:
- ⚠️ 減少詳細追蹤資訊
- ⚠️ 除錯時可能需要更多資訊

---

## 📊 方案比較

| 方案 | 實作難度 | 維護成本 | 日誌減少量 | 推薦場景 |
|------|---------|---------|-----------|---------|
| 手動清理 | ⭐ | 高 | N/A | 開發環境 |
| rotating-file-stream | ⭐⭐ | 低 | 0% (保留歷史) | 生產環境 |
| logrotate | ⭐⭐⭐ | 低 | 0% (保留歷史) | Linux/macOS 生產環境 |
| 日誌層級過濾 | ⭐ | 低 | 50-90% | 生產環境 |
| 精簡日誌內容 | ⭐⭐ | 中 | 70-80% | 所有環境 |

## 🎯 推薦方案組合

### 開發環境
```
方案 3 (日誌層級 = info) + 方案 1 (手動清理)
```
- 保留詳細日誌用於除錯
- 定期手動清理

### 生產環境 (跨平台)
```
方案 2.1 (rotating-file-stream) + 方案 3 (日誌層級 = error)
```
- 自動輪轉管理
- 只記錄錯誤,大幅減少日誌量

### 生產環境 (Linux/macOS)
```
方案 2.2 (logrotate) + 方案 4 (精簡日誌)
```
- 系統級輪轉機制
- 優化日誌內容

---

## 🚀 快速實作 (推薦)

### 步驟 1: 安裝 rotating-file-stream

```bash
cd apps/mcp-server
pnpm add rotating-file-stream
```

### 步驟 2: 修改 logger

建立新檔案 `apps/mcp-server/src/logger.ts`:

```typescript
import rfs from 'rotating-file-stream';
import path from 'path';

// 建立輪轉日誌串流
const logStream = rfs.createStream('mcp-server.log', {
  size: '10M',      // 每個檔案最大 10MB
  interval: '1d',   // 或每天輪轉
  compress: 'gzip', // 壓縮舊檔案
  path: path.join(process.cwd(), 'logs'),
  maxFiles: 7,      // 保留 7 個舊檔案
});

export const logger = {
  info: (message: string, context?: unknown): void => {
    try {
      const logEntry = JSON.stringify({
        level: 'info',
        time: new Date().toISOString(),
        message,
        context
      }) + '\n';

      logStream.write(logEntry);
    } catch (e) {
      // 靜默處理錯誤
    }
  },

  error: (message: string, context?: unknown): void => {
    try {
      const logEntry = JSON.stringify({
        level: 'error',
        time: new Date().toISOString(),
        message,
        context
      }) + '\n';

      logStream.write(logEntry);
    } catch (e) {
      // 靜默處理錯誤
    }
  }
};
```

### 步驟 3: 更新主程式

```typescript
// apps/mcp-server/src/index.ts

// 移除原本的 logger 定義,改為匯入
import { logger } from './logger.js';

// ... 其他程式碼保持不變
```

### 步驟 4: 重新編譯

```bash
cd apps/mcp-server
pnpm run build
```

### 步驟 5: 測試

```bash
# 啟動 MCP Server
pnpm run start:mcp

# 檢查日誌目錄
ls -lh logs/
```

---

## 📁 輪轉後的檔案結構

```
logs/
├── mcp-server.log              # 當前日誌 (< 10MB)
├── mcp-server.log.1.gz         # 第 1 個舊檔案 (壓縮)
├── mcp-server.log.2.gz         # 第 2 個舊檔案
├── mcp-server.log.3.gz         # 第 3 個舊檔案
├── ...
└── mcp-server.log.7.gz         # 第 7 個舊檔案 (最舊,之後會被刪除)
```

**磁盤空間估算**:
- 未壓縮: 10MB × 8 = 80MB
- 壓縮後: ~10MB × 8 × 0.1 = 8MB (壓縮比約 90%)

---

## 🔍 監控與維護

### 檢查日誌大小

```bash
# 查看當前日誌大小
du -h logs/mcp-server.log

# 查看所有日誌檔案
ls -lh logs/mcp-server.log*

# 查看總大小
du -sh logs/
```

### 查看輪轉歷史

```bash
# 列出所有輪轉的日誌
ls -lt logs/mcp-server.log*

# 查看壓縮的舊日誌
zcat logs/mcp-server.log.1.gz | jq '.'
```

### 設定告警 (選用)

```bash
# 建立 cron job,每日檢查日誌大小
0 0 * * * /path/to/check-log-size.sh
```

**check-log-size.sh**:
```bash
#!/bin/bash
LOG_SIZE=$(du -m logs/mcp-server.log | cut -f1)

if [ $LOG_SIZE -gt 50 ]; then
  echo "Warning: MCP Server log size is ${LOG_SIZE}MB" | mail -s "Log Alert" admin@example.com
fi
```

---

## 🎓 總結

**最佳實踐**:

1. **開發環境**: 使用預設設定 + 手動清理
2. **生產環境**: 實作 rotating-file-stream (方案 2.1)
3. **高負載環境**: 加上日誌層級過濾 (方案 3)
4. **優化需求**: 考慮精簡日誌內容 (方案 4)

**下一步行動**:

- [ ] 評估目前日誌增長速度
- [ ] 選擇合適的方案 (建議從方案 2.1 開始)
- [ ] 實作並測試
- [ ] 建立日誌大小監控機制
- [ ] 文件化日誌管理流程

如有任何問題,請參考本文件或聯絡專案維運人員。
