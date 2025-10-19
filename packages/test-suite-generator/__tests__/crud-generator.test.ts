/**
 * CRUD Generator 單元測試
 */

import { describe, test, expect } from 'vitest';
import { CRUDGenerator } from '../src/crud-generator.js';
import type { IEndpointInfo } from '../src/types.js';

describe('CRUDGenerator', () => {
  test('應該為 POST 端點產生 201 成功案例', () => {
    const generator = new CRUDGenerator();

    const endpoint: IEndpointInfo = {
      path: '/users',
      method: 'POST',
      operationId: 'createUser',
      summary: '建立使用者',
      requestSchema: {
        type: 'object',
        properties: {
          username: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
        required: ['username', 'email'],
      },
      responseSchemas: {},
    };

    const steps = generator.generateSuccessCases(endpoint);

    expect(steps).toHaveLength(1);
    expect(steps[0].name).toContain('建立使用者');
    expect(steps[0].expectations.status).toBe(201);
    expect(steps[0].request.body).toBeDefined();
  });

  test('應該根據 schema 產生測試資料', () => {
    const generator = new CRUDGenerator();

    const endpoint: IEndpointInfo = {
      path: '/users',
      method: 'POST',
      operationId: 'createUser',
      requestSchema: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          age: { type: 'integer', minimum: 0 },
        },
        required: ['email', 'age'], // 需要標記為 required 才會產生
      },
      responseSchemas: {},
    };

    const steps = generator.generateSuccessCases(endpoint);
    const body = steps[0].request.body as { email?: string; age?: number };

    // DataSynthesizer 使用 faker.js 產生真實的 email
    expect(body.email).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
    expect(body.age).toBeGreaterThanOrEqual(0);
  });
});
