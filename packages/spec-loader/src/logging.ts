import { createStructuredLogger, setExecutionId } from '@specpilot/shared';
import type { SpecDocument } from './types.js';
import { getSpecInfo } from './validator.js';

/**
 * spec-loader 專用 Logger
 */
const logger = createStructuredLogger('spec-loader');

/**
 * 規格載入事件代碼
 */
export const SPEC_EVENT_CODES = {
  SPEC_LOAD_START: 'SPEC_LOAD_START',
  SPEC_LOAD_SUCCESS: 'SPEC_LOAD_SUCCESS',
  SPEC_LOAD_FAILURE: 'SPEC_LOAD_FAILURE',
  SPEC_VALIDATION_START: 'SPEC_VALIDATION_START',
  SPEC_VALIDATION_SUCCESS: 'SPEC_VALIDATION_SUCCESS',
  SPEC_VALIDATION_FAILURE: 'SPEC_VALIDATION_FAILURE',
} as const;

/**
 * 記錄規格載入開始事件
 */
export function logSpecLoadStart(
  source: { filePath?: string; contentLength?: number },
  format?: string,
  executionId?: string
): void {
  if (executionId) {
    setExecutionId(executionId);
  }

  const context = {
    event: SPEC_EVENT_CODES.SPEC_LOAD_START,
    source: source.filePath ? 'file' : 'content',
    filePath: source.filePath,
    contentLength: source.contentLength,
    format: format || 'auto-detect',
  };

  logger.info('規格載入開始', context);
}

/**
 * 記錄規格載入成功事件
 */
export function logSpecLoadSuccess(document: SpecDocument): void {
  const specInfo = getSpecInfo(document.document);
  // const maskedDocument = maskSensitiveFields(document.document as Record<string, unknown>);
  
  const context = {
    event: SPEC_EVENT_CODES.SPEC_LOAD_SUCCESS,
    specId: document.id,
    specInfo: {
      openApiVersion: specInfo.version,
      title: specInfo.title,
      pathCount: specInfo.pathCount,
      schemaCount: specInfo.schemaCount,
    },
    loadedAt: document.loadedAt,
    // 只記錄基本資訊，避免完整文件內容
    documentInfo: {
      hasInfo: !!(document.document as Record<string, unknown>).info,
      hasPaths: !!(document.document as Record<string, unknown>).paths,
      hasComponents: !!(document.document as Record<string, unknown>).components,
    }
  };

  logger.info('規格載入成功', context);
}

/**
 * 記錄規格載入失敗事件
 */
export function logSpecLoadFailure(
  error: Error,
  source: { filePath?: string; contentLength?: number },
  format?: string
): void {
  const context = {
    event: SPEC_EVENT_CODES.SPEC_LOAD_FAILURE,
    source: source.filePath ? 'file' : 'content',
    filePath: source.filePath,
    contentLength: source.contentLength,
    format: format || 'unknown',
    error: {
      name: error.name,
      message: error.message,
      code: (error as unknown as { code?: number }).code,
    },
  };

  logger.error('規格載入失敗', context);
}

/**
 * 記錄規格驗證開始事件
 */
export function logSpecValidationStart(specId: string): void {
  const context = {
    event: SPEC_EVENT_CODES.SPEC_VALIDATION_START,
    specId,
  };

  logger.info('規格驗證開始', context);
}

/**
 * 記錄規格驗證成功事件
 */
export function logSpecValidationSuccess(
  document: SpecDocument,
  validationInfo?: {
    dereferenced: boolean;
    originalSchemaCount: number;
    finalSchemaCount: number;
  }
): void {
  const specInfo = getSpecInfo(document.document);
  
  const context = {
    event: SPEC_EVENT_CODES.SPEC_VALIDATION_SUCCESS,
    specId: document.id,
    specInfo: {
      openApiVersion: specInfo.version,
      title: specInfo.title,
      pathCount: specInfo.pathCount,
      schemaCount: specInfo.schemaCount,
    },
    validationInfo,
  };

  logger.info('規格驗證成功', context);
}

/**
 * 記錄規格驗證失敗事件
 */
export function logSpecValidationFailure(
  specId: string,
  error: Error,
  validationDetails?: {
    path?: string;
    validationErrors?: unknown[];
  }
): void {
  const context = {
    event: SPEC_EVENT_CODES.SPEC_VALIDATION_FAILURE,
    specId,
    error: {
      name: error.name,
      message: error.message,
      code: (error as unknown as { code?: number }).code,
    },
    validationDetails,
  };

  logger.error('規格驗證失敗', context);
}

/**
 * 記錄一般偵錯訊息
 */
export function logDebug(message: string, context?: Record<string, unknown>): void {
  logger.debug(message, context);
}

/**
 * 記錄一般資訊訊息
 */
export function logInfo(message: string, context?: Record<string, unknown>): void {
  logger.info(message, context);
}

/**
 * 記錄警告訊息
 */
export function logWarn(message: string, context?: Record<string, unknown>): void {
  logger.warn(message, context);
}

/**
 * 記錄錯誤訊息
 */
export function logError(message: string, context?: Record<string, unknown>): void {
  logger.error(message, context);
}