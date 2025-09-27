export * from './logger.js';
export * from './errors/base-error.js';
export * from './errors/auth-errors.js';

/**
 * 共用類型定義
 */
export interface IApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  executionId: string;
}

/**
 * HTTP 方法類型
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * 測試結果狀態
 */
export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

/**
 * 錯誤代碼常數
 */
export const ERROR_CODES = {
  CONFIG_ERROR: 1501,
  SPEC_ERROR: 1502,
  FLOW_ERROR: 1503,
  NETWORK_ERROR: 1504,
  TIMEOUT_ERROR: 1505,
  VALIDATION_ERROR: 1506,
  AUTH_ERROR: 1507,
} as const;

/**
 * 事件代碼常數
 */
export const EVENT_CODES = {
  STEP_START: 'STEP_START',
  STEP_SUCCESS: 'STEP_SUCCESS',
  STEP_FAILURE: 'STEP_FAILURE',
  FALLBACK_USED: 'FALLBACK_USED',
  VALIDATION_PASSED: 'VALIDATION_PASSED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  // 認證相關事件
  TOKEN_LOADED: 'TOKEN_LOADED',
  TOKEN_EXTRACTED: 'TOKEN_EXTRACTED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_MISSING: 'TOKEN_MISSING',
  AUTH_STEP_SUCCESS: 'AUTH_STEP_SUCCESS',
  AUTH_STEP_FAILED: 'AUTH_STEP_FAILED',
  STATIC_TOKEN_LOADED: 'STATIC_TOKEN_LOADED',
  ENV_VAR_MISSING: 'ENV_VAR_MISSING',
  TOKEN_EXTRACTION_FAILED: 'TOKEN_EXTRACTION_FAILED',
  TOKEN_INJECTED: 'TOKEN_INJECTED',
} as const;