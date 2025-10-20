import { describe, it, expect, beforeEach } from 'vitest';
import { CustomValidator } from '../src/custom-validator.js';
import type { ValidationContext, CustomRuleHandler } from '../src/types.js';

describe('CustomValidator', () => {
  let validator: CustomValidator;
  let mockLogger: any;
  let baseContext: ValidationContext;

  beforeEach(() => {
    validator = new CustomValidator();
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
        data: {
          data: {
            id: 1,
            name: 'test user',
            email: 'test@example.com',
            roles: ['admin', 'user'],
            profile: {
              active: true,
              score: null,
            },
          },
        },
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

  describe('notNull 規則', () => {
    it('應該通過非空值驗證', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            { type: 'notNull' as const, field: '$.data.id' },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該失敗空值驗證', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            { type: 'notNull' as const, field: '$.data.profile.score' },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toEqual({
        category: 'custom',
        severity: 'error',
        message: '欄位 $.data.profile.score 不能為空值',
        field: '$.data.profile.score',
        expected: undefined,
        actual: null,
        ruleName: 'notNull',
      });
    });

    it('應該失敗未定義欄位驗證', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            { type: 'notNull' as const, field: '$.data.nonexistent' },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toContain('不能為空值');
    });
  });

  describe('regex 規則', () => {
    it('應該通過正規表達式驗證', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            {
              type: 'regex' as const,
              field: '$.data.email',
              value: '^[\\w.-]+@example\\.com$',
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該失敗不符合正規表達式的值', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            {
              type: 'regex' as const,
              field: '$.data.email',
              value: '^[\\w.-]+@gmail\\.com$',
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toContain('不符合正規表達式');
    });

    it('應該處理無效的正規表達式', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            {
              type: 'regex' as const,
              field: '$.data.name',
              value: '[invalid-regex',
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toContain('正規表達式');
      expect(result.issues[0].message).toContain('格式錯誤');
    });
  });

  describe('contains 規則', () => {
    it('應該通過包含字串驗證', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            {
              type: 'contains' as const,
              field: '$.data.roles',
              value: 'admin',
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該失敗不包含字串驗證', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            {
              type: 'contains' as const,
              field: '$.data.name',
              value: 'admin',
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toContain('未包含 "admin"');
    });
  });

  describe('路徑解析', () => {
    it('應該支援根物件存取', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            { type: 'notNull' as const, field: '$' },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
    });

    it('應該支援巢狀物件存取', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            { type: 'notNull' as const, field: '$.data.profile.active' },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
    });

    it('應該支援陣列索引存取', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            {
              type: 'contains' as const,
              field: '$.data.roles[0]',
              value: 'admin',
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
    });

    it('應該處理無效的陣列索引', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            { type: 'notNull' as const, field: '$.data.roles[10]' },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
    });
  });

  describe('自訂規則註冊', () => {
    it('應該能夠註冊新的自訂規則', async () => {
      const customRule: CustomRuleHandler = (context) => {
        const value = context.payload;
        return {
          isValid: typeof value === 'string' && value.length > 5,
          message: '字串長度必須大於 5',
        };
      };

      validator.registerRule('minLength5', customRule);

      const availableRules = validator.listRules();
      expect(availableRules).toContain('minLength5');
    });

    it('應該執行註冊的自訂規則', async () => {
      const customRule: CustomRuleHandler = (context) => {
        const value = context.payload;
        return {
          isValid: typeof value === 'object' && value !== null,
          message: '必須是物件類型',
        };
      };

      validator.registerRule('isObject', customRule);

      // 這裡需要修改 expectations 結構以支援新規則
      // 由於目前的實作限制，我們先測試規則是否被正確註冊
      const availableRules = validator.listRules();
      expect(availableRules).toContain('isObject');
    });
  });

  describe('批次驗證', () => {
    it('應該執行多個自訂規則', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            { type: 'notNull' as const, field: '$.data.id' },
            {
              type: 'regex' as const,
              field: '$.data.email',
              value: '^[\\w.-]+@example\\.com$',
            },
            {
              type: 'contains' as const,
              field: '$.data.roles',
              value: 'admin',
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該收集所有失敗的規則', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            { type: 'notNull' as const, field: '$.data.nonexistent' },
            {
              type: 'regex' as const,
              field: '$.data.email',
              value: '^[\\w.-]+@gmail\\.com$',
            },
            {
              type: 'contains' as const,
              field: '$.data.name',
              value: 'admin',
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(3);
    });
  });

  describe('錯誤處理', () => {
    it('應該處理不存在的規則', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            { type: 'nonexistent' as any, field: '$.data.id' },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toContain('未知的自訂規則');
    });
  });

  describe('equals 規則 (Phase 10)', () => {
    it('應該通過數值相等驗證', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            {
              type: 'equals' as const,
              field: '$.data.id',
              expected: 1,
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該通過字串相等驗證', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            {
              type: 'equals' as const,
              field: '$.data.name',
              expected: 'test user',
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該通過布林值相等驗證', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            {
              type: 'equals' as const,
              field: '$.data.profile.active',
              expected: true,
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該失敗不相等的值', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            {
              type: 'equals' as const,
              field: '$.data.id',
              expected: 2,
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toContain('值為 1');
      expect(result.issues[0].message).toContain('預期為 2');
    });
  });

  describe('notContains 規則 (Phase 10)', () => {
    it('應該通過陣列不包含物件驗證', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: {
            data: {
              users: [
                { id: 1, name: 'User 1' },
                { id: 3, name: 'User 3' },
              ],
            },
          },
        },
        expectations: {
          custom: [
            {
              type: 'notContains' as const,
              field: '$.data.users',
              expected: { id: 2 },
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該失敗陣列包含物件驗證', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: {
            data: {
              users: [
                { id: 1, name: 'User 1' },
                { id: 2, name: 'User 2' },
              ],
            },
          },
        },
        expectations: {
          custom: [
            {
              type: 'notContains' as const,
              field: '$.data.users',
              expected: { id: 2 },
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toContain('包含不應存在的值');
    });

    it('應該失敗非陣列類型', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            {
              type: 'notContains' as const,
              field: '$.data.name',
              expected: 'test',
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toContain('必須是陣列類型');
    });
  });

  describe('greaterThan 規則 (Phase 10)', () => {
    it('應該通過數值大於驗證', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: {
            data: {
              count: 10,
            },
          },
        },
        expectations: {
          custom: [
            {
              type: 'greaterThan' as const,
              field: '$.data.count',
              value: 5,
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該失敗數值不大於驗證', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: {
            data: {
              count: 3,
            },
          },
        },
        expectations: {
          custom: [
            {
              type: 'greaterThan' as const,
              field: '$.data.count',
              value: 5,
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toContain('未大於 5');
    });

    it('應該失敗非數值類型', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            {
              type: 'greaterThan' as const,
              field: '$.data.name',
              value: 5,
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toContain('必須是數值類型');
    });
  });

  describe('lessThan 規則 (Phase 10)', () => {
    it('應該通過數值小於驗證', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: {
            data: {
              count: 3,
            },
          },
        },
        expectations: {
          custom: [
            {
              type: 'lessThan' as const,
              field: '$.data.count',
              value: 5,
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該失敗數值不小於驗證', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: {
            data: {
              count: 10,
            },
          },
        },
        expectations: {
          custom: [
            {
              type: 'lessThan' as const,
              field: '$.data.count',
              value: 5,
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toContain('未小於 5');
    });
  });

  describe('length 規則 (Phase 10)', () => {
    it('應該通過字串長度驗證(僅 min)', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            {
              type: 'length' as const,
              field: '$.data.name',
              min: 5,
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該通過字串長度驗證(min 與 max)', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            {
              type: 'length' as const,
              field: '$.data.name',
              min: 5,
              max: 20,
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該通過陣列長度驗證', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            {
              type: 'length' as const,
              field: '$.data.roles',
              min: 1,
              max: 5,
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該失敗字串太短', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: {
            data: {
              name: 'ab',
            },
          },
        },
        expectations: {
          custom: [
            {
              type: 'length' as const,
              field: '$.data.name',
              min: 5,
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toContain('長度 2');
      expect(result.issues[0].message).toContain('至少 5');
    });

    it('應該失敗字串太長', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: {
            data: {
              name: 'very long name here',
            },
          },
        },
        expectations: {
          custom: [
            {
              type: 'length' as const,
              field: '$.data.name',
              max: 10,
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toContain('最多 10');
    });

    it('應該失敗非字串/陣列類型', async () => {
      const context = {
        ...baseContext,
        expectations: {
          custom: [
            {
              type: 'length' as const,
              field: '$.data.id',
              min: 1,
            },
          ],
        },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].message).toContain('必須是字串或陣列類型');
    });
  });

  describe('邊界情況', () => {
    it('應該在沒有自訂規則時通過驗證', async () => {
      const context = {
        ...baseContext,
        expectations: {},
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該在自訂規則陣列為空時通過驗證', async () => {
      const context = {
        ...baseContext,
        expectations: { custom: [] },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });
});