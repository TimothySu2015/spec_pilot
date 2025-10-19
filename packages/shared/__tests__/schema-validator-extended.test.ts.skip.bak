import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaValidator } from '../src/schema-validator.js';

describe('SchemaValidator', () => {
  let validator: SchemaValidator;

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  it('應該建立 SchemaValidator 實例', () => {
    expect(validator).toBeDefined();
  });

  it('應該取得所有 Schema', () => {
    const schemas = validator.getAllSchemas();
    expect(schemas).toBeDefined();
    expect(schemas.executionReport).toBeDefined();
    expect(schemas.structuredLog).toBeDefined();
  });

  it('應該驗證有效的日誌項目', () => {
    const validLogEntry = {
      timestamp: '2025-09-28T10:00:00.000Z',
      level: 'info',
      executionId: 'test-exec-id',
      component: 'test-component',
      event: 'TEST_EVENT',
      message: 'Test message'
    };

    const result = validator.validateLogEntry(validLogEntry);
    expect(result).toEqual(validLogEntry);
  });

  it('應該驗證日誌項目陣列', () => {
    const logEntries = [
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

    const result = validator.validateLogEntries(logEntries);
    expect(result).toEqual(logEntries);
  });

  it('應該處理無效的日誌項目', () => {
    const invalidLogEntry = {
      // 缺少必要欄位
      level: 'info',
      message: 'Test message'
    };

    expect(() => {
      validator.validateLogEntry(invalidLogEntry);
    }).toThrow();
  });

  it('應該產生驗證報告', () => {
    const reportValidation = { valid: true, errors: [] };
    const logValidation = { validCount: 5, invalidCount: 0, errors: [] };

    const report = validator.generateValidationReport(reportValidation, logValidation);

    expect(report).toBeDefined();
    expect(report.summary).toBeDefined();
    expect(report.summary.reportValid).toBe(true);
    expect(report.summary.logEntriesValid).toBe(5);
    expect(report.summary.overallValid).toBe(true);
    expect(report.details).toBeDefined();
  });

  it('應該處理驗證失敗的情況', () => {
    const reportValidation = { valid: false, errors: ['Report error'] };
    const logValidation = { validCount: 3, invalidCount: 2, errors: ['Log error'] };

    const report = validator.generateValidationReport(reportValidation, logValidation);

    expect(report.summary.reportValid).toBe(false);
    expect(report.summary.logEntriesInvalid).toBe(2);
    expect(report.summary.overallValid).toBe(false);
    expect(report.details.reportErrors).toEqual(['Report error']);
    expect(report.details.logErrors).toEqual(['Log error']);
  });
});