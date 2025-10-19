/**
 * NLPFlowParser 單元測試
 * 測試自然語言解析器的各項功能
 */

import { describe, it, expect } from 'vitest';
import { NLPFlowParser } from '../src/nlp-parser.js';
import type { ConversationContext } from '../src/types.js';

// ===== 輔助函數 =====

function createMockConfig() {
  return {
    spec: {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {},
    },
  };
}

function createMockContext(hasSteps = false): ConversationContext {
  return {
    contextId: 'test-context',
    currentFlow: {
      name: '測試流程',
      steps: hasSteps ? [{ name: '步驟1' } as any] : [],
    },
    extractedVariables: {},
    conversationHistory: [],
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  };
}

// ===== 測試套件 =====

describe('NLPFlowParser', () => {
  describe('parse() - 主解析方法', () => {
    it('應該解析基本的建立 Flow 請求', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('建立使用者登入測試');

      expect(result.action).toBe('create_flow');
      expect(result.entities.endpoint).toContain('使用者' || '登入');
      expect(result.entities.method).toBe('POST');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('應該解析新增步驟請求（有上下文）', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const context = createMockContext(true);
      const result = await parser.parse('然後取得使用者資料', context);

      expect(result.action).toBe('add_step');
      expect(result.entities.method).toBe('GET');
      expect(result.entities.endpoint).toBeTruthy();
    });

    it('應該解析修改步驟請求', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const context = createMockContext(true);
      const result = await parser.parse('修改上一步的參數', context);

      expect(result.action).toBe('modify_step');
    });

    it('應該解析新增驗證請求', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('新增驗證 email 欄位');

      expect(result.action).toBe('add_validation');
    });
  });

  describe('classifyIntent() - 意圖分類', () => {
    it('應該識別「建立 Flow」意圖', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('建立新的測試流程');

      expect(result.action).toBe('create_flow');
    });

    it('應該識別「新增步驟」意圖（有上下文）', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const context = createMockContext(true);
      const result = await parser.parse('接著查詢訂單', context);

      expect(result.action).toBe('add_step');
    });

    it('應該識別「新增驗證」意圖', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('加入驗證規則');

      expect(result.action).toBe('add_validation');
    });

    it('預設建立 Flow（無上下文）', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('測試登入');

      expect(result.action).toBe('create_flow');
    });

    it('預設新增步驟（有上下文）', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const context = createMockContext(true);
      const result = await parser.parse('查詢使用者', context);

      expect(result.action).toBe('add_step');
    });
  });

  describe('identifyHttpMethod() - HTTP 方法識別', () => {
    const testCases = [
      { input: '登入使用者', expected: 'POST' },
      { input: '建立訂單', expected: 'POST' },
      { input: '查詢使用者資料', expected: 'GET' },
      { input: '取得訂單清單', expected: 'GET' },
      { input: '更新使用者資訊', expected: 'PUT' },
      { input: '修改訂單', expected: 'PATCH' },
      { input: '刪除使用者', expected: 'DELETE' },
    ];

    testCases.forEach(({ input, expected }) => {
      it(`應該識別「${input}」為 ${expected}`, async () => {
        const parser = new NLPFlowParser(createMockConfig());
        const result = await parser.parse(input);

        expect(result.entities.method).toBe(expected);
      });
    });

    it('應該在沒有明確動詞時返回 undefined', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('使用者測試');

      expect(result.entities.method).toBeUndefined();
    });
  });

  describe('extractEndpoint() - 端點提取', () => {
    it('應該提取「測試 XXX」模式的端點', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('測試登入');

      expect(result.entities.endpoint).toBe('登入');
    });

    it('應該提取「XXX 的」模式的端點', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('使用者的登入功能');

      expect(result.entities.endpoint).toBeTruthy();
      expect(['使用者', '登入'].some(word => result.entities.endpoint?.includes(word))).toBe(true);
    });

    it('應該提取「XXX API」模式的端點', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('呼叫使用者 API');

      expect(result.entities.endpoint).toBe('使用者');
    });

    it('應該從關鍵字中提取端點（排除動詞）', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('建立訂單');

      // 可能會提取到 "訂單" 或 "建立訂單"（都是合理的）
      expect(result.entities.endpoint).toBeTruthy();
      expect(['訂單', '建立訂單'].some(word => result.entities.endpoint?.includes(word))).toBe(true);
    });
  });

  describe('extractParameters() - 參數提取', () => {
    it('應該提取「key: value」格式的參數', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('username: testuser, password: 123456');

      expect(result.entities.parameters).toBeDefined();
      expect(result.entities.parameters?.username).toBe('testuser');
      expect(result.entities.parameters?.password).toBe(123456); // 數字轉換
    });

    it('應該提取「key 是 value」格式的參數', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('email 是 test@example.com');

      expect(result.entities.parameters?.email).toBe('test@example.com');
    });

    it('應該提取「key = value」格式的參數', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('age = 25');

      expect(result.entities.parameters?.age).toBe(25);
    });

    it('應該正確轉換數字型別', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('count: 100, name: John');

      expect(result.entities.parameters?.count).toBe(100);
      expect(typeof result.entities.parameters?.count).toBe('number');
      expect(result.entities.parameters?.name).toBe('John');
      expect(typeof result.entities.parameters?.name).toBe('string');
    });
  });

  describe('extractValidations() - 驗證規則提取', () => {
    it('應該提取「不能為空」驗證規則', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('email 不能為空');

      expect(result.entities.validations).toBeDefined();
      expect(result.entities.validations).toHaveLength(1);
      expect(result.entities.validations?.[0].field).toBe('email');
      expect(result.entities.validations?.[0].rule).toBe('notNull');
    });

    it('應該提取「必須」驗證規則', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('username 必須填寫');

      expect(result.entities.validations?.[0].field).toBe('username');
      expect(result.entities.validations?.[0].rule).toBe('notNull');
    });

    it('應該提取「格式」驗證規則', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('檢查 email 格式');

      expect(result.entities.validations?.[0].field).toBe('email');
      expect(result.entities.validations?.[0].rule).toBe('regex');
    });

    it('應該提取「包含」驗證規則', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('username 應該包含 admin');

      expect(result.entities.validations?.[0].field).toBe('username');
      expect(result.entities.validations?.[0].rule).toBe('contains');
      expect(result.entities.validations?.[0].value).toBe('admin');
    });
  });

  describe('calculateConfidence() - 信心度計算', () => {
    it('應該有基本信心度', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('測試');

      // "測試" 會提取端點，所以信心度會略低於 0.5（因為缺少其他資訊）
      expect(result.confidence).toBeGreaterThanOrEqual(0.3);
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('有 HTTP method 應該增加信心度', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('建立訂單');

      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('有端點資訊應該增加信心度', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('測試使用者登入');

      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('有參數應該增加信心度', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('建立訂單，username: admin');

      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('有驗證規則應該增加信心度', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('建立訂單，email 不能為空');

      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('完整資訊應該有高信心度', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('建立使用者，username: admin, email 不能為空');

      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('僅有單個動詞時信心度適中', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('建立');

      // "建立" 會識別為 POST method，但缺少端點資訊
      // 所以信心度應該適中
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.confidence).toBeLessThan(0.8);
    });
  });

  describe('完整情境測試', () => {
    it('應該完整解析「建立使用者登入測試」', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('建立使用者登入測試');

      expect(result.action).toBe('create_flow');
      expect(result.entities.method).toBe('POST');
      expect(result.entities.endpoint).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('應該完整解析「查詢使用者資料，username: admin，email 不能為空」', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('查詢使用者資料，username: admin，email 不能為空');

      expect(result.action).toBe('create_flow');
      expect(result.entities.method).toBe('GET');
      expect(result.entities.endpoint).toBeTruthy();
      expect(result.entities.parameters?.username).toBe('admin');
      expect(result.entities.validations).toBeDefined();
      expect(result.entities.validations?.[0].field).toBe('email');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('應該處理複雜的對話上下文', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const context = createMockContext(true);

      // 第一輪：建立登入
      const result1 = await parser.parse('建立使用者登入測試');
      expect(result1.action).toBe('create_flow');

      // 第二輪：新增查詢
      const result2 = await parser.parse('然後查詢使用者資料', context);
      expect(result2.action).toBe('add_step');

      // 第三輪：新增驗證
      const result3 = await parser.parse('新增驗證 email 欄位', context);
      expect(result3.action).toBe('add_validation');
    });

    it('應該處理空輸入', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('');

      expect(result.action).toBe('create_flow');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('應該處理純英文輸入', async () => {
      const parser = new NLPFlowParser(createMockConfig());
      const result = await parser.parse('create user test');

      expect(result.action).toBe('create_flow');
      expect(result.entities.endpoint).toBeTruthy();
    });
  });
});
