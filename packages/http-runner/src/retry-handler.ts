import { createStructuredLogger } from '@specpilot/shared';
import type { IRetryConfig, ICircuitBreakerConfig, CircuitBreakerState } from './types.js';

const logger = createStructuredLogger('retry-handler');

/**
 * 重試處理器，實作指數退避策略與斷路器機制
 */
export class RetryHandler {
  private readonly config: Required<IRetryConfig>;
  private circuitBreaker: CircuitBreaker;

  constructor(
    retryConfig: Partial<IRetryConfig> = {},
    circuitBreakerConfig: Partial<ICircuitBreakerConfig> = {}
  ) {
    this.config = {
      retries: 3,
      delay: 500,
      factor: 2,
      maxDelay: 10000,
      retryCondition: this.defaultRetryCondition,
      ...retryConfig,
    };

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 30000,
      monitoringPeriod: 60000,
      ...circuitBreakerConfig,
    });
  }

  /**
   * 執行帶重試的操作
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: { component: string; operation: string; executionId?: string }
  ): Promise<T> {
    const { component, operation: operationName, executionId } = context;

    // 檢查斷路器狀態
    if (!this.circuitBreaker.canExecute()) {
      const error = new Error('斷路器處於開啟狀態，拒絕執行請求');
      logger.error('斷路器拒絕執行', {
        component,
        operation: operationName,
        executionId,
        circuitBreakerState: this.circuitBreaker.getState(),
        event: 'CIRCUIT_BREAKER_OPEN',
      });
      throw error;
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retries + 1; attempt++) {
      try {
        logger.debug('開始執行操作', {
          component,
          operation: operationName,
          executionId,
          attempt,
          maxRetries: this.config.retries,
          event: 'RETRY_ATTEMPT',
        });

        const result = await operation();

        // 成功時重置斷路器
        this.circuitBreaker.recordSuccess();

        if (attempt > 1) {
          logger.info('重試成功', {
            component,
            operation: operationName,
            executionId,
            attempt,
            event: 'RETRY_SUCCESS',
          });
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 記錄失敗到斷路器
        this.circuitBreaker.recordFailure();

        const shouldRetry = attempt <= this.config.retries && this.config.retryCondition(error);

        logger.warn('操作執行失敗', {
          component,
          operation: operationName,
          executionId,
          attempt,
          maxRetries: this.config.retries,
          error: lastError.message,
          willRetry: shouldRetry,
          event: 'RETRY_ATTEMPT_FAILED',
        });

        if (!shouldRetry) {
          break;
        }

        // 計算退避延遲
        const delay = this.calculateDelay(attempt - 1);
        await this.sleep(delay);
      }
    }

    // 所有重試都失敗了
    logger.error('所有重試都失敗', {
      component,
      operation: operationName,
      executionId,
      totalAttempts: this.config.retries + 1,
      error: lastError?.message,
      event: 'RETRY_EXHAUSTED',
    });

    throw lastError || new Error('操作執行失敗');
  }

  /**
   * 計算指數退避延遲
   */
  private calculateDelay(attempt: number): number {
    const delay = this.config.delay * Math.pow(this.config.factor, attempt);
    return Math.min(delay, this.config.maxDelay);
  }

  /**
   * 預設重試條件
   */
  private defaultRetryCondition(error: Error | unknown): boolean {
    // 網路錯誤或伺服器錯誤（5xx）應該重試
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // HTTP 狀態碼重試條件
    if (error.response?.status) {
      const status = error.response.status;
      // 重試 5xx 錯誤和 429 (Too Many Requests)
      return status >= 500 || status === 429;
    }

    // 對於 HttpClient 回應的錯誤（非實際 axios 錯誤），不重試
    if (error.status && error.data) {
      return false;
    }

    return false;
  }

  /**
   * 處理 Retry-After header
   */
  private async handleRetryAfter(error: Error | unknown): Promise<void> {
    const retryAfter = error.response?.headers?.['retry-after'];
    if (!retryAfter) {
      return;
    }

    let delayMs: number;

    // Retry-After 可能是秒數或 HTTP 日期
    if (/^\d+$/.test(retryAfter)) {
      delayMs = parseInt(retryAfter, 10) * 1000;
    } else {
      const retryDate = new Date(retryAfter);
      delayMs = retryDate.getTime() - Date.now();
    }

    // 限制最大延遲時間
    delayMs = Math.min(Math.max(delayMs, 0), this.config.maxDelay);

    if (delayMs > 0) {
      logger.info('尊重 Retry-After header', {
        component: 'retry-handler',
        retryAfterValue: retryAfter,
        delayMs,
        event: 'RETRY_AFTER_RESPECTED',
      });
      await this.sleep(delayMs);
    }
  }

  /**
   * 睡眠函式
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 取得重試設定
   */
  getConfig(): Readonly<Required<IRetryConfig>> {
    return { ...this.config };
  }

  /**
   * 取得斷路器狀態
   */
  getCircuitBreakerInfo(): {
    state: CircuitBreakerState;
    failureCount: number;
    lastFailureTime?: Date;
  } {
    return this.circuitBreaker.getInfo();
  }

  /**
   * 重置斷路器
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
    logger.info('斷路器已重置', {
      component: 'retry-handler',
      event: 'CIRCUIT_BREAKER_RESET',
    });
  }
}

/**
 * 簡易斷路器實作
 */
class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime?: Date;
  private readonly config: ICircuitBreakerConfig;

  constructor(config: ICircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * 檢查是否可以執行操作
   */
  canExecute(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      const now = new Date();
      const timeSinceLastFailure = this.lastFailureTime
        ? now.getTime() - this.lastFailureTime.getTime()
        : 0;

      if (timeSinceLastFailure >= this.config.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        logger.info('斷路器進入半開狀態', {
          component: 'circuit-breaker',
          timeSinceLastFailure,
          event: 'CIRCUIT_BREAKER_HALF_OPEN',
        });
        return true;
      }

      return false;
    }

    // HALF_OPEN 狀態：允許一個測試請求
    return this.state === 'HALF_OPEN';
  }

  /**
   * 記錄成功
   */
  recordSuccess(): void {
    this.failureCount = 0;
    this.lastFailureTime = undefined;

    if (this.state !== 'CLOSED') {
      this.state = 'CLOSED';
      logger.info('斷路器關閉', {
        component: 'circuit-breaker',
        event: 'CIRCUIT_BREAKER_CLOSED',
      });
    }
  }

  /**
   * 記錄失敗
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      logger.warn('斷路器從半開狀態轉為開啟', {
        component: 'circuit-breaker',
        failureCount: this.failureCount,
        event: 'CIRCUIT_BREAKER_OPEN',
      });
    } else if (this.state === 'CLOSED' && this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
      logger.warn('斷路器開啟', {
        component: 'circuit-breaker',
        failureCount: this.failureCount,
        threshold: this.config.failureThreshold,
        event: 'CIRCUIT_BREAKER_OPEN',
      });
    }
  }

  /**
   * 取得斷路器狀態
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * 取得斷路器資訊
   */
  getInfo(): {
    state: CircuitBreakerState;
    failureCount: number;
    lastFailureTime?: Date;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  /**
   * 重置斷路器
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = undefined;
  }
}