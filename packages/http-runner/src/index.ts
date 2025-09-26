import { createStructuredLogger, type HttpMethod } from '@specpilot/shared';

const logger = createStructuredLogger('http-runner');

/**
 * HTTP 請求設定
 */
export interface IHttpRequest {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retries?: number;
}

/**
 * HTTP 回應
 */
export interface IHttpResponse {
  status: number;
  headers: Record<string, string>;
  data: unknown;
  duration: number;
}

/**
 * HTTP 執行引擎
 */
export class HttpRunner {
  private defaultTimeout = 30000;
  private defaultRetries = 3;

  /**
   * 執行 HTTP 請求
   */
  async execute(request: IHttpRequest): Promise<IHttpResponse> {
    const startTime = Date.now();
    logger.info('執行 HTTP 請求', { 
      method: request.method,
      url: request.url,
      timeout: request.timeout || this.defaultTimeout,
    });

    const retries = request.retries ?? this.defaultRetries;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // 模擬一些處理時間
        await this.delay(10);
        
        // TODO: 實際的 HTTP 請求實作 (axios/fetch)
        // 目前返回模擬回應
        const response: IHttpResponse = {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'x-response-time': `${Date.now() - startTime}ms`,
          },
          data: {
            message: '模擬回應 - 實際 HTTP 客戶端尚未實作',
            request: {
              method: request.method,
              url: request.url,
            },
          },
          duration: Date.now() - startTime,
        };

        logger.info('HTTP 請求成功', {
          method: request.method,
          url: request.url,
          status: response.status,
          duration: response.duration,
          attempt,
        });

        return response;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知錯誤';
        logger.warn('HTTP 請求失敗', {
          method: request.method,
          url: request.url,
          attempt,
          error: errorMessage,
          willRetry: attempt < retries,
        });

        if (attempt === retries) {
          logger.error('HTTP 請求最終失敗', {
            method: request.method,
            url: request.url,
            totalAttempts: retries,
            error: errorMessage,
          });
          throw error;
        }

        // 指數退避重試
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await this.delay(delay);
      }
    }

    throw new Error('HTTP 請求失敗，已重試所有次數');
  }

  /**
   * 建立 HTTP 請求設定
   */
  createRequest(
    method: HttpMethod,
    url: string,
    options: {
      headers?: Record<string, string>;
      body?: unknown;
      timeout?: number;
      retries?: number;
    } = {},
  ): IHttpRequest {
    return {
      method,
      url,
      headers: options.headers,
      body: options.body,
      timeout: options.timeout || this.defaultTimeout,
      retries: options.retries || this.defaultRetries,
    };
  }

  /**
   * 檢查健康狀態
   */
  async healthCheck(baseUrl: string): Promise<boolean> {
    logger.info('執行健康檢查', { baseUrl });

    try {
      const request = this.createRequest('GET', `${baseUrl}/health`, {
        timeout: 5000,
        retries: 1,
      });

      const response = await this.execute(request);
      const isHealthy = response.status >= 200 && response.status < 300;

      logger.info('健康檢查完成', { 
        baseUrl, 
        status: response.status, 
        isHealthy,
      });

      return isHealthy;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      logger.error('健康檢查失敗', { baseUrl, error: errorMessage });
      return false;
    }
  }

  /**
   * 延遲執行
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}