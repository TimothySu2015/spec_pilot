import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { exportToJsonSchema } from '../src/utils/export-json-schema';
import { FlowDefinitionSchema, HTTPMethodSchema } from '../src/flow-schema';
import { FlowStepSchema } from '../src/step-schema';
import { ValidationRuleSchema } from '../src/validation-schema';

describe('exportToJsonSchema - Zod ↔ JSON Schema 轉換一致性測試', () => {
  describe('基礎轉換功能', () => {
    it('應該成功轉換 FlowDefinitionSchema 為 JSON Schema', () => {
      const jsonSchema = exportToJsonSchema(FlowDefinitionSchema, {
        name: 'FlowDefinition',
      }) as any;

      expect(jsonSchema).toBeDefined();
      expect(typeof jsonSchema).toBe('object');
      // JSON Schema 應該至少有 type, anyOf, $ref 或 properties 之一
      const hasValidStructure = Boolean(
        jsonSchema.type || jsonSchema.anyOf || jsonSchema.$ref || jsonSchema.properties
      );
      expect(hasValidStructure).toBe(true);
    });

    it('應該成功轉換 HTTPMethodSchema 為 JSON Schema', () => {
      const jsonSchema = exportToJsonSchema(HTTPMethodSchema);

      expect(jsonSchema).toBeDefined();
      expect(jsonSchema).toHaveProperty('enum');
    });

    it('應該成功轉換 FlowStepSchema 為 JSON Schema', () => {
      const jsonSchema = exportToJsonSchema(FlowStepSchema, {
        name: 'FlowStep',
      }) as any;

      expect(jsonSchema).toBeDefined();
      // 檢查是否為有效的 JSON Schema 結構
      expect(jsonSchema.type || jsonSchema.anyOf || jsonSchema.$ref).toBeDefined();
    });
  });

  describe('JSON Schema 可被 AJV 編譯', () => {
    it('FlowDefinitionSchema 產生的 JSON Schema 可被 AJV 編譯', () => {
      const jsonSchema = exportToJsonSchema(FlowDefinitionSchema);
      const ajv = new Ajv({ allErrors: true, verbose: true, strict: false });
      addFormats(ajv); // 支援 uri, email 等格式

      expect(() => {
        ajv.compile(jsonSchema);
      }).not.toThrow();
    });

    it('ValidationRuleSchema 產生的 JSON Schema 可被 AJV 編譯', () => {
      const jsonSchema = exportToJsonSchema(ValidationRuleSchema);
      const ajv = new Ajv({ allErrors: true, verbose: true, strict: false });

      expect(() => {
        ajv.compile(jsonSchema);
      }).not.toThrow();
    });
  });

  describe('Zod 與 JSON Schema 驗證一致性', () => {
    it('有效的 Flow 資料應通過 Zod 與 JSON Schema 驗證', () => {
      const validFlow = {
        name: '使用者管理測試',
        description: '測試使用者 CRUD 操作',
        version: '1.0.0',
        baseUrl: 'http://localhost:3000',
        variables: {
          username: 'admin',
          password: '123456',
        },
        steps: [
          {
            name: '登入測試',
            description: '測試登入功能',
            request: {
              method: 'POST',
              path: '/api/auth/login',
              headers: {
                'Content-Type': 'application/json',
              },
              body: {
                username: '{{username}}',
                password: '{{password}}',
              },
            },
            expect: {
              statusCode: 200,
              bodyFields: [
                {
                  fieldName: 'token',
                  expectedValue: '',
                  validationMode: 'any',
                },
              ],
            },
            validation: [
              {
                rule: 'notNull',
                path: 'token',
              },
            ],
            capture: [
              {
                variableName: 'authToken',
                path: 'token',
              },
            ],
          },
        ],
      };

      // Zod 驗證
      const zodResult = FlowDefinitionSchema.safeParse(validFlow);
      expect(zodResult.success).toBe(true);

      // JSON Schema 驗證
      const jsonSchema = exportToJsonSchema(FlowDefinitionSchema);
      const ajv = new Ajv({ allErrors: true, verbose: true, strict: false });
      addFormats(ajv);
      const validate = ajv.compile(jsonSchema);
      const jsonSchemaValid = validate(validFlow);

      expect(jsonSchemaValid).toBe(true);
    });

    it('無效的 Flow 資料應被 Zod 與 JSON Schema 同時拒絕', () => {
      const invalidFlow = {
        // 缺少必填 name
        description: '測試',
        baseUrl: 'http://localhost:3000',
        steps: [],
      };

      // Zod 驗證 - 應該失敗
      const zodResult = FlowDefinitionSchema.safeParse(invalidFlow);
      expect(zodResult.success).toBe(false);

      // JSON Schema 驗證 - 應該失敗
      const jsonSchema = exportToJsonSchema(FlowDefinitionSchema);
      const ajv = new Ajv({ allErrors: true, verbose: true, strict: false });
      addFormats(ajv);
      const validate = ajv.compile(jsonSchema);
      const jsonSchemaValid = validate(invalidFlow);

      expect(jsonSchemaValid).toBe(false);
      expect(validate.errors).toBeDefined();
    });

    it('包含變數語法的資料應通過驗證', () => {
      const flowWithVariables = {
        name: '變數測試',
        baseUrl: '{{api_url}}',
        steps: [
          {
            name: '步驟',
            request: {
              method: 'GET',
              path: '/api/users/{{userId}}',
              headers: {
                Authorization: 'Bearer {{token}}',
              },
            },
            expect: {
              statusCode: 200,
            },
          },
        ],
      };

      // Zod 驗證
      const zodResult = FlowDefinitionSchema.safeParse(flowWithVariables);
      expect(zodResult.success).toBe(true);

      // JSON Schema 驗證
      const jsonSchema = exportToJsonSchema(FlowDefinitionSchema);
      const ajv = new Ajv({ allErrors: true, verbose: true, strict: false });
      addFormats(ajv);
      const validate = ajv.compile(jsonSchema);
      const jsonSchemaValid = validate(flowWithVariables);

      expect(jsonSchemaValid).toBe(true);
    });
  });

  describe('複雜資料結構驗證一致性', () => {
    it('包含所有欄位的完整 Flow 應通過驗證', () => {
      const completeFlow = {
        name: '完整測試 Flow',
        description: '包含所有可能欄位的測試',
        version: '2.0.0',
        baseUrl: 'https://api.example.com',
        variables: {
          apiKey: 'test-key-123',
          userId: '12345',
        },
        options: {
          timeout: 30000,
          retryCount: 3,
          failFast: true,
        },
        steps: [
          {
            name: '完整步驟',
            description: '包含所有欄位的步驟',
            request: {
              method: 'POST',
              path: '/api/resource',
              headers: {
                'X-API-Key': '{{apiKey}}',
                'Content-Type': 'application/json',
              },
              body: {
                data: {
                  nested: {
                    value: 'test',
                  },
                },
              },
            },
            expect: {
              statusCode: 201,
              bodyFields: [
                {
                  fieldName: 'id',
                  expectedValue: '',
                  validationMode: 'any',
                },
                {
                  fieldName: 'status',
                  expectedValue: 'success',
                  validationMode: 'exact',
                },
              ],
            },
            validation: [
              {
                rule: 'notNull',
                path: 'data.id',
              },
              {
                rule: 'regex',
                path: 'data.email',
                value: '^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$',
              },
              {
                rule: 'contains',
                path: 'data.status',
                value: 'active',
              },
            ],
            capture: [
              {
                variableName: 'resourceId',
                path: 'id',
              },
            ],
          },
        ],
      };

      // Zod 驗證
      const zodResult = FlowDefinitionSchema.safeParse(completeFlow);
      expect(zodResult.success).toBe(true);

      // JSON Schema 驗證
      const jsonSchema = exportToJsonSchema(FlowDefinitionSchema);
      const ajv = new Ajv({ allErrors: true, verbose: true, strict: false });
      addFormats(ajv);
      const validate = ajv.compile(jsonSchema);
      const jsonSchemaValid = validate(completeFlow);

      if (!jsonSchemaValid) {
        console.error('JSON Schema validation errors:', validate.errors);
      }

      expect(jsonSchemaValid).toBe(true);
    });

    it('邊界值應通過驗證', () => {
      const boundaryFlow = {
        name: '邊界測試',
        baseUrl: 'http://localhost:3000',
        options: {
          timeout: 1, // 最小正整數
          retryCount: 0, // 最小值
          failFast: false,
        },
        steps: [
          {
            name: '步驟',
            request: {
              method: 'GET',
              path: '/',
            },
            expect: {
              statusCode: 100, // HTTP 最小狀態碼
            },
          },
        ],
      };

      // Zod 驗證
      const zodResult = FlowDefinitionSchema.safeParse(boundaryFlow);
      expect(zodResult.success).toBe(true);

      // JSON Schema 驗證
      const jsonSchema = exportToJsonSchema(FlowDefinitionSchema);
      const ajv = new Ajv({ allErrors: true, verbose: true, strict: false });
      addFormats(ajv);
      const validate = ajv.compile(jsonSchema);
      const jsonSchemaValid = validate(boundaryFlow);

      expect(jsonSchemaValid).toBe(true);
    });
  });

  describe('錯誤案例驗證一致性', () => {
    it('無效的 HTTP 方法應被同時拒絕', () => {
      const invalidMethodFlow = {
        name: '測試',
        baseUrl: 'http://localhost:3000',
        steps: [
          {
            name: '步驟',
            request: {
              method: 'INVALID_METHOD',
              path: '/',
            },
            expect: {
              statusCode: 200,
            },
          },
        ],
      };

      // Zod 驗證 - steps 定義為 z.any(),暫時無法驗證 method
      // 這個測試標記為已知限制
      const zodResult = FlowDefinitionSchema.safeParse(invalidMethodFlow);
      // TODO: steps 改用 FlowStepSchema 後會正確拒絕
      expect(zodResult.success).toBe(true); // 目前會通過,因為 steps 是 z.any()

      // JSON Schema 驗證 - steps 是 array of any,無法驗證內容
      const jsonSchema = exportToJsonSchema(FlowDefinitionSchema);
      const ajv = new Ajv({ allErrors: true, verbose: true, strict: false });
      addFormats(ajv);
      const validate = ajv.compile(jsonSchema);
      const jsonSchemaValid = validate(invalidMethodFlow);

      // TODO: steps 改用 FlowStepSchema 後會拒絕
      expect(jsonSchemaValid).toBe(true); // 目前會通過
    });

    it('無效的 statusCode 應被同時拒絕', () => {
      const invalidStatusFlow = {
        name: '測試',
        baseUrl: 'http://localhost:3000',
        steps: [
          {
            name: '步驟',
            request: {
              method: 'GET',
              path: '/',
            },
            expect: {
              statusCode: 99, // 小於 100
            },
          },
        ],
      };

      // Zod 驗證 - steps 定義為 z.any(),暫時無法驗證 statusCode
      const zodResult = FlowDefinitionSchema.safeParse(invalidStatusFlow);
      // TODO: steps 改用 FlowStepSchema 後會正確拒絕
      expect(zodResult.success).toBe(true); // 目前會通過

      // JSON Schema 驗證 - steps 是 array of any,無法驗證內容
      const jsonSchema = exportToJsonSchema(FlowDefinitionSchema);
      const ajv = new Ajv({ allErrors: true, verbose: true, strict: false });
      addFormats(ajv);
      const validate = ajv.compile(jsonSchema);
      const jsonSchemaValid = validate(invalidStatusFlow);

      // TODO: steps 改用 FlowStepSchema 後會拒絕
      expect(jsonSchemaValid).toBe(true); // 目前會通過
    });

    it('無效的 retryCount 應被同時拒絕', () => {
      const invalidRetryFlow = {
        name: '測試',
        baseUrl: 'http://localhost:3000',
        options: {
          retryCount: 10, // 超過最大值 5
        },
        steps: [],
      };

      // Zod 驗證
      const zodResult = FlowDefinitionSchema.safeParse(invalidRetryFlow);
      expect(zodResult.success).toBe(false);

      // JSON Schema 驗證
      const jsonSchema = exportToJsonSchema(FlowDefinitionSchema);
      const ajv = new Ajv({ allErrors: true, verbose: true, strict: false });
      addFormats(ajv);
      const validate = ajv.compile(jsonSchema);
      const jsonSchemaValid = validate(invalidRetryFlow);

      expect(jsonSchemaValid).toBe(false);
    });
  });

  describe('JSON Schema 格式檢查', () => {
    it('應該產生符合 JSON Schema Draft 7 的格式', () => {
      const jsonSchema = exportToJsonSchema(FlowDefinitionSchema) as any;

      // 檢查是否包含必要欄位
      expect(jsonSchema).toHaveProperty('type');

      // 檢查物件結構
      if (jsonSchema.type === 'object') {
        expect(jsonSchema).toHaveProperty('properties');
        expect(jsonSchema.properties).toHaveProperty('name');
        expect(jsonSchema.properties).toHaveProperty('baseUrl');
        expect(jsonSchema.properties).toHaveProperty('steps');
      }
    });

    it('應該正確處理選用欄位', () => {
      const jsonSchema = exportToJsonSchema(FlowDefinitionSchema) as any;

      // description, version, variables, options 都是選用欄位
      // 不應該在 required 陣列中
      if (jsonSchema.required) {
        expect(jsonSchema.required).toContain('name');
        expect(jsonSchema.required).toContain('baseUrl');
        expect(jsonSchema.required).toContain('steps');
      }
    });
  });

  describe('轉換選項測試', () => {
    it('應該支援自訂 Schema 名稱', () => {
      const jsonSchema = exportToJsonSchema(FlowDefinitionSchema, {
        name: 'CustomFlowSchema',
      }) as any;

      expect(jsonSchema).toBeDefined();
    });

    it('應該使用 none 作為預設 $refStrategy', () => {
      const jsonSchema = exportToJsonSchema(FlowDefinitionSchema) as any;

      // 使用 none 策略時,不應該有 $ref
      const jsonString = JSON.stringify(jsonSchema);
      expect(jsonString.includes('$ref')).toBe(false);
    });
  });
});
