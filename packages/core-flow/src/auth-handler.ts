/**
 * Core Flow 認證處理器
 */

import { createStructuredLogger } from '@specpilot/shared';
import { TokenManager } from '@specpilot/http-runner';
import type { FlowStep, FlowAuth, StaticAuth } from '@specpilot/flow-parser';

const logger = createStructuredLogger('auth-handler');

/**
 * 認證處理結果
 */
export interface AuthHandleResult {
  /** 是否成功 */
  success: boolean;
  /** 錯誤訊息（失敗時） */
  error?: string;
  /** 詳細資訊 */
  details?: Record<string, unknown>;
}

/**
 * 認證處理器類別
 */
export class AuthHandler {
  private tokenManager: TokenManager;

  constructor(tokenManager?: TokenManager) {
    this.tokenManager = tokenManager || new TokenManager();
  }

  /**
   * 處理步驟層級的認證
   */
  async handleStepAuth(
    step: FlowStep,
    response?: unknown,
    executionId?: string
  ): Promise<AuthHandleResult> {
    if (!step.auth) {
      return { success: true };
    }

    const authConfig = step.auth;

    try {
      switch (authConfig.type) {
        case 'login':
          return await this.handleLoginAuth(step, authConfig, response, executionId);
        case 'static':
          return await this.handleStaticAuth(step, authConfig, executionId);
        default:
          return {
            success: false,
            error: `不支援的認證類型: ${(authConfig as { type: string }).type}`,
            details: { stepName: step.name, authType: (authConfig as { type: string }).type }
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';

      logger.error('認證處理失敗', {
        component: 'auth-handler',
        stepName: step.name,
        authType: authConfig.type,
        error: errorMessage,
        executionId
      });

      return {
        success: false,
        error: errorMessage,
        details: { stepName: step.name, authType: authConfig.type }
      };
    }
  }

  /**
   * 處理登入類型認證
   */
  private async handleLoginAuth(
    step: FlowStep,
    authConfig: FlowAuth,
    response: unknown,
    executionId?: string
  ): Promise<AuthHandleResult> {
    if (!authConfig.tokenExtraction) {
      return {
        success: false,
        error: '登入認證缺少 tokenExtraction 設定',
        details: { stepName: step.name }
      };
    }

    const extraction = authConfig.tokenExtraction;
    const namespace = extraction.namespace || 'default';

    // 從回應中提取 Token
    const token = this.tokenManager.extractTokenFromResponse(
      response,
      extraction.path,
      namespace,
      extraction.expiresIn
    );

    if (!token) {
      logger.warn('Token 提取失敗', {
        component: 'auth-handler',
        stepName: step.name,
        extractionPath: extraction.path,
        namespace,
        executionId,
        event: 'TOKEN_EXTRACTION_FAILED'
      });

      return {
        success: false,
        error: `無法從回應中提取 Token，路徑：${extraction.path}`,
        details: {
          stepName: step.name,
          extractionPath: extraction.path,
          namespace
        }
      };
    }

    logger.info('Token 提取成功', {
      component: 'auth-handler',
      stepName: step.name,
      extractionPath: extraction.path,
      namespace,
      executionId,
      event: 'TOKEN_EXTRACTED'
    });

    return { success: true };
  }

  /**
   * 處理靜態類型認證
   */
  private async handleStaticAuth(
    step: FlowStep,
    authConfig: FlowAuth,
    executionId?: string
  ): Promise<AuthHandleResult> {
    const namespace = authConfig.namespace || 'default';

    // 檢查是否已有有效的 Token
    if (this.tokenManager.hasValidToken(namespace)) {
      logger.debug('使用已存在的靜態 Token', {
        component: 'auth-handler',
        stepName: step.name,
        namespace,
        executionId
      });

      return { success: true };
    }

    logger.warn('指定命名空間的 Token 不存在或已過期', {
      component: 'auth-handler',
      stepName: step.name,
      namespace,
      executionId,
      event: 'TOKEN_MISSING'
    });

    return {
      success: false,
      error: `命名空間 "${namespace}" 的 Token 不存在或已過期`,
      details: { stepName: step.name, namespace }
    };
  }

  /**
   * 載入全域靜態認證設定
   */
  async loadGlobalStaticAuth(
    staticAuthConfigs: StaticAuth[],
    executionId?: string
  ): Promise<AuthHandleResult[]> {
    const results: AuthHandleResult[] = [];

    for (const config of staticAuthConfigs) {
      try {
        // 檢查 Token 是否為環境變數格式
        let tokenValue = config.token;
        if (tokenValue.startsWith('${') && tokenValue.endsWith('}')) {
          const envVarName = tokenValue.slice(2, -1);
          const envValue = process.env[envVarName];

          if (!envValue) {
            logger.warn('環境變數未設定', {
              component: 'auth-handler',
              namespace: config.namespace,
              envVarName,
              executionId,
              event: 'ENV_VAR_MISSING'
            });

            results.push({
              success: false,
              error: `環境變數 ${envVarName} 未設定`,
              details: { namespace: config.namespace, envVarName }
            });
            continue;
          }

          tokenValue = envValue;
        }

        // 載入靜態 Token
        this.tokenManager.loadStaticToken(
          tokenValue,
          config.namespace,
          config.expiresInSeconds
        );

        logger.info('靜態 Token 載入成功', {
          component: 'auth-handler',
          namespace: config.namespace,
          hasExpiry: !!config.expiresInSeconds,
          executionId,
          event: 'STATIC_TOKEN_LOADED'
        });

        results.push({ success: true });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知錯誤';

        logger.error('靜態 Token 載入失敗', {
          component: 'auth-handler',
          namespace: config.namespace,
          error: errorMessage,
          executionId
        });

        results.push({
          success: false,
          error: errorMessage,
          details: { namespace: config.namespace }
        });
      }
    }

    return results;
  }

  /**
   * 為 HTTP 請求注入認證 Header
   */
  injectAuthHeaders(
    headers: Record<string, string> = {},
    namespace: string = 'default'
  ): Record<string, string> {
    return this.tokenManager.injectAuthHeader(headers, namespace);
  }

  /**
   * 取得 Token 管理器實例
   */
  getTokenManager(): TokenManager {
    return this.tokenManager;
  }

  /**
   * 檢查指定命名空間的 Token 狀態
   */
  getTokenStatus(namespace: string = 'default'): {
    hasToken: boolean;
    isExpired: boolean;
    expiresAt?: string;
  } | null {
    const tokenInfo = this.tokenManager.getTokenInfo(namespace);

    if (!tokenInfo) {
      return null;
    }

    return {
      hasToken: tokenInfo.hasToken,
      isExpired: tokenInfo.isExpired,
      expiresAt: tokenInfo.expiresAt
    };
  }

  /**
   * 取得所有 Token 狀態概覽
   */
  getAllTokensStatus(): Array<{
    namespace: string;
    hasToken: boolean;
    isExpired: boolean;
    expiresAt?: string;
  }> {
    return this.tokenManager.getAllTokensInfo();
  }

  /**
   * 清除指定命名空間的 Token
   */
  clearToken(namespace: string): boolean {
    return this.tokenManager.removeToken(namespace);
  }

  /**
   * 清除所有 Token
   */
  clearAllTokens(): void {
    this.tokenManager.clearAllTokens();
  }
}