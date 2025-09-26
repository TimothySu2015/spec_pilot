import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationEngine, type ICustomValidationRule } from '../src/index.js';

describe('ValidationEngine', () => {
  let engine: ValidationEngine;

  beforeEach(() => {
    engine = new ValidationEngine();
  });

  describe('validateSchema', () => {
    it('應該通過有效的 Schema 驗證', () => {
      const data = {
        name: 'John',
        age: 30,
      };

      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      };

      const result = engine.validateSchema(data, schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('應該失敗無效的 Schema 驗證', () => {
      const data = {
        name: 'John',
        age: 'thirty', // 錯誤的類型
      };

      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        required: ['name', 'age'],
      };

      const result = engine.validateSchema(data, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].path).toContain('age');
    });
  });

  describe('validateCustomRules', () => {
    it('應該通過 notNull 規則', () => {
      const data = { value: 'not null' };
      const rules: ICustomValidationRule[] = [
        {
          name: 'test-not-null',
          path: 'value',
          rule: 'notNull',
        },
      ];

      const result = engine.validateCustomRules(data, rules);

      expect(result.valid).toBe(true);
    });

    it('應該失敗 notNull 規則', () => {
      const data = { value: null };
      const rules: ICustomValidationRule[] = [
        {
          name: 'test-not-null',
          path: 'value',
          rule: 'notNull',
        },
      ];

      const result = engine.validateCustomRules(data, rules);

      expect(result.valid).toBe(false);
      expect(result.errors![0].path).toBe('value');
    });

    it('應該通過 regex 規則', () => {
      const data = { email: 'test@example.com' };
      const rules: ICustomValidationRule[] = [
        {
          name: 'test-email',
          path: 'email',
          rule: 'regex',
          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        },
      ];

      const result = engine.validateCustomRules(data, rules);

      expect(result.valid).toBe(true);
    });

    it('應該失敗 regex 規則', () => {
      const data = { email: 'invalid-email' };
      const rules: ICustomValidationRule[] = [
        {
          name: 'test-email',
          path: 'email',
          rule: 'regex',
          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        },
      ];

      const result = engine.validateCustomRules(data, rules);

      expect(result.valid).toBe(false);
      expect(result.errors![0].path).toBe('email');
    });

    it('應該通過 contains 規則', () => {
      const data = { message: 'Hello World' };
      const rules: ICustomValidationRule[] = [
        {
          name: 'test-contains',
          path: 'message',
          rule: 'contains',
          value: 'World',
        },
      ];

      const result = engine.validateCustomRules(data, rules);

      expect(result.valid).toBe(true);
    });

    it('應該處理多個規則', () => {
      const data = {
        name: 'John',
        email: 'john@example.com',
      };

      const rules: ICustomValidationRule[] = [
        {
          name: 'test-name-not-null',
          path: 'name',
          rule: 'notNull',
        },
        {
          name: 'test-email-contains',
          path: 'email',
          rule: 'contains',
          value: '@',
        },
      ];

      const result = engine.validateCustomRules(data, rules);

      expect(result.valid).toBe(true);
    });
  });
});