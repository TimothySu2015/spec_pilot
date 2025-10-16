import type { HttpMethod } from '@specpilot/shared';

/**
 * HTTP 請求設定
 */
export interface HttpRequest {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

/**
 * HTTP 回應
 */
export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  data: unknown;
  duration: number;
}

/**
 * HTTP 客戶端設定
 */
export interface HttpClientConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  baseUrl?: string;
}

/**
 * 重試策略設定
 */
export interface RetryConfig {
  retries: number;
  delay: number;
  factor: number;
  maxDelay: number;
  retryCondition?: (error: Error | unknown) => boolean;
}

/**
 * Token 管理介面
 */
export interface TokenInfo {
  token: string;
  namespace?: string;
  expiresAt?: Date;
}

/**
 * URL 建構選項
 */
export interface UrlBuilderOptions {
  baseUrl: string;
  path: string;
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string>;
}

/**
 * 斷路器狀態
 */
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * 斷路器設定
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}