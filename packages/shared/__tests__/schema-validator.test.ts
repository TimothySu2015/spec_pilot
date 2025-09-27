import { describe, test, expect, beforeEach } from 'vitest';
import { SchemaValidator } from '../src/schema-validator.js';
import type { ExecutionReport } from '@specpilot/reporting';
import type { StructuredLogEntry } from '../src/structured-log-types.js';

describe('SchemaValidator', () => {
  let schemaValidator: SchemaValidator;

  beforeEach(() => {
    schemaValidator = new SchemaValidator();
  });

  describe('執行報表驗證', () => {
    test('應該驗證有效的執行報表', () => {
      const validReport: ExecutionReport = {
        executionId: '550e8400-e29b-41d4-a716-446655440000',
        flowId: 'test-flow',
        startTime: '2025-09-27T10:30:00.000Z',
        endTime: '2025-09-27T10:30:15.234Z',
        duration: 15234,
        status: 'success',
        summary: {
          totalSteps: 1,
          successfulSteps: 1,
          failedSteps: 0,
          skippedSteps: 0
        },
        steps: [
          {
            name: 'test_step',
            status: 'success',
            startTime: '2025-09-27T10:30:00.100Z',
            duration: 1200,
            request: {
              method: 'GET',
              url: 'https://api.example.com/test',
              headerHash: 'sha256:' + 'a'.repeat(64),
              bodyHash: 'sha256:' + 'b'.repeat(64)
            },
            response: {
              statusCode: 200,
              success: true,
              validationResults: ['status_check_passed'],
              errorMessage: null
            }
          }
        ],
        config: {
          baseUrl: 'https://api.example.com',
          fallbackUsed: false,
          authNamespaces: ['default']
        }
      };

      expect(() => {
        const result = schemaValidator.validateExecutionReport(validReport);
        expect(result).toEqual(validReport);
      }).not.toThrow();
    });

    test('應該拋出錯誤對於無效的執行報表', () => {
      const invalidReport = {
        executionId: 'invalid-uuid',
        flowId: 'test-flow'
        // 缺少必需欄位
      };

      expect(() => {
        schemaValidator.validateExecutionReport(invalidReport);
      }).toThrow(/報表格式驗證失敗/);
    });

    test('應該驗證報表檔案內容', () => {
      const validReportJson = JSON.stringify({
        executionId: '550e8400-e29b-41d4-a716-446655440000',
        flowId: 'test-flow',
        startTime: '2025-09-27T10:30:00.000Z',
        endTime: '2025-09-27T10:30:15.234Z',
        duration: 15234,
        status: 'success',
        summary: {
          totalSteps: 0,
          successfulSteps: 0,
          failedSteps: 0,
          skippedSteps: 0
        },
        steps: [],
        config: {
          baseUrl: 'https://api.example.com',
          fallbackUsed: false,
          authNamespaces: []
        }
      });

      expect(() => {
        const result = schemaValidator.validateReportFile(validReportJson);
        expect(result.executionId).toBe('550e8400-e29b-41d4-a716-446655440000');
      }).not.toThrow();
    });

    test('應該處理無效的 JSON 格式', () => {
      const invalidJson = '{ invalid json }';

      expect(() => {
        schemaValidator.validateReportFile(invalidJson);
      }).toThrow(/JSON 解析失敗/);
    });
  });

  describe('結構化日誌驗證', () => {
    test('應該驗證有效的日誌項目', () => {
      const validLogEntry: StructuredLogEntry = {
        timestamp: '2025-09-27T10:30:00.000Z',
        level: 'info',
        executionId: '550e8400-e29b-41d4-a716-446655440000',
        component: 'test-component',
        event: 'TEST_EVENT',
        message: 'Test message'
      };

      expect(() => {
        const result = schemaValidator.validateStructuredLogEntry(validLogEntry);
        expect(result).toEqual(validLogEntry);
      }).not.toThrow();
    });

    test('應該驗證包含請求回應摘要的日誌項目', () => {
      const validLogEntry: StructuredLogEntry = {
        timestamp: '2025-09-27T10:30:00.000Z',
        level: 'info',
        executionId: '550e8400-e29b-41d4-a716-446655440000',
        component: 'http-runner',
        event: 'REQUEST_SENT',
        message: 'HTTP request sent',
        stepName: 'login_step',
        requestSummary: {
          method: 'POST',
          url: 'https://api.example.com/auth/login',
          headerHash: 'sha256:' + 'a'.repeat(64),
          bodyHash: 'sha256:' + 'b'.repeat(64)
        },
        responseSummary: {
          statusCode: 200,
          validationResults: ['schema_valid']
        }
      };

      expect(() => {
        const result = schemaValidator.validateStructuredLogEntry(validLogEntry);
        expect(result).toEqual(validLogEntry);
      }).not.toThrow();
    });

    test('應該拋出錯誤對於無效的日誌項目', () => {
      const invalidLogEntry = {
        timestamp: 'invalid-date',
        level: 'invalid-level',
        message: 'Test message'
        // 缺少必需欄位
      };

      expect(() => {
        schemaValidator.validateStructuredLogEntry(invalidLogEntry);
      }).toThrow(/日誌格式驗證失敗/);
    });

    test('應該批次驗證多個日誌項目', () => {
      const logEntries = [
        {
          timestamp: '2025-09-27T10:30:00.000Z',
          level: 'info',
          executionId: '550e8400-e29b-41d4-a716-446655440000',
          component: 'test',
          event: 'EVENT1',
          message: 'Message 1'
        },
        {
          timestamp: 'invalid-date', // 無效項目
          level: 'info',
          message: 'Message 2'
        },
        {
          timestamp: '2025-09-27T10:30:01.000Z',
          level: 'warn',
          executionId: '550e8400-e29b-41d4-a716-446655440001',
          component: 'test',
          event: 'EVENT3',
          message: 'Message 3'
        }
      ];

      const result = schemaValidator.validateLogEntries(logEntries);

      expect(result.validEntries).toHaveLength(2);
      expect(result.invalidEntries).toHaveLength(1);
      expect(result.validEntries[0].message).toBe('Message 1');
      expect(result.validEntries[1].message).toBe('Message 3');
      expect(result.invalidEntries[0].index).toBe(1);
    });
  });

  describe('JSON Lines 日誌驗證', () => {
    test('應該驗證有效的 JSON Lines 格式', () => {
      const jsonLinesContent = [
        JSON.stringify({
          timestamp: '2025-09-27T10:30:00.000Z',
          level: 'info',
          executionId: '550e8400-e29b-41d4-a716-446655440000',
          component: 'test',
          event: 'EVENT1',
          message: 'Message 1'
        }),
        JSON.stringify({
          timestamp: '2025-09-27T10:30:01.000Z',
          level: 'warn',
          executionId: '550e8400-e29b-41d4-a716-446655440001',
          component: 'test',
          event: 'EVENT2',
          message: 'Message 2'
        })
      ].join('\n');

      const result = schemaValidator.validateJsonLinesLog(jsonLinesContent);

      expect(result.validEntries).toHaveLength(2);
      expect(result.invalidLines).toHaveLength(0);
      expect(result.validEntries[0].message).toBe('Message 1');
      expect(result.validEntries[1].message).toBe('Message 2');
    });

    test('應該處理混合有效和無效的 JSON Lines', () => {
      const jsonLinesContent = [
        JSON.stringify({
          timestamp: '2025-09-27T10:30:00.000Z',
          level: 'info',
          executionId: '550e8400-e29b-41d4-a716-446655440000',
          component: 'test',
          event: 'EVENT1',
          message: 'Valid message'
        }),
        '{ invalid json }',
        JSON.stringify({
          timestamp: 'invalid-date',
          level: 'info',
          message: 'Invalid schema'
        }),
        JSON.stringify({
          timestamp: '2025-09-27T10:30:02.000Z',
          level: 'error',
          executionId: '550e8400-e29b-41d4-a716-446655440002',
          component: 'test',
          event: 'EVENT3',
          message: 'Another valid message'
        })
      ].join('\n');

      const result = schemaValidator.validateJsonLinesLog(jsonLinesContent);

      expect(result.validEntries).toHaveLength(2);
      expect(result.invalidLines).toHaveLength(2);

      // 檢查有效項目
      expect(result.validEntries[0].message).toBe('Valid message');
      expect(result.validEntries[1].message).toBe('Another valid message');

      // 檢查無效行資訊
      expect(result.invalidLines[0].lineNumber).toBe(2);
      expect(result.invalidLines[0].error).toContain('JSON 解析失敗');
      expect(result.invalidLines[1].lineNumber).toBe(3);
      expect(result.invalidLines[1].error).toContain('executionId');
    });

    test('應該忽略空白行', () => {
      const jsonLinesContent = [
        JSON.stringify({
          timestamp: '2025-09-27T10:30:00.000Z',
          level: 'info',
          executionId: '550e8400-e29b-41d4-a716-446655440000',
          component: 'test',
          event: 'EVENT1',
          message: 'Message 1'
        }),
        '',
        '   ',
        JSON.stringify({
          timestamp: '2025-09-27T10:30:01.000Z',
          level: 'warn',
          executionId: '550e8400-e29b-41d4-a716-446655440001',
          component: 'test',
          event: 'EVENT2',
          message: 'Message 2'
        })
      ].join('\n');

      const result = schemaValidator.validateJsonLinesLog(jsonLinesContent);

      expect(result.validEntries).toHaveLength(2);
      expect(result.invalidLines).toHaveLength(0);
    });
  });

  describe('Schema 管理', () => {
    test('應該提供所有 Schema', () => {
      const schemas = schemaValidator.getAllSchemas();

      expect(schemas.executionReport).toBeDefined();
      expect(schemas.structuredLog).toBeDefined();
      expect(typeof schemas.executionReport).toBe('object');
      expect(typeof schemas.structuredLog).toBe('object');
    });
  });

  describe('驗證報告產生', () => {
    test('應該產生綜合驗證報告', () => {
      const reportValidation = {
        valid: true,
        errors: []
      };

      const logValidation = {
        validCount: 10,
        invalidCount: 2,
        errors: ['Invalid timestamp', 'Missing field']
      };

      const validationReport = schemaValidator.generateValidationReport(
        reportValidation,
        logValidation
      );

      expect(validationReport.summary.reportValid).toBe(true);
      expect(validationReport.summary.logEntriesValid).toBe(10);
      expect(validationReport.summary.logEntriesInvalid).toBe(2);
      expect(validationReport.summary.overallValid).toBe(false); // 因為有無效日誌
      expect(validationReport.details.logErrors).toHaveLength(2);
    });

    test('應該正確判斷整體驗證狀態', () => {
      // 全部有效的情況
      const allValidReport = schemaValidator.generateValidationReport(
        { valid: true },
        { validCount: 5, invalidCount: 0 }
      );
      expect(allValidReport.summary.overallValid).toBe(true);

      // 報表無效的情況
      const invalidReportResult = schemaValidator.generateValidationReport(
        { valid: false, errors: ['Report error'] },
        { validCount: 5, invalidCount: 0 }
      );
      expect(invalidReportResult.summary.overallValid).toBe(false);

      // 日誌無效的情況
      const invalidLogResult = schemaValidator.generateValidationReport(
        { valid: true },
        { validCount: 3, invalidCount: 2 }
      );
      expect(invalidLogResult.summary.overallValid).toBe(false);
    });
  });
});