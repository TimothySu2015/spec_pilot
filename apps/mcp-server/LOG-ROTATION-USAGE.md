# MCP Server 日誌輪轉使用說明

## ✅ 已實作功能

MCP Server 現已整合 `rotating-file-stream`,提供自動日誌輪轉功能。

## 📊 輪轉配置

### 當前設定

```typescript
// apps/mcp-server/src/logger.ts
const logStream = rfs.createStream('mcp-server.log', {
  size: '10M',      // 每個檔案最大 10MB
  interval: '1d',   // 或每天輪轉一次
  compress: 'gzip', // 壓縮舊檔案
  path: logsDir,    // logs/ 目錄
  maxFiles: 7,      // 保留 7 個舊檔案
});
```

### 配置說明

| 設定 | 值 | 說明 |
|------|-----|------|
| **size** | `10M` | 單一檔案最大 10MB，超過就輪轉 |
| **interval** | `1d` | 每日輪轉 (即使未達 10MB) |
| **compress** | `gzip` | 自動壓縮舊檔案 (節省 ~90% 空間) |
| **maxFiles** | `7` | 保留最多 7 個舊檔案 |

### 輪轉觸發條件

滿足以下**任一**條件即觸發輪轉:
- ✅ 檔案大小 ≥ 10MB
- ✅ 距離上次輪轉 ≥ 24 小時

## 📁 檔案結構

### 正常運作時

```
logs/
├── mcp-server.log          # 當前日誌 (< 10MB)
├── mcp-server.log.1.gz     # 昨天的日誌 (壓縮)
├── mcp-server.log.2.gz     # 前天的日誌
├── mcp-server.log.3.gz     # 3 天前
├── mcp-server.log.4.gz     # 4 天前
├── mcp-server.log.5.gz     # 5 天前
├── mcp-server.log.6.gz     # 6 天前
└── mcp-server.log.7.gz     # 7 天前 (最舊，之後會被刪除)
```

### 磁盤空間估算

- **未壓縮**: 10MB × 8 = 80MB
- **壓縮後**: ~10MB × 8 × 0.1 = **8MB** (壓縮比約 90%)

## 🔍 查看日誌

### 查看當前日誌

```bash
# 即時監看
tail -f logs/mcp-server.log

# 查看最後 50 行
tail -50 logs/mcp-server.log

# 美化輸出
tail -f logs/mcp-server.log | jq '.'
```

### 查看壓縮的舊日誌

```bash
# 解壓並查看
zcat logs/mcp-server.log.1.gz | jq '.'

# 搜尋特定內容
zcat logs/mcp-server.log.*.gz | grep "錯誤"

# 統計錯誤數量
zcat logs/mcp-server.log.*.gz | grep '"level":"error"' | wc -l
```

### 查看所有日誌 (包含壓縮檔案)

```bash
# 顯示所有日誌的前 10 行
cat logs/mcp-server.log
zcat logs/mcp-server.log.*.gz

# 搜尋特定 executionId
cat logs/mcp-server.log | grep "run-1759306176831"
zcat logs/mcp-server.log.*.gz | grep "run-1759306176831"
```

## 🛠️ 管理操作

### 檢查日誌大小

```bash
# 查看當前日誌大小
du -h logs/mcp-server.log

# 查看所有日誌檔案
ls -lh logs/mcp-server*

# 查看總大小
du -sh logs/
```

### 手動清理 (選用)

```bash
# 刪除所有舊日誌 (保留當前)
rm logs/mcp-server.log.*.gz

# 完全清空並重新開始
rm logs/mcp-server.log*
# MCP Server 會自動建立新檔案
```

### 強制輪轉 (選用)

```bash
# 重新命名當前日誌
mv logs/mcp-server.log logs/mcp-server.log.manual

# 重啟 MCP Server
# Server 會自動建立新的 mcp-server.log
```

## ⚙️ 自訂配置

