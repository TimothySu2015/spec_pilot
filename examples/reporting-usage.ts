/**
 * SpecPilot 報表與日誌功能使用範例
 *
 * 這個檔案展示如何使用 Story 2.4 實作的完整報表與日誌功能
 */

import {
  ReportGenerator,
  type StepInput,
  type ExecutionConfig,
  ReportValidator
} from '@specpilot/reporting';

import {
  createEnhancedStructuredLogger,
  SchemaValidator,
  EVENT_CODES
} from '@specpilot/shared';

import {
  EnhancedFlowOrchestrator,
  ReportingIntegration
} from '@specpilot/core-flow';

// =============================================================================
// 1. 基本報表生成範例
// =============================================================================

async function basicReportExample() {
  console.log('=== 基本報表生成範例 ===');

  const reportGenerator = new ReportGenerator();

  // 準備測試步驟資料
  const steps: StepInput[] = [
    {
      name: 'user_login',
      status: 'success',
      startTime: '2025-09-27T10:30:00.100Z',
      duration: 1200,
      request: {
        method: 'POST',
        url: 'https://api.example.com/auth/login',
        headers: { 'Content-Type': 'application/json' },
        body: { username: 'testuser', password: 'password123' }
      },
      response: {
        statusCode: 200,
        success: true,
        validationResults: ['status_check_passed', 'schema_validation_passed']
      }
    },
    {
      name: 'get_user_profile',
      status: 'failure',
      startTime: '2025-09-27T10:30:02.000Z',
      duration: 800,
      request: {
        method: 'GET',
        url: 'https://api.example.com/user/profile',
        headers: { Authorization: 'Bearer token123' },
        body: null
      },
      response: {
        statusCode: 404,
        success: false,
        validationResults: ['status_check_failed'],
        errorMessage: 'User not found'
      }
    }
  ];

  // 執行配置
  const config: ExecutionConfig = {
    baseUrl: 'https://api.example.com',
    fallbackUsed: false,
    authNamespaces: ['api_v1']
  };

  // 產生報表
  const report = reportGenerator.generateReport(
    'example-execution-123',
    'user_management_flow',
    '2025-09-27T10:30:00.000Z',
    '2025-09-27T10:30:15.000Z',
    steps,
    config
  );

  console.log('報表生成完成:');
  console.log(`- 執行 ID: ${report.executionId}`);
  console.log(`- 流程 ID: ${report.flowId}`);
  console.log(`- 狀態: ${report.status}`);
  console.log(`- 總步驟: ${report.summary.totalSteps}`);
  console.log(`- 成功: ${report.summary.successfulSteps}`);
  console.log(`- 失敗: ${report.summary.failedSteps}`);

  // 儲存報表
  await reportGenerator.saveReport(report, 'examples/output/basic-report.json');
  console.log('報表已儲存至: examples/output/basic-report.json');

  // 產生 CLI 摘要
  const cliSummary = reportGenerator.generateCliSummary(report, 'examples/output/basic-report.json');
  console.log('\nCLI 摘要:');
  console.log(cliSummary);
}

// =============================================================================
// 2. 增強版日誌記錄範例
// =============================================================================

async function enhancedLoggingExample() {
  console.log('\n=== 增強版日誌記錄範例 ===');

  // 建立增強版 Logger
  const logger = createEnhancedStructuredLogger('example-component', 'example-exec-456', {
    maxFileSize: '5MB',
    maxFiles: 5,
    compress: false
  });

  // 記錄步驟開始
  logger.logStepStart('api_authentication', {
    targetUrl: 'https://api.example.com/auth',
    retryCount: 0
  });

  // 記錄 HTTP 請求
  logger.logRequestSent('api_authentication', {
    method: 'POST',
    url: 'https://api.example.com/auth/login',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'SpecPilot/1.0.0'
    },
    body: {
      username: 'testuser',
      password: 'secret123'  // 會被自動遮罩
    }
  });

  // 模擬一些處理時間
  await new Promise(resolve => setTimeout(resolve, 100));

  // 記錄 HTTP 回應
  logger.logResponseReceived('api_authentication', {
    statusCode: 200,
    validationResults: ['status_check_passed', 'token_extracted'],
    errorMessage: undefined
  });

  // 記錄步驟完成
  logger.logStepComplete('api_authentication', 100, {
    tokenNamespace: 'default',
    authSuccess: true
  });

  // 記錄一般資訊
  logger.info('認證流程完成', {
    method: 'JWT',
    expiresIn: 3600,
    event: EVENT_CODES.AUTH_STEP_SUCCESS
  });

  console.log('增強版日誌記錄完成');
}

