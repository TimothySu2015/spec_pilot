import pino from 'pino';
import pinoMultistream from 'pino-multi-stream';
import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import path from 'path';
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import {
  StructuredLogEntry,
  RequestSummary,
  ResponseSummary,
  LogRotationConfig
} from './structured-log-types.js';
import { EVENT_CODES } from './index.js';

/**
 * 增強版結構化日誌介面
 */
export interface IEnhancedStructuredLogger {
  /**
   * 記錄步驟開始
   */
  logStepStart(stepName: string, context?: Record<string, unknown>): void;

  /**
   * 記錄步驟完成
   */
  logStepComplete(stepName: string, duration: number, context?: Record<string, unknown>): void;

  /**
   * 記錄步驟失敗
   */
  logStepFailure(stepName: string, duration: number, error: string, context?: Record<string, unknown>): void;

  /**
   * 記錄 HTTP 請求發送
   */
  logRequestSent(stepName: string, request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: unknown;
  }): void;

  /**
   * 記錄 HTTP 回應接收
   */
  logResponseReceived(stepName: string, response: {
    statusCode: number;
    validationResults: string[];
    errorMessage?: string;
  }): void;

  /**
   * 記錄一般訊息
   */
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;

  /**
   * 建立子 Logger
   */
  child(bindings: Record<string, unknown>): IEnhancedStructuredLogger;
}

/**
 * 預設日誌輪替配置
 */
const DEFAULT_ROTATION_CONFIG: LogRotationConfig = {
  maxFileSize: '10MB',
  maxFiles: 10,
  datePattern: 'YYYY-MM-DD',
  compress: true,
  archiveAfterDays: 3,
};

/**
 * 增強版結構化 Logger 實作
 */
export class EnhancedStructuredLogger implements IEnhancedStructuredLogger {
  private logger: pino.Logger;
  private currentExecutionId: string;
  private component: string;
  private rotationConfig: LogRotationConfig;

  constructor(
    component: string,
    executionId?: string,
    rotationConfig: Partial<LogRotationConfig> = {}
  ) {
    this.component = component;
    this.currentExecutionId = executionId || randomUUID();
    this.rotationConfig = { ...DEFAULT_ROTATION_CONFIG, ...rotationConfig };

    // 建立日誌目錄
    const logDir = path.resolve(process.cwd(), 'logs');
    this.ensureDirectoryExists(logDir);

    // 檢查並執行日誌輪替
    this.rotateLogsIfNeeded(logDir);

    // 建立 pino logger
    this.logger = this.createPinoLogger(logDir);
  }

  /**
   * 確保目錄存在
   */
  private ensureDirectoryExists(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 檢查並執行日誌輪替
   */
  private rotateLogsIfNeeded(logDir: string): void {
    const currentLogFile = path.join(logDir, 'specpilot.log');

    if (!existsSync(currentLogFile)) {
      return;
    }

    const stats = statSync(currentLogFile);
    const maxSizeBytes = this.parseFileSize(this.rotationConfig.maxFileSize);

    if (stats.size > maxSizeBytes) {
      this.performLogRotation(logDir);
    }

    // 清理過期檔案
    this.cleanupOldLogs(logDir);
  }

  /**
   * 解析檔案大小字串
   */
  private parseFileSize(sizeStr: string): number {
    const units: { [key: string]: number } = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
    };

    const match = sizeStr.match(/^(\d+)([A-Z]+)$/);
    if (!match) {
      throw new Error(`Invalid file size format: ${sizeStr}`);
    }

    const [, size, unit] = match;
    return parseInt(size, 10) * (units[unit] || 1);
  }

  /**
   * 執行日誌輪替
   */
  private performLogRotation(logDir: string): void {
    const today = new Date().toISOString().split('T')[0];
    const currentLogFile = path.join(logDir, 'specpilot.log');

    // 找到下一個可用的索引
    let index = 1;
    let rotatedFile: string;

    do {
      rotatedFile = path.join(logDir, `specpilot-${today}-${index}.log`);
      index++;
    } while (existsSync(rotatedFile));

    // 重新命名當前日誌檔案
    const fs = require('fs');
    fs.renameSync(currentLogFile, rotatedFile);

    // 記錄輪替事件
    this.logRotationEvent(rotatedFile);
  }

