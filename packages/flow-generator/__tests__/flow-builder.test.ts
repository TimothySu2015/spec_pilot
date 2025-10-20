/**
 * Flow Builder 單元測試
 */

import { describe, test, expect } from 'vitest';
import { FlowBuilder } from '../src/flow-builder.js';

describe('FlowBuilder', () => {
  test('應該建立基本的 Flow 結構', () => {
    const builder = new FlowBuilder();

    const flow = builder
      .setName('測試流程')
      .setDescription('測試描述')
      .addStep({
        name: '取得使用者',
        method: 'GET',
        path: '/users/123',
        expectedStatusCode: 200,
      })
      .build();

    expect(flow.name).toBe('測試流程');
    expect(flow.description).toBe('測試描述');
    expect(flow.steps).toHaveLength(1);
    expect(flow.steps[0].name).toBe('取得使用者');
    expect(flow.steps[0].request.method).toBe('GET');
    expect(flow.steps[0].request.path).toBe('/users/123');
    expect(flow.steps[0].expect.statusCode).toBe(200);
  });

  test('應該正確設定步驟名稱', () => {
    const builder = new FlowBuilder();

    builder.addStep({
      name: '建立使用者',
      method: 'POST',
      path: '/users',
      expectedStatusCode: 201,
    });
    builder.addStep({
      name: '取得使用者',
      method: 'GET',
      path: '/users/1',
      expectedStatusCode: 200,
    });

    const flow = builder.build();

    expect(flow.steps[0].name).toBe('建立使用者');
    expect(flow.steps[1].name).toBe('取得使用者');
  });

  test('應該支援變數提取', () => {
    const builder = new FlowBuilder();

    const flow = builder
      .addStep({
        name: '建立使用者',
        method: 'POST',
        path: '/users',
        expectedStatusCode: 201,
        extractVariables: {
          userId: 'id',
        },
      })
      .build();

    expect(flow.steps[0].capture).toEqual([
      { variableName: 'userId', path: 'id' }
    ]);
  });

  test('建構空 Flow 時應該拋出錯誤', () => {
    const builder = new FlowBuilder();

    expect(() => builder.build()).toThrow('Flow 必須至少包含一個步驟');
  });

  // ============================================
  // Phase 12: CustomRules 驗證規則測試
  // ============================================

  describe('CustomRules 驗證規則', () => {
    test('應該支援 customRules 驗證規則', () => {
      const builder = new FlowBuilder();

      const flow = builder
        .addStep({
          name: '建立使用者',
          method: 'POST',
          path: '/users',
          expectedStatusCode: 201,
          customRules: [
            { field: 'id', rule: 'notNull' },
            { field: 'email', rule: 'regex', value: '^[^@]+@[^@]+$' },
          ],
        })
        .build();

      expect(flow.steps[0].expect.body).toBeDefined();
      expect(flow.steps[0].expect.body).toHaveProperty('customRules');
      expect(flow.steps[0].expect.body.customRules).toHaveLength(2);
      expect(flow.steps[0].expect.body.customRules[0]).toEqual({
        field: 'id',
        rule: 'notNull',
      });
      expect(flow.steps[0].expect.body.customRules[1]).toEqual({
        field: 'email',
        rule: 'regex',
        value: '^[^@]+@[^@]+$',
      });
    });

    test('應該支援單一 customRule', () => {
      const builder = new FlowBuilder();

      const flow = builder
        .addStep({
          name: '查詢使用者',
          method: 'GET',
          path: '/users/1',
          expectedStatusCode: 200,
          customRules: [{ field: 'name', rule: 'notNull' }],
        })
        .build();

      expect(flow.steps[0].expect.body).toBeDefined();
      expect(flow.steps[0].expect.body.customRules).toHaveLength(1);
    });

    test('當沒有 customRules 時，expect.body.customRules 不應存在', () => {
      const builder = new FlowBuilder();

      const flow = builder
        .addStep({
          name: '取得使用者',
          method: 'GET',
          path: '/users/1',
          expectedStatusCode: 200,
        })
        .build();

      expect(flow.steps[0].expect.body).toBeUndefined();
    });

    test('應該支援多個規則組合', () => {
      const builder = new FlowBuilder();

      const flow = builder
        .addStep({
          name: '建立訂單',
          method: 'POST',
          path: '/orders',
          expectedStatusCode: 201,
          customRules: [
            { field: 'orderId', rule: 'notNull' },
            { field: 'status', rule: 'contains', value: 'pending' },
            { field: 'total', rule: 'greaterThan', value: 0 },
            { field: 'email', rule: 'regex', value: '@' },
          ],
        })
        .build();

      expect(flow.steps[0].expect.body.customRules).toHaveLength(4);
      expect(flow.steps[0].expect.body.customRules[2]).toEqual({
        field: 'total',
        rule: 'greaterThan',
        value: 0,
      });
    });
  });

  // ============================================
  // Phase 12: 向後相容測試
  // ============================================

  describe('向後相容 - validations 舊格式', () => {
    test('應該支援舊格式 validations 並自動轉換為 customRules', () => {
      const builder = new FlowBuilder();

      const flow = builder
        .addStep({
          name: '查詢使用者',
          method: 'GET',
          path: '/users/1',
          expectedStatusCode: 200,
          validations: [{ field: 'name', rule: 'notNull' }],
        })
        .build();

      // Phase 12: 自動轉換為新格式 expect.body.customRules
      expect(flow.steps[0].expect.body).toBeDefined();
      expect(flow.steps[0].expect.body.customRules).toBeDefined();
      expect(flow.steps[0].expect.body.customRules).toHaveLength(1);
      expect(flow.steps[0].expect.body.customRules[0]).toEqual({
        field: 'name',
        rule: 'notNull',
      });
      // 不應產生舊格式 validation 欄位
      expect(flow.steps[0].validation).toBeUndefined();
    });

    test('customRules 應優先於 validations', () => {
      const builder = new FlowBuilder();

      const flow = builder
        .addStep({
          name: '測試優先順序',
          method: 'GET',
          path: '/test',
          expectedStatusCode: 200,
          customRules: [{ field: 'a', rule: 'notNull' }],
          validations: [{ field: 'b', rule: 'notNull' }],
        })
        .build();

      // customRules 應該優先
      expect(flow.steps[0].expect.body).toBeDefined();
      expect(flow.steps[0].expect.body.customRules).toHaveLength(1);
      expect(flow.steps[0].expect.body.customRules[0].field).toBe('a');

      // validations 應該被忽略
      expect(flow.steps[0].validation).toBeUndefined();
    });

    test('validations 應該正確轉換包含 value 的規則', () => {
      const builder = new FlowBuilder();

      const flow = builder
        .addStep({
          name: '測試轉換',
          method: 'GET',
          path: '/test',
          expectedStatusCode: 200,
          validations: [
            { field: 'email', rule: 'regex', value: '^[^@]+@[^@]+$' },
            { field: 'age', rule: 'greaterThan', value: 18 },
          ],
        })
        .build();

      // Phase 12: 自動轉換為 expect.body.customRules
      expect(flow.steps[0].expect.body.customRules).toHaveLength(2);
      expect(flow.steps[0].expect.body.customRules[0]).toEqual({
        field: 'email',
        rule: 'regex',
        value: '^[^@]+@[^@]+$',
      });
      expect(flow.steps[0].expect.body.customRules[1]).toEqual({
        field: 'age',
        rule: 'greaterThan',
        value: 18,
      });
      // 不應產生舊格式
      expect(flow.steps[0].validation).toBeUndefined();
    });
  });

  // ============================================
  // Phase 12: 所有 8 個驗證規則測試
  // ============================================

  describe('所有 8 個驗證規則', () => {
    test('應該支援 notNull 規則', () => {
      const builder = new FlowBuilder();
      const flow = builder
        .addStep({
          name: '測試 notNull',
          method: 'GET',
          path: '/test',
          customRules: [{ field: 'id', rule: 'notNull' }],
        })
        .build();

      expect(flow.steps[0].expect.body.customRules[0]).toEqual({
        field: 'id',
        rule: 'notNull',
      });
    });

    test('應該支援 regex 規則', () => {
      const builder = new FlowBuilder();
      const flow = builder
        .addStep({
          name: '測試 regex',
          method: 'GET',
          path: '/test',
          customRules: [{ field: 'email', rule: 'regex', value: '^[a-z]+@[a-z]+\\.[a-z]+$' }],
        })
        .build();

      expect(flow.steps[0].expect.body.customRules[0]).toEqual({
        field: 'email',
        rule: 'regex',
        value: '^[a-z]+@[a-z]+\\.[a-z]+$',
      });
    });

    test('應該支援 contains 規則', () => {
      const builder = new FlowBuilder();
      const flow = builder
        .addStep({
          name: '測試 contains',
          method: 'GET',
          path: '/test',
          customRules: [{ field: 'status', rule: 'contains', value: 'active' }],
        })
        .build();

      expect(flow.steps[0].expect.body.customRules[0]).toEqual({
        field: 'status',
        rule: 'contains',
        value: 'active',
      });
    });

    test('應該支援 equals 規則', () => {
      const builder = new FlowBuilder();
      const flow = builder
        .addStep({
          name: '測試 equals',
          method: 'GET',
          path: '/test',
          customRules: [{ field: 'role', rule: 'equals', value: 'admin' }],
        })
        .build();

      expect(flow.steps[0].expect.body.customRules[0]).toEqual({
        field: 'role',
        rule: 'equals',
        value: 'admin',
      });
    });

    test('應該支援 notContains 規則', () => {
      const builder = new FlowBuilder();
      const flow = builder
        .addStep({
          name: '測試 notContains',
          method: 'GET',
          path: '/test',
          customRules: [{ field: 'message', rule: 'notContains', value: 'error' }],
        })
        .build();

      expect(flow.steps[0].expect.body.customRules[0]).toEqual({
        field: 'message',
        rule: 'notContains',
        value: 'error',
      });
    });

    test('應該支援 greaterThan 規則', () => {
      const builder = new FlowBuilder();
      const flow = builder
        .addStep({
          name: '測試 greaterThan',
          method: 'GET',
          path: '/test',
          customRules: [{ field: 'age', rule: 'greaterThan', value: 18 }],
        })
        .build();

      expect(flow.steps[0].expect.body.customRules[0]).toEqual({
        field: 'age',
        rule: 'greaterThan',
        value: 18,
      });
    });

    test('應該支援 lessThan 規則', () => {
      const builder = new FlowBuilder();
      const flow = builder
        .addStep({
          name: '測試 lessThan',
          method: 'GET',
          path: '/test',
          customRules: [{ field: 'price', rule: 'lessThan', value: 100 }],
        })
        .build();

      expect(flow.steps[0].expect.body.customRules[0]).toEqual({
        field: 'price',
        rule: 'lessThan',
        value: 100,
      });
    });

    test('應該支援 length 規則', () => {
      const builder = new FlowBuilder();
      const flow = builder
        .addStep({
          name: '測試 length',
          method: 'GET',
          path: '/test',
          customRules: [{ field: 'username', rule: 'length', value: 5 }],
        })
        .build();

      expect(flow.steps[0].expect.body.customRules[0]).toEqual({
        field: 'username',
        rule: 'length',
        value: 5,
      });
    });

    test('應該支援混合使用所有 8 種規則', () => {
      const builder = new FlowBuilder();
      const flow = builder
        .addStep({
          name: '測試混合規則',
          method: 'POST',
          path: '/test',
          customRules: [
            { field: 'id', rule: 'notNull' },
            { field: 'email', rule: 'regex', value: '@' },
            { field: 'status', rule: 'contains', value: 'active' },
            { field: 'role', rule: 'equals', value: 'user' },
            { field: 'bio', rule: 'notContains', value: 'spam' },
            { field: 'age', rule: 'greaterThan', value: 0 },
            { field: 'score', rule: 'lessThan', value: 100 },
            { field: 'code', rule: 'length', value: 6 },
          ],
        })
        .build();

      expect(flow.steps[0].expect.body.customRules).toHaveLength(8);
      // 驗證每個規則都被正確設定
      expect(flow.steps[0].expect.body.customRules[0].rule).toBe('notNull');
      expect(flow.steps[0].expect.body.customRules[1].rule).toBe('regex');
      expect(flow.steps[0].expect.body.customRules[2].rule).toBe('contains');
      expect(flow.steps[0].expect.body.customRules[3].rule).toBe('equals');
      expect(flow.steps[0].expect.body.customRules[4].rule).toBe('notContains');
      expect(flow.steps[0].expect.body.customRules[5].rule).toBe('greaterThan');
      expect(flow.steps[0].expect.body.customRules[6].rule).toBe('lessThan');
      expect(flow.steps[0].expect.body.customRules[7].rule).toBe('length');
    });
  });
});
