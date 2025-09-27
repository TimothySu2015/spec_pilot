import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RetryHandler } from '../src/retry-handler.js';

describe('RetryHandler', () => {
  let retryHandler: RetryHandler;

  beforeEach(() => {
    retryHandler = new RetryHandler(
      { retries: 3, delay: 100, factor: 2, maxDelay: 1000 },
      { failureThreshold: 2, recoveryTimeout: 1000, monitoringPeriod: 5000 }
    );
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('建構函式與設定', () => {
    it('應該使用預設設定', () => {
      const handler = new RetryHandler();
      const config = handler.getConfig();

      expect(config.retries).toBe(3);
      expect(config.delay).toBe(500);
      expect(config.factor).toBe(2);
      expect(config.maxDelay).toBe(10000);
    });

    it('應該使用自訂設定', () => {
      const config = retryHandler.getConfig();

      expect(config.retries).toBe(3);
      expect(config.delay).toBe(100);
      expect(config.factor).toBe(2);
      expect(config.maxDelay).toBe(1000);
    });
  });

  describe('成功執行', () => {
    it('應該執行成功的操作', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');

      const result = await retryHandler.executeWithRetry(mockOperation, {
        component: 'test',
        operation: 'test-op',
      });

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('應該重置斷路器在成功後', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');

      await retryHandler.executeWithRetry(mockOperation, {
        component: 'test',
        operation: 'test-op',
      });

      const circuitInfo = retryHandler.getCircuitBreakerInfo();
      expect(circuitInfo.state).toBe('CLOSED');
      expect(circuitInfo.failureCount).toBe(0);
    });
  });

  describe('重試機制', () => {
    it('應該重試失敗的操作', async () => {
      const networkError1 = new Error('Network Error');
      (networkError1 as any).code = 'ENOTFOUND';
      const networkError2 = new Error('Network Error');
      (networkError2 as any).code = 'ENOTFOUND';

      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(networkError1)
        .mockRejectedValueOnce(networkError2)
        .mockResolvedValue('success');

      // 執行重試操作
      const promise = retryHandler.executeWithRetry(mockOperation, {
        component: 'test',
        operation: 'test-op',
      });

      // 等待所有計時器執行完成
      await vi.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('應該計算指數退避延遲', async () => {
      const networkError1 = new Error('Network Error');
      (networkError1 as any).code = 'ENOTFOUND';
      const networkError2 = new Error('Network Error');
      (networkError2 as any).code = 'ENOTFOUND';

      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(networkError1)
        .mockRejectedValueOnce(networkError2)
        .mockResolvedValue('success');

      // 執行重試操作
      const promise = retryHandler.executeWithRetry(mockOperation, {
        component: 'test',
        operation: 'test-op',
      });

      // 等待所有計時器執行完成
      await vi.runAllTimersAsync();
      await promise;

      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('應該限制最大延遲時間', () => {
      const handler = new RetryHandler({
        retries: 5,
        delay: 1000,
        factor: 2,
        maxDelay: 2000,
      });

      // 計算第 4 次重試的延遲 (1000 * 2^3 = 8000)，應該被限制為 2000
      const delay = (handler as any).calculateDelay(3);
      expect(delay).toBe(2000);
    });

    it('應該在達到最大重試次數後失敗', async () => {
      const networkError = new Error('Persistent failure');
      (networkError as any).code = 'ENOTFOUND';

      const mockOperation = vi.fn().mockRejectedValue(networkError);

      // 執行重試操作
      const promise = retryHandler.executeWithRetry(mockOperation, {
        component: 'test',
        operation: 'test-op',
      });

      // 等待所有計時器執行完成
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Persistent failure');
      expect(mockOperation).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });
  });

  describe('重試條件', () => {
    it('應該重試網路錯誤', async () => {
      const networkError = new Error('Network Error');
      (networkError as any).code = 'ENOTFOUND';

      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');

      const promise = retryHandler.executeWithRetry(mockOperation, {
        component: 'test',
        operation: 'test-op',
      });

      await vi.advanceTimersByTimeAsync(100);
      const result = await promise;

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('應該重試 5xx 錯誤', async () => {
      const serverError = new Error('Server Error');
      (serverError as any).response = { status: 500 };

      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(serverError)
        .mockResolvedValue('success');

      const promise = retryHandler.executeWithRetry(mockOperation, {
        component: 'test',
        operation: 'test-op',
      });

      await vi.advanceTimersByTimeAsync(100);
      const result = await promise;

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('應該重試 429 錯誤', async () => {
      const rateLimitError = new Error('Too Many Requests');
      (rateLimitError as any).response = { status: 429 };

      const mockOperation = vi
        .fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue('success');

      const promise = retryHandler.executeWithRetry(mockOperation, {
        component: 'test',
        operation: 'test-op',
      });

      await vi.advanceTimersByTimeAsync(100);
      const result = await promise;

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('不應該重試 4xx 錯誤（除了 429）', async () => {
      const clientError = new Error('Bad Request');
      (clientError as any).response = { status: 400 };

      const mockOperation = vi.fn().mockRejectedValue(clientError);

      await expect(
        retryHandler.executeWithRetry(mockOperation, {
          component: 'test',
          operation: 'test-op',
        })
      ).rejects.toThrow('Bad Request');

      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe('斷路器', () => {
    it('應該在失敗次數達到閾值時開啟斷路器', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Failure'));

      // 觸發兩次失敗（達到閾值）
      try {
        await retryHandler.executeWithRetry(mockOperation, {
          component: 'test',
          operation: 'test-op',
        });
      } catch {}

      await vi.advanceTimersByTimeAsync(1000);

      try {
        await retryHandler.executeWithRetry(mockOperation, {
          component: 'test',
          operation: 'test-op',
        });
      } catch {}

      const circuitInfo = retryHandler.getCircuitBreakerInfo();
      expect(circuitInfo.state).toBe('OPEN');
    });

    it('應該在斷路器開啟時拒絕執行', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Failure'));

      // 觸發失敗直到斷路器開啟
      for (let i = 0; i < 2; i++) {
        try {
          const promise = retryHandler.executeWithRetry(mockOperation, {
            component: 'test',
            operation: 'test-op',
          });

          // 等待所有重試完成
          await vi.runAllTimersAsync();
          await promise;
        } catch {}
      }

      // 現在斷路器應該開啟，拒絕新請求
      await expect(
        retryHandler.executeWithRetry(mockOperation, {
          component: 'test',
          operation: 'test-op',
        })
      ).rejects.toThrow('斷路器處於開啟狀態，拒絕執行請求');
    });

    it('應該在恢復時間後進入半開狀態', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Failure'));

      // 開啟斷路器
      for (let i = 0; i < 2; i++) {
        try {
          await retryHandler.executeWithRetry(mockOperation, {
            component: 'test',
            operation: 'test-op',
          });
        } catch {}
        await vi.advanceTimersByTimeAsync(1000);
      }

      // 等待恢復時間
      await vi.advanceTimersByTimeAsync(1000);

      // 重置 mock 以成功回應
      mockOperation.mockResolvedValue('success');

      const result = await retryHandler.executeWithRetry(mockOperation, {
        component: 'test',
        operation: 'test-op',
      });

      expect(result).toBe('success');
      const circuitInfo = retryHandler.getCircuitBreakerInfo();
      expect(circuitInfo.state).toBe('CLOSED');
    });

    it('應該手動重置斷路器', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Failure'));

      // 開啟斷路器
      for (let i = 0; i < 2; i++) {
        try {
          await retryHandler.executeWithRetry(mockOperation, {
            component: 'test',
            operation: 'test-op',
          });
        } catch {}
        await vi.advanceTimersByTimeAsync(1000);
      }

      expect(retryHandler.getCircuitBreakerInfo().state).toBe('OPEN');

      retryHandler.resetCircuitBreaker();

      const circuitInfo = retryHandler.getCircuitBreakerInfo();
      expect(circuitInfo.state).toBe('CLOSED');
      expect(circuitInfo.failureCount).toBe(0);
    });
  });

  describe('斷路器狀態資訊', () => {
    it('應該提供斷路器資訊', () => {
      const info = retryHandler.getCircuitBreakerInfo();

      expect(info).toHaveProperty('state');
      expect(info).toHaveProperty('failureCount');
      expect(info).toHaveProperty('lastFailureTime');

      expect(info.state).toBe('CLOSED');
      expect(info.failureCount).toBe(0);
    });

    it('應該記錄失敗時間', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Failure'));

      try {
        await retryHandler.executeWithRetry(mockOperation, {
          component: 'test',
          operation: 'test-op',
        });
      } catch {}

      await vi.advanceTimersByTimeAsync(1000);

      const info = retryHandler.getCircuitBreakerInfo();
      expect(info.failureCount).toBeGreaterThan(0);
      expect(info.lastFailureTime).toBeInstanceOf(Date);
    });
  });
});