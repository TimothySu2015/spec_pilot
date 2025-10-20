/**
 * FlowBuilder CustomRules 使用範例
 *
 * 此範例展示如何使用 FlowBuilder 的 customRules 功能，
 * 涵蓋所有 8 種驗證規則的使用方式。
 */

import { FlowBuilder } from '../src/flow-builder.js';

// ============================================
// 範例 1: 基本 customRules 使用
// ============================================

const basicExample = new FlowBuilder()
  .setName('基本 CustomRules 範例')
  .setDescription('展示 customRules 的基本使用')
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

console.log('基本範例：', JSON.stringify(basicExample, null, 2));

// ============================================
// 範例 2: 所有 8 種驗證規則
// ============================================

const allRulesExample = new FlowBuilder()
  .setName('所有驗證規則範例')
  .setDescription('展示 SpecPilot 支援的 8 種驗證規則')
  .addStep({
    name: '建立完整資料',
    method: 'POST',
    path: '/data',
    expectedStatusCode: 201,
    customRules: [
      // 1. notNull - 欄位不可為 null
      { field: 'id', rule: 'notNull' },

      // 2. regex - 正則表達式驗證
      { field: 'email', rule: 'regex', value: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' },

      // 3. contains - 包含特定值
      { field: 'status', rule: 'contains', value: 'active' },

      // 4. equals - 精確值比對
      { field: 'role', rule: 'equals', value: 'admin' },

      // 5. notContains - 不包含特定值
      { field: 'bio', rule: 'notContains', value: 'spam' },

      // 6. greaterThan - 數值大於
      { field: 'age', rule: 'greaterThan', value: 18 },

      // 7. lessThan - 數值小於
      { field: 'score', rule: 'lessThan', value: 100 },

      // 8. length - 長度驗證
      { field: 'code', rule: 'length', value: 6 },
    ],
  })
  .build();

console.log('\n所有規則範例：', JSON.stringify(allRulesExample, null, 2));

// ============================================
// 範例 3: 複雜驗證場景
// ============================================

const complexExample = new FlowBuilder()
  .setName('複雜驗證場景')
  .setDescription('展示在實際應用中的複雜驗證')
  .addStep({
    name: '登入',
    method: 'POST',
    path: '/auth/login',
    expectedStatusCode: 200,
    customRules: [
      { field: 'token', rule: 'notNull' },
      { field: 'token', rule: 'regex', value: '^[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]+$' }, // JWT 格式
    ],
    extractVariables: {
      authToken: 'token',
    },
  })
  .addStep({
    name: '建立訂單',
    method: 'POST',
    path: '/orders',
    expectedStatusCode: 201,
    parameters: {
      headers: {
        Authorization: 'Bearer ${authToken}',
      },
      body: {
        productId: 123,
        quantity: 2,
      },
    },
    customRules: [
      { field: 'orderId', rule: 'notNull' },
      { field: 'status', rule: 'equals', value: 'pending' },
      { field: 'total', rule: 'greaterThan', value: 0 },
      { field: 'items', rule: 'notNull' },
      { field: 'items', rule: 'length', value: 1 }, // 至少 1 個商品
    ],
  })
  .addStep({
    name: '查詢訂單',
    method: 'GET',
    path: '/orders/${orderId}',
    expectedStatusCode: 200,
    customRules: [
      { field: 'orderId', rule: 'notNull' },
      { field: 'status', rule: 'contains', value: 'pending' },
      { field: 'cancelReason', rule: 'notContains', value: 'fraud' }, // 確保沒有詐騙標記
    ],
  })
  .build();

console.log('\n複雜範例：', JSON.stringify(complexExample, null, 2));

// ============================================
// 範例 4: 向後相容 - 舊格式自動轉換
// ============================================

const backwardCompatibleExample = new FlowBuilder()
  .setName('向後相容範例')
  .setDescription('展示舊格式 validations 自動轉換為 customRules')
  .addStep({
    name: '使用舊格式',
    method: 'GET',
    path: '/users/1',
    expectedStatusCode: 200,
    // ⚠️ 舊格式（已不推薦，但仍支援）
    validations: [
      { field: 'name', rule: 'notNull' },
      { field: 'email', rule: 'regex', value: '@' },
    ],
  })
  .build();

console.log('\n向後相容範例：', JSON.stringify(backwardCompatibleExample, null, 2));
console.log('\n注意：舊格式已自動轉換為 expect.body.customRules');

// ============================================
// 推薦使用方式總結
// ============================================

console.log(`
============================================
✅ 推薦使用方式
============================================

1. 使用 customRules 參數（新格式）:
   customRules: [
     { field: 'id', rule: 'notNull' },
     { field: 'email', rule: 'regex', value: '^[^@]+@[^@]+$' }
   ]

2. 產生的 YAML 格式:
   expect:
     statusCode: 200
     body:
       customRules:
         - field: id
           rule: notNull
         - field: email
           rule: regex
           value: '^[^@]+@[^@]+$'

⚠️ 不推薦使用方式（但仍支援）:
   validations: [...]  # 會自動轉換為 customRules

============================================
`);
