/**
 * Data Synthesizer - 測試資料合成器
 * 根據 JSON Schema 產生合理的測試資料
 */

import type { JSONSchema } from './types.js';

/**
 * 資料合成選項
 */
export interface SynthesizerOptions {
  useExamples?: boolean;
  useDefaults?: boolean;
  useEnums?: boolean;
  locale?: 'zh-TW' | 'en-US';
}

export class DataSynthesizer {
  constructor(private options: SynthesizerOptions = {}) {
    this.options.useExamples = options.useExamples ?? true;
    this.options.useDefaults = options.useDefaults ?? true;
    this.options.useEnums = options.useEnums ?? true;
    this.options.locale = options.locale ?? 'zh-TW';
  }

  /**
   * 根據 schema 合成測試資料
   */
  synthesize(schema: JSONSchema, examples?: Record<string, unknown>): unknown {
    // 1. 優先使用 examples
    if (this.options.useExamples && examples) {
      const exampleValue = this.extractExample(examples);
      if (exampleValue !== null) {
        return exampleValue;
      }
    }

    // 2. 使用 schema 中的 examples
    if (this.options.useExamples && schema.examples && schema.examples.length > 0) {
      return schema.examples[0];
    }

    // 3. 使用 default 值
    if (this.options.useDefaults && 'default' in schema) {
      return schema.default;
    }

    // 4. 根據類型產生
    return this.generateByType(schema);
  }

  /**
   * 根據類型產生資料
   */
  private generateByType(schema: JSONSchema, fieldName?: string): unknown {
    switch (schema.type) {
      case 'string':
        return this.generateString(schema, fieldName);
      case 'number':
      case 'integer':
        return this.generateNumber(schema);
      case 'boolean':
        return this.generateBoolean(schema);
      case 'array':
        return this.generateArray(schema);
      case 'object':
        return this.generateObject(schema);
      case 'null':
        return null;
      default:
        return null;
    }
  }

  /**
   * 產生字串值
   */
  private generateString(schema: JSONSchema, fieldName?: string): string {
    // 1. 使用 enum
    if (this.options.useEnums && schema.enum && schema.enum.length > 0) {
      return String(schema.enum[0]);
    }

    // 2. 根據 format 產生
    if (schema.format) {
      switch (schema.format) {
        case 'email':
          return this.options.locale === 'zh-TW' ? 'test@example.tw' : 'test@example.com';
        case 'uri':
        case 'url':
          return 'https://example.com';
        case 'uuid':
          return '123e4567-e89b-12d3-a456-426614174000';
        case 'date':
          return new Date().toISOString().split('T')[0];
        case 'date-time':
          return new Date().toISOString();
        case 'time':
          return '12:00:00';
        case 'ipv4':
          return '192.168.1.1';
        case 'ipv6':
          return '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
        case 'hostname':
          return 'example.com';
        case 'phone':
          return this.options.locale === 'zh-TW' ? '0912345678' : '+1-555-123-4567';
      }
    }

    // 3. 根據欄位名稱產生合理的測試資料
    if (fieldName) {
      const lowerName = fieldName.toLowerCase();

      // 使用者名稱相關
      if (lowerName.includes('username') || lowerName === 'user') {
        return 'testuser';
      }

      // 密碼相關
      if (lowerName.includes('password') || lowerName.includes('pwd')) {
        return 'password123';
      }

      // Email 相關
      if (lowerName.includes('email') || lowerName.includes('mail')) {
        return this.options.locale === 'zh-TW' ? 'test@example.tw' : 'test@example.com';
      }

      // 名稱相關
      if (lowerName === 'name' || lowerName.includes('fullname')) {
        return this.options.locale === 'zh-TW' ? '測試使用者' : 'Test User';
      }

      // 標題相關
      if (lowerName === 'title' || lowerName.includes('subject')) {
        return this.options.locale === 'zh-TW' ? '測試標題' : 'Test Title';
      }

      // 描述相關
      if (lowerName.includes('description') || lowerName.includes('desc')) {
        return this.options.locale === 'zh-TW' ? '這是測試描述' : 'This is a test description';
      }

      // 地址相關
      if (lowerName.includes('address')) {
        return this.options.locale === 'zh-TW' ? '台北市信義區' : '123 Test Street';
      }

      // 電話相關
      if (lowerName.includes('phone') || lowerName.includes('tel')) {
        return this.options.locale === 'zh-TW' ? '0912345678' : '+1-555-123-4567';
      }
    }

    // 4. 根據 pattern 產生（簡化處理）
    if (schema.pattern) {
      // 簡單的 pattern 處理
      if (schema.pattern === '^[A-Z]{2}$') {
        return 'AB';
      }
      if (schema.pattern.includes('[0-9]')) {
        return '123';
      }
    }

    // 5. 根據長度限制產生
    const minLength = schema.minLength || 1;
    // 確保至少產生 3 個字元,避免過短的測試資料
    const targetLength = Math.max(minLength, 3);

    const baseValue = this.options.locale === 'zh-TW' ? '測試資料' : 'testdata';
    if (targetLength <= baseValue.length) {
      return baseValue.substring(0, targetLength);
    }
    return baseValue.repeat(Math.ceil(targetLength / baseValue.length)).substring(0, targetLength);
  }

