import { createStructuredLogger, EVENT_CODES } from '@specpilot/shared';
import { writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { createHash } from 'crypto';
import {
  ExecutionReport,
  StepResult,
  ExecutionConfig,
  PartialExecutionReport
} from './execution-report.js';

const logger = createStructuredLogger('report-generator');

/**
 * 輸入步驟資料介面
 */
export interface StepInput {
  name: string;
  status: 'success' | 'failure' | 'skipped';
  startTime: string;
  duration: number;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: unknown;
  };
  response: {
    statusCode: number;
    success: boolean;
    validationResults: string[];
    errorMessage?: string;
  };
}

/**
 * 完整的報表產生器類別
 */
export class ReportGenerator {
  /**
   * 計算資料雜湊值
   */
  private calculateHash(data: unknown): string {
    // 對於 undefined/null，使用空字串計算 hash
    if (data === undefined || data === null) {
      const hash = createHash('sha256').update('').digest('hex');
      return `sha256:${hash}`;
    }
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
    const hash = createHash('sha256').update(jsonString).digest('hex');
    return `sha256:${hash}`;
  }

  /**
   * 產生步驟結果
   */
  private generateStepResult(stepInput: StepInput): StepResult {
    return {
      name: stepInput.name,
      status: stepInput.status,
      startTime: stepInput.startTime,
      duration: stepInput.duration,
      request: {
        method: stepInput.request.method,
        url: stepInput.request.url,
        headerHash: this.calculateHash(stepInput.request.headers),
        bodyHash: this.calculateHash(stepInput.request.body),
      },
      response: {
        statusCode: stepInput.response.statusCode,
        success: stepInput.response.success,
        validationResults: stepInput.response.validationResults,
        errorMessage: stepInput.response.errorMessage || null,
      },
    };
  }

  /**
   * 產生完整執行報表
   */
  generateReport(
    executionId: string,
    flowId: string,
    startTime: string,
    endTime: string,
    steps: StepInput[],
    config: ExecutionConfig
  ): ExecutionReport {
    logger.info('開始產生執行報表', {
      executionId,
      flowId,
      stepCount: steps.length
    });

    const stepResults = steps.map(step => this.generateStepResult(step));

    const successfulSteps = stepResults.filter(s => s.status === 'success').length;
    const failedSteps = stepResults.filter(s => s.status === 'failure').length;
    const skippedSteps = stepResults.filter(s => s.status === 'skipped').length;

    const startTimeMs = new Date(startTime).getTime();
    const endTimeMs = new Date(endTime).getTime();
    const duration = endTimeMs - startTimeMs;

    // 決定整體狀態
    let status: 'success' | 'failure' | 'partial';
    if (failedSteps === 0 && skippedSteps === 0) {
      status = 'success';
    } else if (successfulSteps === 0) {
      status = 'failure';
    } else {
      status = 'partial';
    }

    const report: ExecutionReport = {
      executionId,
      flowId,
      startTime,
      endTime,
      duration,
      status,
      summary: {
        totalSteps: steps.length,
        successfulSteps,
        failedSteps,
        skippedSteps,
      },
      steps: stepResults,
      config,
    };

    logger.info('執行報表產生完成', {
      executionId,
      flowId,
      status,
      summary: report.summary,
    });

    return report;
  }

  /**
   * 安全寫入報表檔案（使用臨時檔 + rename）
   */
  async saveReport(
    report: ExecutionReport,
    filePath: string = 'reports/result.json'
  ): Promise<void> {
    const absolutePath = resolve(filePath);
    const tempPath = `${absolutePath}.tmp`;

    logger.info('開始儲存執行報表', {
      executionId: report.executionId,
      filePath: absolutePath,
    });

    try {
      // 確保目錄存在
      await mkdir(dirname(absolutePath), { recursive: true });

      // 先寫入臨時檔案
      const reportContent = JSON.stringify(report, null, 2);
      await writeFile(tempPath, reportContent, 'utf8');

      // 原子性重新命名
      const fs = await import('fs');
      fs.renameSync(tempPath, absolutePath);

      logger.info('執行報表儲存成功', {
        executionId: report.executionId,
        filePath: absolutePath,
        size: reportContent.length,
        event: EVENT_CODES.STEP_SUCCESS,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';

      logger.error('執行報表儲存失敗', {
        executionId: report.executionId,
        filePath: absolutePath,
        error: errorMessage,
        event: EVENT_CODES.STEP_FAILURE,
      });

      // 清理臨時檔案
      try {
        const fs = await import('fs');
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (cleanupError) {
        logger.warn('清理臨時檔案失敗', {
          tempPath,
          error: cleanupError instanceof Error ? cleanupError.message : '未知錯誤',
        });
      }

      throw error;
    }
  }

  /**
   * 產生部分報表（用於錯誤恢復）
   */
  generatePartialReport(
    executionId: string,
    flowId: string,
    startTime: string,
    steps: StepInput[],
    config: ExecutionConfig,
    failureReason: string
  ): PartialExecutionReport {
    logger.warn('產生部分報表', {
      executionId,
      flowId,
      stepCount: steps.length,
      failureReason,
    });

    const stepResults = steps.map(step => this.generateStepResult(step));

    const successfulSteps = stepResults.filter(s => s.status === 'success').length;
    const failedSteps = stepResults.filter(s => s.status === 'failure').length;
    const skippedSteps = stepResults.filter(s => s.status === 'skipped').length;

    const partialReport: PartialExecutionReport = {
      executionId,
      flowId,
      startTime,
      generatedAt: new Date().toISOString(),
      failureReason,
      summary: {
        totalSteps: steps.length,
        successfulSteps,
        failedSteps,
        skippedSteps,
      },
      steps: stepResults,
      config,
    };

    return partialReport;
  }

  /**
   * 儲存部分報表
   */
  async savePartialReport(
    partialReport: PartialExecutionReport,
    baseDir: string = 'reports'
  ): Promise<string> {
    const fileName = `partial-${partialReport.executionId}.json`;
    const filePath = resolve(baseDir, fileName);

    logger.warn('儲存部分報表', {
      executionId: partialReport.executionId,
      filePath,
      failureReason: partialReport.failureReason,
    });

    try {
      await mkdir(dirname(filePath), { recursive: true });
      const content = JSON.stringify(partialReport, null, 2);
      await writeFile(filePath, content, 'utf8');

      logger.info('部分報表儲存成功', {
        executionId: partialReport.executionId,
        filePath,
        size: content.length,
      });

      return filePath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';

      logger.error('部分報表儲存失敗', {
        executionId: partialReport.executionId,
        filePath,
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * 產生 CLI 摘要文字
   */
  generateCliSummary(report: ExecutionReport, reportPath: string): string {
    const { summary } = report;
    const successRate = summary.totalSteps > 0
      ? (summary.successfulSteps / summary.totalSteps * 100).toFixed(1)
      : '0.0';

    const statusEmoji = report.status === 'success' ? '✅' :
                       report.status === 'failure' ? '❌' : '⚠️';

    return `
${statusEmoji} 測試執行完成

報表位置：${reportPath}
執行狀態：${report.status}
失敗計數：${summary.failedSteps}
成功率：${successRate}%

詳細結果：
  總計：${summary.totalSteps} 步驟
  成功：${summary.successfulSteps}
  失敗：${summary.failedSteps}
  跳過：${summary.skippedSteps}

執行時間：${report.duration}ms
`.trim();
  }
}