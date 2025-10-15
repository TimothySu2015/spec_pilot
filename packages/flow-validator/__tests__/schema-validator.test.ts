/**
 * Schema Validator 單元測試
 */

import { describe, test, expect } from 'vitest';
import { SchemaValidator } from '../src/schema-validator.js';
import type { FlowDefinition } from '@specpilot/flow-parser';

describe('SchemaValidator', () => {
  test('應該驗證合法的 Flow 定義', () => {
    const validator = new SchemaValidator();

    const flow: FlowDefinition = {
      name: '測試流程',
      steps: [
        {
          id: 'step1',
          operationId: 'getUser',
          request: {},
        },
      ],
    };

    const errors = validator.validate(flow);
    expect(errors).toHaveLength(0);
  });

  test('應該偵測缺少必要欄位', () => {
    const validator = new SchemaValidator();

    const flow = {
      steps: [
        {
          id: 'step1',
          request: {},
        },
      ],
    } as unknown as FlowDefinition;

    const errors = validator.validate(flow);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes('name'))).toBe(true);
  });

  test('應該偵測重複的步驟 ID', () => {
    const validator = new SchemaValidator();

    const flow: FlowDefinition = {
      name: '測試流程',
      steps: [
        { id: 'step1', operationId: 'getUser', request: {} },
        { id: 'step1', operationId: 'createUser', request: {} },
      ],
    };

    const errors = validator.validateUniqueStepIds(flow);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('重複的步驟 ID');
  });
});
