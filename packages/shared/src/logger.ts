import pino from 'pino';
import pinoMultistream from 'pino-multi-stream';
import { randomUUID } from 'crypto';
import path from 'path';

/**
 * 結構化日誌介面
 */
export interface StructuredLogger {
  /**
   * 記錄偵錯訊息
   */
  debug(message: string, context?: Record<string, unknown>): void;
  
  /**
   * 記錄資訊訊息
   */
  info(message: string, context?: Record<string, unknown>): void;
  
  /**
   * 記錄警告訊息
   */
  warn(message: string, context?: Record<string, unknown>): void;
  
  /**
   * 記錄錯誤訊息
   */
  error(message: string, context?: Record<string, unknown>): void;
  
  /**
   * 建立子 Logger，繼承執行 ID 與元件資訊
   */
  child(bindings: Record<string, unknown>): StructuredLogger;
}

/**
 * 全域執行 ID 追蹤
 */
let currentExecutionId = randomUUID();

/**
 * 設定執行 ID
 */
export function setExecutionId(executionId: string): void {
  currentExecutionId = executionId;
}

/**
 * 取得目前執行 ID
 */
export function getExecutionId(): string {
  return currentExecutionId;
}

/**
 * 重置執行 ID（產生新的 UUID）
 */
export function resetExecutionId(): void {
  currentExecutionId = randomUUID();
}

/**
 * 敏感資料遮罩函式
 */
function maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...data };
  const sensitiveKeys = ['token', 'password', 'secret', 'key', 'authorization'];
  
  for (const key in masked) {
    if (sensitiveKeys.some(sensitiveKey => 
      key.toLowerCase().includes(sensitiveKey.toLowerCase())
    )) {
      masked[key] = '***';
    }
  }
  
  return masked;
}

/**
 * 建立結構化 Logger
 */
export function createStructuredLogger(component: string): StructuredLogger {
  // 確保 logs 目錄存在
  const logDir = path.resolve(process.cwd(), 'logs');
  
  const streams = [
    // 主控台輸出（開發時使用 pretty format）
    {
      stream: process.env.NODE_ENV === 'development' 
        ? pino.destination({ 
            sync: true, // Use sync mode to avoid sonic boom issues
            dest: 1, // stdout
          })
        : process.stdout
    },
    // 檔案輸出（JSON Lines 格式）
    {
      stream: pino.destination({
        dest: path.join(logDir, 'specpilot.log'),
        sync: true, // Use sync mode to avoid sonic boom issues  
        mkdir: true,
      })
    }
  ];

  const logger = pino(
    {
      level: process.env.LOG_LEVEL || 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (level) => {
          return { level };
        },
      },
      base: {
        pid: process.pid,
        hostname: undefined, // 移除 hostname 以減少 log 大小
      },
    },
    pinoMultistream.multistream(streams)
  );

  return {
    debug(message: string, context?: Record<string, unknown>): void {
      const logContext = context ? maskSensitiveData(context) : {};
      logger.debug({
        executionId: currentExecutionId,
        component,
        message,
        context: logContext,
        timestamp: new Date().toISOString(),
      });
    },

    info(message: string, context?: Record<string, unknown>): void {
      const logContext = context ? maskSensitiveData(context) : {};
      logger.info({
        executionId: currentExecutionId,
        component,
        message,
        context: logContext,
        timestamp: new Date().toISOString(),
      });
    },

    warn(message: string, context?: Record<string, unknown>): void {
      const logContext = context ? maskSensitiveData(context) : {};
      logger.warn({
        executionId: currentExecutionId,
        component,
        message,
        context: logContext,
        timestamp: new Date().toISOString(),
      });
    },

    error(message: string, context?: Record<string, unknown>): void {
      const logContext = context ? maskSensitiveData(context) : {};
      logger.error({
        executionId: currentExecutionId,
        component,
        message,
        context: logContext,
        timestamp: new Date().toISOString(),
      });
    },

    child(bindings: Record<string, unknown>): StructuredLogger {
      const childLogger = logger.child(maskSensitiveData(bindings));
      
      return {
        debug: (message: string, context?: Record<string, unknown>): void => {
          const logContext = context ? maskSensitiveData(context) : {};
          childLogger.debug({
            executionId: currentExecutionId,
            component,
            message,
            context: logContext,
            timestamp: new Date().toISOString(),
          });
        },
        info: (message: string, context?: Record<string, unknown>): void => {
          const logContext = context ? maskSensitiveData(context) : {};
          childLogger.info({
            executionId: currentExecutionId,
            component,
            message,
            context: logContext,
            timestamp: new Date().toISOString(),
          });
        },
        warn: (message: string, context?: Record<string, unknown>): void => {
          const logContext = context ? maskSensitiveData(context) : {};
          childLogger.warn({
            executionId: currentExecutionId,
            component,
            message,
            context: logContext,
            timestamp: new Date().toISOString(),
          });
        },
        error: (message: string, context?: Record<string, unknown>): void => {
          const logContext = context ? maskSensitiveData(context) : {};
          childLogger.error({
            executionId: currentExecutionId,
            component,
            message,
            context: logContext,
            timestamp: new Date().toISOString(),
          });
        },
        child: (childBindings: Record<string, unknown>): StructuredLogger => childLogger.child(maskSensitiveData(childBindings)) as StructuredLogger,
      };
    },
  };
}