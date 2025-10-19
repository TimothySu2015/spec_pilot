/**
 * DataSynthesizer 單元測試
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DataSynthesizer } from '../src/data-synthesizer.js';
import type { JSONSchema } from '../src/types.js';

describe('DataSynthesizer', () => {
  let synthesizer: DataSynthesizer;

  beforeEach(() => {
    synthesizer = new DataSynthesizer();
  });

  describe('構造函數與選項', () => {
    it('應該使用預設選項', () => {
      const synth = new DataSynthesizer();
      const result = synth.synthesize({ type: 'string', examples: ['test'] });
      expect(result).toBe('test'); // useExamples 預設為 true
    });

    it('應該支援自訂 locale (zh-TW)', () => {
      const synth = new DataSynthesizer({ locale: 'zh-TW' });
      const result = synth.synthesize({ type: 'string', format: 'email' });
      // 使用 faker.js 後，驗證格式而不是精確值
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/); // 驗證 email 格式
    });

    it('應該支援自訂 locale (en-US)', () => {
      const synth = new DataSynthesizer({ locale: 'en-US' });
      const result = synth.synthesize({ type: 'string', format: 'email' });
      // 使用 faker.js 後，驗證格式而不是精確值
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/); // 驗證 email 格式
    });

    it('應該支援停用 examples', () => {
      const synth = new DataSynthesizer({ useExamples: false });
      const result = synth.synthesize(
        { type: 'string', default: 'default-value', examples: ['example-value'] }
      );
      expect(result).toBe('default-value'); // 跳過 examples,使用 default
    });

    it('應該支援停用 defaults', () => {
      const synth = new DataSynthesizer({ useDefaults: false });
      const result = synth.synthesize({ type: 'string', default: 'default-value' });
      expect(result).not.toBe('default-value'); // 應該產生新值
    });

    it('應該支援停用 enums', () => {
      const synth = new DataSynthesizer({ useEnums: false });
      const result = synth.synthesize({ type: 'string', enum: ['enum-value'] });
      expect(result).not.toBe('enum-value'); // 應該產生新值
    });
  });

  describe('synthesize 優先順序', () => {
    it('應該優先使用參數中的 examples', () => {
      const schema: JSONSchema = {
        type: 'string',
        default: 'default-value',
        examples: ['schema-example']
      };
      const examples = { example1: 'param-example' };

      const result = synthesizer.synthesize(schema, examples);
      expect(result).toBe('param-example');
    });

    it('應該使用 schema.examples (當無參數 examples)', () => {
      const schema: JSONSchema = {
        type: 'string',
        default: 'default-value',
        examples: ['schema-example']
      };

      const result = synthesizer.synthesize(schema);
      expect(result).toBe('schema-example');
    });

    it('應該使用 schema.default (當無 examples)', () => {
      const schema: JSONSchema = {
        type: 'string',
        default: 'default-value'
      };

      const result = synthesizer.synthesize(schema);
      expect(result).toBe('default-value');
    });

    it('應該根據類型產生 (當無 examples 和 default)', () => {
      const schema: JSONSchema = { type: 'string' };
      const result = synthesizer.synthesize(schema);
      expect(typeof result).toBe('string');
      expect(result).toBeTruthy();
    });
  });

  describe('字串類型產生', () => {
    it('應該產生基本字串', () => {
      const result = synthesizer.synthesize({ type: 'string' });
      expect(typeof result).toBe('string');
      expect((result as string).length).toBeGreaterThanOrEqual(3);
    });

    it('應該使用 enum 值', () => {
      const result = synthesizer.synthesize({
        type: 'string',
        enum: ['option1', 'option2']
      });
      expect(result).toBe('option1');
    });

    describe('format 支援', () => {
      it('應該產生 email (zh-TW)', () => {
        const synth = new DataSynthesizer({ locale: 'zh-TW' });
        const result = synth.synthesize({ type: 'string', format: 'email' });
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      });

      it('應該產生 email (en-US)', () => {
        const synth = new DataSynthesizer({ locale: 'en-US' });
        const result = synth.synthesize({ type: 'string', format: 'email' });
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      });

      it('應該產生 uri', () => {
        const result = synthesizer.synthesize({ type: 'string', format: 'uri' });
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^https?:\/\//);
      });

      it('應該產生 url', () => {
        const result = synthesizer.synthesize({ type: 'string', format: 'url' });
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^https?:\/\//);
      });

      it('應該產生 uuid', () => {
        const result = synthesizer.synthesize({ type: 'string', format: 'uuid' });
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });

      it('應該產生 date', () => {
        const result = synthesizer.synthesize({ type: 'string', format: 'date' });
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it('應該產生 date-time', () => {
        const result = synthesizer.synthesize({ type: 'string', format: 'date-time' });
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      });

      it('應該產生 time', () => {
        const result = synthesizer.synthesize({ type: 'string', format: 'time' });
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      });

      it('應該產生 ipv4', () => {
        const result = synthesizer.synthesize({ type: 'string', format: 'ipv4' });
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
      });

      it('應該產生 ipv6', () => {
        const result = synthesizer.synthesize({ type: 'string', format: 'ipv6' });
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^[0-9a-f:]+$/i);
      });

      it('應該產生 hostname', () => {
        const result = synthesizer.synthesize({ type: 'string', format: 'hostname' });
        expect(typeof result).toBe('string');
        expect(result).toMatch(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i);
      });

      it('應該產生 phone (zh-TW)', () => {
        const synth = new DataSynthesizer({ locale: 'zh-TW' });
        const result = synth.synthesize({ type: 'string', format: 'phone' });
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });

      it('應該產生 phone (en-US)', () => {
        const synth = new DataSynthesizer({ locale: 'en-US' });
        const result = synth.synthesize({ type: 'string', format: 'phone' });
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('根據欄位名稱產生', () => {
      it('應該產生 username', () => {
        const schema: JSONSchema = {
          type: 'object',
          properties: { username: { type: 'string' } },
          required: ['username']
        };
        const result = synthesizer.synthesize(schema) as Record<string, unknown>;
        expect(typeof result.username).toBe('string');
        expect((result.username as string).length).toBeGreaterThan(0);
      });

      it('應該產生 password', () => {
        const schema: JSONSchema = {
          type: 'object',
          properties: { password: { type: 'string' } },
          required: ['password']
        };
        const result = synthesizer.synthesize(schema) as Record<string, unknown>;
        expect(typeof result.password).toBe('string');
        expect((result.password as string).length).toBeGreaterThan(0);
      });

      it('應該產生 email', () => {
        const synth = new DataSynthesizer({ locale: 'zh-TW' });
        const schema: JSONSchema = {
          type: 'object',
          properties: { email: { type: 'string' } },
          required: ['email']
        };
        const result = synth.synthesize(schema) as Record<string, unknown>;
        expect(typeof result.email).toBe('string');
        expect(result.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      });

      it('應該產生 name (zh-TW)', () => {
        const synth = new DataSynthesizer({ locale: 'zh-TW' });
        const schema: JSONSchema = {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name']
        };
        const result = synth.synthesize(schema) as Record<string, unknown>;
        expect(typeof result.name).toBe('string');
        expect((result.name as string).length).toBeGreaterThan(0);
      });

      it('應該產生 name (en-US)', () => {
        const synth = new DataSynthesizer({ locale: 'en-US' });
        const schema: JSONSchema = {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name']
        };
        const result = synth.synthesize(schema) as Record<string, unknown>;
        expect(typeof result.name).toBe('string');
        expect((result.name as string).length).toBeGreaterThan(0);
      });

      it('應該產生 title (zh-TW)', () => {
        const synth = new DataSynthesizer({ locale: 'zh-TW' });
        const schema: JSONSchema = {
          type: 'object',
          properties: { title: { type: 'string' } },
          required: ['title']
        };
        const result = synth.synthesize(schema) as Record<string, unknown>;
        expect(typeof result.title).toBe('string');
        expect((result.title as string).length).toBeGreaterThan(0);
      });

      it('應該產生 description (zh-TW)', () => {
        const synth = new DataSynthesizer({ locale: 'zh-TW' });
        const schema: JSONSchema = {
          type: 'object',
          properties: { description: { type: 'string' } },
          required: ['description']
        };
        const result = synth.synthesize(schema) as Record<string, unknown>;
        expect(typeof result.description).toBe('string');
        expect((result.description as string).length).toBeGreaterThan(0);
      });

      it('應該產生 address (zh-TW)', () => {
        const synth = new DataSynthesizer({ locale: 'zh-TW' });
        const schema: JSONSchema = {
          type: 'object',
          properties: { address: { type: 'string' } },
          required: ['address']
        };
        const result = synth.synthesize(schema) as Record<string, unknown>;
        expect(typeof result.address).toBe('string');
        expect((result.address as string).length).toBeGreaterThan(0);
      });

      it('應該產生 phone', () => {
        const synth = new DataSynthesizer({ locale: 'zh-TW' });
        const schema: JSONSchema = {
          type: 'object',
          properties: { phone: { type: 'string' } },
          required: ['phone']
        };
        const result = synth.synthesize(schema) as Record<string, unknown>;
        expect(typeof result.phone).toBe('string');
        expect((result.phone as string).length).toBeGreaterThan(0);
      });
    });

    describe('長度限制', () => {
      it('應該遵守 minLength', () => {
        const result = synthesizer.synthesize({ type: 'string', minLength: 10 }) as string;
        expect(result.length).toBeGreaterThanOrEqual(10);
      });

      it('應該產生至少 3 個字元 (預設)', () => {
        const result = synthesizer.synthesize({ type: 'string' }) as string;
        expect(result.length).toBeGreaterThanOrEqual(3);
      });

      it('應該重複字串以滿足最小長度', () => {
        const result = synthesizer.synthesize({ type: 'string', minLength: 20 }) as string;
        expect(result.length).toBeGreaterThanOrEqual(20);
      });
    });
  });

  describe('數字類型產生', () => {
    it('應該產生整數', () => {
      const result = synthesizer.synthesize({ type: 'integer' });
      expect(typeof result).toBe('number');
      expect(Number.isInteger(result)).toBe(true);
    });

    it('應該產生浮點數', () => {
      const result = synthesizer.synthesize({ type: 'number' });
      expect(typeof result).toBe('number');
    });

    it('應該使用 enum 值', () => {
      const result = synthesizer.synthesize({ type: 'integer', enum: [5, 10, 15] });
      expect(result).toBe(5);
    });

    it('應該遵守 minimum', () => {
      const result = synthesizer.synthesize({ type: 'integer', minimum: 10 });
      expect(result).toBeGreaterThanOrEqual(10);
    });

    it('應該遵守 maximum', () => {
      const result = synthesizer.synthesize({ type: 'integer', maximum: 100 });
      expect(result).toBeLessThanOrEqual(100);
    });

    it('應該遵守 exclusiveMinimum', () => {
      const result = synthesizer.synthesize({
        type: 'integer',
        minimum: 10,
        exclusiveMinimum: true
      });
      expect(result).toBeGreaterThan(10);
    });

    it('應該遵守 exclusiveMaximum', () => {
      const result = synthesizer.synthesize({
        type: 'integer',
        maximum: 100,
        exclusiveMaximum: true
      });
      expect(result).toBeLessThan(100);
    });

    it('應該遵守 multipleOf', () => {
      const result = synthesizer.synthesize({
        type: 'integer',
        minimum: 7,
        multipleOf: 5
      }) as number;
      expect(result % 5).toBe(0);
    });

    it('應該產生預設值 1 (無限制時)', () => {
      const result = synthesizer.synthesize({ type: 'integer' });
      expect(result).toBe(1);
    });
  });

  describe('布林類型產生', () => {
    it('應該產生布林值', () => {
      const result = synthesizer.synthesize({ type: 'boolean' });
      expect(typeof result).toBe('boolean');
    });

    it('應該使用 enum 值', () => {
      const result = synthesizer.synthesize({ type: 'boolean', enum: [false] });
      expect(result).toBe(false);
    });

    it('應該預設產生 true', () => {
      const result = synthesizer.synthesize({ type: 'boolean' });
      expect(result).toBe(true);
    });
  });

  describe('陣列類型產生', () => {
    it('應該產生陣列', () => {
      const result = synthesizer.synthesize({
        type: 'array',
        items: { type: 'string' }
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it('應該遵守 minItems', () => {
      const result = synthesizer.synthesize({
        type: 'array',
        items: { type: 'string' },
        minItems: 3
      }) as unknown[];
      expect(result.length).toBe(3);
    });

    it('應該產生空陣列 (當無 items)', () => {
      const result = synthesizer.synthesize({ type: 'array' });
      expect(result).toEqual([]);
    });

    it('應該產生至少 1 個元素 (預設)', () => {
      const result = synthesizer.synthesize({
        type: 'array',
        items: { type: 'integer' }
      }) as unknown[];
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('物件類型產生', () => {
    it('應該產生物件', () => {
      const result = synthesizer.synthesize({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' }
        },
        required: ['name']
      });
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
    });

    it('應該產生 required 欄位', () => {
      const result = synthesizer.synthesize({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' }
        },
        required: ['name']
      }) as Record<string, unknown>;
      expect(result).toHaveProperty('name');
      expect(typeof result.name).toBe('string');
    });

    it('應該不產生非 required 欄位 (除非有 default)', () => {
      const result = synthesizer.synthesize({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' }
        },
        required: ['name']
      }) as Record<string, unknown>;
      expect(result).toHaveProperty('name');
      expect(result).not.toHaveProperty('age');
    });

    it('應該產生有 default 的非 required 欄位', () => {
      const result = synthesizer.synthesize({
        type: 'object',
        properties: {
          name: { type: 'string' },
          status: { type: 'string', default: 'active' }
        },
        required: ['name']
      }) as Record<string, unknown>;
      expect(result).toHaveProperty('status');
      expect(result.status).toBe('active');
    });

    it('應該產生空物件 (當無 properties)', () => {
      const result = synthesizer.synthesize({ type: 'object' });
      expect(result).toEqual({});
    });

    it('應該產生巢狀物件', () => {
      const result = synthesizer.synthesize({
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' }
            },
            required: ['name']
          }
        },
        required: ['user']
      }) as Record<string, unknown>;

      expect(result).toHaveProperty('user');
      expect(typeof result.user).toBe('object');
      expect((result.user as Record<string, unknown>).name).toBeDefined();
    });
  });

  describe('null 類型產生', () => {
    it('應該產生 null', () => {
      const result = synthesizer.synthesize({ type: 'null' });
      expect(result).toBeNull();
    });
  });

  describe('synthesizeInvalid - 產生無效值', () => {
    describe('字串無效值', () => {
      it('應該產生無效 email', () => {
        const result = synthesizer.synthesizeInvalid({ type: 'string', format: 'email' });
        expect(result).toBe('invalid-email');
      });

      it('應該產生過短字串 (minLength)', () => {
        const result = synthesizer.synthesizeInvalid({ type: 'string', minLength: 5 }) as string;
        expect(result.length).toBe(4); // minLength - 1
      });

      it('應該產生過長字串 (maxLength)', () => {
        const result = synthesizer.synthesizeInvalid({ type: 'string', maxLength: 5 }) as string;
        expect(result.length).toBe(6); // maxLength + 1
      });

      it('應該產生類型錯誤 (無限制時)', () => {
        const result = synthesizer.synthesizeInvalid({ type: 'string' });
        expect(typeof result).toBe('number'); // 應該是 123
      });
    });

    describe('數字無效值', () => {
      it('應該產生小於 minimum 的值', () => {
        const result = synthesizer.synthesizeInvalid({ type: 'integer', minimum: 10 });
        expect(result).toBe(9);
      });

      it('應該產生大於 maximum 的值', () => {
        const result = synthesizer.synthesizeInvalid({ type: 'integer', maximum: 100 });
        expect(result).toBe(101);
      });

      it('應該產生類型錯誤 (無限制時)', () => {
        const result = synthesizer.synthesizeInvalid({ type: 'integer' });
        expect(typeof result).toBe('string'); // 應該是 'not-a-number'
      });
    });

    describe('布林無效值', () => {
      it('應該產生類型錯誤', () => {
        const result = synthesizer.synthesizeInvalid({ type: 'boolean' });
        expect(typeof result).toBe('string');
      });
    });

    describe('陣列無效值', () => {
      it('應該產生空陣列 (minItems)', () => {
        const result = synthesizer.synthesizeInvalid({ type: 'array', minItems: 3 });
        expect(result).toEqual([]);
      });

      it('應該產生類型錯誤 (無限制時)', () => {
        const result = synthesizer.synthesizeInvalid({ type: 'array' });
        expect(typeof result).toBe('string');
      });
    });

    describe('物件無效值', () => {
      it('應該產生類型錯誤', () => {
        const result = synthesizer.synthesizeInvalid({ type: 'object' });
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe('extractExample - 提取範例值', () => {
    it('應該提取 OpenAPI 3.0 格式的範例', () => {
      const examples = { example1: { value: 'test-value' } };
      const schema: JSONSchema = { type: 'string' };
      const result = synthesizer.synthesize(schema, examples);
      expect(result).toBe('test-value');
    });

    it('應該提取直接的範例值', () => {
      const examples = { example1: 'direct-value' };
      const schema: JSONSchema = { type: 'string' };
      const result = synthesizer.synthesize(schema, examples);
      expect(result).toBe('direct-value');
    });

    it('應該處理空 examples', () => {
      const examples = {};
      const schema: JSONSchema = { type: 'string', default: 'default-value' };
      const result = synthesizer.synthesize(schema, examples);
      expect(result).toBe('default-value'); // 跳過空 examples,使用 default
    });
  });

  describe('整合測試', () => {
    it('應該產生完整的使用者物件 (zh-TW)', () => {
      const synth = new DataSynthesizer({ locale: 'zh-TW' });
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
          age: { type: 'integer', minimum: 0, maximum: 150 },
          phone: { type: 'string' },
          address: { type: 'string' }
        },
        required: ['username', 'email']
      };

      const result = synth.synthesize(schema) as Record<string, unknown>;

      expect(typeof result.username).toBe('string');
      expect((result.username as string).length).toBeGreaterThan(0);
      expect(typeof result.email).toBe('string');
      expect(result.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(result.age).toBeUndefined(); // 非 required
      expect(result.phone).toBeUndefined(); // 非 required
      expect(result.address).toBeUndefined(); // 非 required
    });

    it('應該產生完整的使用者物件 (en-US)', () => {
      const synth = new DataSynthesizer({ locale: 'en-US' });
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' }
        },
        required: ['name', 'email']
      };

      const result = synth.synthesize(schema) as Record<string, unknown>;

      expect(typeof result.name).toBe('string');
      expect((result.name as string).length).toBeGreaterThan(0);
      expect(typeof result.email).toBe('string');
      expect(result.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('應該處理複雜的巢狀結構', () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              contacts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['email', 'phone'] },
                    value: { type: 'string' }
                  },
                  required: ['type', 'value']
                },
                minItems: 1
              }
            },
            required: ['name', 'contacts']
          }
        },
        required: ['user']
      };

      const result = synthesizer.synthesize(schema) as Record<string, unknown>;
      const user = result.user as Record<string, unknown>;
      const contacts = user.contacts as Record<string, unknown>[];

      expect(user).toBeDefined();
      expect(user.name).toBeDefined();
      expect(Array.isArray(contacts)).toBe(true);
      expect(contacts.length).toBeGreaterThanOrEqual(1);
      expect(contacts[0].type).toBe('email');
      expect(contacts[0].value).toBeDefined();
    });
  });
});
