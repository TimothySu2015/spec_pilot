import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { createStructuredLogger, EVENT_CODES } from '@specpilot/shared';
import type { IHttpRequest, IHttpResponse, IHttpClientConfig } from './types.js';

const logger = createStructuredLogger('http-client');

/**
 * HTTP 客戶端類別，包裝 axios 實例處理所有 HTTP 請求
 */
export class HttpClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly config: IHttpClientConfig;

  constructor(config: IHttpClientConfig = {}) {
    this.config = {
      timeout: 30000,
      retries: 3,
      retryDelay: 500,
      ...config,
    };

    this.axiosInstance = axios.create({
      timeout: this.config.timeout,
      validateStatus: () => true, // 不自動拋出狀態碼錯誤，由我們處理
    });

    this.setupInterceptors();
  }

  /**
   * 執行 HTTP 請求
   */
  async request(request: IHttpRequest): Promise<IHttpResponse> {
    const startTime = Date.now();
    const executionId = crypto.randomUUID();

    logger.info(EVENT_CODES.STEP_START, {
      executionId,
      component: 'http-client',
      method: request.method,
      url: request.url,
      timeout: request.timeout || this.config.timeout,
    });

    const axiosConfig: AxiosRequestConfig = {
      method: request.method.toLowerCase(),
      url: request.url,
      headers: request.headers,
      data: request.body,
      timeout: request.timeout || this.config.timeout,
    };

    try {
      const response = await this.axiosInstance.request(axiosConfig);
      const duration = Date.now() - startTime;

      const httpResponse: IHttpResponse = {
        status: response.status,
        headers: response.headers as Record<string, string>,
        data: response.data,
        duration,
      };

      logger.info(EVENT_CODES.STEP_SUCCESS, {
        executionId,
        component: 'http-client',
        method: request.method,
        url: request.url,
        status: response.status,
        duration,
      });

      return httpResponse;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      const errorCode = error && typeof error === 'object' && 'code' in error
        ? (error as { code?: string }).code
        : undefined;

      logger.error(EVENT_CODES.STEP_FAILURE, {
        executionId,
        component: 'http-client',
        method: request.method,
        url: request.url,
        error: errorMessage,
        errorCode,
        duration,
      });

      // ✨ 回傳虛擬 response 而不是拋出錯誤
      // status: 0 表示網路層級錯誤（非 HTTP 錯誤）
      return {
        status: 0,
        headers: {},
        data: {
          _network_error: true,
          error: 'NETWORK_ERROR',
          message: errorMessage,
          error_code: errorCode,
          url: request.url,
          method: request.method
        },
        duration
      };
    }
  }

  /**
   * GET 請求
   */
  async get(url: string, config?: Partial<IHttpRequest>): Promise<IHttpResponse> {
    return this.request({
      method: 'GET',
      url,
      ...config,
    });
  }

  /**
   * POST 請求
   */
  async post(url: string, body?: unknown, config?: Partial<IHttpRequest>): Promise<IHttpResponse> {
    return this.request({
      method: 'POST',
      url,
      body,
      ...config,
    });
  }

  /**
   * PUT 請求
   */
  async put(url: string, body?: unknown, config?: Partial<IHttpRequest>): Promise<IHttpResponse> {
    return this.request({
      method: 'PUT',
      url,
      body,
      ...config,
    });
  }

  /**
   * PATCH 請求
   */
  async patch(url: string, body?: unknown, config?: Partial<IHttpRequest>): Promise<IHttpResponse> {
    return this.request({
      method: 'PATCH',
      url,
      body,
      ...config,
    });
  }

  /**
   * DELETE 請求
   */
  async delete(url: string, config?: Partial<IHttpRequest>): Promise<IHttpResponse> {
    return this.request({
      method: 'DELETE',
      url,
      ...config,
    });
  }

  /**
   * HEAD 請求
   */
  async head(url: string, config?: Partial<IHttpRequest>): Promise<IHttpResponse> {
    return this.request({
      method: 'HEAD',
      url,
      ...config,
    });
  }

  /**
   * OPTIONS 請求
   */
  async options(url: string, config?: Partial<IHttpRequest>): Promise<IHttpResponse> {
    return this.request({
      method: 'OPTIONS',
      url,
      ...config,
    });
  }

  /**
   * 設定請求/回應攔截器
   */
  private setupInterceptors(): void {
    // 請求攔截器
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // 遮罩敏感資訊用於日誌
        const maskedHeaders = this.maskSensitiveData(config.headers || {});
        logger.debug('發送 HTTP 請求', {
          component: 'http-client',
          url: config.url,
          method: config.method?.toUpperCase(),
          headers: maskedHeaders,
        });
        return config;
      },
      (error) => {
        logger.error('請求攔截器錯誤', {
          component: 'http-client',
          error: error.message,
        });
        return Promise.reject(error);
      }
    );

    // 回應攔截器
    this.axiosInstance.interceptors.response.use(
      (response) => {
        const maskedHeaders = this.maskSensitiveData(response.headers || {});
        logger.debug('收到 HTTP 回應', {
          component: 'http-client',
          url: response.config.url,
          status: response.status,
          headers: maskedHeaders,
        });
        return response;
      },
      (error) => {
        logger.error('回應攔截器錯誤', {
          component: 'http-client',
          error: error.message,
          status: error.response?.status,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * 遮罩敏感資訊
   */
  private maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['authorization', 'auth', 'token', 'password', 'secret'];
    const masked = { ...data };

    for (const key of Object.keys(masked)) {
      if (sensitiveKeys.some(sensitiveKey =>
        key.toLowerCase().includes(sensitiveKey.toLowerCase())
      )) {
        masked[key] = '***';
      }
    }

    return masked;
  }

  /**
   * 更新設定
   */
  updateConfig(newConfig: Partial<IHttpClientConfig>): void {
    Object.assign(this.config, newConfig);

    // 更新 axios 實例的逾時設定
    if (newConfig.timeout) {
      this.axiosInstance.defaults.timeout = newConfig.timeout;
    }
  }

  /**
   * 取得當前設定
   */
  getConfig(): Readonly<IHttpClientConfig> {
    return { ...this.config };
  }
}