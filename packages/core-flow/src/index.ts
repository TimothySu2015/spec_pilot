import { createStructuredLogger, type TestStatus } from '@specpilot/shared';
import type { FlowDefinition as FlowParserDefinition, FlowStep as FlowParserStep } from '@specpilot/flow-parser';
import { AuthHandler, type AuthHandleResult } from './auth-handler.js';

// 匯出認證相關功能
export { AuthHandler, type AuthHandleResult } from './auth-handler.js';

const logger = createStructuredLogger('core-flow');

/**
 * 測試執行結果
 */
export interface TestResult {
  status: TestStatus;
  duration: number;
  error?: string;
  response?: unknown;
  /** 認證狀態資訊 */
  authStatus?: {
    /** 是否有認證處理 */
    hasAuth: boolean;
    /** 認證是否成功 */
    authSuccess?: boolean;
    /** 認證錯誤訊息 */
    authError?: string;
    /** 命名空間 */
    namespace?: string;
  };
}

/**
 * 流程步驟定義
 */
export interface FlowStep {
  name: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  validation?: unknown;
  fallback?: unknown;
}

/**
 * 流程定義
 */
export interface FlowDefinition {
  name: string;
  description?: string;
  steps: FlowStep[];
}

/**
 * 執行運行上下文
 */
export interface RunContext {
  /** 執行 ID */
  executionId: string;
  /** Flow 定義 */
  flow: FlowParserDefinition;
  /** 認證處理器 */
  authHandler: AuthHandler;
  /** 執行開始時間 */
  startTime: Date;
}

/**
 * 流程協調引擎
 */
export class FlowOrchestrator {
  private authHandler: AuthHandler;

  constructor(authHandler?: AuthHandler) {
    this.authHandler = authHandler || new AuthHandler();
  }

  /**
   * 執行測試流程（使用 Flow Parser 定義）
   */
  async executeFlowDefinition(
    flowDefinition: FlowParserDefinition,
    executionId?: string
  ): Promise<TestResult[]> {
    const context: RunContext = {
      executionId: executionId || this.generateExecutionId(),
      flow: flowDefinition,
      authHandler: this.authHandler,
      startTime: new Date()
    };

    logger.info('開始執行測試流程', {
      flowId: flowDefinition.id,
      stepCount: flowDefinition.steps.length,
      executionId: context.executionId,
      component: 'core-flow'
    });

    // 載入全域靜態認證設定
    if (flowDefinition.globals?.auth && 'static' in flowDefinition.globals.auth && flowDefinition.globals.auth.static) {
      const staticAuthResults = await this.authHandler.loadGlobalStaticAuth(
        flowDefinition.globals.auth.static,
        context.executionId
      );

      const failedAuth = staticAuthResults.find(result => !result.success);
      if (failedAuth) {
        logger.error('全域靜態認證載入失敗', {
          error: failedAuth.error,
          details: failedAuth.details,
          executionId: context.executionId,
          component: 'core-flow'
        });
      }
    }

    const results: TestResult[] = [];

    // 執行每個步驟
    for (const step of flowDefinition.steps) {
      const stepResult = await this.executeStep(step, context);
      results.push(stepResult);

      // 如果步驟失敗且非認證錯誤，考慮是否繼續執行
      if (stepResult.status === 'failed' && !stepResult.authStatus?.authError) {
        logger.warn('步驟執行失敗，繼續執行下一步驟', {
          stepName: step.name,
          error: stepResult.error,
          executionId: context.executionId,
          component: 'core-flow'
        });
      }
    }

    logger.info('測試流程執行完成', {
      flowId: flowDefinition.id,
      totalSteps: results.length,
      successful: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      executionId: context.executionId,
      component: 'core-flow'
    });

    return results;
  }

  /**
   * 執行測試流程（舊版相容介面）
   */
  async executeFlow(flow: FlowDefinition): Promise<TestResult[]> {
    logger.info('開始執行測試流程', { flowName: flow.name });

    const results: TestResult[] = [];

    for (const step of flow.steps) {
      const startTime = Date.now();
      logger.info('執行測試步驟', { stepName: step.name });

      try {
        // 模擬一些處理時間
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // TODO: 實際的 HTTP 執行邏輯需要 http-runner 模組
        const result: TestResult = {
          status: 'pending',
          duration: Date.now() - startTime,
          error: '需要 http-runner 模組來執行實際 HTTP 請求',
        };

        results.push(result);
        logger.warn('步驟模擬執行', { stepName: step.name, result });

      } catch (error) {
        const result: TestResult = {
          status: 'failed',
          duration: Date.now() - startTime,
          error: error instanceof Error ? error.message : '未知錯誤',
        };

        results.push(result);
        logger.error('步驟執行失敗', { stepName: step.name, error: result.error });
      }
    }

    logger.info('測試流程執行完成', { 
      flowName: flow.name,
      totalSteps: results.length,
      successful: results.filter(r => r.status === 'passed').length,
    });

    return results;
  }

  /**
   * 驗證流程定義
   */
  validateFlow(flow: FlowDefinition): boolean {
    if (!flow.name || !flow.steps || flow.steps.length === 0) {
      logger.error('無效的流程定義', { flowName: flow.name });
      return false;
    }

    for (const step of flow.steps) {
      if (!step.name || !step.method || !step.url) {
        logger.error('無效的步驟定義', { stepName: step.name });
        return false;
      }
    }

    logger.info('流程定義驗證通過', { flowName: flow.name });
    return true;
  }

  /**
   * 執行單個步驟
   */
  private async executeStep(step: FlowParserStep, context: RunContext): Promise<TestResult> {
    const startTime = Date.now();

    logger.info('執行測試步驟', {
      stepName: step.name,
      hasAuth: !!step.auth,
      executionId: context.executionId,
      component: 'core-flow'
    });

    try {
      let authResult: AuthHandleResult | undefined;

      // 處理靜態認證（檢查 Token 並注入 Authorization header）
      if (step.auth?.type === 'static') {
        authResult = await context.authHandler.handleStepAuth(
          step,
          undefined,
          context.executionId
        );

        if (authResult.success) {
          const namespace = step.auth.namespace || 'default';
          context.authHandler.injectAuthHeaders(step.request.headers || {}, namespace);

          logger.debug('注入 Authorization header', {
            stepName: step.name,
            namespace,
            executionId: context.executionId,
            component: 'core-flow'
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

      const result: TestResult = {
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

      logger.info('步驟執行成功', {
        stepName: step.name,
        duration: result.duration,
        hasAuthProcessing: !!authResult,
        authSuccess: authResult?.success,
        executionId: context.executionId,
        component: 'core-flow'
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';

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

      logger.error('步驟執行失敗', {
        stepName: step.name,
        error: errorMessage,
        duration: result.duration,
        executionId: context.executionId,
        component: 'core-flow'
      });

      return result;
    }
  }

  /**
   * 產生唯一的執行 ID
   */
  private generateExecutionId(): string {
    return `flow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 取得認證處理器
   */
  getAuthHandler(): AuthHandler {
    return this.authHandler;
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
// 匯出增強功能
export { ReportingIntegration } from './reporting-integration.js';
export { EnhancedFlowOrchestrator } from './enhanced-orchestrator.js';
