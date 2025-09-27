import { getConfig, getToken } from '@specpilot/config';
import { createStructuredLogger } from '@specpilot/shared';
import type { IHttpRunnerConfig, IHttpClientConfig, IRetryConfig, ICircuitBreakerConfig } from './types.js';

const logger = createStructuredLogger('http-runner-config');

/**
 * HTTP Runner 專用設定擴展
 */
export interface IHttpRunnerEnvConfig {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  retryMaxDelay?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerTimeout?: number;
}

/**
 * 從環境變數載入 HTTP Runner 設定
 */
export function loadHttpRunnerConfigFromEnv(): IHttpRunnerEnvConfig {
  const config: IHttpRunnerEnvConfig = {};

  // HTTP 設定
  if (process.env.SPEC_PILOT_HTTP_TIMEOUT) {
    const parsed = parseInt(process.env.SPEC_PILOT_HTTP_TIMEOUT, 10);
    if (!isNaN(parsed)) {
      config.timeout = parsed;
    }
  }

  if (process.env.SPEC_PILOT_HTTP_RETRIES) {
    const parsed = parseInt(process.env.SPEC_PILOT_HTTP_RETRIES, 10);
    if (!isNaN(parsed)) {
      config.retries = parsed;
    }
  }

  if (process.env.SPEC_PILOT_HTTP_RETRY_DELAY) {
    const parsed = parseInt(process.env.SPEC_PILOT_HTTP_RETRY_DELAY, 10);
    if (!isNaN(parsed)) {
      config.retryDelay = parsed;
    }
  }

  if (process.env.SPEC_PILOT_HTTP_RETRY_MAX_DELAY) {
    const parsed = parseInt(process.env.SPEC_PILOT_HTTP_RETRY_MAX_DELAY, 10);
    if (!isNaN(parsed)) {
      config.retryMaxDelay = parsed;
    }
  }

  // 斷路器設定
  if (process.env.SPEC_PILOT_CIRCUIT_BREAKER_THRESHOLD) {
    const parsed = parseInt(process.env.SPEC_PILOT_CIRCUIT_BREAKER_THRESHOLD, 10);
    if (!isNaN(parsed)) {
      config.circuitBreakerThreshold = parsed;
    }
  }

  if (process.env.SPEC_PILOT_CIRCUIT_BREAKER_TIMEOUT) {
    const parsed = parseInt(process.env.SPEC_PILOT_CIRCUIT_BREAKER_TIMEOUT, 10);
    if (!isNaN(parsed)) {
      config.circuitBreakerTimeout = parsed;
    }
  }

  logger.debug('HTTP Runner 環境設定已載入', {
    component: 'http-runner-config',
    config: {
      ...config,
      // 不記錄敏感資訊
    },
  });

  return config;
}

/**
 * 建立 HTTP Runner 設定
 */
export function createHttpRunnerConfig(overrides: Partial<IHttpRunnerConfig> = {}): IHttpRunnerConfig {
  const baseConfig = getConfig();
  const envConfig = loadHttpRunnerConfigFromEnv();

  // HTTP 客戶端設定
  const httpConfig: IHttpClientConfig = {
    timeout: envConfig.timeout || 30000,
    retries: envConfig.retries || 3,
    retryDelay: envConfig.retryDelay || 500,
    ...overrides.http,
  };

  // 重試設定
  const retryConfig: Partial<IRetryConfig> = {
    retries: envConfig.retries || 3,
    delay: envConfig.retryDelay || 500,
    maxDelay: envConfig.retryMaxDelay || 10000,
    factor: 2,
    ...overrides.retry,
  };

  // 斷路器設定
  const circuitBreakerConfig: Partial<ICircuitBreakerConfig> = {
    failureThreshold: envConfig.circuitBreakerThreshold || 5,
    recoveryTimeout: envConfig.circuitBreakerTimeout || 30000,
    monitoringPeriod: 60000,
    ...overrides.circuitBreaker,
  };

  const finalConfig: IHttpRunnerConfig = {
    baseUrl: baseConfig.baseUrl,
    http: httpConfig,
    retry: retryConfig,
    circuitBreaker: circuitBreakerConfig,
    ...overrides,
  };

  logger.info('HTTP Runner 設定已建立', {
    component: 'http-runner-config',
    baseUrl: !!finalConfig.baseUrl,
    timeout: finalConfig.http?.timeout,
    retries: finalConfig.retry?.retries,
    circuitBreakerThreshold: finalConfig.circuitBreaker?.failureThreshold,
  });

  return finalConfig;
}

