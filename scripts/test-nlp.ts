#!/usr/bin/env tsx
/**
 * NLP 自然語言解析互動式測試工具
 *
 * 使用方式:
 * pnpm exec tsx scripts/test-nlp.ts
 *
 * 或直接輸入測試語句:
 * pnpm exec tsx scripts/test-nlp.ts "建立使用者登入測試"
 */

import { NLPFlowParser } from '../packages/flow-generator/src/nlp-parser.js';
import type { ConversationContext } from '../packages/flow-generator/src/types.js';

// 創建模擬的 OpenAPI 規格
const mockSpec = {
  openapi: '3.0.0',
  info: { title: 'Test API', version: '1.0.0' },
  paths: {
    '/users': {
      get: {
        operationId: 'listUsers',
        summary: '取得使用者列表',
      },
      post: {
        operationId: 'createUser',
        summary: '建立使用者',
      },
    },
    '/users/{id}': {
      get: {
        operationId: 'getUser',
        summary: '取得單一使用者',
      },
      put: {
        operationId: 'updateUser',
        summary: '更新使用者',
      },
      delete: {
        operationId: 'deleteUser',
        summary: '刪除使用者',
      },
    },
    '/auth/login': {
      post: {
        operationId: 'login',
        summary: '使用者登入',
      },
    },
    '/orders': {
      get: {
        operationId: 'listOrders',
        summary: '取得訂單列表',
      },
      post: {
        operationId: 'createOrder',
        summary: '建立訂單',
      },
    },
  },
};

// 創建模擬的對話上下文
function createContext(hasSteps = false): ConversationContext {
  return {
    contextId: 'interactive-test',
    currentFlow: {
      name: '互動式測試流程',
      steps: hasSteps ? [
        {
          name: '登入步驟',
          request: {
            method: 'POST',
            path: '/auth/login',
          },
        } as any,
      ] : [],
    },
    extractedVariables: {},
    conversationHistory: [],
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  };
}

// 格式化輸出結果
function formatResult(input: string, result: any) {
  console.log('\n' + '='.repeat(70));
  console.log('📝 輸入:', input);
  console.log('─'.repeat(70));
  console.log('🎯 意圖 (action):', result.action);
  console.log('🔢 信心度 (confidence):', (result.confidence * 100).toFixed(1) + '%');
  console.log('\n📦 提取的實體 (entities):');

  if (result.entities.method) {
    console.log('  ├─ HTTP 方法:', result.entities.method);
  }

  if (result.entities.endpoint) {
    console.log('  ├─ 端點:', result.entities.endpoint);
  }

  if (result.entities.parameters && Object.keys(result.entities.parameters).length > 0) {
    console.log('  ├─ 參數:');
    for (const [key, value] of Object.entries(result.entities.parameters)) {
      console.log(`  │   ├─ ${key}: ${value}`);
    }
  }

  if (result.entities.validations && result.entities.validations.length > 0) {
    console.log('  └─ 驗證規則:');
    result.entities.validations.forEach((v: any, i: number) => {
      const isLast = i === result.entities.validations.length - 1;
      const prefix = isLast ? '      └─' : '      ├─';
      console.log(`${prefix} ${v.field} - ${v.rule}${v.value ? ` = ${v.value}` : ''}`);
    });
  }

  console.log('='.repeat(70) + '\n');
}

// 主函數
async function main() {
  const parser = new NLPFlowParser({ spec: mockSpec });
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // 命令行模式：測試單一語句
    const input = args.join(' ');
    const result = await parser.parse(input);
    formatResult(input, result);
  } else {
    // 互動模式：顯示範例
    console.log('\n🚀 NLP 自然語言解析測試工具');
    console.log('=' .repeat(70));
    console.log('\n📚 測試範例：\n');

    const examples = [
      // 建立 Flow
      { text: '建立使用者登入測試', hasContext: false },
      { text: '測試登入 API，使用 POST /auth/login', hasContext: false },

      // HTTP 方法識別
      { text: '建立訂單', hasContext: false },
      { text: '查詢使用者資料', hasContext: false },
      { text: '更新使用者資訊', hasContext: false },
      { text: '刪除使用者', hasContext: false },

      // 新增步驟（需要上下文）
      { text: '然後取得使用者列表', hasContext: true },
      { text: '接著查詢訂單', hasContext: true },

      // 參數提取
      { text: '新增步驟：建立訂單，參數 user_id:123 product:apple', hasContext: false },
      { text: '建立使用者 username 是 testuser email 是 test@example.com', hasContext: false },

      // 驗證規則
      { text: '新增驗證 email 欄位不為空', hasContext: false },
      { text: '驗證 status 等於 success', hasContext: false },
    ];

    for (const example of examples) {
      const context = example.hasContext ? createContext(true) : undefined;
      const result = await parser.parse(example.text, context);
      formatResult(example.text, result);

      // 暫停一下讓輸出更清楚
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n💡 提示：你可以直接測試自己的語句：');
    console.log('   pnpm exec tsx scripts/test-nlp.ts "你的自然語言測試"');
    console.log('');
  }
}

main().catch(console.error);
