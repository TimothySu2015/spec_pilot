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
    expect(flow.steps[0].expectations.status).toBe(200);
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
});
