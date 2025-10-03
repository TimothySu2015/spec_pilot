import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { exportToJsonSchema } from '../src/utils/export-json-schema';
import { FlowDefinitionSchema } from '../src/flow-schema';

const ajvFactory = () => {
  const ajv = new Ajv({ allErrors: true, verbose: true, strict: false });
  addFormats(ajv);
  return ajv;
};

describe('exportToJsonSchema', () => {
  it('應該可以將 FlowDefinitionSchema 轉為 JSON Schema', () => {
    const jsonSchema = exportToJsonSchema(FlowDefinitionSchema, { name: 'FlowDefinition' });

    expect(jsonSchema).toBeDefined();
    expect(typeof jsonSchema).toBe('object');
  });

  it('產生的 JSON Schema 應可被 AJV 編譯', () => {
    const jsonSchema = exportToJsonSchema(FlowDefinitionSchema);
    const ajv = ajvFactory();

    expect(() => ajv.compile(jsonSchema)).not.toThrow();
  });

  it('有效的 Flow 應同時通過 Zod 與 JSON Schema 驗證', () => {
    const validFlow = {
      name: '使用者流程',
      baseUrl: 'http://localhost:3000',
      options: {
        timeout: 3000,
      },
      steps: [
        {
          name: '登入',
          request: {
            method: 'POST',
            path: '/auth/login',
            headers: {
              'Content-Type': 'application/json',
            },
            body: {
              username: 'admin',
              password: '123456',
            },
          },
          expect: {
            statusCode: 200,
            bodyFields: [
              {
                fieldName: 'token',
              },
            ],
          },
          validation: [
            { rule: 'notNull', path: 'token' },
          ],
          capture: [
            { variableName: 'token', path: 'token' },
          ],
        },
      ],
    };

    const zodResult = FlowDefinitionSchema.safeParse(validFlow);
    expect(zodResult.success).toBe(true);

    const ajv = ajvFactory();
    const validate = ajv.compile(exportToJsonSchema(FlowDefinitionSchema));
    expect(validate(validFlow)).toBe(true);
  });

  it('無效的 HTTP 方法應被拒絕', () => {
    const invalidFlow = {
      name: '錯誤流程',
      steps: [
        {
          name: '錯誤步驟',
          request: {
            method: 'FETCH',
            path: '/',
          },
          expect: {
            statusCode: 200,
          },
        },
      ],
    };

    expect(FlowDefinitionSchema.safeParse(invalidFlow).success).toBe(false);

    const ajv = ajvFactory();
    const validate = ajv.compile(exportToJsonSchema(FlowDefinitionSchema));
    expect(validate(invalidFlow)).toBe(false);
  });

  it('無效的 statusCode 應被拒絕', () => {
    const invalidFlow = {
      name: '錯誤流程',
      steps: [
        {
          name: '錯誤步驟',
          request: {
            method: 'GET',
            path: '/',
          },
          expect: {
            statusCode: 99,
          },
        },
      ],
    };

    expect(FlowDefinitionSchema.safeParse(invalidFlow).success).toBe(false);

    const ajv = ajvFactory();
    const validate = ajv.compile(exportToJsonSchema(FlowDefinitionSchema));
    expect(validate(invalidFlow)).toBe(false);
  });

  it('JSON Schema 應將 baseUrl 視為選用欄位', () => {
    const jsonSchema = exportToJsonSchema(FlowDefinitionSchema) as any;

    expect(jsonSchema).toHaveProperty('properties.baseUrl');
    if (Array.isArray(jsonSchema.required)) {
      expect(jsonSchema.required).toContain('name');
      expect(jsonSchema.required).toContain('steps');
      expect(jsonSchema.required).not.toContain('baseUrl');
    }
  });
});
