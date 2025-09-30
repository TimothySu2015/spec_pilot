import { createStructuredLogger } from '@specpilot/shared';
import type { IExecutionReport, IStepResult } from './execution-report.js';
import type {
  IDiagnosticContext,
  IFailedStepDiagnostic,
  IErrorClassification,
  IErrorPattern,
  IDiagnosticHints,
  IEnvironmentDiagnostic,
  ErrorType
} from './diagnostic-context.js';

const logger = createStructuredLogger('diagnostic-context-builder');

/**
 * 診斷上下文建構器
 * 分析測試報表並生成結構化的診斷資訊
 */
export class DiagnosticContextBuilder {
  /**
   * 建立診斷上下文
   */
  build(report: IExecutionReport): IDiagnosticContext | null {
    // 如果沒有失敗，不需要診斷上下文
    const failedSteps = report.steps.filter(s => s.status === 'failure');
    if (failedSteps.length === 0) {
      logger.info('無失敗步驟，不建立診斷上下文', {
        executionId: report.executionId,
        totalSteps: report.steps.length
      });
      return null;
    }

    logger.info('開始建立診斷上下文', {
      executionId: report.executionId,
      failureCount: failedSteps.length,
      totalSteps: report.steps.length
    });

    // 建立失敗步驟診斷
    const failedStepDiagnostics = failedSteps.map((step) => {
      const stepIndex = report.steps.indexOf(step);
      return this.buildFailedStepDiagnostic(step, stepIndex);
    });

    // 建立環境診斷
    const environment: IEnvironmentDiagnostic = {
      baseUrl: report.config.baseUrl,
      fallbackUsed: report.config.fallbackUsed,
      authNamespaces: report.config.authNamespaces
    };

    // 偵測錯誤模式
    const errorPatterns = this.detectErrorPatterns(report, failedSteps);

    // 生成診斷提示
    const diagnosticHints = this.generateDiagnosticHints(failedSteps, failedStepDiagnostics, errorPatterns);

    const diagnosticContext: IDiagnosticContext = {
      hasFailed: true,
      failureCount: failedSteps.length,
      failedSteps: failedStepDiagnostics,
      environment,
      errorPatterns,
      diagnosticHints
    };

    logger.info('診斷上下文建立完成', {
      executionId: report.executionId,
      failureCount: failedSteps.length,
      patternsDetected: errorPatterns.length,
      primaryErrorTypes: failedStepDiagnostics.map(d => d.classification.primaryType)
    });

    return diagnosticContext;
  }

  /**
   * 建立失敗步驟診斷
   */
  private buildFailedStepDiagnostic(step: IStepResult, stepIndex: number): IFailedStepDiagnostic {
    const classification = this.classifyError(step);

    return {
      stepName: step.name,
      stepIndex,
      statusCode: step.response.statusCode,
      classification,
      errorMessage: step.response.errorMessage,
      hasErrorDetails: !!step.response.errorDetails,
      responseTime: step.response.errorDetails?.responseTime
    };
  }

  /**
   * 錯誤分類
   */
  private classifyError(step: IStepResult): IErrorClassification {
    const code = step.response.statusCode;
    const body = step.response.errorDetails?.body;
    const errorCode = this.extractErrorCode(body);

    // 網路層級錯誤 (由 HttpClient 統一處理)
    if (code === 0) {
      return {
        primaryType: 'network',
        confidence: 95,
        indicators: ['statusCode: 0', '網路連線失敗']
      };
    }

    // 認證錯誤 (結合錯誤代碼提高準確度)
    if (code === 401) {
      const authCodes = ['TOKEN_EXPIRED', 'AUTHENTICATION_FAILED', 'INVALID_TOKEN', 'AUTH_FAILED'];
      if (errorCode && authCodes.some(ac => errorCode.includes(ac))) {
        return {
          primaryType: 'auth',
          confidence: 95,
          indicators: [`HTTP 401`, `error: ${errorCode}`]
        };
      }
      return {
        primaryType: 'auth',
        confidence: 80,
        indicators: ['HTTP 401']
      };
    }

    // 授權錯誤
    if (code === 403) {
      return {
        primaryType: 'auth',
        confidence: 85,
        indicators: ['HTTP 403', '權限不足']
      };
    }

    // 驗證錯誤
    if (code === 400 || code === 422) {
      const validationFailed = step.response.validationResults.some(r =>
        r.includes('驗證失敗') || r.includes('Schema')
      );
      return {
        primaryType: 'validation',
        confidence: validationFailed ? 90 : 85,
        indicators: [`HTTP ${code}`, ...(validationFailed ? ['Schema 驗證失敗'] : [])]
      };
    }

    // 找不到資源
    if (code === 404) {
      return {
        primaryType: 'validation',
        confidence: 80,
        indicators: ['HTTP 404', '資源不存在']
      };
    }

    // 伺服器錯誤
    if (code >= 500) {
      return {
        primaryType: 'server',
        confidence: 90,
        indicators: [`HTTP ${code}`, '伺服器內部錯誤']
      };
    }

    // 未知錯誤
    return {
      primaryType: 'unknown',
      confidence: 50,
      indicators: [`HTTP ${code}`]
    };
  }

