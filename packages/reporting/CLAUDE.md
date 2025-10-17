# @specpilot/reporting - 報表產生與日誌模組

## 模組概述

`@specpilot/reporting` 是 SpecPilot 的報表產生與日誌管理模組，負責收集測試執行結果、產生結構化報表、提供 AI 友善的診斷資訊與錯誤分析。

## 核心職責

1. **測試報表產生**: 產生結構化的 JSON 測試報表
2. **診斷資訊收集**: 收集失敗步驟的詳細診斷資訊
3. **錯誤模式分析**: 分析錯誤模式 (連續失敗、級聯失敗等)
4. **AI 上下文建構**: 為 AI Agent 提供易於理解的診斷上下文
5. **修復建議產生**: 根據錯誤模式提供具體修復建議

## 技術堆疊

### 核心依賴
- `@specpilot/core-flow` - 讀取執行結果
- `@specpilot/shared` - 共用工具與型別
- `ajv` (^8.17.1) - Schema 驗證
- `ajv-formats` (^3.0.1) - 格式驗證器

## 報表格式

### ExecutionReport (執行報表)

```typescript
interface ExecutionReport {
  executionId: string;              // 執行唯一識別碼
  timestamp: string;                // 執行時間 (ISO 8601)
  duration: number;                 // 執行時長 (ms)
  flowName: string;                 // 流程名稱
  success: boolean;                 // 是否成功

  summary: {
    totalSteps: number;             // 總步驟數
    passedSteps: number;            // 通過步驟數
    failedSteps: number;            // 失敗步驟數
    skippedSteps: number;           // 跳過步驟數
  };

  steps: StepResult[];              // 步驟結果詳情

  // 失敗時的診斷資訊
  diagnostics?: DiagnosticContext;
}
```

### StepResult (步驟結果)

```typescript
interface StepResult {
  stepName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: any;
  };
  response?: {
    status: number;
    headers: Record<string, string>;
    body: any;
    duration: number;
  };
  validationResults?: ValidationResult[];
  error?: ErrorDetail;
}
```

### DiagnosticContext (診斷上下文)

```typescript
interface DiagnosticContext {
  // 錯誤摘要
  errorSummary: string;

  // 失敗步驟詳情
  failedSteps: FailedStepDetail[];

  // 錯誤模式分析
  errorPatterns: ErrorPattern[];

  // 修復建議
  suggestions: RepairSuggestion[];

  // 相關上下文
  context: {
    previousSteps: StepResult[];    // 前置步驟
    environmentInfo: EnvironmentInfo;
    dependencies: DependencyInfo[];
  };
}
```

## 核心元件

### ReportGenerator
報表產生器：

```typescript
import { ReportGenerator } from '@specpilot/reporting';

const generator = new ReportGenerator();

// 產生基本報表
const report = generator.generate({
  executionId: 'exec-123',
  flowName: '使用者 CRUD 測試',
  steps: stepResults
});

// 產生增強報表 (含診斷資訊)
const enhancedReport = generator.generateEnhanced({
  executionId: 'exec-123',
  flowName: '使用者 CRUD 測試',
  steps: stepResults,
  includeDiagnostics: true
});
```

### DiagnosticContextBuilder
診斷上下文建構器：

```typescript
class DiagnosticContextBuilder {
  // 建構診斷上下文
  build(failedSteps: StepResult[]): DiagnosticContext;

  // 分析錯誤模式
  analyzeErrorPatterns(steps: StepResult[]): ErrorPattern[];

  // 產生修復建議
  generateSuggestions(patterns: ErrorPattern[]): RepairSuggestion[];
}
```

### ErrorPatternAnalyzer
錯誤模式分析器：

```typescript
class ErrorPatternAnalyzer {
  // 偵測連續失敗
  detectConsecutiveFailures(steps: StepResult[]): boolean;

  // 偵測級聯失敗
  detectCascadingFailures(steps: StepResult[]): boolean;

  // 偵測網路錯誤
  detectNetworkErrors(steps: StepResult[]): boolean;

  // 偵測認證錯誤
  detectAuthErrors(steps: StepResult[]): boolean;
}
```

## 報表類型

### 1. 摘要報表 (Summary Report)

簡潔的測試結果摘要，適合快速檢視：

```json
{
  "executionId": "exec-20250117-001",
  "success": false,
  "summary": {
    "totalSteps": 5,
    "passedSteps": 3,
    "failedSteps": 2,
    "skippedSteps": 0
  },
  "duration": 1250,
  "errorSummary": "2 個步驟失敗：認證失敗、資源不存在"
}
```

### 2. 詳細報表 (Detailed Report)

包含所有步驟的完整執行資訊：

```json
{
  "executionId": "exec-20250117-001",
  "timestamp": "2025-01-17T10:30:00.000Z",
  "flowName": "使用者 CRUD 測試",
  "success": false,
  "summary": { ... },
  "steps": [
    {
      "stepName": "建立使用者",
      "status": "passed",
      "duration": 250,
      "request": { ... },
      "response": { ... }
    },
    {
      "stepName": "讀取使用者",
      "status": "failed",
      "duration": 180,
      "request": { ... },
      "error": {
        "code": "HTTP_404",
        "message": "資源不存在"
      }
    }
  ]
}
```

### 3. 診斷報表 (Diagnostic Report)

包含 AI 診斷資訊與修復建議：

