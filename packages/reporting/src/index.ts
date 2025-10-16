import { createStructuredLogger, type TestStatus, getExecutionId } from '@specpilot/shared';
import { type TestResult } from '@specpilot/core-flow';
import { writeFileSync } from 'fs';

// 匯出新的類型與功能
export * from './execution-report.js';
export { ReportGenerator as EnhancedReportGenerator, type StepInput } from './report-generator.js';
export * from './report-validator.js';

// ✨ 匯出診斷相關功能
export * from './diagnostic-context.js';
export { DiagnosticContextBuilder } from './diagnostic-context-builder.js';

const logger = createStructuredLogger('reporting');

/**
 * 測試報表
 */
export interface TestReport {
  executionId: string;
  timestamp: string;
  flowName: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  steps: Array<{
    name: string;
    status: TestStatus;
    duration: number;
    error?: string;
    response?: unknown;
  }>;
  environment: {
    baseUrl?: string;
    port?: number;
    version: string;
  };
  metadata: {
    fallbackUsed: boolean;
    retryCount: number;
    [key: string]: unknown;
  };
}

/**
 * 報表產生器（舊版，保持向後相容性）
 */
export class ReportGenerator {
  /**
   * 產生測試報表
   */
  generateReport(
    flowName: string,
    results: TestResult[],
    environment: {
      baseUrl?: string;
      port?: number;
    } = {},
    metadata: Record<string, unknown> = {},
  ): TestReport {
    logger.info('產生測試報表', { flowName, resultCount: results.length });

    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    const report: TestReport = {
      executionId: getExecutionId(),
      timestamp: new Date().toISOString(),
      flowName,
      summary: {
        total: results.length,
        passed,
        failed,
        skipped,
        duration: totalDuration,
      },
      steps: results.map((result, index) => ({
        name: `Step ${index + 1}`,
        status: result.status,
        duration: result.duration,
        error: result.error,
        response: result.response,
      })),
      environment: {
        baseUrl: environment.baseUrl,
        port: environment.port,
        version: '0.1.0',
      },
      metadata: {
        fallbackUsed: false,
        retryCount: 0,
        ...metadata,
      },
    };

    logger.info('測試報表產生完成', {
      flowName,
      executionId: report.executionId,
      summary: report.summary,
    });

    return report;
  }

  /**
   * 儲存報表至檔案
   */
  saveReport(report: TestReport, filePath: string = 'reports/result.json'): void {
    logger.info('儲存測試報表', { filePath, executionId: report.executionId });

    try {
      const reportContent = JSON.stringify(report, null, 2);
      writeFileSync(filePath, reportContent, 'utf8');

      logger.info('測試報表儲存成功', { 
        filePath, 
        executionId: report.executionId,
        size: reportContent.length,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      logger.error('測試報表儲存失敗', { 
        filePath, 
        executionId: report.executionId,
        error: errorMessage,
      });
      throw error;
    }
  }

  /**
   * 產生摘要報告
   */
  generateSummary(report: TestReport): string {
    const { summary } = report;
    const successRate = summary.total > 0 ? (summary.passed / summary.total * 100).toFixed(1) : '0.0';

    return `
測試執行摘要：
─────────────────────────────
流程名稱：${report.flowName}
執行 ID：${report.executionId}
執行時間：${new Date(report.timestamp).toLocaleString()}

測試結果：
  總計：${summary.total}
  通過：${summary.passed}
  失敗：${summary.failed}
  跳過：${summary.skipped}
  成功率：${successRate}%

執行時間：${summary.duration}ms
環境資訊：${report.environment.baseUrl || 'N/A'}
─────────────────────────────
`.trim();
  }

  /**
   * 產生 JUnit XML 報表（用於 CI/CD）
   */
  generateJUnitXml(report: TestReport): string {
    logger.info('產生 JUnit XML 報表', { executionId: report.executionId });

    const { summary } = report;
    const timestamp = new Date(report.timestamp).toISOString();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuite name="${report.flowName}" tests="${summary.total}" failures="${summary.failed}" skipped="${summary.skipped}" time="${summary.duration / 1000}" timestamp="${timestamp}">\n`;

    for (const [index, step] of report.steps.entries()) {
      const testName = step.name || `Step ${index + 1}`;
      const time = step.duration / 1000;

      xml += `  <testcase name="${testName}" time="${time}">\n`;

      if (step.status === 'failed' && step.error) {
        xml += `    <failure message="${step.error}"></failure>\n`;
      } else if (step.status === 'skipped') {
        xml += `    <skipped></skipped>\n`;
      }

      xml += `  </testcase>\n`;
    }

    xml += `</testsuite>\n`;

    logger.info('JUnit XML 報表產生完成', { 
      executionId: report.executionId,
      size: xml.length,
    });

    return xml;
  }
}
