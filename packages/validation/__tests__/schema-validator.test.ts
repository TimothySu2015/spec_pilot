import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaValidator } from '../src/schema-validator.js';
import type { ValidationContext, JsonSchema } from '../src/types.js';

describe('SchemaValidator', () => {
  let validator: SchemaValidator;
  let mockLogger: any;
  let baseContext: ValidationContext;

  beforeEach(() => {
    validator = new SchemaValidator();
    mockLogger = {
      debug: () => {},
      info: () => {},
      error: () => {},
    };

    baseContext = {
      step: {
        name: 'test-step',
        request: {
          method: 'GET' as any,
          path: '/test',
        },
        expectations: {},
      },
      response: {
        status: 200,
        headers: {},
        data: { id: 1, name: 'test', active: true },
        duration: 100,
      },
      expectations: {},
      schemas: {},
      logger: mockLogger,
      executionId: 'test-exec-id',
      runContext: {
        executionId: 'test-exec-id',
        flowId: 'test-flow',
        timestamp: new Date(),
      },
    };
  });

  describe('Schema 驗證', () => {
    it('應該通過有效的 Schema 驗證', async () => {
      const userSchema: JsonSchema = {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          active: { type: 'boolean' },
        },
        required: ['id', 'name'],
      };

      const context = {
        ...baseContext,
        expectations: { schema: 'User' },
        schemas: { User: userSchema },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.telemetry.details).toEqual({
        schemaName: 'User',
        schemaExists: true,
      });
    });

    it('應該失敗無效的 Schema 驗證', async () => {
      const userSchema: JsonSchema = {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['id', 'name', 'email'],
      };

      const context = {
        ...baseContext,
        expectations: { schema: 'User' },
        schemas: { User: userSchema },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].category).toBe('schema');
      expect(result.issues[0].severity).toBe('error');
      expect(result.issues[0].message).toContain('缺少必要欄位：email');
    });

    it('應該處理 Schema 不存在的情況', async () => {
      const context = {
        ...baseContext,
        expectations: { schema: 'NonExistent' },
        schemas: {},
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toEqual({
        category: 'schema',
        severity: 'error',
        message: '找不到 Schema 定義：NonExistent',
        ruleName: 'schema-not-found',
      });
    });
  });

  describe('AJV 錯誤格式化', () => {
    it('應該正確格式化類型錯誤', async () => {
      const userSchema: JsonSchema = {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      };

      const context = {
        ...baseContext,
        expectations: { schema: 'User' },
        schemas: { User: userSchema },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toContain('類型錯誤');
    });

    it('應該正確格式化格式錯誤', async () => {
      const userSchema: JsonSchema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
        },
        required: ['email'],
      };

      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: { email: 'invalid-email' },
        },
        expectations: { schema: 'User' },
        schemas: { User: userSchema },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toContain('格式錯誤');
    });
  });

  describe('Schema 快取', () => {
    it('應該快取編譯過的 Schema', async () => {
      const userSchema: JsonSchema = {
        type: 'object',
        properties: {
          id: { type: 'number' },
        },
      };

      const context = {
        ...baseContext,
        expectations: { schema: 'User' },
        schemas: { User: userSchema },
      };

      // 第一次驗證
      await validator.validate(context);

      // 檢查快取狀態
      const stats = validator.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.schemas).toContain('User');

      // 第二次驗證應該使用快取
      const result = await validator.validate(context);
      expect(result.isValid).toBe(true);
    });

    it('應該能夠清除快取', async () => {
      const userSchema: JsonSchema = {
        type: 'object',
        properties: {
          id: { type: 'number' },
        },
      };

      const context = {
        ...baseContext,
        expectations: { schema: 'User' },
        schemas: { User: userSchema },
      };

      await validator.validate(context);
      expect(validator.getCacheStats().size).toBe(1);

      validator.clearCache();
      expect(validator.getCacheStats().size).toBe(0);
    });
  });

  describe('邊界情況', () => {
    it('應該在沒有期望 Schema 時通過驗證', async () => {
      const context = {
        ...baseContext,
        expectations: {},
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該處理 Schema 編譯錯誤', async () => {
      const invalidSchema = {
        type: 'invalid-type',
      } as JsonSchema;

      const context = {
        ...baseContext,
        expectations: { schema: 'Invalid' },
        schemas: { Invalid: invalidSchema },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].ruleName).toBe('schema-compilation-error');
    });
  });

  describe('複雜 Schema 驗證', () => {
    it('應該驗證巢狀物件', async () => {
      const complexSchema: JsonSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              profile: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  age: { type: 'number', minimum: 0 },
                },
                required: ['name'],
              },
            },
            required: ['profile'],
          },
        },
        required: ['user'],
      };

      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: {
            user: {
              profile: {
                name: 'John',
                age: 25,
              },
            },
          },
        },
        expectations: { schema: 'Complex' },
        schemas: { Complex: complexSchema },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該驗證陣列結構', async () => {
      const arraySchema: JsonSchema = {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                name: { type: 'string' },
              },
              required: ['id', 'name'],
            },
            minItems: 1,
          },
        },
        required: ['items'],
      };

      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: {
            items: [
              { id: 1, name: 'Item 1' },
              { id: 2, name: 'Item 2' },
            ],
          },
        },
        expectations: { schema: 'Array' },
        schemas: { Array: arraySchema },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });
});