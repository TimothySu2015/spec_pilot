import { describe, it, expect, beforeEach } from 'vitest';
import { BodyValidator } from '../src/body-validator.js';
import type { ValidationContext } from '../src/types.js';

describe('BodyValidator', () => {
  let validator: BodyValidator;
  let mockLogger: any;
  let baseContext: ValidationContext;

  beforeEach(() => {
    validator = new BodyValidator();
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
        data: {},
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

  describe('基本型別比對', () => {
    it('應該通過字串值完全相符的驗證', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: { name: 'John' },
        },
        expectations: {
          body: { name: 'John' },
        },
      };

      const result = await validator.validate(context);
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該拒絕字串值不相符的驗證', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: { name: 'John' },
        },
        expectations: {
          body: { name: 'Jane' },
        },
      };

      const result = await validator.validate(context);
      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].ruleName).toBe('body-value-mismatch');
    });

    it('應該通過數字值完全相符的驗證', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: { age: 30 },
        },
        expectations: {
          body: { age: 30 },
        },
      };

      const result = await validator.validate(context);
      expect(result.isValid).toBe(true);
    });

    it('應該通過布林值完全相符的驗證', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: { active: true },
        },
        expectations: {
          body: { active: true },
        },
      };

      const result = await validator.validate(context);
      expect(result.isValid).toBe(true);
    });
  });

  describe('型別檢查', () => {
    it('應該拒絕型別不符的驗證', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: { age: '30' },
        },
        expectations: {
          body: { age: 30 },
        },
      };

      const result = await validator.validate(context);
      expect(result.isValid).toBe(false);
      expect(result.issues[0].ruleName).toBe('body-type-mismatch');
    });

    it('應該正確識別 null 值', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: { value: null },
        },
        expectations: {
          body: { value: null },
        },
      };

      const result = await validator.validate(context);
      expect(result.isValid).toBe(true);
    });
  });

  describe('巢狀物件比對', () => {
    it('應該通過巢狀物件完全相符的驗證', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: {
            user: {
              name: 'John',
              email: 'john@example.com',
            },
          },
        },
        expectations: {
          body: {
            user: {
              name: 'John',
              email: 'john@example.com',
            },
          },
        },
      };

      const result = await validator.validate(context);
      expect(result.isValid).toBe(true);
    });

    it('應該支援部分比對（實際值可以有額外欄位）', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: {
            user: {
              name: 'John',
              email: 'john@example.com',
              age: 30,
              address: 'Some street',
            },
          },
        },
        expectations: {
          body: {
            user: {
              name: 'John',
              email: 'john@example.com',
            },
          },
        },
      };

      const result = await validator.validate(context);
      expect(result.isValid).toBe(true);
    });

    it('應該拒絕缺少預期欄位的驗證', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: {
            user: {
              name: 'John',
            },
          },
        },
        expectations: {
          body: {
            user: {
              name: 'John',
              email: 'john@example.com',
            },
          },
        },
      };

      const result = await validator.validate(context);
      expect(result.isValid).toBe(false);
      expect(result.issues[0].ruleName).toBe('body-field-missing');
      expect(result.issues[0].field).toBe('response.data.user.email');
    });

    it('應該拒絕巢狀欄位值不相符的驗證', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: {
            user: {
              name: 'John',
              email: 'wrong@example.com',
            },
          },
        },
        expectations: {
          body: {
            user: {
              name: 'John',
              email: 'john@example.com',
            },
          },
        },
      };

      const result = await validator.validate(context);
      expect(result.isValid).toBe(false);
      expect(result.issues[0].ruleName).toBe('body-value-mismatch');
      expect(result.issues[0].field).toBe('response.data.user.email');
    });
  });

  describe('陣列比對', () => {
    it('應該通過陣列長度與元素完全相符的驗證', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: {
            tags: ['tag1', 'tag2', 'tag3'],
          },
        },
        expectations: {
          body: {
            tags: ['tag1', 'tag2', 'tag3'],
          },
        },
      };

      const result = await validator.validate(context);
      expect(result.isValid).toBe(true);
    });

    it('應該拒絕陣列長度不符的驗證', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: {
            tags: ['tag1', 'tag2'],
          },
        },
        expectations: {
          body: {
            tags: ['tag1', 'tag2', 'tag3'],
          },
        },
      };

      const result = await validator.validate(context);
      expect(result.isValid).toBe(false);
      expect(result.issues[0].ruleName).toBe('body-array-length-mismatch');
    });

    it('應該拒絕陣列元素值不符的驗證', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: {
            tags: ['tag1', 'wrong', 'tag3'],
          },
        },
        expectations: {
          body: {
            tags: ['tag1', 'tag2', 'tag3'],
          },
        },
      };

      const result = await validator.validate(context);
      expect(result.isValid).toBe(false);
      expect(result.issues[0].ruleName).toBe('body-value-mismatch');
      expect(result.issues[0].field).toBe('response.data.tags[1]');
    });

    it('應該支援物件陣列的深度比對', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: {
            users: [
              { id: 1, name: 'John' },
              { id: 2, name: 'Jane' },
            ],
          },
        },
        expectations: {
          body: {
            users: [
              { id: 1, name: 'John' },
              { id: 2, name: 'Jane' },
            ],
          },
        },
      };

      const result = await validator.validate(context);
      expect(result.isValid).toBe(true);
    });
  });

  describe('複雜巢狀結構', () => {
    it('應該通過複雜巢狀結構的驗證', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: {
            status: 'ok',
            environment: 'development',
            features: {
              auth: true,
              userManagement: true,
              adminAccount: {
                username: 'admin',
                note: '預設管理者帳號',
              },
            },
          },
        },
        expectations: {
          body: {
            status: 'ok',
            environment: 'development',
            features: {
              auth: true,
              userManagement: true,
            },
          },
        },
      };

      const result = await validator.validate(context);
      expect(result.isValid).toBe(true);
    });
  });

  describe('邊界情況', () => {
    it('當 expectations.body 為 undefined 時應該通過驗證', async () => {
      const context = {
        ...baseContext,
        expectations: {},
      };

      const result = await validator.validate(context);
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該正確處理空物件', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: {},
        },
        expectations: {
          body: {},
        },
      };

      const result = await validator.validate(context);
      expect(result.isValid).toBe(true);
    });

    it('應該正確處理空陣列', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: { items: [] },
        },
        expectations: {
          body: { items: [] },
        },
      };

      const result = await validator.validate(context);
      expect(result.isValid).toBe(true);
    });
  });

  describe('遙測資訊', () => {
    it('應該回傳正確的遙測資訊', async () => {
      const context = {
        ...baseContext,
        response: {
          ...baseContext.response,
          data: { name: 'John' },
        },
        expectations: {
          body: { name: 'John' },
        },
      };

      const result = await validator.validate(context);
      expect(result.telemetry).toBeDefined();
      expect(result.telemetry.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.telemetry.details?.hasExpectedBody).toBe(true);
      expect(result.telemetry.details?.issueCount).toBe(0);
    });
  });
});