// =============================================================================
// 3. 完整流程執行與報表整合範例
// =============================================================================

async function fullIntegrationExample() {
  console.log('\n=== 完整流程執行與報表整合範例 ===');

  // 建立增強版流程協調器
  const orchestrator = new EnhancedFlowOrchestrator();

  // 定義測試流程
  const flowDefinition = {
    id: 'integration-example-flow',
    name: 'Integration Example Flow',
    version: '1.0.0',
    steps: [
      {
        name: 'health_check',
        request: {
          method: 'GET',
          url: '/health',
          headers: {}
        }
      },
      {
        name: 'user_login',
        request: {
          method: 'POST',
          url: '/auth/login',
          headers: { 'Content-Type': 'application/json' },
          body: { username: 'test', password: 'secret' }
        },
        auth: {
          type: 'login',
          tokenExtraction: {
            jsonPath: '$.token',
            namespace: 'default'
          }
        }
      },
      {
        name: 'get_profile',
        request: {
          method: 'GET',
          url: '/user/profile',
          headers: {}
        },
        auth: {
          type: 'static',
          namespace: 'default'
        }
      }
    ]
  };

  // 執行配置
  const config: ExecutionConfig = {
    baseUrl: 'https://api.example.com',
    fallbackUsed: false,
    authNamespaces: ['default']
  };

  try {
    // 執行流程（包含完整報表功能）
    const result = await orchestrator.executeFlowWithReporting(
      flowDefinition,
      config,
      {
        reportPath: 'examples/output/integration-report.json',
        enableReporting: true
      }
    );

    console.log('流程執行完成:');
    console.log(`- 執行 ID: ${result.executionId}`);
    console.log(`- 步驟結果: ${result.results.length} 個步驟`);
    console.log(`- 成功步驟: ${result.results.filter(r => r.status === 'passed').length}`);
    console.log(`- 失敗步驟: ${result.results.filter(r => r.status === 'failed').length}`);

    console.log('\nCLI 摘要:');
    console.log(result.reportSummary);

  } catch (error) {
    console.error('流程執行失敗:', error);
  }
}

// =============================================================================
// 4. 報表驗證範例
// =============================================================================

async function reportValidationExample() {
  console.log('\n=== 報表驗證範例 ===');

  const validator = new ReportValidator();
  const schemaValidator = new SchemaValidator();

  try {
    // 讀取並驗證報表檔案
    const fs = await import('fs/promises');
    const reportContent = await fs.readFile('examples/output/integration-report.json', 'utf8');

    // 方法 1: 使用 ReportValidator
    const reportData = JSON.parse(reportContent);
    const validationResult = validator.validateReport(reportData);

    if (validationResult.valid) {
      console.log('✅ 報表格式驗證通過');
    } else {
      console.log('❌ 報表格式驗證失敗:');
      validationResult.errors.forEach(error => {
        console.log(`  - ${error.path}: ${error.message}`);
      });
    }

    // 方法 2: 使用 SchemaValidator (包含檔案解析)
    const validatedReport = schemaValidator.validateReportFile(reportContent);
    console.log(`✅ Schema 驗證通過，報表包含 ${validatedReport.steps.length} 個步驟`);

    // 取得 Schema 定義
    const schemas = schemaValidator.getAllSchemas();
    console.log('可用的 Schema:');
    console.log(`- ExecutionReport: ${Object.keys(schemas.executionReport).length} 個屬性`);
    console.log(`- StructuredLog: ${Object.keys(schemas.structuredLog).length} 個屬性`);

  } catch (error) {
    console.error('報表驗證過程發生錯誤:', error);
  }
}

// =============================================================================
// 5. 部分報表與錯誤恢復範例
// =============================================================================

