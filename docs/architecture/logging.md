# 日誌系統架構與輪替策略

## 概述

SpecPilot 使用基於 pino 的結構化日誌系統，支援自動日誌輪替、敏感資料遮罩，以及與報表系統的深度整合。

## 核心功能

### 結構化日誌格式

- **格式**: JSON Lines (NDJSON)
- **時間戳**: ISO 8601 格式
- **必要欄位**: `timestamp`, `level`, `executionId`, `component`, `event`, `message`
- **可選欄位**: `stepName`, `duration`, `requestSummary`, `responseSummary`, `details`

### 支援的日誌級別

- `debug`: 詳細偵錯資訊
- `info`: 一般資訊訊息
- `warn`: 警告訊息
- `error`: 錯誤訊息

## 日誌輪替策略

### 預設配置

```typescript
const DEFAULT_ROTATION_CONFIG = {
  maxFileSize: '10MB',    // 單檔最大尺寸
  maxFiles: 10,           // 保留檔案數量
  datePattern: 'YYYY-MM-DD', // 日期批次格式
  compress: true,         // 壓縮舊檔案
  archiveAfterDays: 3,    // 3天後壓縮
};
```

### 輪替觸發條件

1. **檔案大小超限**: 當 `specpilot.log` 超過 `maxFileSize` 時
2. **手動觸發**: 透過程式呼叫觸發
3. **系統重啟**: 啟動時檢查並執行必要的輪替

### 檔案命名規則

- **主日誌檔**: `logs/specpilot.log`
- **輪替檔**: `logs/specpilot-{YYYY-MM-DD}-{index}.log`
- **壓縮檔**: `logs/specpilot-{YYYY-MM-DD}-{index}.log.gz` (如啟用壓縮)

### 清理策略

- 保留最新的 `maxFiles` 個檔案
- 超過保留數量的檔案會被自動刪除
- 壓縮檔案不計入保留數量限制

## 環境變數設定

### 基本設定

```bash
# 日誌級別
LOG_LEVEL=info

# 日誌輪替設定
SPEC_PILOT_LOG_MAX_SIZE=10MB
SPEC_PILOT_LOG_MAX_FILES=10
SPEC_PILOT_LOG_COMPRESS=true
SPEC_PILOT_LOG_ARCHIVE_DAYS=3
```

### 進階設定

```bash
# 自訂日誌目錄
SPEC_PILOT_LOG_DIR=/var/log/specpilot

# 日誌格式設定
SPEC_PILOT_LOG_PRETTY=false  # 生產環境建議設為 false
SPEC_PILOT_LOG_SYNC=true     # 同步寫入，確保資料不遺失
```

## 程式化配置

### 使用 EnhancedStructuredLogger

```typescript
import { createEnhancedStructuredLogger } from '@specpilot/shared';

const logger = createEnhancedStructuredLogger('my-component', 'exec-123', {
  maxFileSize: '5MB',
  maxFiles: 15,
  compress: false,
  archiveAfterDays: 7
});
```

### 在 Config 套件中設定

```typescript
// packages/config/src/index.ts
export const logConfig = {
  rotation: {
    maxFileSize: process.env.SPEC_PILOT_LOG_MAX_SIZE || '10MB',
    maxFiles: parseInt(process.env.SPEC_PILOT_LOG_MAX_FILES || '10'),
    compress: process.env.SPEC_PILOT_LOG_COMPRESS === 'true',
    archiveAfterDays: parseInt(process.env.SPEC_PILOT_LOG_ARCHIVE_DAYS || '3'),
  }
};
```

## 步驟級日誌記錄

### 支援的事件類型

- `STEP_START`: 步驟開始執行
- `STEP_COMPLETE`: 步驟成功完成
- `STEP_FAILURE`: 步驟執行失敗
- `REQUEST_SENT`: HTTP 請求發送
- `RESPONSE_RECEIVED`: HTTP 回應接收
- `VALIDATION_SUCCESS`: 驗證通過
- `VALIDATION_FAILURE`: 驗證失敗

### 請求/回應摘要記錄

```typescript
// 請求摘要包含
{
  method: 'POST',
  url: 'https://api.example.com/users',
  headerHash: 'sha256:abc123...',
  bodyHash: 'sha256:def456...'
}

// 回應摘要包含
{
  statusCode: 201,
  validationResults: ['schema_valid', 'business_rule_passed'],
  errorMessage: null
}
```