  /**
   * 清理過期日誌檔案
   */
  private cleanupOldLogs(logDir: string): void {
    const files = readdirSync(logDir).filter(file =>
      file.startsWith('specpilot-') && file.endsWith('.log')
    );

    // 按修改時間排序，保留最新的檔案
    const sortedFiles = files
      .map(file => ({
        name: file,
        path: path.join(logDir, file),
        mtime: statSync(path.join(logDir, file)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    // 刪除超過保留數量的檔案
    if (sortedFiles.length > this.rotationConfig.maxFiles) {
      const filesToDelete = sortedFiles.slice(this.rotationConfig.maxFiles);
      filesToDelete.forEach(file => {
        unlinkSync(file.path);
      });
    }
  }

  /**
   * 記錄日誌輪替事件
   */
  private logRotationEvent(rotatedFile: string): void {
    // 建立一個臨時 logger 來記錄輪替事件
    const tempLogger = pino({
      level: 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
    }, createWriteStream(path.join(path.dirname(rotatedFile), 'specpilot.log'), { flags: 'a' }));

    tempLogger.info({
      executionId: this.currentExecutionId,
      component: this.component,
      event: EVENT_CODES.LOG_ROTATED,
      message: '日誌檔案輪替完成',
      rotatedFile,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 建立 pino logger
   */
  private createPinoLogger(logDir: string): pino.Logger {
    const streams = [
      // 主控台輸出
      {
        stream: process.env.NODE_ENV === 'development'
          ? pino.destination({ sync: true, dest: 1 })
          : process.stdout
      },
      // 檔案輸出
      {
        stream: pino.destination({
          dest: path.join(logDir, 'specpilot.log'),
          sync: true,
          mkdir: true,
        })
      }
    ];

    return pino(
      {
        level: process.env.LOG_LEVEL || 'info',
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
          level: (level) => ({ level }),
        },
        base: {
          pid: process.pid,
          hostname: undefined,
        },
      },
      pinoMultistream.multistream(streams)
    );
  }

  /**
   * 計算資料雜湊值
   */
  private calculateHash(data: unknown): string {
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
    const hash = createHash('sha256').update(jsonString).digest('hex');
    return `sha256:${hash}`;
  }

  /**
   * 遮罩敏感資料
   */
  private maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
    const masked = { ...data };

    // 敏感關鍵字模式（支援正則表達式）
    const sensitivePatterns = [
      /token/i,
      /password/i,
      /secret/i,
      /key/i,
      /authorization/i,
      /auth/i,
      /credential/i,
      /session/i,
      /cookie/i,
      /bearer/i,
      /jwt/i,
      /api[-_]?key/i,
      /access[-_]?token/i,
      /refresh[-_]?token/i
    ];

    for (const key in masked) {
      const shouldMask = sensitivePatterns.some(pattern => pattern.test(key));

      if (shouldMask) {
        const value = masked[key];
        if (typeof value === 'string' && value.length > 0) {
          // 保留前後字元，中間用星號
          if (value.length <= 6) {
            masked[key] = '***';
          } else {
            const start = value.substring(0, 2);
            const end = value.substring(value.length - 2);
            const middle = '*'.repeat(Math.max(3, value.length - 4));
            masked[key] = `${start}${middle}${end}`;
          }
        } else {
          masked[key] = '***';
        }
      }
    }

    return masked;
  }

  /**
   * 建立結構化日誌項目
   */
  private createLogEntry(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    event: string,
    options: {
      stepName?: string;
      duration?: number;
      requestSummary?: RequestSummary;
      responseSummary?: ResponseSummary;
      context?: Record<string, unknown>;
    } = {}
  ): StructuredLogEntry {
    const { stepName, duration, requestSummary, responseSummary, context } = options;

    return {
      timestamp: new Date().toISOString(),
      level,
      executionId: this.currentExecutionId,
      component: this.component,
      event,
      message,
      stepName,
      duration,
      requestSummary,
      responseSummary,
      details: context ? this.maskSensitiveData(context) : undefined,
    };
  }

  // 實作介面方法

  logStepStart(stepName: string, context?: Record<string, unknown>): void {
    const logEntry = this.createLogEntry('info', `步驟開始：${stepName}`, EVENT_CODES.STEP_START, {
      stepName,
      context,
    });
    this.logger.info(logEntry);
  }

  logStepComplete(stepName: string, duration: number, context?: Record<string, unknown>): void {
    const logEntry = this.createLogEntry('info', `步驟完成：${stepName}`, EVENT_CODES.STEP_COMPLETE, {
      stepName,
      duration,
      context,
    });
    this.logger.info(logEntry);
  }

  logStepFailure(stepName: string, duration: number, error: string, context?: Record<string, unknown>): void {
    const logEntry = this.createLogEntry('error', `步驟失敗：${stepName} - ${error}`, EVENT_CODES.STEP_FAILURE, {
      stepName,
      duration,
      context: { ...context, error },
    });
    this.logger.error(logEntry);
  }

  logRequestSent(stepName: string, request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: unknown;
  }): void {
    const requestSummary: RequestSummary = {
      method: request.method,
      url: request.url,
      headerHash: this.calculateHash(request.headers),
      bodyHash: this.calculateHash(request.body),
    };

    const logEntry = this.createLogEntry('info', `HTTP 請求發送：${request.method} ${request.url}`, EVENT_CODES.REQUEST_SENT, {
      stepName,
      requestSummary,
    });
    this.logger.info(logEntry);
  }

  logResponseReceived(stepName: string, response: {
    statusCode: number;
    validationResults: string[];
    errorMessage?: string;
  }): void {
    const responseSummary: ResponseSummary = {
      statusCode: response.statusCode,
      validationResults: response.validationResults,
      errorMessage: response.errorMessage,
    };

    const logEntry = this.createLogEntry('info', `HTTP 回應接收：${response.statusCode}`, EVENT_CODES.RESPONSE_RECEIVED, {
      stepName,
      responseSummary,
    });
    this.logger.info(logEntry);
  }

  info(message: string, context?: Record<string, unknown>): void {
    const logEntry = this.createLogEntry('info', message, 'INFO', { context });
    this.logger.info(logEntry);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    const logEntry = this.createLogEntry('warn', message, 'WARN', { context });
    this.logger.warn(logEntry);
  }

  error(message: string, context?: Record<string, unknown>): void {
    const logEntry = this.createLogEntry('error', message, 'ERROR', { context });
    this.logger.error(logEntry);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    const logEntry = this.createLogEntry('debug', message, 'DEBUG', { context });
    this.logger.debug(logEntry);
  }

  child(bindings: Record<string, unknown>): IEnhancedStructuredLogger {
    return new EnhancedStructuredLogger(
      this.component,
      this.currentExecutionId,
      this.rotationConfig
    );
  }
}

/**
 * 建立增強版結構化 Logger
 */
export function createEnhancedStructuredLogger(
  component: string,
  executionId?: string,
  rotationConfig?: Partial<LogRotationConfig>
): IEnhancedStructuredLogger {
  return new EnhancedStructuredLogger(component, executionId, rotationConfig);
}