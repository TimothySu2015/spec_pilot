# SpecPilot 報表格式說明

## 概述

SpecPilot 產生的測試報表採用結構化 JSON 格式，包含完整的執行摘要、步驟詳情與系統配置資訊。報表設計符合 JSON Schema 規範，確保格式一致性與可驗證性。

## 報表檔案位置

- **主要報表**: `reports/result.json`
- **歷史報表**: `reports/archive/result-{timestamp}.json` (可選)
- **部分報表**: `reports/partial-{executionId}.json` (錯誤恢復時)

## 完整報表格式

### 基本結構

```json
{
  "executionId": "550e8400-e29b-41d4-a716-446655440000",
  "flowId": "user_crud_flow",
  "startTime": "2025-09-27T10:30:00.000Z",
  "endTime": "2025-09-27T10:30:15.234Z",
  "duration": 15234,
  "status": "success",
  "summary": {
    "totalSteps": 5,
    "successfulSteps": 5,
    "failedSteps": 0,
    "skippedSteps": 0
  },
  "steps": [
    // 步驟陣列，詳見下方
  ],
  "config": {
    "baseUrl": "https://api.example.com",
    "fallbackUsed": false,
    "authNamespaces": ["api_v1"]
  }
}
```

### 欄位說明

#### 根層級欄位

| 欄位 | 類型 | 必要 | 說明 |
|------|------|------|------|
| `executionId` | string | ✓ | 執行的唯一識別碼 (UUID v4) |
| `flowId` | string | ✓ | 測試流程識別碼 |
| `startTime` | string | ✓ | 執行開始時間 (ISO 8601) |
| `endTime` | string | ✓ | 執行結束時間 (ISO 8601) |
| `duration` | number | ✓ | 總執行時長 (毫秒) |
| `status` | string | ✓ | 整體狀態: `success`, `failure`, `partial` |
| `summary` | object | ✓ | 執行摘要 |
| `steps` | array | ✓ | 步驟執行結果陣列 |
| `config` | object | ✓ | 執行配置資訊 |

#### 執行摘要 (summary)

```json
{
  "totalSteps": 5,
  "successfulSteps": 4,
  "failedSteps": 1,
  "skippedSteps": 0
}
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| `totalSteps` | number | 總步驟數 |
| `successfulSteps` | number | 成功步驟數 |
| `failedSteps` | number | 失敗步驟數 |
| `skippedSteps` | number | 跳過步驟數 |

#### 執行配置 (config)

```json
{
  "baseUrl": "https://api.example.com",
  "fallbackUsed": false,
  "authNamespaces": ["api_v1", "payment_v2"]
}
```

| 欄位 | 類型 | 說明 |
|------|------|------|
| `baseUrl` | string | API 基礎 URL |
| `fallbackUsed` | boolean | 是否使用了備援服務 |
| `authNamespaces` | array | 使用的認證命名空間列表 |

## 步驟結果格式

### 完整步驟物件

```json
{
  "name": "user_login",
  "status": "success",
  "startTime": "2025-09-27T10:30:00.100Z",
  "duration": 1200,
  "request": {
    "method": "POST",
    "url": "https://api.example.com/auth/login",
    "headerHash": "sha256:a1b2c3d4e5f6...",
    "bodyHash": "sha256:f6e5d4c3b2a1..."
  },
  "response": {
    "statusCode": 200,
    "success": true,
    "validationResults": ["status_check_passed", "schema_validation_passed"],
    "errorMessage": null
  }
}
```

### 步驟欄位說明

#### 基本資訊

| 欄位 | 類型 | 必要 | 說明 |
|------|------|------|------|
| `name` | string | ✓ | 步驟名稱 |
| `status` | string | ✓ | 步驟狀態: `success`, `failure`, `skipped` |
| `startTime` | string | ✓ | 步驟開始時間 (ISO 8601) |
| `duration` | number | ✓ | 步驟執行時長 (毫秒) |

#### 請求摘要 (request)

| 欄位 | 類型 | 必要 | 說明 |
|------|------|------|------|
| `method` | string | ✓ | HTTP 方法 |
| `url` | string | ✓ | 完整請求 URL |
| `headerHash` | string | ✓ | 請求 Header 的 SHA256 雜湊值 |
| `bodyHash` | string | ✓ | 請求 Body 的 SHA256 雜湊值 |

#### 回應摘要 (response)

| 欄位 | 類型 | 必要 | 說明 |
|------|------|------|------|
| `statusCode` | number | ✓ | HTTP 狀態碼 |
| `success` | boolean | ✓ | 是否執行成功 |
| `validationResults` | array | ✓ | 驗證結果列表 |
| `errorMessage` | string\|null | ✓ | 錯誤訊息 (如果有) |

## 狀態判定規則

### 整體狀態 (status)

- **success**: 所有步驟都成功，沒有失敗或跳過的步驟
- **failure**: 沒有成功的步驟，全部失敗
- **partial**: 有成功也有失敗的步驟

### 步驟狀態 (status)

- **success**: 步驟執行成功，所有驗證通過
- **failure**: 步驟執行失敗或驗證不通過
- **skipped**: 步驟被跳過執行

## 雜湊計算

### 計算方式

```typescript
function calculateHash(data: unknown): string {
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
  const hash = createHash('sha256').update(jsonString).digest('hex');
  return `sha256:${hash}`;
}
```

### 用途

- **安全性**: 避免在報表中暴露敏感資料
- **完整性**: 可驗證請求/回應資料是否被修改
- **追蹤**: 相同的請求會產生相同的雜湊值

## 驗證結果格式

### 常見驗證類型

```json
{
  "validationResults": [
    "status_check_passed",      // HTTP 狀態碼驗證
    "schema_validation_passed", // JSON Schema 驗證
    "custom_rule_user_id",     // 自訂規則驗證
    "auth_token_extracted"     // 認證相關驗證
  ]
}
```

### 失敗驗證範例

```json
{
  "validationResults": [
    "status_check_failed",
    "schema_validation_failed",
    "custom_rule_email_format_failed"
  ],
  "errorMessage": "User email format is invalid"
}
```

## 部分報表格式

當報表生成過程中發生錯誤時，系統會產生部分報表：

```json
{
  "executionId": "550e8400-e29b-41d4-a716-446655440000",
  "flowId": "user_crud_flow",
  "startTime": "2025-09-27T10:30:00.000Z",
  "generatedAt": "2025-09-27T10:30:10.500Z",
  "failureReason": "Network timeout occurred",
  "summary": {
    "totalSteps": 3,
    "successfulSteps": 2,
    "failedSteps": 0,
    "skippedSteps": 1
  },
  "steps": [
    // 已完成的步驟資料
  ],
  "config": {
    "baseUrl": "https://api.example.com",
    "fallbackUsed": true,
    "authNamespaces": ["api_v1"]
  }
}
```

### 部分報表特殊欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| `generatedAt` | string | 部分報表產生時間 |
| `failureReason` | string | 失敗原因說明 |

## JSON Schema 驗證

### Schema 檔案位置

- **執行報表**: `packages/reporting/src/schemas/execution-report.schema.json`
- **結構化日誌**: `packages/shared/src/schemas/structured-log.schema.json`

### 驗證範例

```typescript
import { ReportValidator } from '@specpilot/reporting';