  /**
   * 從錯誤 body 提取錯誤代碼
   */
  private extractErrorCode(body: unknown): string | null {
    if (!body || typeof body !== 'object') {
      return null;
    }

    const bodyObj = body as Record<string, unknown>;

    // 常見的錯誤代碼欄位
    const errorCodeFields = ['error', 'errorCode', 'error_code', 'code', 'type'];

    for (const field of errorCodeFields) {
      const value = bodyObj[field];
      if (typeof value === 'string') {
        return value;
      }
    }

    return null;
  }

  /**
   * 偵測錯誤模式
   */
  private detectErrorPatterns(report: IExecutionReport, failedSteps: IStepResult[]): IErrorPattern[] {
    const patterns: IErrorPattern[] = [];
    const steps = report.steps;

    // 模式 1: 連續認證失敗
    const authFailures = failedSteps.filter(s => {
      const code = s.response.statusCode;
      return code === 401 || code === 403;
    });

    if (authFailures.length >= 2) {
      const affectedSteps = authFailures.map(s => steps.indexOf(s));
      patterns.push({
        pattern: 'consecutive_auth_failures',
        description: `連續 ${authFailures.length} 個步驟認證失敗`,
        likelihood: authFailures.length === failedSteps.length ? 'high' : 'medium',
        affectedSteps
      });
    }

    // 模式 2: 連鎖失敗 (第一步失敗導致後續失敗)
    if (steps[0].status === 'failure' && failedSteps.length > 1) {
      const subsequentFailures = steps.slice(1).filter(s => s.status === 'failure');
      if (subsequentFailures.length > 0) {
        patterns.push({
          pattern: 'cascading_failures',
          description: '第一步失敗導致後續步驟連鎖失敗',
          likelihood: 'high',
          affectedSteps: [0, ...subsequentFailures.map(s => steps.indexOf(s))]
        });
      }
    }

    // 模式 3: 全部網路錯誤 (API 未啟動)
    const networkErrors = failedSteps.filter(s => s.response.statusCode === 0);
    if (networkErrors.length === failedSteps.length && networkErrors.length > 0) {
      patterns.push({
        pattern: 'all_network_errors',
        description: '所有失敗都是網路錯誤，API 服務可能未啟動',
        likelihood: 'high',
        affectedSteps: networkErrors.map(s => steps.indexOf(s))
      });
    }

    // 模式 4: 同一資源的操作都失敗
    if (failedSteps.length >= 2) {
      const resourcePattern = this.findSameResourceFailures(failedSteps, steps);
      if (resourcePattern) {
        patterns.push(resourcePattern);
      }
    }

    return patterns;
  }

  /**
   * 尋找同一資源的失敗模式
   */
  private findSameResourceFailures(failedSteps: IStepResult[], allSteps: IStepResult[]): IErrorPattern | null {
    // 簡化版：檢查 URL 是否有共同的資源路徑
    const urlPaths = failedSteps.map(s => {
      const url = s.request.url;
      const match = url.match(/\/([a-z]+)(?:\/|$)/i);
      return match ? match[1] : null;
    }).filter(Boolean);

    if (urlPaths.length < 2) {
      return null;
    }

    // 找出最常見的資源
    const resourceCounts = new Map<string, number>();
    urlPaths.forEach(path => {
      if (path) {
        resourceCounts.set(path, (resourceCounts.get(path) || 0) + 1);
      }
    });

    const mostCommon = Array.from(resourceCounts.entries())
      .sort((a, b) => b[1] - a[1])[0];

    if (mostCommon && mostCommon[1] >= 2) {
      const affectedSteps = failedSteps
        .filter(s => s.request.url.includes(mostCommon[0]))
        .map(s => allSteps.indexOf(s));

      return {
        pattern: 'same_resource_failures',
        description: `針對資源 '${mostCommon[0]}' 的多個操作都失敗`,
        likelihood: mostCommon[1] === failedSteps.length ? 'high' : 'medium',
        affectedSteps
      };
    }

    return null;
  }

  /**
   * 生成診斷提示
   */
  private generateDiagnosticHints(
    failedSteps: IStepResult[],
    diagnostics: IFailedStepDiagnostic[],
    patterns: IErrorPattern[]
  ): IDiagnosticHints {
    const errorTypes = diagnostics.map(d => d.classification.primaryType);
    const uniqueTypes = Array.from(new Set(errorTypes));

    // 快速診斷摘要
    const quickDiagnosis = this.generateQuickDiagnosis(failedSteps.length, uniqueTypes, patterns);

    // 可能原因
    const likelyCauses = this.generateLikelyCauses(uniqueTypes, patterns, diagnostics);

    // 建議動作
    const suggestedActions = this.generateSuggestedActions(uniqueTypes, patterns);

    // 建議問題
    const suggestedQuestions = this.generateSuggestedQuestions(uniqueTypes, patterns);

    return {
      quickDiagnosis,
      likelyCauses,
      suggestedActions,
      suggestedQuestions
    };
  }