```json
{
  "executionId": "exec-20250117-001",
  "success": false,
  "diagnostics": {
    "errorSummary": "認證失敗導致後續步驟全部失敗",
    "errorPatterns": [
      {
        "type": "CASCADING_FAILURE",
        "description": "第 2 步驟認證失敗，導致後續所有步驟失敗",
        "affectedSteps": [2, 3, 4, 5]
      }
    ],
    "suggestions": [
      {
        "priority": "high",
        "action": "檢查認證憑證是否有效",
        "details": "Token 可能已過期或無效，請重新取得認證憑證"
      },
      {
        "priority": "medium",
        "action": "確認 API 認證端點是否正常",
        "details": "POST /auth/login 端點可能暫時無法使用"
      }
    ],
    "context": {
      "previousSteps": [...],
      "environmentInfo": {
        "baseUrl": "http://localhost:3000",
        "timestamp": "2025-01-17T10:30:00.000Z"
      }
    }
  }
}
```

## 錯誤模式類型

### 1. 連續失敗 (Consecutive Failures)
```typescript
{
  type: 'CONSECUTIVE_FAILURE',
  description: '連續 3 個步驟失敗',
  affectedSteps: [3, 4, 5],
  suggestion: '檢查 API 服務是否正常運作'
}
```

### 2. 級聯失敗 (Cascading Failures)
```typescript
{
  type: 'CASCADING_FAILURE',
  description: '認證失敗導致所有後續步驟失敗',
  rootCause: '步驟 1: 登入失敗',
  affectedSteps: [2, 3, 4, 5],
  suggestion: '修復認證問題後重新執行'
}
```

### 3. 網路錯誤 (Network Errors)
```typescript
{
  type: 'NETWORK_ERROR',
  description: '無法連線到目標 API',
  errorCode: 'ECONNREFUSED',
  suggestion: '確認 API 服務是否啟動且可連線'
}
```

### 4. 驗證失敗 (Validation Failures)
```typescript
{
  type: 'VALIDATION_FAILURE',
  description: 'Schema 驗證失敗',
  failedFields: ['email', 'age'],
  suggestion: '檢查 API 回應格式是否符合 OpenAPI 規格'
}
```

## 使用範例

### 基本報表產生

```typescript
import { ReportGenerator } from '@specpilot/reporting';

const generator = new ReportGenerator();

// 執行測試後產生報表
const report = generator.generate({
  executionId: crypto.randomUUID(),
  flowName: flow.name,
  steps: executionResults,
  timestamp: new Date(),
  duration: totalDuration
});

// 儲存為檔案
await fs.writeFile(
  'reports/execution-report.json',
  JSON.stringify(report, null, 2)
);
```

### 診斷報表產生

```typescript
// 針對失敗的執行產生診斷報表
if (!report.success) {
  const diagnostics = diagnosticBuilder.build(
    report.steps.filter(s => s.status === 'failed')
  );

  const enhancedReport = {
    ...report,
    diagnostics
  };

  console.log('錯誤摘要:', diagnostics.errorSummary);
  console.log('修復建議:');
  diagnostics.suggestions.forEach(s => {
    console.log(`  [${s.priority}] ${s.action}`);
    console.log(`    ${s.details}`);
  });
}
```

### MCP 整合

```typescript
// 在 MCP getReport 工具中使用
async function handleGetReport(executionId?: string, format?: string) {
  const report = await reportStorage.get(executionId);

  if (format === 'summary') {
    // 回傳摘要格式
    return {
      executionId: report.executionId,
      success: report.success,
      summary: report.summary,
      errorSummary: report.diagnostics?.errorSummary
    };
  }

  // 回傳完整格式 (含診斷)
  return report;
}
```

## 開發指令

```bash
# 編譯模組
pnpm run build

# 開發模式 (watch)
pnpm run dev
```

## 架構設計原則

1. **AI 友善**: 報表格式設計為易於 AI 理解與分析
2. **結構化**: 使用標準 JSON 格式，便於程式化處理
3. **可讀性**: 提供人類可讀的錯誤摘要與建議
4. **可擴充**: 易於新增新的錯誤模式分析
5. **效能考量**: 大型報表使用串流處理

## 依賴關係

### 被依賴於
- `@specpilot/core-flow` - 產生執行報表
- `apps/mcp-server` - 提供 getReport 工具
- `apps/cli` - 輸出測試結果

### 依賴於
- `@specpilot/core-flow` - 讀取執行結果
- `@specpilot/shared` - 共用工具

## 報表儲存

### 檔案系統儲存

```typescript
// 預設儲存於 reports/ 目錄
reports/
  ├── exec-20250117-001.json        # 完整報表
  ├── exec-20250117-001.summary.txt # 摘要文字
  └── latest.json                   # 最新報表連結
```

### 記憶體快取

```typescript
// 保留最近 10 次執行結果在記憶體中
const reportCache = new LRUCache<string, ExecutionReport>(10);
```

## 未來擴充方向

1. 支援多種報表格式 (HTML, PDF, Markdown)
2. 報表視覺化圖表 (成功率趨勢、耗時分析)
3. 歷史報表比較與回歸偵測
4. 自動化根因分析 (Root Cause Analysis)
5. 整合 AI 模型進行更智慧的診斷
6. 報表聚合與統計分析
7. 實時報表推送 (WebSocket, SSE)
8. 報表範本客製化
9. 整合外部監控系統 (Datadog, Grafana)
