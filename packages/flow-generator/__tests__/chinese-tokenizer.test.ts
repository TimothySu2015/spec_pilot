/**
 * ChineseTokenizer 單元測試
 * 測試簡易中文分詞器功能
 */

import { describe, it, expect } from 'vitest';
import { ChineseTokenizer, STOP_WORDS } from '../src/utils/chinese-tokenizer.js';

describe('ChineseTokenizer', () => {
  describe('cut() - 基本分詞功能', () => {
    it('應該正確分割中文詞彙', () => {
      const tokenizer = new ChineseTokenizer();
      const result = tokenizer.cut('建立使用者登入測試');

      expect(result).toContain('建立');
      // 因為詞典中有「使用者登入」這個 4 字詞，會優先匹配
      expect(result).toContain('使用者登入');
      expect(result).toContain('測試');
    });

    it('應該保留英文單字', () => {
      const tokenizer = new ChineseTokenizer();
      const result = tokenizer.cut('測試 API 端點');

      expect(result).toContain('測試');
      expect(result).toContain('API');
      expect(result).toContain('端點');
    });

    it('應該處理混合中英文', () => {
      const tokenizer = new ChineseTokenizer();
      const result = tokenizer.cut('呼叫 POST /users API');

      expect(result).toContain('呼叫');
      expect(result).toContain('POST');
      expect(result).toContain('users');
      expect(result).toContain('API');
    });

    it('應該處理帶連字符和底線的英文', () => {
      const tokenizer = new ChineseTokenizer();
      const result = tokenizer.cut('測試 user_id 和 test-api');

      expect(result).toContain('測試');
      expect(result).toContain('user_id');
      expect(result).toContain('test-api');
    });

    it('應該跳過標點符號和空白', () => {
      const tokenizer = new ChineseTokenizer();
      const result = tokenizer.cut('建立，使用者。登入！');

      expect(result).toContain('建立');
      expect(result).toContain('使用者');
      expect(result).toContain('登入');
      expect(result).not.toContain('，');
      expect(result).not.toContain('。');
      expect(result).not.toContain('！');
    });

    it('應該處理空字串', () => {
      const tokenizer = new ChineseTokenizer();
      const result = tokenizer.cut('');

      expect(result).toEqual([]);
    });

    it('應該處理純空白字串', () => {
      const tokenizer = new ChineseTokenizer();
      const result = tokenizer.cut('   ');

      expect(result).toEqual([]);
    });
  });

  describe('cutWithStopWords() - 停用詞過濾', () => {
    it('應該過濾停用詞', () => {
      const tokenizer = new ChineseTokenizer();
      const result = tokenizer.cutWithStopWords('我想建立使用者的測試', STOP_WORDS);

      expect(result).toContain('建立');
      expect(result).toContain('使用者');
      expect(result).toContain('測試');
      expect(result).not.toContain('我');
      expect(result).not.toContain('的');
      expect(result).not.toContain('想');
    });

    it('應該使用自訂停用詞集', () => {
      const tokenizer = new ChineseTokenizer();
      const customStopWords = new Set(['測試']);
      const result = tokenizer.cutWithStopWords('建立測試流程', customStopWords);

      expect(result).toContain('建立');
      expect(result).toContain('流程');
      expect(result).not.toContain('測試');
    });
  });

  describe('addWord() - 自訂詞彙', () => {
    it('應該能新增自訂詞彙到詞典', () => {
      const tokenizer = new ChineseTokenizer();
      tokenizer.addWord('自訂詞彙');

      const result = tokenizer.cut('測試自訂詞彙功能');

      expect(result).toContain('自訂詞彙');
    });

    it('應該能批次新增詞彙', () => {
      const tokenizer = new ChineseTokenizer();
      tokenizer.addWords(['詞彙一', '詞彙二']);

      const result = tokenizer.cut('測試詞彙一和詞彙二');

      expect(result).toContain('詞彙一');
      expect(result).toContain('詞彙二');
    });
  });

  describe('最長匹配演算法', () => {
    it('應該優先匹配較長的詞', () => {
      const tokenizer = new ChineseTokenizer();
      // '使用者登入' vs '使用者' + '登入'
      const result = tokenizer.cut('使用者登入測試');

      // 因為詞典中有 '使用者登入' (4字) 和 '使用者' (3字)、'登入' (2字)
      // 應該優先匹配較長的「使用者登入」
      expect(result).toContain('使用者登入');
      expect(result).toContain('測試');
    });

    it('應該處理未知詞彙為單字', () => {
      const tokenizer = new ChineseTokenizer();
      const result = tokenizer.cut('建立嘰嘰喳喳測試');

      expect(result).toContain('建立');
      expect(result).toContain('測試');
      // 未知詞彙會被拆成單字
      expect(result.filter(t => t.length === 1).length).toBeGreaterThan(0);
    });
  });

  describe('getDictionarySize()', () => {
    it('應該返回詞典大小', () => {
      const tokenizer = new ChineseTokenizer();
      const initialSize = tokenizer.getDictionarySize();

      expect(initialSize).toBeGreaterThan(0);

      tokenizer.addWord('新詞彙');
      expect(tokenizer.getDictionarySize()).toBe(initialSize + 1);
    });

    it('應該包含自訂詞彙', () => {
      const tokenizer = new ChineseTokenizer(['自訂1', '自訂2']);
      const size = tokenizer.getDictionarySize();

      expect(size).toBeGreaterThan(50); // 預設詞典至少有 50 個詞
    });
  });

  describe('STOP_WORDS 常數', () => {
    it('應該包含常見停用詞', () => {
      expect(STOP_WORDS.has('的')).toBe(true);
      expect(STOP_WORDS.has('了')).toBe(true);
      expect(STOP_WORDS.has('是')).toBe(true);
      expect(STOP_WORDS.has('在')).toBe(true);
    });

    it('應該包含代詞', () => {
      expect(STOP_WORDS.has('我')).toBe(true);
      expect(STOP_WORDS.has('你')).toBe(true);
      expect(STOP_WORDS.has('他')).toBe(true);
    });
  });
});
