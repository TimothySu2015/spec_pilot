import { createStructuredLogger, EVENT_CODES } from '@specpilot/shared';
import { HttpClient } from './http-client.js';
import { TokenManager } from './token-manager.js';
import { UrlBuilder } from './url-builder.js';
import { RetryHandler } from './retry-handler.js';
import type {
  IHttpRequest,
  IHttpResponse,
  IHttpClientConfig,
  IRetryConfig,
  ICircuitBreakerConfig,
} from './types.js';

// 匯出所有類別和型別
export { HttpClient } from './http-client.js';
export { TokenManager } from './token-manager.js';
export { UrlBuilder } from './url-builder.js';
export { RetryHandler } from './retry-handler.js';
export type {
  IHttpRequest,
  IHttpResponse,
  IHttpClientConfig,
  IRetryConfig,
  ICircuitBreakerConfig,
} from './types.js';

// 匯出設定整合功能
export {
  createHttpRunnerConfig,
  createConfiguredHttpRunner,
  validateHttpRunnerConfig,
  getConfigHelp,
  getConfigSummary,
  getStaticToken,
} from './config-integration.js';

const logger = createStructuredLogger('http-runner');

/**
 * HTTP Runner 整合配置
 */
export interface IHttpRunnerConfig {
  http?: IHttpClientConfig;
  retry?: Partial<IRetryConfig>;
  circuitBreaker?: Partial<ICircuitBreakerConfig>;
  baseUrl?: string;
}

/**
 * HTTP Runner 主要類別，整合所有功能模組
 */
export class HttpRunner {
  private readonly httpClient: HttpClient;
  private readonly tokenManager: TokenManager;
  private readonly retryHandler: RetryHandler;
  private readonly baseUrl?: string;

  constructor(config: IHttpRunnerConfig = {}) {
    this.baseUrl = config.baseUrl;
    this.httpClient = new HttpClient(config.http);
    this.tokenManager = new TokenManager();
    this.retryHandler = new RetryHandler(config.retry, config.circuitBreaker);

    logger.info('HTTP Runner 初始化完成', {
      component: 'http-runner',
      hasBaseUrl: !!this.baseUrl,
      httpConfig: this.httpClient.getConfig(),
      retryConfig: this.retryHandler.getConfig(),
    });
  }

