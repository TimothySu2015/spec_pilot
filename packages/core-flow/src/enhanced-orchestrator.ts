import { createStructuredLogger, type TestStatus, randomUUID } from '@specpilot/shared';
import type { IFlowDefinition as FlowParserDefinition, IFlowStep as FlowParserStep } from '@specpilot/flow-parser';
import { AuthHandler, type IAuthHandleResult } from './auth-handler.js';
import { ReportingIntegration } from './reporting-integration.js';
import type { ExecutionConfig } from '@specpilot/reporting';
import type { ITestResult, IRunContext } from './index.js';

const logger = createStructuredLogger('enhanced-orchestrator');

/**
 * 增強版流程協調引擎，支援完整的日誌與報表功能
 */
export class EnhancedFlowOrchestrator {
  private authHandler: AuthHandler;
  private reportingIntegration: ReportingIntegration | null = null;

  constructor(authHandler?: AuthHandler) {
    this.authHandler = authHandler || new AuthHandler();
  }

  /**
   * 執行測試流程（增強版，支援完整報表）
   */
  async executeFlowWithReporting(
    flowDefinition: FlowParserDefinition,
    config: ExecutionConfig,
    options: {
      executionId?: string;
      reportPath?: string;
      enableReporting?: boolean;
    } = {}
  ): Promise<{
    results: ITestResult[];
    reportSummary: string;
    executionId: string;
  }> {
    const executionId = options.executionId || this.generateExecutionId();
    const reportPath = options.reportPath || 'reports/result.json';
    const enableReporting = options.enableReporting !== false;

    // 初始化報表整合
    if (enableReporting) {
      this.reportingIntegration = new ReportingIntegration(executionId);
      this.reportingIntegration.recordFlowStart(flowDefinition, config);
    }

    const context: IRunContext = {
      executionId,
      flow: flowDefinition,
      authHandler: this.authHandler,
      startTime: new Date()
    };

    logger.info('開始執行測試流程（增強版）', {
      flowId: flowDefinition.id,
      stepCount: flowDefinition.steps.length,
      executionId,
      enableReporting,
      component: 'enhanced-orchestrator'
    });

    try {
      // 載入全域靜態認證設定
      if (flowDefinition.globals?.auth && 'static' in flowDefinition.globals.auth && flowDefinition.globals.auth.static) {
        const staticAuthResults = await this.authHandler.loadGlobalStaticAuth(
          flowDefinition.globals.auth.static,
          executionId
        );

        const failedAuth = staticAuthResults.find(result => !result.success);
        if (failedAuth) {
          logger.error('全域靜態認證載入失敗', {
            error: failedAuth.error,
            details: failedAuth.details,
            executionId,
            component: 'enhanced-orchestrator'
          });

          if (enableReporting && this.reportingIntegration) {
            this.reportingIntegration.recordFlowFailure(
              executionId,
              flowDefinition.id,
              config,
              `全域認證失敗：${failedAuth.error}`
            );
          }

          throw new Error(`全域認證失敗：${failedAuth.error}`);
        }
      }

      const results: ITestResult[] = [];

      // 執行每個步驟
      for (const step of flowDefinition.steps) {
        if (enableReporting && this.reportingIntegration) {
          this.reportingIntegration.recordStepStart(step);
        }

        const stepResult = await this.executeStepWithReporting(step, context);
        results.push(stepResult);

        // 如果步驟失敗且非認證錯誤，考慮是否繼續執行
        if (stepResult.status === 'failed' && !stepResult.authStatus?.authError) {
          logger.warn('步驟執行失敗，繼續執行下一步驟', {
            stepName: step.name,
            error: stepResult.error,
            executionId,
            component: 'enhanced-orchestrator'
          });
        }
      }

      // 產生報表摘要
      let reportSummary = '';
      if (enableReporting && this.reportingIntegration) {
        reportSummary = await this.reportingIntegration.recordFlowComplete(
          executionId,
          flowDefinition.id,
          config,
          reportPath
        );
      }

      logger.info('測試流程執行完成（增強版）', {
        flowId: flowDefinition.id,
        totalSteps: results.length,
        successful: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        executionId,
        component: 'enhanced-orchestrator'
      });

      return {
        results,
        reportSummary,
        executionId
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';

      logger.error('測試流程執行失敗', {
        flowId: flowDefinition.id,
        error: errorMessage,
        executionId,
        component: 'enhanced-orchestrator'
      });

      if (enableReporting && this.reportingIntegration) {
        this.reportingIntegration.recordFlowFailure(
          executionId,
          flowDefinition.id,
          config,
          errorMessage
        );
      }

      throw error;
    }
  }

  /**
   * 執行單個步驟（增強版，支援報表記錄）
   */
  private async executeStepWithReporting(step: FlowParserStep, context: IRunContext): Promise<ITestResult> {
    const startTime = Date.now();

    logger.info('執行測試步驟（增強版）', {
      stepName: step.name,
      hasAuth: !!step.auth,
      executionId: context.executionId,
      component: 'enhanced-orchestrator'
    });

    try {
      let authResult: IAuthHandleResult | undefined;

      // 模擬請求物件
      const mockRequest = {
        method: step.request.method,
        url: step.request.url,
        headers: { ...step.request.headers } || {},
        body: step.request.body
      };

      // 處理靜態認證（檢查 Token 並注入 Authorization header）
      if (step.auth?.type === 'static') {
        authResult = await context.authHandler.handleStepAuth(
          step,
          undefined,
          context.executionId
        );

        if (authResult.success) {
          const namespace = step.auth.namespace || 'default';
          context.authHandler.injectAuthHeaders(mockRequest.headers, namespace);

          logger.debug('注入 Authorization header', {
            stepName: step.name,
            namespace,
            executionId: context.executionId,
            component: 'enhanced-orchestrator'
          });
        }
      }

      // 模擬 HTTP 請求執行
      // TODO: 這裡應該整合實際的 HTTP Runner
      await new Promise(resolve => setTimeout(resolve, 10));

      const mockResponse = {
        status: 200,
        data: {
          token: 'mock_token_value',
          user_id: 123,
          expires_in: 3600
        }
      };

      // 處理登入認證（提取 Token）
      if (step.auth?.type === 'login') {
        authResult = await context.authHandler.handleStepAuth(
          step,
          mockResponse,
          context.executionId
        );
      }

      // 模擬驗證結果
      const validationResults = ['status_check_passed', 'schema_validation_passed'];
      const responseData = {
        statusCode: mockResponse.status,
        validationResults,
        errorMessage: undefined
      };

      const result: ITestResult = {
        status: 'passed',
        duration: Date.now() - startTime,
        response: mockResponse,
        authStatus: step.auth ? {
          hasAuth: true,
          authSuccess: authResult?.success ?? true,
          authError: authResult?.error,
          namespace: step.auth.type === 'static'
            ? step.auth.namespace
            : step.auth.tokenExtraction?.namespace
        } : undefined
      };

      // 記錄到報表整合
      if (this.reportingIntegration) {
        this.reportingIntegration.recordStepComplete(
          step,
          result,
          mockRequest,
          responseData
        );
        this.reportingIntegration.recordValidationResult(
          step.name,
          validationResults,
          true
        );
      }

      logger.info('步驟執行成功（增強版）', {
        stepName: step.name,
        duration: result.duration,
        hasAuthProcessing: !!authResult,
        authSuccess: authResult?.success,
        executionId: context.executionId,
        component: 'enhanced-orchestrator'
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';

      const mockRequest = {
        method: step.request.method,
        url: step.request.url,
        headers: { ...step.request.headers } || {},
        body: step.request.body
      };

      const errorResponse = {
        statusCode: 500,
        validationResults: ['execution_failed'],
        errorMessage
      };

      const result: ITestResult = {
        status: 'failed',
        duration: Date.now() - startTime,
        error: errorMessage,
        authStatus: step.auth ? {
          hasAuth: true,
          authSuccess: false,
          authError: errorMessage
        } : undefined
      };

      // 記錄到報表整合
      if (this.reportingIntegration) {
        this.reportingIntegration.recordStepComplete(
          step,
          result,
          mockRequest,
          errorResponse
        );
        this.reportingIntegration.recordValidationResult(
          step.name,
          ['execution_failed'],
          false
        );
      }

      logger.error('步驟執行失敗（增強版）', {
        stepName: step.name,
        error: errorMessage,
        duration: result.duration,
        executionId: context.executionId,
        component: 'enhanced-orchestrator'
      });

      return result;
    }
  }

  /**
   * 產生唯一的執行 ID
   */
  private generateExecutionId(): string {
    return randomUUID();
  }

  /**
   * 取得認證處理器
   */
  getAuthHandler(): AuthHandler {
    return this.authHandler;
  }

  /**
   * 取得報表整合器
   */
  getReportingIntegration(): ReportingIntegration | null {
    return this.reportingIntegration;
  }

  /**
   * 取得所有 Token 狀態
   */
  getAllTokensStatus(): Array<{
    namespace: string;
    hasToken: boolean;
    isExpired: boolean;
    expiresAt?: string;
  }> {
    return this.authHandler.getAllTokensStatus();
  }

  /**
   * 清除所有 Token
   */
  clearAllTokens(): void {
    this.authHandler.clearAllTokens();
  }
}