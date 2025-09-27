import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationEngine, ValidationError } from '../src/validation-engine.js';
import type { ValidationInput, JsonSchema } from '../src/types.js';

describe('ValidationEngine', () => {
  let engine: ValidationEngine;
  let mockLogger: any;
  let baseInput: ValidationInput;

  beforeEach(() => {
    engine = new ValidationEngine();
    const logEntries: any[] = [];
    mockLogger = {
      debug: (event: string, data: any) => logEntries.push({ level: 'debug', event, data }),
      info: (event: string, data: any) => logEntries.push({ level: 'info', event, data }),
      error: (event: string, data: any) => logEntries.push({ level: 'error', event, data }),
      getEntries: () => logEntries,
      clear: () => logEntries.length = 0,
    };

    baseInput = {
      step: {
        name: 'test-step',
        request: {
          method: 'GET' as any,
          path: '/users/1',
        },
        expectations: {},
      },
      response: {
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: {
          data: {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            active: true,
          },
        },
        duration: 150,
      },
      expectations: {},
      schemas: {},
      logger: mockLogger,
      executionId: 'test-exec-123',
      runContext: {
        executionId: 'test-exec-123',
        flowId: 'user-crud-flow',
        timestamp: new Date(),
      },
    };
  });

  describe('單一驗證器測試', () => {
    it('應該通過狀態碼驗證', async () => {
      const input = {
        ...baseInput,
        expectations: { status: 200 },
      };

      const result = await engine.validateResponse(input);

      expect(result.status).toBe('success');
      expect(result.issues).toHaveLength(0);
      expect(result.stepResultPatch.success).toBe(true);
      expect(result.stepResultPatch.customChecks).toHaveLength(1);
      expect(result.stepResultPatch.customChecks![0]).toEqual({
        rule: 'status',
        field: 'response.status',
        success: true,
        message: '狀態碼驗證通過',
      });
    });

    it('應該通過 Schema 驗證', async () => {
      const userSchema: JsonSchema = {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
              email: { type: 'string' },
              active: { type: 'boolean' },
            },
            required: ['id', 'name', 'email'],
          },
        },
        required: ['data'],
      };

      const input = {
        ...baseInput,
        expectations: { schema: 'User' },
        schemas: { User: userSchema },
      };

      const result = await engine.validateResponse(input);

      expect(result.status).toBe('success');
      expect(result.issues).toHaveLength(0);
      expect(result.stepResultPatch.customChecks).toContainEqual({
        rule: 'schema',
        field: 'response.data',
        success: true,
        message: 'Schema 驗證通過',
      });
    });

    it('應該通過自訂規則驗證', async () => {
      const input = {
        ...baseInput,
        expectations: {
          custom: [
            { type: 'notNull' as const, field: '$.data.id' },
            { type: 'regex' as const, field: '$.data.email', value: '^[\\w.-]+@example\\.com$' },
          ],
        },
      };

      const result = await engine.validateResponse(input);

      expect(result.status).toBe('success');
      expect(result.issues).toHaveLength(0);
      expect(result.stepResultPatch.customChecks).toHaveLength(2);
    });
  });

  describe('組合驗證測試', () => {
    it('應該通過所有類型的驗證', async () => {
      const userSchema: JsonSchema = {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
              email: { type: 'string' },
              active: { type: 'boolean' },
            },
            required: ['id', 'name', 'email'],
          },
        },
        required: ['data'],
      };

      const input = {
        ...baseInput,
        expectations: {
          status: 200,
          schema: 'User',
          custom: [
            { type: 'notNull' as const, field: '$.data.id' },
            { type: 'contains' as const, field: '$.data.email', value: '@example.com' },
          ],
        },
        schemas: { User: userSchema },
      };

      const result = await engine.validateResponse(input);

      expect(result.status).toBe('success');
      expect(result.issues).toHaveLength(0);
      expect(result.stepResultPatch.success).toBe(true);
      expect(result.stepResultPatch.customChecks).toHaveLength(4); // status + schema + 2 custom
    });

    it('應該處理部分失敗的驗證', async () => {
      const userSchema: JsonSchema = {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              id: { type: 'string' }, // 故意設錯類型
              name: { type: 'string' },
              email: { type: 'string' },
              active: { type: 'boolean' },
            },
            required: ['id', 'name', 'email'],
          },
        },
        required: ['data'],
      };

      const input = {
        ...baseInput,
        expectations: {
          status: 201, // 故意設錯狀態碼
          schema: 'User',
          custom: [
            { type: 'notNull' as const, field: '$.data.id' }, // 這個會成功
            { type: 'contains' as const, field: '$.data.email', value: '@gmail.com' }, // 這個會失敗
          ],
        },
        schemas: { User: userSchema },
      };

      const result = await engine.validateResponse(input);

      expect(result.status).toBe('failed');
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.stepResultPatch.success).toBe(false);

      // 檢查各種類型的錯誤都有被記錄
      const statusErrors = result.issues.filter(i => i.category === 'status');
      const schemaErrors = result.issues.filter(i => i.category === 'schema');
      const customErrors = result.issues.filter(i => i.category === 'custom');

      expect(statusErrors).toHaveLength(1);
      expect(schemaErrors).toHaveLength(1);
      expect(customErrors).toHaveLength(1);
    });
  });

  describe('ValidationOutcome 結構', () => {
    it('應該返回正確的 ValidationOutcome 結構', async () => {
      const input = {
        ...baseInput,
        expectations: { status: 200 },
      };

      const result = await engine.validateResponse(input);

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('stepResultPatch');
      expect(result).toHaveProperty('logs');

      expect(result.stepResultPatch).toHaveProperty('success');
      expect(result.stepResultPatch).toHaveProperty('customChecks');
      expect(Array.isArray(result.issues)).toBe(true);
      expect(Array.isArray(result.logs)).toBe(true);
    });
  });

  describe('引擎管理功能', () => {
    it('應該提供統計資訊', () => {
      const stats = engine.getStats();

      expect(stats).toHaveProperty('availableCustomRules');
      expect(stats).toHaveProperty('schemaCacheStats');
      expect(Array.isArray(stats.availableCustomRules)).toBe(true);
      expect(stats.availableCustomRules).toContain('notNull');
      expect(stats.availableCustomRules).toContain('regex');
      expect(stats.availableCustomRules).toContain('contains');
    });

    it('應該能夠清除快取', () => {
      engine.clearCaches();
      const stats = engine.getStats();
      expect(stats.schemaCacheStats.size).toBe(0);
    });
  });

  describe('邊界情況', () => {
    it('應該處理空的期望設定', async () => {
      const input = {
        ...baseInput,
        expectations: {},
      };

      const result = await engine.validateResponse(input);

      expect(result.status).toBe('success');
      expect(result.issues).toHaveLength(0);
      expect(result.stepResultPatch.success).toBe(true);
      expect(result.stepResultPatch.customChecks).toHaveLength(0);
    });
  });
});