  /**
   * 執行 HTTP 請求（包含重試、Token 注入、URL 建構）
   */
  async execute(request: IHttpRequest, options: {
    tokenNamespace?: string;
    pathParams?: Record<string, string>;
    queryParams?: Record<string, string>;
    extractToken?: {
      path: string;
      namespace?: string;
      expiresIn?: number;
    };
  } = {}): Promise<IHttpResponse> {
    const executionId = crypto.randomUUID();
    const { tokenNamespace = 'default', pathParams, queryParams, extractToken } = options;

    try {
      // 建構完整 URL
      const fullUrl = this.buildUrl(request.url, pathParams, queryParams);

      // 注入 Authorization header
      const headersWithAuth = this.tokenManager.injectAuthHeader(
        request.headers,
        tokenNamespace
      );

      const finalRequest: IHttpRequest = {
        ...request,
        url: fullUrl,
        headers: headersWithAuth,
      };

      logger.info(EVENT_CODES.STEP_START, {
        executionId,
        component: 'http-runner',
        method: request.method,
        originalUrl: request.url,
        finalUrl: fullUrl,
        hasAuth: this.tokenManager.hasValidToken(tokenNamespace),
        tokenNamespace,
      });

      // 使用重試機制執行請求
      const response = await this.retryHandler.executeWithRetry(
        () => this.httpClient.request(finalRequest),
        {
          component: 'http-runner',
          operation: 'http-request',
          executionId,
        }
      );

      // 如果需要，從回應中提取 Token
      if (extractToken) {
        this.tokenManager.extractTokenFromResponse(
          response.data,
          extractToken.path,
          extractToken.namespace || tokenNamespace,
          extractToken.expiresIn
        );
      }

      logger.info(EVENT_CODES.STEP_SUCCESS, {
        executionId,
        component: 'http-runner',
        method: request.method,
        url: fullUrl,
        status: response.status,
        duration: response.duration,
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      logger.error(EVENT_CODES.STEP_FAILURE, {
        executionId,
        component: 'http-runner',
        method: request.method,
        url: request.url,
        error: errorMessage,
      });
      throw error;
    }
  }

  /**
   * GET 請求的便利方法
   */
  async get(url: string, options: Parameters<typeof this.execute>[1] & {
    headers?: Record<string, string>;
    timeout?: number;
  } = {}): Promise<IHttpResponse> {
    const { headers, timeout, ...executeOptions } = options;
    return this.execute({
      method: 'GET',
      url,
      headers,
      timeout,
    }, executeOptions);
  }

  /**
   * POST 請求的便利方法
   */
  async post(url: string, body?: unknown, options: Parameters<typeof this.execute>[1] & {
    headers?: Record<string, string>;
    timeout?: number;
  } = {}): Promise<IHttpResponse> {
    const { headers, timeout, ...executeOptions } = options;
    return this.execute({
      method: 'POST',
      url,
      body,
      headers,
      timeout,
    }, executeOptions);
  }

  /**
   * PUT 請求的便利方法
   */
  async put(url: string, body?: unknown, options: Parameters<typeof this.execute>[1] & {
    headers?: Record<string, string>;
    timeout?: number;
  } = {}): Promise<IHttpResponse> {
    const { headers, timeout, ...executeOptions } = options;
    return this.execute({
      method: 'PUT',
      url,
      body,
      headers,
      timeout,
    }, executeOptions);
  }

  /**
   * PATCH 請求的便利方法
   */
  async patch(url: string, body?: unknown, options: Parameters<typeof this.execute>[1] & {
    headers?: Record<string, string>;
    timeout?: number;
  } = {}): Promise<IHttpResponse> {
    const { headers, timeout, ...executeOptions } = options;
    return this.execute({
      method: 'PATCH',
      url,
      body,
      headers,
      timeout,
    }, executeOptions);
  }

  /**
   * DELETE 請求的便利方法
   */
  async delete(url: string, options: Parameters<typeof this.execute>[1] & {
    headers?: Record<string, string>;
    timeout?: number;
  } = {}): Promise<IHttpResponse> {
    const { headers, timeout, ...executeOptions } = options;
    return this.execute({
      method: 'DELETE',
      url,
      headers,
      timeout,
    }, executeOptions);
  }

  /**
   * 健康檢查
   */
  async healthCheck(url?: string): Promise<boolean> {
    try {
      const checkUrl = url || (this.baseUrl ? `${this.baseUrl}/health` : '/health');
      const response = await this.get(checkUrl, { timeout: 5000 });
      return response.status >= 200 && response.status < 300;
    } catch {
      return false;
    }
  }

  /**
   * 建構 URL
   */
  private buildUrl(
    url: string,
    pathParams?: Record<string, string>,
    queryParams?: Record<string, string>
  ): string {
    // 如果 URL 已經是完整的，直接使用
    if (UrlBuilder.validate(url)) {
      if (!pathParams && !queryParams) {
        return url;
      }
      // 需要處理參數替換
      const parsed = UrlBuilder.parse(url);
      return UrlBuilder.build({
        baseUrl: `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`,
        path: parsed.pathname,
        pathParams,
        queryParams: { ...parsed.searchParams, ...queryParams },
      });
    }

    // 如果有 baseUrl，進行拼接
    if (this.baseUrl) {
      return UrlBuilder.build({
        baseUrl: this.baseUrl,
        path: url,
        pathParams,
        queryParams,
      });
    }

    // 沒有 baseUrl，但需要進行參數替換
    if (pathParams || queryParams) {
      // 假設這是一個相對路徑，需要處理參數
      let processedUrl = url;

      if (pathParams) {
        for (const [key, value] of Object.entries(pathParams)) {
          const patterns = [
            new RegExp(`\\{${key}\\}`, 'g'),
            new RegExp(`:${key}(?=/|$)`, 'g'),
          ];
          for (const pattern of patterns) {
            processedUrl = processedUrl.replace(pattern, encodeURIComponent(value));
          }
        }
      }

      if (queryParams) {
        const urlObj = new URL(processedUrl, 'http://localhost');
        for (const [key, value] of Object.entries(queryParams)) {
          urlObj.searchParams.set(key, value);
        }
        return urlObj.pathname + urlObj.search;
      }

      return processedUrl;
    }

    return url;
  }

  /**
   * Token 管理器存取
   */
  getTokenManager(): TokenManager {
    return this.tokenManager;
  }

  /**
   * 取得系統狀態
   */
  getStatus(): {
    httpClient: ReturnType<HttpClient['getConfig']>;
    retry: ReturnType<RetryHandler['getConfig']>;
    circuitBreaker: ReturnType<RetryHandler['getCircuitBreakerInfo']>;
    tokens: ReturnType<TokenManager['getAllTokensInfo']>;
  } {
    return {
      httpClient: this.httpClient.getConfig(),
      retry: this.retryHandler.getConfig(),
      circuitBreaker: this.retryHandler.getCircuitBreakerInfo(),
      tokens: this.tokenManager.getAllTokensInfo(),
    };
  }

  /**
   * 重置斷路器
   */
  resetCircuitBreaker(): void {
    this.retryHandler.resetCircuitBreaker();
  }

  /**
   * 更新 HTTP 客戶端設定
   */
  updateHttpConfig(config: Partial<HttpClientConfig>): void {
    this.httpClient.updateConfig(config);
  }
}