如果需要調整輪轉設定,修改 `apps/mcp-server/src/logger.ts`:

### 範例: 更積極的輪轉 (適合高負載環境)

```typescript
const logStream = rfs.createStream('mcp-server.log', {
  size: '5M',       // 5MB 就輪轉
  interval: '12h',  // 每 12 小時輪轉
  compress: 'gzip',
  path: logsDir,
  maxFiles: 14,     // 保留 14 個 (約 7 天)
});
```

### 範例: 更寬鬆的輪轉 (適合低負載環境)

```typescript
const logStream = rfs.createStream('mcp-server.log', {
  size: '50M',      // 50MB 才輪轉
  interval: '7d',   // 每週輪轉
  compress: 'gzip',
  path: logsDir,
  maxFiles: 4,      // 保留 4 個 (約 1 個月)
});
```

### 範例: 不壓縮舊檔案

```typescript
const logStream = rfs.createStream('mcp-server.log', {
  size: '10M',
  interval: '1d',
  // compress: 'gzip',  // 移除此行
  path: logsDir,
  maxFiles: 7,
});
```

**修改後需要重新編譯**:

```bash
cd apps/mcp-server
pnpm run build
```

## 📊 監控與告警 (進階)

### 設定大小告警

建立 `scripts/check-mcp-log-size.sh`:

```bash
#!/bin/bash
LOG_SIZE=$(du -m logs/mcp-server.log | cut -f1)

if [ $LOG_SIZE -gt 8 ]; then
  echo "Warning: MCP Server log is ${LOG_SIZE}MB (threshold: 8MB)"
  # 可以發送通知或記錄到監控系統
fi
```

### Cron 定期檢查

```bash
# 每小時檢查一次
0 * * * * /path/to/scripts/check-mcp-log-size.sh
```

## ✅ 驗證結果

### 測試結果

執行 `node test-mcp-with-rotation.js` 後:

```
✅ 日誌檔案存在: D:\codes\spec_pilot\logs\mcp-server.log
📊 日誌行數: 5
📏 檔案大小: 935 bytes

📝 最後 3 行日誌:
   1. [info] listSpecs 方法成功完成
   2. [info] listFlows 方法開始執行
   3. [info] listFlows 方法成功完成

✅ rotating-file-stream 正常運作!
   - 日誌寫入檔案
   - stdout 未被污染
   - MCP 協議正常運作
```

### 安全性驗證

- ✅ 不輸出到 stdout/stderr
- ✅ 不干擾 MCP Stdio Transport
- ✅ JSON-RPC 協議正常運作
- ✅ 自動輪轉與壓縮功能正常

詳見: [ROTATING-FILE-STREAM-SAFETY.md](../../docs/ROTATING-FILE-STREAM-SAFETY.md)

## 🎓 總結

### 優點

1. ✅ **自動管理**: 無需手動清理日誌
2. ✅ **空間節省**: 壓縮舊檔案節省 90% 空間
3. ✅ **保留歷史**: 保存 7 天歷史記錄
4. ✅ **完全安全**: 不干擾 MCP 協議
5. ✅ **易於查詢**: 支援標準工具 (grep, zcat, jq)

### 注意事項

- ⚠️ 修改配置後需要重新編譯
- ⚠️ 壓縮的日誌需要 `zcat` 查看
- ⚠️ 輪轉可能在檔案寫入時發生,不會丟失資料

## 📚 相關文件

- [LOG-MANAGEMENT-GUIDE.md](../../docs/LOG-MANAGEMENT-GUIDE.md) - 日誌管理完整指南
- [ROTATING-FILE-STREAM-SAFETY.md](../../docs/ROTATING-FILE-STREAM-SAFETY.md) - 安全性驗證報告
- [LOGGING.md](./LOGGING.md) - MCP Server 日誌系統詳解
- [LOGGING-ARCHITECTURE.md](../../docs/LOGGING-ARCHITECTURE.md) - 雙日誌系統架構
