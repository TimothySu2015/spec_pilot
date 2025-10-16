import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AsyncLogWriter } from '../src/async-log-writer.js';
import type { StructuredLogEntry } from '../src/structured-log-types.js';

describe('AsyncLogWriter', () => {
  let logWriter: AsyncLogWriter;
  let mockEntry: StructuredLogEntry;

  beforeEach(() => {
    logWriter = new AsyncLogWriter({
      batchSize: 2,
      flushInterval: 100,
      maxWaitTime: 500
    });

    mockEntry = {
      timestamp: '2025-09-28T10:00:00.000Z',
      level: 'info',
      executionId: 'test-exec-id',
      component: 'test-component',
      event: 'TEST_EVENT',
      message: 'Test message'
    };
  });

  afterEach(async () => {
    if (logWriter) {
      await logWriter.shutdown();
    }
  });

  it('應該建立 AsyncLogWriter 實例', () => {
    expect(logWriter).toBeDefined();
    expect(logWriter.writeLog).toBeDefined();
  });

  it('應該接受日誌寫入任務', () => {
    const result = logWriter.writeLog(mockEntry, '/test/path/log.txt');
    expect(result).toBeDefined();
  });

  it('應該處理批次配置', () => {
    const customLogWriter = new AsyncLogWriter({
      batchSize: 5,
      flushInterval: 200
    });

    expect(customLogWriter).toBeDefined();
    customLogWriter.shutdown();
  });

  it('應該處理空批次配置', () => {
    const defaultLogWriter = new AsyncLogWriter();
    expect(defaultLogWriter).toBeDefined();
    defaultLogWriter.shutdown();
  });

  it('應該觸發事件', (done) => {
    logWriter.on('batchProcessed', (data) => {
      expect(data).toBeDefined();
      done();
    });

    // 觸發批次處理
    logWriter.writeLog(mockEntry, '/test/path/log1.txt');
    logWriter.writeLog(mockEntry, '/test/path/log2.txt');
  });

  it('應該處理關閉操作', async () => {
    const shutdownPromise = logWriter.shutdown();
    expect(shutdownPromise).toBeInstanceOf(Promise);
    await shutdownPromise;
  });
});