  /**
   * 生成快速診斷摘要
   */
  private generateQuickDiagnosis(failureCount: number, errorTypes: ErrorType[], patterns: IErrorPattern[]): string {
    const typeDescriptions: Record<ErrorType, string> = {
      auth: '認證問題',
      network: '網路連線問題',
      validation: '驗證問題',
      server: '伺服器錯誤',
      unknown: '未知錯誤'
    };

    const primaryType = errorTypes[0];
    const typeDesc = typeDescriptions[primaryType];

    if (patterns.some(p => p.pattern === 'all_network_errors')) {
      return `${failureCount} 個步驟失敗，全部是網路錯誤，API 服務可能未啟動`;
    }

    if (patterns.some(p => p.pattern === 'cascading_failures')) {
      return `${failureCount} 個步驟失敗，第一步失敗導致後續連鎖失敗`;
    }

    if (errorTypes.length === 1) {
      return `${failureCount} 個步驟失敗，主要是${typeDesc}`;
    }

    return `${failureCount} 個步驟失敗，涉及多種錯誤類型：${errorTypes.map(t => typeDescriptions[t]).join('、')}`;
  }

  /**
   * 生成可能原因列表
   */
  private generateLikelyCauses(errorTypes: ErrorType[], patterns: IErrorPattern[], _diagnostics: IFailedStepDiagnostic[]): string[] {
    const causes: string[] = [];

    // 根據錯誤類型生成原因
    if (errorTypes.includes('network')) {
      causes.push('API 服務未啟動或無法連線');
      causes.push('網路連線問題或防火牆阻擋');
      causes.push('URL 設定錯誤');
    }

    if (errorTypes.includes('auth')) {
      causes.push('認證 Token 遺失、無效或已過期');
      causes.push('API Key 設定錯誤');
      causes.push('使用者權限不足');
    }

    if (errorTypes.includes('validation')) {
      causes.push('請求資料格式不符合 API 規格');
      causes.push('必要欄位遺失或型別錯誤');
      causes.push('資源不存在或 ID 錯誤');
    }

    if (errorTypes.includes('server')) {
      causes.push('API 伺服器內部錯誤');
      causes.push('資料庫連線問題');
      causes.push('伺服器資源不足或過載');
    }

    // 根據模式補充原因
    if (patterns.some(p => p.pattern === 'cascading_failures')) {
      causes.unshift('第一步失敗導致後續步驟無法正常執行');
    }

    return causes.slice(0, 5); // 最多 5 個
  }

  /**
   * 生成建議動作
   */
  private generateSuggestedActions(errorTypes: ErrorType[], patterns: IErrorPattern[]): string[] {
    const actions: string[] = [];

    if (patterns.some(p => p.pattern === 'all_network_errors')) {
      actions.push('確認 API 服務是否正在執行');
      actions.push('檢查 baseUrl 設定是否正確');
      actions.push('測試網路連線是否正常');
      return actions;
    }

    if (patterns.some(p => p.pattern === 'cascading_failures')) {
      actions.push('優先修復第一個失敗的步驟');
      actions.push('修復後重新執行測試，確認是否解決後續失敗');
    }

    if (errorTypes.includes('auth')) {
      actions.push('更新或重新取得認證 Token');
      actions.push('檢查 .env.local 中的認證設定');
      actions.push('確認使用者帳號具有足夠的權限');
    }

    if (errorTypes.includes('validation')) {
      actions.push('比對 API 規格，檢查請求資料格式');
      actions.push('確認必要欄位都已正確提供');
      actions.push('檢查資料型別是否符合規格要求');
    }

    if (errorTypes.includes('server')) {
      actions.push('查看 API 伺服器日誌檔');
      actions.push('檢查伺服器資源使用狀況');
      actions.push('聯絡 API 維護團隊');
    }

    if (errorTypes.includes('network')) {
      actions.push('確認 API 服務正在執行');
      actions.push('檢查網路連線與防火牆設定');
      actions.push('驗證 URL 與埠號是否正確');
    }

    return actions.slice(0, 5); // 最多 5 個
  }

  /**
   * 生成建議問題（給 Claude 的提示）
   */
  private generateSuggestedQuestions(errorTypes: ErrorType[], patterns: IErrorPattern[]): string[] {
    const questions: string[] = [];

    if (errorTypes.includes('auth')) {
      questions.push('Token 是什麼時候過期的？如何刷新？');
      questions.push('API 使用哪種認證方式（Bearer Token / API Key）？');
    }

    if (errorTypes.includes('validation')) {
      questions.push('錯誤訊息中提到哪些欄位有問題？');
      questions.push('API 規格對這些欄位的要求是什麼？');
    }

    if (errorTypes.includes('server')) {
      questions.push('伺服器日誌中有什麼錯誤訊息？');
      questions.push('這個錯誤是否可重現？');
    }

    if (patterns.some(p => p.pattern === 'cascading_failures')) {
      questions.push('第一步失敗的根本原因是什麼？');
    }

    return questions;
  }
}