/**
 * 取得靜態 Token（如果設定中有的話）
 */
export function getStaticToken(): string | undefined {
  const token = getToken();

  if (token) {
    logger.debug('靜態 Token 從設定載入', {
      component: 'http-runner-config',
      hasToken: true,
    });
  }

  return token;
}

/**
 * 建立包含 Token 的 HTTP Runner 實例
 */
export function createConfiguredHttpRunner(
  overrides: Partial<IHttpRunnerConfig> = {}
): { runner: unknown; hasStaticToken: boolean } {
  // 動態匯入以避免循環依賴
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { HttpRunner } = require('./index.js');

  const config = createHttpRunnerConfig(overrides);
  const runner = new HttpRunner(config);

  // 載入靜態 Token（如果有的話）
  const staticToken = getStaticToken();
  let hasStaticToken = false;

  if (staticToken) {
    runner.getTokenManager().loadStaticToken(staticToken);
    hasStaticToken = true;

    logger.info('靜態 Token 已載入到 HTTP Runner', {
      component: 'http-runner-config',
      tokenNamespace: 'default',
    });
  }

  return { runner, hasStaticToken };
}

/**
 * 驗證設定值
 */
export function validateHttpRunnerConfig(config: IHttpRunnerConfig): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 驗證逾時設定
  if (config.http?.timeout && (config.http.timeout <= 0 || config.http.timeout > 300000)) {
    errors.push('HTTP timeout 必須在 1ms 到 300000ms 之間');
  }

  // 驗證重試設定
  if (config.retry?.retries && (config.retry.retries < 0 || config.retry.retries > 10)) {
    errors.push('重試次數必須在 0 到 10 之間');
  }

  if (config.retry?.delay && config.retry.delay < 0) {
    errors.push('重試延遲必須為正數');
  }

  // 驗證斷路器設定
  if (config.circuitBreaker?.failureThreshold !== undefined && config.circuitBreaker.failureThreshold <= 0) {
    errors.push('斷路器失敗閾值必須為正數');
  }

  if (config.circuitBreaker?.recoveryTimeout && config.circuitBreaker.recoveryTimeout < 1000) {
    errors.push('斷路器恢復逾時必須至少為 1000ms');
  }

  // 驗證 baseUrl
  if (config.baseUrl) {
    try {
      new URL(config.baseUrl);
    } catch {
      errors.push('baseUrl 必須是有效的 URL');
    }
  }

  const isValid = errors.length === 0;

  if (!isValid) {
    logger.error('HTTP Runner 設定驗證失敗', {
      component: 'http-runner-config',
      errors,
    });
  }

  return { isValid, errors };
}

/**
 * 取得設定說明（用於 CLI 幫助文字）
 */
export function getConfigHelp(): string {
  return `
HTTP Runner 設定環境變數：

基本設定：
  SPEC_PILOT_BASE_URL           - API 基礎 URL
  SPEC_PILOT_TOKEN              - 靜態認證 Token

HTTP 設定：
  SPEC_PILOT_HTTP_TIMEOUT       - 請求逾時時間（毫秒，預設：30000）
  SPEC_PILOT_HTTP_RETRIES       - 重試次數（預設：3）
  SPEC_PILOT_HTTP_RETRY_DELAY   - 重試延遲（毫秒，預設：500）
  SPEC_PILOT_HTTP_RETRY_MAX_DELAY - 最大重試延遲（毫秒，預設：10000）

斷路器設定：
  SPEC_PILOT_CIRCUIT_BREAKER_THRESHOLD  - 失敗閾值（預設：5）
  SPEC_PILOT_CIRCUIT_BREAKER_TIMEOUT    - 恢復逾時（毫秒，預設：30000）

範例：
  export SPEC_PILOT_BASE_URL="https://api.example.com"
  export SPEC_PILOT_HTTP_TIMEOUT=15000
  export SPEC_PILOT_HTTP_RETRIES=5
`;
}

/**
 * 取得當前設定摘要
 */
export function getConfigSummary(): {
  baseUrl?: string;
  timeout: number;
  retries: number;
  circuitBreakerThreshold: number;
  hasStaticToken: boolean;
} {
  const config = createHttpRunnerConfig();
  const hasStaticToken = !!getStaticToken();

  return {
    baseUrl: config.baseUrl,
    timeout: config.http?.timeout || 30000,
    retries: config.retry?.retries || 3,
    circuitBreakerThreshold: config.circuitBreaker?.failureThreshold || 5,
    hasStaticToken,
  };
}