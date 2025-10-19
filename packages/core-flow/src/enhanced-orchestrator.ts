import { createStructuredLogger, randomUUID, type HttpMethod } from '@specpilot/shared';
import type { FlowDefinition as FlowParserDefinition, FlowStep as FlowParserStep } from '@specpilot/flow-parser';
import { VariableResolver } from '@specpilot/flow-parser';
import { AuthHandler, type AuthHandleResult } from './auth-handler.js';
import { ReportingIntegration } from './reporting-integration.js';
import type { ExecutionConfig } from '@specpilot/reporting';
import type { TestResult, RunContext } from './index.js';
import { HttpRunner, type HttpRequest } from '@specpilot/http-runner';
import { ValidationEngine, type ValidationInput } from '@specpilot/validation';

const logger = createStructuredLogger('enhanced-orchestrator');

/**
 * 增強版流程協調引擎，支援完整的日誌與報表功能
 */
export class EnhancedFlowOrchestrator {
  private authHandler: AuthHandler;
  private reportingIntegration: ReportingIntegration | null = null;
  private httpRunner: HttpRunner;
  private validationEngine: ValidationEngine;
  private variableResolver: VariableResolver;

  constructor(authHandler?: AuthHandler, config?: { baseUrl?: string }) {
    this.authHandler = authHandler || new AuthHandler();
    this.httpRunner = new HttpRunner({ baseUrl: config?.baseUrl });
    this.validationEngine = new ValidationEngine();
    this.variableResolver = new VariableResolver();
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
    results: TestResult[];
    reportSummary: string;
    executionId: string;
  }> {
    const executionId = options.executionId || this.generateExecutionId();
    const reportPath = options.reportPath || 'reports/result.json';
    const enableReporting = options.enableReporting !== false;

    // 根據 Flow options 重新建立 HttpRunner（支援 retryCount 和 timeout）
    if (flowDefinition.options?.retryCount !== undefined || flowDefinition.options?.timeout !== undefined) {
      const httpRunnerConfig: {
        baseUrl?: string;
        retry?: { retries: number };
        http?: { timeout: number };
      } = {
        baseUrl: config.baseUrl
      };

      if (flowDefinition.options.retryCount !== undefined) {
        httpRunnerConfig.retry = { retries: flowDefinition.options.retryCount };
        logger.info('從 Flow options 設定 retryCount', {
          executionId,
          retryCount: flowDefinition.options.retryCount,
          component: 'enhanced-orchestrator'
        });
      }

      if (flowDefinition.options.timeout !== undefined) {
        httpRunnerConfig.http = { timeout: flowDefinition.options.timeout };
        logger.info('從 Flow options 設定 timeout', {
          executionId,
          timeout: flowDefinition.options.timeout,
          component: 'enhanced-orchestrator'
        });
      }

      this.httpRunner = new HttpRunner(httpRunnerConfig);
    }

    // 初始化報表整合
    if (enableReporting) {
      this.reportingIntegration = new ReportingIntegration(executionId);
      this.reportingIntegration.recordFlowStart(flowDefinition, config);
    }

    const context: RunContext = {
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
      // 載入全域變數
      if (flowDefinition.variables) {
        this.variableResolver.loadVariables(flowDefinition.variables, executionId);
        logger.info('載入全域變數', {
          executionId,
          variableCount: Object.keys(flowDefinition.variables).length,
          variableNames: Object.keys(flowDefinition.variables),
          component: 'enhanced-orchestrator'
        });
      }

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

      const results: TestResult[] = [];

      // 取得 failFast 設定（預設為 false，保持向後相容）
      const failFast = flowDefinition.options?.failFast ?? false;

      // 執行每個步驟
      for (const step of flowDefinition.steps) {
        if (enableReporting && this.reportingIntegration) {
          this.reportingIntegration.recordStepStart(step);
        }

        // 解析步驟中的變數
        const resolvedStep = this.resolveStepVariables(step, executionId);

        const stepResult = await this.executeStepWithReporting(resolvedStep, context);
        results.push(stepResult);

        // 處理 capture：從回應中提取變數
        if (step.capture && stepResult.response?.data) {
          this.captureVariables(step.capture, stepResult.response.data, executionId);
        }

        // 處理失敗步驟
        if (stepResult.status === 'failed') {
          if (failFast) {
            // Fail-Fast 模式：立即停止執行
            const remainingSteps = flowDefinition.steps.length - results.length;
            logger.error('步驟執行失敗，啟用 Fail-Fast 模式，停止執行後續步驟', {
              stepName: step.name,
              error: stepResult.error,
              executedSteps: results.length,
              remainingSteps,
              executionId,
              component: 'enhanced-orchestrator',
              event: 'FAIL_FAST_TRIGGERED'
            });
            break; // 中斷迴圈，停止執行
          } else if (!stepResult.authStatus?.authError) {
            // Continue-On-Error 模式：繼續執行（原有行為）
            logger.warn('步驟執行失敗，繼續執行下一步驟', {
              stepName: step.name,
              error: stepResult.error,
              executionId,
              component: 'enhanced-orchestrator'
            });
          }
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
   * @param step - 已解析變數的步驟（從 executeFlowWithReporting 傳入）
   */
  private async executeStepWithReporting(step: FlowParserStep, context: RunContext): Promise<TestResult> {
    const startTime = Date.now();

    logger.info('執行測試步驟（增強版）', {
      stepName: step.name,
      hasAuth: !!step.auth,
      executionId: context.executionId,
      component: 'enhanced-orchestrator'
    });

    try {
      let authResult: AuthHandleResult | undefined;

      // 注意：step 參數已經是解析過變數的步驟（在 executeFlowWithReporting 中解析）
      // 建立 HTTP 請求
      const httpRequest: HttpRequest = {
        method: step.request.method.toUpperCase() as HttpMethod,
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

      // 執行驗證（step 已經是解析過變數的步驟）
      let validationSuccess = true;
      const validationResults: string[] = [];

      if (step.expectations) {
        const validationInput: ValidationInput = {
          step: step,
          response: httpResponse,
          expectations: step.expectations,
          // 註：schemas 目前未使用，ValidationEngine 主要依賴 step.expectations 進行驗證
          // 未來如需 JSON Schema 驗證，可透過構造函數傳入 OpenAPI spec 並從 spec.components.schemas 提取
          schemas: {},
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

      const result: TestResult = {
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

      // step 已經是解析過變數的步驟，直接使用
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

      const result: TestResult = {
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

  /**
   * 解析步驟中的變數引用
   */
  private resolveStepVariables(step: FlowParserStep, executionId: string): FlowParserStep {
    return {
      ...step,
      request: {
        ...step.request,
        headers: this.variableResolver.resolve(step.request.headers, executionId) as Record<string, string> | undefined,
        body: this.variableResolver.resolve(step.request.body, executionId),
        query: this.variableResolver.resolve(step.request.query, executionId) as Record<string, string> | undefined,
        path: step.request.path ? this.variableResolver.resolve(step.request.path, executionId) as string : step.request.path,
        url: step.request.url ? this.variableResolver.resolve(step.request.url, executionId) as string : step.request.url,
      },
      // 解析 expectations 中的變數（支援 custom 規則和 body 物件）
      expectations: step.expectations ? {
        status: step.expectations.status,
        schema: step.expectations.schema,
        custom: step.expectations.custom ? step.expectations.custom.map(rule => {
          const resolvedValue = rule.value !== undefined ? this.variableResolver.resolve(rule.value, executionId) : rule.value;
          return {
            ...rule,
            value: resolvedValue
          };
        }) : undefined
      } : step.expectations
    };
  }

  /**
   * 從回應中提取變數（capture）
   */
  private captureVariables(capture: Record<string, string>, responseData: unknown, executionId: string): void {
    Object.entries(capture).forEach(([varName, jsonPath]) => {
      const value = this.variableResolver.extractValueByPath(responseData, jsonPath);

      if (value !== undefined) {
        this.variableResolver.captureVariable(varName, value, executionId);
        logger.info('Capture 變數成功', {
          executionId,
          variableName: varName,
          jsonPath,
          valueType: typeof value,
          component: 'enhanced-orchestrator'
        });
      } else {
        logger.warn('Capture 變數失敗：路徑無效', {
          executionId,
          variableName: varName,
          jsonPath,
          responseData,
          component: 'enhanced-orchestrator'
        });
      }
    });
  }

  /**
   * 取得變數解析器（用於測試）
   */
  getVariableResolver(): VariableResolver {
    return this.variableResolver;
  }
}