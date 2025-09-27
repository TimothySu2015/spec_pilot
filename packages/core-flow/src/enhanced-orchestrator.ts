import { createStructuredLogger, type TestStatus, randomUUID } from '@specpilot/shared';
import type { IFlowDefinition as FlowParserDefinition, IFlowStep as FlowParserStep } from '@specpilot/flow-parser';
import { AuthHandler, type IAuthHandleResult } from './auth-handler.js';
import { ReportingIntegration } from './reporting-integration.js';
import type { ExecutionConfig } from '@specpilot/reporting';
import type { ITestResult, IRunContext } from './index.js';
import { HttpRunner, type IHttpRequest } from '@specpilot/http-runner';
import { ValidationEngine, type IValidationInput } from '@specpilot/validation';

const logger = createStructuredLogger('enhanced-orchestrator');

/**
 * 增強版流程協調引擎，支援完整的日誌與報表功能
 */
export class EnhancedFlowOrchestrator {
  private authHandler: AuthHandler;
  private reportingIntegration: ReportingIntegration | null = null;
  private httpRunner: HttpRunner;
  private validationEngine: ValidationEngine;

  constructor(authHandler?: AuthHandler, config?: { baseUrl?: string }) {
    this.authHandler = authHandler || new AuthHandler();
    this.httpRunner = new HttpRunner({ baseUrl: config?.baseUrl });
    this.validationEngine = new ValidationEngine();
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

      // 建立 HTTP 請求
      const httpRequest: IHttpRequest = {
        method: step.request.method.toUpperCase() as any,
        url: step.request.url || step.request.path || '/',
        headers: { ...step.request.headers } || {},
        body: step.request.body
      };

      // 處理靜態認證（檢查並注入 Token）
      let tokenNamespace = 'default';
      if (step.auth?.type === 'static') {
        authResult = await context.authHandler.handleStepAuth(
          step,
          undefined,
          context.executionId
        );

        tokenNamespace = step.auth.namespace || 'default';
        logger.debug('使用靜態認證', {
          stepName: step.name,
          namespace: tokenNamespace,
          authSuccess: authResult.success,
          executionId: context.executionId,
          component: 'enhanced-orchestrator'
        });
      }

      // 執行 HTTP 請求
      const httpResponse = await this.httpRunner.execute(httpRequest, {
        tokenNamespace,
        extractToken: step.auth?.type === 'login' && step.auth.tokenExtraction ? {
          path: step.auth.tokenExtraction.jsonPath || '$.token',
          namespace: step.auth.tokenExtraction.namespace || 'default'
        } : undefined
      });

      // 處理登入認證（提取 Token）
      if (step.auth?.type === 'login') {
        authResult = await context.authHandler.handleStepAuth(
          step,
          httpResponse,
          context.executionId
        );
      }

      // 執行驗證（如果有定義 expectations）
      let validationSuccess = true;
      const validationResults: string[] = [];

      if (step.expectations) {
        const validationInput: IValidationInput = {
          step,
          response: httpResponse,
          expectations: step.expectations,
          schemas: {}, // TODO: 從 OpenAPI spec 載入 schemas
          logger,
          executionId: context.executionId,
          runContext: {
            executionId: context.executionId,
            flowId: context.flow.id,
            timestamp: context.startTime
          }
        };

        const validationOutcome = await this.validationEngine.validateResponse(validationInput);
        validationSuccess = validationOutcome.status === 'success';

        if (validationOutcome.status === 'success') {
          validationResults.push('all_validations_passed');
        } else {
          for (const issue of validationOutcome.issues) {
            validationResults.push(`${issue.category}_${issue.severity}: ${issue.message}`);
          }
        }
      }

      const responseData = {
        statusCode: httpResponse.status,
        validationResults,
        errorMessage: validationSuccess ? undefined : 'Validation failed'
      };

      const result: ITestResult = {
        status: validationSuccess ? 'passed' : 'failed',
        duration: Date.now() - startTime,
        response: httpResponse,
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
          httpRequest,
          responseData
        );
        this.reportingIntegration.recordValidationResult(
          step.name,
          validationResults,
          validationSuccess
        );
      }

      logger.info('步驟執行成功（增強版）', {
        stepName: step.name,
        duration: result.duration,
        hasAuthProcessing: !!authResult,
        authSuccess: authResult?.success,
        validationSuccess,
        executionId: context.executionId,
        component: 'enhanced-orchestrator'
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';

      const httpRequest = {
        method: step.request.method,
        url: step.request.url || step.request.path || '/',
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
          httpRequest,
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