## 敏感資料處理

### 自動遮罩欄位

以下欄位會自動被遮罩為 `***`:

- `token`, `TOKEN`
- `password`, `PASSWORD`
- `secret`, `SECRET`
- `key`, `KEY`
- `authorization`, `AUTHORIZATION`

### 遮罩規則

- 大小寫不敏感
- 部分字串比對 (例如 `apiKey` 會被遮罩)
- 遮罩發生在日誌寫入前
- 原始資料在記憶體中不受影響

## 效能考量

### 非同步寫入

- 使用 pino 的異步寫入機制
- 避免阻塞主執行緒
- 確保高負載時的穩定性

### 記憶體管理

```typescript
// 批次寫入設定
const BATCH_SIZE = 100;        // 每批次日誌數量
const FLUSH_INTERVAL = 1000;   // 強制 flush 間隔 (毫秒)
const MAX_MEMORY_USAGE = '50MB'; // 記憶體使用上限
```

### 效能監控

- 監控日誌寫入延遲
- 追蹤檔案大小成長速度
- 記憶體使用量警告

## 監控與警告

### 重要監控指標

1. **日誌檔案大小**: 防止磁碟空間不足
2. **輪替頻率**: 異常頻繁的輪替可能表示有問題
3. **寫入錯誤**: 權限或磁碟空間問題
4. **記憶體使用**: 防止 OOM 錯誤

### 警告事件

```typescript
// 系統會在以下情況記錄警告
{
  event: 'LOG_ROTATION_WARNING',
  message: '日誌檔案大小接近上限',
  details: {
    currentSize: '9.5MB',
    maxSize: '10MB',
    utilizationPercentage: 95
  }
}
```

## 最佳實踐

### 開發環境

```bash
LOG_LEVEL=debug
SPEC_PILOT_LOG_PRETTY=true
SPEC_PILOT_LOG_MAX_SIZE=1MB
SPEC_PILOT_LOG_MAX_FILES=3
```

### 測試環境

```bash
LOG_LEVEL=info
SPEC_PILOT_LOG_MAX_SIZE=5MB
SPEC_PILOT_LOG_MAX_FILES=5
SPEC_PILOT_LOG_COMPRESS=false
```

### 生產環境

```bash
LOG_LEVEL=warn
SPEC_PILOT_LOG_MAX_SIZE=50MB
SPEC_PILOT_LOG_MAX_FILES=20
SPEC_PILOT_LOG_COMPRESS=true
SPEC_PILOT_LOG_ARCHIVE_DAYS=7
```

## 故障排除

### 常見問題

1. **日誌檔案無法建立**
   - 檢查目錄權限
   - 確認磁碟空間充足

2. **輪替失敗**
   - 檢查檔案鎖定狀態
   - 確認有足夠權限

3. **效能問題**
   - 調整批次大小
   - 檢查磁碟 I/O 效能

### 除錯指令

```bash
# 檢查日誌檔案
ls -la logs/

# 查看最新日誌
tail -f logs/specpilot.log

# 檢查日誌格式
jq . logs/specpilot.log | head -20

# 統計日誌事件
grep '"event":' logs/specpilot.log | sort | uniq -c
```

## 與報表系統整合

### 共用執行 ID

- 日誌與報表使用相同的 `executionId`
- 便於關聯查詢與問題追蹤

### 事件同步

- 重要事件同時記錄到日誌與報表
- 確保資料一致性

### 錯誤追蹤

- 失敗步驟的詳細日誌會保留在日誌檔案中
- 報表僅包含摘要資訊

## 法規遵循

### 資料保護

- 自動遮罩個人識別資訊
- 支援 GDPR 資料清除要求
- 加密敏感日誌檔案 (可選)

### 稽核追蹤

- 完整的操作記錄
- 不可否認性支援
- 時間戳完整性驗證

## 版本歷史

- **v1.0**: 基礎日誌功能
- **v1.1**: 加入輪替策略
- **v1.2**: 敏感資料遮罩
- **v1.3**: 與報表系統整合
- **v1.4**: 效能優化與監控