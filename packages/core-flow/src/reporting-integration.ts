import {
  createEnhancedStructuredLogger,
  type EnhancedStructuredLogger,
  EVENT_CODES
} from '@specpilot/shared';
import {
  EnhancedReportGenerator,
  type StepInput,
  type ExecutionConfig
} from '@specpilot/reporting';
import type { FlowDefinition as FlowParserDefinition, FlowStep as FlowParserStep } from '@specpilot/flow-parser';
import type { TestResult } from './index.js';

/**
 * 報表整合管理器
 */
export class ReportingIntegration {
  private logger: EnhancedStructuredLogger;
  private reportGenerator: EnhancedReportGenerator;
  private stepInputs: StepInput[] = [];
  private flowStartTime: string = '';

  constructor(executionId: string, component: string = 'reporting-integration') {
    this.logger = createEnhancedStructuredLogger(component, executionId);
    this.reportGenerator = new EnhancedReportGenerator();
  }

  /**
   * 記錄流程開始
   */
  recordFlowStart(flowDefinition: FlowParserDefinition, config: ExecutionConfig): void {
    this.flowStartTime = new Date().toISOString();
    this.stepInputs = [];

    this.logger.info('流程執行開始', {
      flowId: flowDefinition.id,
      stepCount: flowDefinition.steps.length,
      config,
      event: EVENT_CODES.FLOW_START
    });
  }

  /**
   * 記錄步驟開始
   */
  recordStepStart(step: FlowParserStep): void {
    this.logger.logStepStart(step.name, {
      method: step.request.method,
      url: step.request.url,
      hasAuth: !!step.auth
    });
  }

  /**
   * 記錄步驟完成
   */
  recordStepComplete(
    step: FlowParserStep,
    testResult: TestResult,
    request: {
      method: string;
      url: string;
      headers: Record<string, string>;
      body: unknown;
    },
    response: {
      statusCode: number;
      validationResults: string[];
      errorMessage?: string;
    }
  ): void {
    const stepStartTime = new Date(Date.now() - testResult.duration).toISOString();

    // 記錄請求發送
    this.logger.logRequestSent(step.name, request);

    // 記錄回應接收
    this.logger.logResponseReceived(step.name, response);

    // 記錄步驟完成或失敗
    if (testResult.status === 'passed') {
      this.logger.logStepComplete(step.name, testResult.duration, {
        statusCode: response.statusCode,
        validationResults: response.validationResults
      });
    } else {
      this.logger.logStepFailure(
        step.name,
        testResult.duration,
        testResult.error || '未知錯誤',
        {
          statusCode: response.statusCode,
          authError: testResult.authStatus?.authError
        }
      );
    }

    // 收集步驟資料用於報表
    const stepInput: StepInput = {
      name: step.name,
      status: testResult.status === 'passed' ? 'success' :
              testResult.status === 'failed' ? 'failure' : 'skipped',
      startTime: stepStartTime,
      duration: testResult.duration,
      request,
      response: {
        statusCode: response.statusCode,
        success: testResult.status === 'passed',
        validationResults: response.validationResults,
        errorMessage: response.errorMessage || testResult.error,
        // ✨ 新增: 從 testResult.response 傳遞完整資料
        body: testResult.response?.data,
        headers: testResult.response?.headers,
        responseTime: testResult.response?.duration
      }
    };

    this.stepInputs.push(stepInput);
  }

  /**
   * 記錄流程完成並產生報表
   */
  async recordFlowComplete(
    executionId: string,
    flowId: string,
    config: ExecutionConfig,
    reportPath: string = 'reports/result.json'
  ): Promise<string> {
    const endTime = new Date().toISOString();

    this.logger.info('流程執行完成', {
      flowId,
      stepCount: this.stepInputs.length,
      duration: new Date(endTime).getTime() - new Date(this.flowStartTime).getTime(),
      event: EVENT_CODES.FLOW_COMPLETE
    });

    try {
      // 產生執行報表
      const report = this.reportGenerator.generateReport(
        executionId,
        flowId,
        this.flowStartTime,
        endTime,
        this.stepInputs,
        config
      );

      // 儲存報表
      await this.reportGenerator.saveReport(report, reportPath);

      this.logger.info('執行報表產生完成', {
        reportPath,
        status: report.status,
        successfulSteps: report.summary.successfulSteps,
        failedSteps: report.summary.failedSteps,
        event: EVENT_CODES.REPORT_GENERATED
      });

      // 產生 CLI 摘要
      const cliSummary = this.reportGenerator.generateCliSummary(report, reportPath);

      return cliSummary;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';

      this.logger.error('執行報表產生失敗', {
        error: errorMessage,
        event: EVENT_CODES.REPORT_GENERATION_FAILED
      });

      // 產生部分報表
      try {
        const partialReport = this.reportGenerator.generatePartialReport(
          executionId,
          flowId,
          this.flowStartTime,
          this.stepInputs,
          config,
          errorMessage
        );

        const partialPath = await this.reportGenerator.savePartialReport(partialReport);

        return `⚠️ 報表產生失敗，已儲存部分報表至：${partialPath}\n錯誤：${errorMessage}`;

      } catch (partialError) {
        const partialErrorMessage = partialError instanceof Error ? partialError.message : '未知錯誤';

        this.logger.error('部分報表產生失敗', {
          error: partialErrorMessage
        });

        return `❌ 報表產生完全失敗\n主要錯誤：${errorMessage}\n部分報表錯誤：${partialErrorMessage}`;
      }
    }
  }

  /**
   * 記錄流程失敗
   */
  async recordFlowFailure(
    executionId: string,
    flowId: string,
    config: ExecutionConfig,
    error: string
  ): Promise<void> {
    this.logger.error('流程執行失敗', {
      flowId,
      error,
      stepCount: this.stepInputs.length,
      event: EVENT_CODES.FLOW_FAILURE
    });

    // 產生部分報表
    try {
      const partialReport = this.reportGenerator.generatePartialReport(
        executionId,
        flowId,
        this.flowStartTime,
        this.stepInputs,
        config,
        error
      );

      await this.reportGenerator.savePartialReport(partialReport);

      this.logger.info('部分報表產生成功', {
        executionId,
        failureReason: error
      });
    } catch (partialError) {
      this.logger.error('部分報表產生失敗', {
        error: partialError instanceof Error ? partialError.message : '未知錯誤'
      });
    }
  }

  /**
   * 記錄驗證結果
   */
  recordValidationResult(stepName: string, validationResults: string[], success: boolean): void {
    if (success) {
      this.logger.info('驗證通過', {
        stepName,
        validationResults,
        event: EVENT_CODES.VALIDATION_SUCCESS
      });
    } else {
      this.logger.warn('驗證失敗', {
        stepName,
        validationResults,
        event: EVENT_CODES.VALIDATION_FAILURE
      });
    }
  }

  /**
   * 記錄備援使用
   */
  recordFallbackUsed(stepName: string, originalUrl: string, fallbackUrl: string): void {
    this.logger.warn('使用備援服務', {
      stepName,
      originalUrl,
      fallbackUrl,
      event: EVENT_CODES.FALLBACK_USED
    });
  }

  /**
   * 取得當前收集的步驟資料
   */
  getCollectedSteps(): StepInput[] {
    return [...this.stepInputs];
  }

  /**
   * 清除收集的資料
   */
  clearCollectedData(): void {
    this.stepInputs = [];
    this.flowStartTime = '';
  }
}