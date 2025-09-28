import { describe, it, expect, beforeEach } from 'vitest';
import { LogValidator } from '../src/log-validator.js';

describe('LogValidator', () => {
  let validator: LogValidator;

  beforeEach(() => {
    validator = new LogValidator();
  });

  it('應該建立 LogValidator 實例', () => {
    expect(validator).toBeDefined();
  });

  it('應該驗證有效的日誌級別', () => {
    expect(validator.validateLogLevel('debug')).toBe(true);
    expect(validator.validateLogLevel('info')).toBe(true);
    expect(validator.validateLogLevel('warn')).toBe(true);
    expect(validator.validateLogLevel('error')).toBe(true);
  });

  it('應該拒絕無效的日誌級別', () => {
    expect(validator.validateLogLevel('invalid')).toBe(false);
    expect(validator.validateLogLevel('trace')).toBe(false);
    expect(validator.validateLogLevel('fatal')).toBe(false);
  });

  it('應該驗證有效的日誌項目', () => {
    const validEntry = {
      timestamp: '2025-09-28T10:00:00.000Z',
      level: 'info',
      executionId: 'test-exec-id',
      component: 'test-component',
      event: 'TEST_EVENT',
      message: 'Test message'
    };

    const result = validator.validateLogEntry(validEntry);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('應該檢測缺少必要欄位的日誌項目', () => {
    const invalidEntry = {
      level: 'info',
      message: 'Test message'
      // 缺少 timestamp, executionId, component, event
    };

    const result = validator.validateLogEntry(invalidEntry);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('應該檢測無效的日誌級別', () => {
    const invalidEntry = {
      timestamp: '2025-09-28T10:00:00.000Z',
      level: 'invalid',
      executionId: 'test-exec-id',
      component: 'test-component',
      event: 'TEST_EVENT',
      message: 'Test message'
    };

    const result = validator.validateLogEntry(invalidEntry);
    expect(result.valid).toBe(false);
    expect(result.errors.some(error => error.message.includes('level'))).toBe(true);
  });

  it('應該驗證日誌項目陣列', () => {
    const entries = [
      {
        timestamp: '2025-09-28T10:00:00.000Z',
        level: 'info',
        executionId: 'test-exec-id',
        component: 'test-component',
        event: 'TEST_EVENT',
        message: 'Test message 1'
      },
      {
        timestamp: '2025-09-28T10:01:00.000Z',
        level: 'warn',
        executionId: 'test-exec-id',
        component: 'test-component',
        event: 'TEST_EVENT',
        message: 'Test message 2'
      }
    ];

    const result = validator.validateLogEntries(entries);
    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it('應該處理混合的有效/無效日誌項目', () => {
    const entries = [
      {
        timestamp: '2025-09-28T10:00:00.000Z',
        level: 'info',
        executionId: 'test-exec-id',
        component: 'test-component',
        event: 'TEST_EVENT',
        message: 'Valid message'
      },
      {
        level: 'info',
        message: 'Invalid message'
        // 缺少必要欄位
      }
    ];

    const result = validator.validateLogEntries(entries);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('應該驗證並斷言有效的日誌項目', () => {
    const validEntry = {
      timestamp: '2025-09-28T10:00:00.000Z',
      level: 'info',
      executionId: 'test-exec-id',
      component: 'test-component',
      event: 'TEST_EVENT',
      message: 'Test message'
    };

    const result = validator.validateAndAssertLogEntry(validEntry);
    expect(result).toEqual(validEntry);
  });

  it('應該在斷言失敗時拋出錯誤', () => {
    const invalidEntry = {
      level: 'info',
      message: 'Test message'
      // 缺少必要欄位
    };

    expect(() => {
      validator.validateAndAssertLogEntry(invalidEntry);
    }).toThrow();
  });
});