async function partialReportExample() {
  console.log('\n=== 部分報表與錯誤恢復範例 ===');

  const reportGenerator = new ReportGenerator();

  // 模擬執行到一半失敗的情況
  const completedSteps: StepInput[] = [
    {
      name: 'step1_success',
      status: 'success',
      startTime: '2025-09-27T10:30:00.000Z',
      duration: 500,
      request: {
        method: 'GET',
        url: 'https://api.example.com/step1',
        headers: {},
        body: null
      },
      response: {
        statusCode: 200,
        success: true,
        validationResults: ['status_check_passed']
      }
    },
    {
      name: 'step2_success',
      status: 'success',
      startTime: '2025-09-27T10:30:01.000Z',
      duration: 700,
      request: {
        method: 'POST',
        url: 'https://api.example.com/step2',
        headers: { 'Content-Type': 'application/json' },
        body: { data: 'test' }
      },
      response: {
        statusCode: 201,
        success: true,
        validationResults: ['status_check_passed', 'schema_validation_passed']
      }
    }
  ];

  const config: ExecutionConfig = {
    baseUrl: 'https://api.example.com',
    fallbackUsed: true,
    authNamespaces: []
  };

  // 產生部分報表
  const partialReport = reportGenerator.generatePartialReport(
    'partial-exec-789',
    'interrupted-flow',
    '2025-09-27T10:30:00.000Z',
    completedSteps,
    config,
    'Network timeout occurred during step 3'
  );

  console.log('部分報表生成:');
  console.log(`- 執行 ID: ${partialReport.executionId}`);
  console.log(`- 失敗原因: ${partialReport.failureReason}`);
  console.log(`- 已完成步驟: ${partialReport.summary.successfulSteps}`);
  console.log(`- 產生時間: ${partialReport.generatedAt}`);

  // 儲存部分報表
  const partialPath = await reportGenerator.savePartialReport(partialReport, 'examples/output');
  console.log(`部分報表已儲存至: ${partialPath}`);
}

// =============================================================================
// 6. 日誌輪替與配置範例
// =============================================================================

async function logRotationExample() {
  console.log('\n=== 日誌輪替與配置範例 ===');

  // 自訂輪替配置
  const customLogger = createEnhancedStructuredLogger('rotation-example', 'rotation-exec', {
    maxFileSize: '1MB',     // 較小的檔案用於示範
    maxFiles: 3,            // 只保留 3 個檔案
    compress: true,         // 啟用壓縮
    archiveAfterDays: 1     // 1天後壓縮
  });

  // 產生一些日誌以觸發輪替 (在實際環境中)
  for (let i = 0; i < 10; i++) {
    customLogger.info(`批次日誌訊息 ${i + 1}`, {
      batchId: `batch-${i}`,
      timestamp: new Date().toISOString(),
      data: Array(100).fill(`data-${i}`).join(' ') // 產生較大的日誌項目
    });
  }

  console.log('日誌輪替範例完成');
  console.log('檢查 logs/ 目錄以查看輪替檔案');
}

// =============================================================================
// 主程式入口
// =============================================================================

async function main() {
  console.log('SpecPilot 報表與日誌功能使用範例');
  console.log('=====================================\n');

  // 確保輸出目錄存在
  const fs = await import('fs/promises');
  try {
    await fs.mkdir('examples/output', { recursive: true });
  } catch (error) {
    // 目錄已存在
  }

  try {
    // 依序執行所有範例
    await basicReportExample();
    await enhancedLoggingExample();
    await fullIntegrationExample();
    await reportValidationExample();
    await partialReportExample();
    await logRotationExample();

    console.log('\n=====================================');
    console.log('所有範例執行完成！');
    console.log('檢查以下位置的輸出檔案:');
    console.log('- examples/output/ (報表檔案)');
    console.log('- logs/ (日誌檔案)');

  } catch (error) {
    console.error('範例執行過程中發生錯誤:', error);
    process.exit(1);
  }
}

// 執行範例（如果直接執行此檔案）
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  basicReportExample,
  enhancedLoggingExample,
  fullIntegrationExample,
  reportValidationExample,
  partialReportExample,
  logRotationExample
};