  /**
   * 產生數字值
   */
  private generateNumber(schema: JSONSchema): number {
    // 1. 使用 enum
    if (this.options.useEnums && schema.enum && schema.enum.length > 0) {
      return Number(schema.enum[0]);
    }

    // 2. 根據範圍產生
    let value: number;

    if (schema.minimum !== undefined) {
      value = schema.minimum;
      if (schema.exclusiveMinimum) {
        value += 1;
      }
    } else if (schema.maximum !== undefined) {
      value = schema.maximum;
      if (schema.exclusiveMaximum) {
        value -= 1;
      }
    } else {
      value = schema.type === 'integer' ? 1 : 1.0;
    }

    // 3. 處理 multipleOf
    if (schema.multipleOf) {
      value = Math.ceil(value / schema.multipleOf) * schema.multipleOf;
    }

    // 4. 確保是整數
    if (schema.type === 'integer') {
      value = Math.floor(value);
    }

    return value;
  }

  /**
   * 產生布林值
   */
  private generateBoolean(schema: JSONSchema): boolean {
    if (this.options.useEnums && schema.enum && schema.enum.length > 0) {
      return Boolean(schema.enum[0]);
    }
    return true;
  }

  /**
   * 產生陣列值
   */
  private generateArray(schema: JSONSchema): unknown[] {
    if (!schema.items) {
      return [];
    }

    const minItems = schema.minItems || 1;
    // const maxItems = schema.maxItems || Math.min(minItems + 2, 3); // 未來可用於範圍內隨機
    const count = minItems;

    const items: unknown[] = [];
    for (let i = 0; i < count; i++) {
      items.push(this.generateByType(schema.items));
    }

    return items;
  }

  /**
   * 產生物件值
   */
  private generateObject(schema: JSONSchema): Record<string, unknown> {
    const obj: Record<string, unknown> = {};

    if (!schema.properties) {
      return obj;
    }

    // 產生所有屬性（優先產生 required）
    const required = new Set(schema.required || []);

    for (const [key, propSchema] of Object.entries(schema.properties)) {
      // 總是產生 required 欄位
      if (required.has(key)) {
        obj[key] = this.generateByType(propSchema, key);
      }
      // 也產生非 required 但有 default 的欄位
      else if (this.options.useDefaults && 'default' in propSchema) {
        obj[key] = propSchema.default;
      }
    }

    return obj;
  }

  /**
   * 從 examples 中提取範例值
   */
  private extractExample(examples: Record<string, unknown>): unknown {
    const keys = Object.keys(examples);
    if (keys.length === 0) {
      return null;
    }

    const firstKey = keys[0];
    const example = examples[firstKey];

    // OpenAPI 3.0 格式: { "example1": { "value": ... } }
    if (typeof example === 'object' && example !== null && 'value' in example) {
      return (example as { value: unknown }).value;
    }

    // 直接的範例值
    return example;
  }

  /**
   * 產生無效值（用於錯誤測試）
   */
  synthesizeInvalid(schema: JSONSchema): unknown {
    switch (schema.type) {
      case 'string':
        if (schema.format === 'email') {
          return 'invalid-email';
        }
        if (schema.minLength) {
          return 'x'.repeat(Math.max(0, schema.minLength - 1));
        }
        if (schema.maxLength) {
          return 'x'.repeat(schema.maxLength + 1);
        }
        return 123; // 類型錯誤

      case 'number':
      case 'integer':
        if (schema.minimum !== undefined) {
          return schema.minimum - 1;
        }
        if (schema.maximum !== undefined) {
          return schema.maximum + 1;
        }
        return 'not-a-number'; // 類型錯誤

      case 'boolean':
        return 'not-a-boolean'; // 類型錯誤

      case 'array':
        if (schema.minItems) {
          return []; // 長度不足
        }
        return 'not-an-array'; // 類型錯誤

      case 'object':
        return []; // 類型錯誤

      default:
        return undefined;
    }
  }
}