const validator = new ReportValidator();
const result = validator.validateReport(reportData);

if (!result.valid) {
  console.error('報表格式錯誤:', result.errors);
}
```

## CLI 摘要格式

除了 JSON 報表外，系統也會產生人類可讀的 CLI 摘要：

```
✅ 測試執行完成

報表位置：reports/result.json
執行狀態：success
失敗計數：0
成功率：100.0%

詳細結果：
  總計：5 步驟
  成功：5
  失敗：0
  跳過：0

執行時間：15234ms
```

### 狀態圖示

- ✅ `success` - 全部成功
- ❌ `failure` - 全部失敗
- ⚠️ `partial` - 部分成功

## 與 MCP 協議整合

### MCP 回應格式

```json
{
  "jsonrpc": "2.0",
  "result": {
    "summary": "✅ 測試執行完成...",
    "reportPath": "reports/result.json",
    "executionId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "success",
    "metrics": {
      "totalSteps": 5,
      "successfulSteps": 5,
      "failedSteps": 0,
      "duration": 15234
    }
  }
}
```

## 最佳實踐

### 報表大小管理

- 單一報表建議不超過 10MB
- 大量步驟時考慮分割報表
- 定期清理歷史報表檔案

### 效能考量

```typescript
// 非同步報表生成
const report = await reportGenerator.generateReport(/*...*/);

// 批次處理大量步驟
const batchSize = 100;
for (let i = 0; i < steps.length; i += batchSize) {
  const batch = steps.slice(i, i + batchSize);
  await processBatch(batch);
}
```

### 錯誤處理

```typescript
try {
  await reportGenerator.saveReport(report);
} catch (error) {
  // 儲存部分報表
  const partialReport = reportGenerator.generatePartialReport(/*...*/);
  await reportGenerator.savePartialReport(partialReport);
}
```

## 故障排除

### 常見問題

1. **報表檔案過大**
   - 檢查步驟數量
   - 考慮分批處理

2. **格式驗證失敗**
   - 使用 ReportValidator 檢查
   - 確認所有必要欄位存在

3. **雜湊值不一致**
   - 檢查 JSON 序列化方式
   - 確認資料格式一致性

### 除錯工具

```bash
# 驗證報表格式
jq . reports/result.json

# 檢查報表大小
ls -lh reports/

# 統計步驟狀態
jq '.steps[].status' reports/result.json | sort | uniq -c
```

## 版本相容性

- **v1.0**: 基礎報表格式
- **v1.1**: 新增雜湊欄位
- **v1.2**: 加入配置資訊
- **v1.3**: 支援部分報表
- **v1.4**: CLI 摘要整合

向後相容性保證：新版本可讀取舊版本報表格式。