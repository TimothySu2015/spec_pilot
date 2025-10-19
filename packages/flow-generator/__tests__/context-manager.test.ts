/**
 * ContextManager 單元測試
 * 測試對話上下文管理功能
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ContextManager } from '../src/context-manager.js';
import type { ConversationTurn } from '../src/types.js';

// ===== 輔助函數 =====

function resetContextManager() {
  // 重置單例（透過反射）
  (ContextManager as any).instance = undefined;
}

function createMockTurn(overrides?: Partial<ConversationTurn>): ConversationTurn {
  return {
    role: 'user',
    content: '測試訊息',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ===== 測試套件 =====

describe('ContextManager', () => {
  beforeEach(() => {
    // 每個測試前重置單例
    resetContextManager();
    // 重置時間模擬
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getInstance() - 單例模式', () => {
    it('應該返回 ContextManager 實例', () => {
      const manager = ContextManager.getInstance();

      expect(manager).toBeInstanceOf(ContextManager);
    });

    it('應該總是返回相同的實例', () => {
      const manager1 = ContextManager.getInstance();
      const manager2 = ContextManager.getInstance();

      expect(manager1).toBe(manager2);
    });

    it('應該使用預設 config', () => {
      const manager = ContextManager.getInstance();
      const contextId = manager.createContext();
      const context = manager.getContext(contextId);

      expect(context).toBeDefined();
      // 預設 TTL 是 30 分鐘
      const createdAt = new Date(context!.createdAt).getTime();
      const expiresAt = new Date(context!.expiresAt).getTime();
      const ttlMinutes = (expiresAt - createdAt) / (60 * 1000);

      expect(ttlMinutes).toBeCloseTo(30, 0);
    });

    it('應該接受自訂 config（僅首次有效）', () => {
      const manager1 = ContextManager.getInstance({ ttlMinutes: 60 });
      const contextId1 = manager1.createContext();
      const context1 = manager1.getContext(contextId1);

      const createdAt1 = new Date(context1!.createdAt).getTime();
      const expiresAt1 = new Date(context1!.expiresAt).getTime();
      const ttlMinutes1 = (expiresAt1 - createdAt1) / (60 * 1000);

      expect(ttlMinutes1).toBeCloseTo(60, 0);

      // 第二次呼叫 getInstance 會返回相同實例，config 不會改變
      const manager2 = ContextManager.getInstance({ ttlMinutes: 10 });
      expect(manager2).toBe(manager1);
    });
  });

  describe('createContext() - 建立對話上下文', () => {
    it('應該建立新的對話上下文', () => {
      const manager = ContextManager.getInstance();
      const contextId = manager.createContext();

      expect(contextId).toBeTruthy();
      expect(typeof contextId).toBe('string');
    });

    it('應該產生唯一的 contextId', () => {
      const manager = ContextManager.getInstance();
      const contextId1 = manager.createContext();
      const contextId2 = manager.createContext();

      expect(contextId1).not.toBe(contextId2);
    });

    it('contextId 格式應為 "ctx-{timestamp}-{random}"', () => {
      const manager = ContextManager.getInstance();
      const contextId = manager.createContext();

      expect(contextId).toMatch(/^ctx-\d+-[a-z0-9]+$/);
    });

    it('應該初始化上下文的基本結構', () => {
      const manager = ContextManager.getInstance();
      const contextId = manager.createContext();
      const context = manager.getContext(contextId);

      expect(context).toBeDefined();
      expect(context!.contextId).toBe(contextId);
      expect(context!.currentFlow).toEqual({ steps: [] });
      expect(context!.extractedVariables).toEqual({});
      expect(context!.conversationHistory).toEqual([]);
      expect(context!.createdAt).toBeTruthy();
      expect(context!.expiresAt).toBeTruthy();
    });

    it('應該設定正確的過期時間（預設 30 分鐘）', () => {
      const manager = ContextManager.getInstance();
      const contextId = manager.createContext();
      const context = manager.getContext(contextId);

      const createdAt = new Date(context!.createdAt);
      const expiresAt = new Date(context!.expiresAt);
      const diffMinutes = (expiresAt.getTime() - createdAt.getTime()) / (60 * 1000);

      expect(diffMinutes).toBeCloseTo(30, 0);
    });

    it('應該使用自訂的 TTL', () => {
      resetContextManager();
      const manager = ContextManager.getInstance({ ttlMinutes: 120 });
      const contextId = manager.createContext();
      const context = manager.getContext(contextId);

      const createdAt = new Date(context!.createdAt);
      const expiresAt = new Date(context!.expiresAt);
      const diffMinutes = (expiresAt.getTime() - createdAt.getTime()) / (60 * 1000);

      expect(diffMinutes).toBeCloseTo(120, 0);
    });
  });

  describe('getContext() - 取得對話上下文', () => {
    it('應該返回存在的上下文', () => {
      const manager = ContextManager.getInstance();
      const contextId = manager.createContext();
      const context = manager.getContext(contextId);

      expect(context).toBeDefined();
      expect(context!.contextId).toBe(contextId);
    });

    it('當上下文不存在時應返回 undefined', () => {
      const manager = ContextManager.getInstance();
      const context = manager.getContext('non-existent-id');

      expect(context).toBeUndefined();
    });

    it('當上下文過期時應返回 undefined', () => {
      // 使用假時間
      vi.useFakeTimers();
      const now = new Date('2025-01-17T10:00:00Z');
      vi.setSystemTime(now);

      const manager = ContextManager.getInstance({ ttlMinutes: 30 });
      const contextId = manager.createContext();

      // 確認上下文存在
      expect(manager.getContext(contextId)).toBeDefined();

      // 快進 31 分鐘（超過 TTL）
      vi.advanceTimersByTime(31 * 60 * 1000);

      // 上下文應該過期
      const context = manager.getContext(contextId);
      expect(context).toBeUndefined();

      vi.useRealTimers();
    });

    it('當上下文過期時應該刪除該上下文', () => {
      vi.useFakeTimers();
      const now = new Date('2025-01-17T10:00:00Z');
      vi.setSystemTime(now);

      const manager = ContextManager.getInstance({ ttlMinutes: 30 });
      const contextId = manager.createContext();

      // 快進 31 分鐘
      vi.advanceTimersByTime(31 * 60 * 1000);

      // 第一次呼叫：檢測到過期並刪除
      manager.getContext(contextId);

      // 回到現在時間
      vi.setSystemTime(now);

      // 第二次呼叫：即使回到過去時間，上下文已被刪除
      const context = manager.getContext(contextId);
      expect(context).toBeUndefined();

      vi.useRealTimers();
    });

    it('未過期的上下文應該可以正常取得', () => {
      vi.useFakeTimers();
      const now = new Date('2025-01-17T10:00:00Z');
      vi.setSystemTime(now);

      const manager = ContextManager.getInstance({ ttlMinutes: 30 });
      const contextId = manager.createContext();

      // 快進 29 分鐘（未超過 TTL）
      vi.advanceTimersByTime(29 * 60 * 1000);

      // 上下文應該仍然存在
      const context = manager.getContext(contextId);
      expect(context).toBeDefined();
      expect(context!.contextId).toBe(contextId);

      vi.useRealTimers();
    });
  });

  describe('updateContext() - 更新對話上下文', () => {
    it('應該更新存在的上下文', () => {
      const manager = ContextManager.getInstance();
      const contextId = manager.createContext();

      const newFlow = {
        name: '測試 Flow',
        steps: [{ name: '步驟1' } as any],
      };

      manager.updateContext(contextId, { currentFlow: newFlow });
      const context = manager.getContext(contextId);

      expect(context!.currentFlow).toEqual(newFlow);
    });

    it('應該支援部分更新', () => {
      const manager = ContextManager.getInstance();
      const contextId = manager.createContext();

      // 先更新 Flow
      manager.updateContext(contextId, {
        currentFlow: { name: 'Flow 1', steps: [] },
      });

      // 再更新變數
      manager.updateContext(contextId, {
        extractedVariables: { userId: '123' },
      });

      const context = manager.getContext(contextId);

      // 兩個更新都應該存在
      expect(context!.currentFlow).toEqual({ name: 'Flow 1', steps: [] });
      expect(context!.extractedVariables).toEqual({ userId: '123' });
    });

    it('更新不存在的上下文時不應拋出錯誤', () => {
      const manager = ContextManager.getInstance();

      expect(() => {
        manager.updateContext('non-existent-id', { currentFlow: { steps: [] } });
      }).not.toThrow();
    });

    it('應該能更新多個欄位', () => {
      const manager = ContextManager.getInstance();
      const contextId = manager.createContext();

      manager.updateContext(contextId, {
        currentFlow: { name: 'New Flow', steps: [] },
        extractedVariables: { token: 'abc123' },
      });

      const context = manager.getContext(contextId);

      expect(context!.currentFlow.name).toBe('New Flow');
      expect(context!.extractedVariables).toEqual({ token: 'abc123' });
    });
  });

  describe('addConversationTurn() - 新增對話記錄', () => {
    it('應該新增對話記錄到歷史', () => {
      const manager = ContextManager.getInstance();
      const contextId = manager.createContext();

      const turn = createMockTurn({ content: '測試訊息' });
      manager.addConversationTurn(contextId, turn);

      const context = manager.getContext(contextId);

      expect(context!.conversationHistory).toHaveLength(1);
      expect(context!.conversationHistory[0]).toEqual(turn);
    });

    it('應該保持對話記錄的順序', () => {
      const manager = ContextManager.getInstance();
      const contextId = manager.createContext();

      const turn1 = createMockTurn({ content: '訊息 1' });
      const turn2 = createMockTurn({ content: '訊息 2' });
      const turn3 = createMockTurn({ content: '訊息 3' });

      manager.addConversationTurn(contextId, turn1);
      manager.addConversationTurn(contextId, turn2);
      manager.addConversationTurn(contextId, turn3);

      const context = manager.getContext(contextId);

      expect(context!.conversationHistory).toHaveLength(3);
      expect(context!.conversationHistory[0].content).toBe('訊息 1');
      expect(context!.conversationHistory[1].content).toBe('訊息 2');
      expect(context!.conversationHistory[2].content).toBe('訊息 3');
    });

    it('應該限制歷史記錄大小（預設 50 筆）', () => {
      const manager = ContextManager.getInstance();
      const contextId = manager.createContext();

      // 新增 60 筆記錄
      for (let i = 0; i < 60; i++) {
        manager.addConversationTurn(contextId, createMockTurn({ content: `訊息 ${i}` }));
      }

      const context = manager.getContext(contextId);

      // 應該只保留最新的 50 筆
      expect(context!.conversationHistory).toHaveLength(50);
      // 最舊的記錄應該被移除（訊息 0-9）
      expect(context!.conversationHistory[0].content).toBe('訊息 10');
      // 最新的記錄應該保留
      expect(context!.conversationHistory[49].content).toBe('訊息 59');
    });

    it('應該使用自訂的歷史大小限制', () => {
      resetContextManager();
      const manager = ContextManager.getInstance({ maxHistorySize: 10 });
      const contextId = manager.createContext();

      // 新增 15 筆記錄
      for (let i = 0; i < 15; i++) {
        manager.addConversationTurn(contextId, createMockTurn({ content: `訊息 ${i}` }));
      }

      const context = manager.getContext(contextId);

      // 應該只保留最新的 10 筆
      expect(context!.conversationHistory).toHaveLength(10);
      expect(context!.conversationHistory[0].content).toBe('訊息 5');
      expect(context!.conversationHistory[9].content).toBe('訊息 14');
    });

    it('新增記錄到不存在的上下文時不應拋出錯誤', () => {
      const manager = ContextManager.getInstance();

      expect(() => {
        manager.addConversationTurn('non-existent-id', createMockTurn());
      }).not.toThrow();
    });

    it('應該支援不同角色的對話記錄', () => {
      const manager = ContextManager.getInstance();
      const contextId = manager.createContext();

      manager.addConversationTurn(contextId, createMockTurn({ role: 'user', content: '使用者訊息' }));
      manager.addConversationTurn(contextId, createMockTurn({ role: 'assistant', content: '助手回應' }));

      const context = manager.getContext(contextId);

      expect(context!.conversationHistory[0].role).toBe('user');
      expect(context!.conversationHistory[1].role).toBe('assistant');
    });
  });

  describe('getCurrentFlow() - 取得當前 Flow', () => {
    it('應該返回存在的 Flow', () => {
      const manager = ContextManager.getInstance();
      const contextId = manager.createContext();

      const newFlow = { name: '測試 Flow', steps: [] };
      manager.updateContext(contextId, { currentFlow: newFlow });

      const flow = manager.getCurrentFlow(contextId);

      expect(flow).toEqual(newFlow);
    });

    it('當上下文不存在時應返回 undefined', () => {
      const manager = ContextManager.getInstance();
      const flow = manager.getCurrentFlow('non-existent-id');

      expect(flow).toBeUndefined();
    });

    it('應該返回初始的空 Flow', () => {
      const manager = ContextManager.getInstance();
      const contextId = manager.createContext();

      const flow = manager.getCurrentFlow(contextId);

      expect(flow).toEqual({ steps: [] });
    });
  });

  describe('cleanupExpiredContexts() - 清理過期上下文', () => {
    it('應該刪除所有過期的上下文', () => {
      vi.useFakeTimers();
      const now = new Date('2025-01-17T10:00:00Z');
      vi.setSystemTime(now);

      const manager = ContextManager.getInstance({ ttlMinutes: 30 });

      // 建立 3 個上下文
      const contextId1 = manager.createContext();
      const contextId2 = manager.createContext();
      const contextId3 = manager.createContext();

      // 確認都存在
      expect(manager.getContext(contextId1)).toBeDefined();
      expect(manager.getContext(contextId2)).toBeDefined();
      expect(manager.getContext(contextId3)).toBeDefined();

      // 快進 31 分鐘
      vi.advanceTimersByTime(31 * 60 * 1000);

      // 清理過期上下文
      manager.cleanupExpiredContexts();

      // 所有上下文都應該被刪除
      expect(manager.getContext(contextId1)).toBeUndefined();
      expect(manager.getContext(contextId2)).toBeUndefined();
      expect(manager.getContext(contextId3)).toBeUndefined();

      vi.useRealTimers();
    });

    it('應該保留未過期的上下文', () => {
      vi.useFakeTimers();
      const now = new Date('2025-01-17T10:00:00Z');
      vi.setSystemTime(now);

      const manager = ContextManager.getInstance({ ttlMinutes: 30 });

      // 建立第一個上下文
      const contextId1 = manager.createContext();

      // 快進 20 分鐘
      vi.advanceTimersByTime(20 * 60 * 1000);

      // 建立第二個上下文
      const contextId2 = manager.createContext();

      // 再快進 15 分鐘（總共 35 分鐘）
      vi.advanceTimersByTime(15 * 60 * 1000);

      // 清理過期上下文
      manager.cleanupExpiredContexts();

      // contextId1 應該過期（35 分鐘 > 30 分鐘）
      expect(manager.getContext(contextId1)).toBeUndefined();

      // contextId2 應該仍存在（15 分鐘 < 30 分鐘）
      expect(manager.getContext(contextId2)).toBeDefined();

      vi.useRealTimers();
    });

    it('沒有過期上下文時不應影響現有上下文', () => {
      const manager = ContextManager.getInstance();
      const contextId = manager.createContext();

      manager.cleanupExpiredContexts();

      // 上下文應該仍存在
      expect(manager.getContext(contextId)).toBeDefined();
    });

    it('空的上下文列表不應拋出錯誤', () => {
      const manager = ContextManager.getInstance();

      expect(() => {
        manager.cleanupExpiredContexts();
      }).not.toThrow();
    });
  });

  describe('整合情境測試', () => {
    it('應該支援完整的對話流程', () => {
      const manager = ContextManager.getInstance();

      // 1. 建立上下文
      const contextId = manager.createContext();

      // 2. 新增使用者訊息
      manager.addConversationTurn(contextId, {
        role: 'user',
        content: '建立使用者登入測試',
        timestamp: new Date().toISOString(),
      });

      // 3. 更新 Flow
      manager.updateContext(contextId, {
        currentFlow: {
          name: '使用者登入測試',
          steps: [
            {
              name: '登入',
              request: { method: 'POST', path: '/auth/login' },
            } as any,
          ],
        },
      });

      // 4. 新增助手回應
      manager.addConversationTurn(contextId, {
        role: 'assistant',
        content: '已建立登入測試流程',
        timestamp: new Date().toISOString(),
      });

      // 5. 取得上下文驗證
      const context = manager.getContext(contextId);

      expect(context!.conversationHistory).toHaveLength(2);
      expect(context!.currentFlow.name).toBe('使用者登入測試');
      expect(context!.currentFlow.steps).toHaveLength(1);
    });

    it('應該支援多個上下文並行', () => {
      const manager = ContextManager.getInstance();

      const context1 = manager.createContext();
      const context2 = manager.createContext();

      manager.updateContext(context1, {
        currentFlow: { name: 'Flow 1', steps: [] },
      });
      manager.updateContext(context2, {
        currentFlow: { name: 'Flow 2', steps: [] },
      });

      const flow1 = manager.getCurrentFlow(context1);
      const flow2 = manager.getCurrentFlow(context2);

      expect(flow1!.name).toBe('Flow 1');
      expect(flow2!.name).toBe('Flow 2');
    });

    it('應該處理上下文的完整生命週期', () => {
      vi.useFakeTimers();
      const now = new Date('2025-01-17T10:00:00Z');
      vi.setSystemTime(now);

      const manager = ContextManager.getInstance({ ttlMinutes: 30 });

      // 建立 -> 使用 -> 過期 -> 清理
      const contextId = manager.createContext();
      manager.addConversationTurn(contextId, createMockTurn());

      // 確認存在
      expect(manager.getContext(contextId)).toBeDefined();

      // 快進到過期
      vi.advanceTimersByTime(31 * 60 * 1000);

      // 清理
      manager.cleanupExpiredContexts();

      // 確認已刪除
      expect(manager.getContext(contextId)).toBeUndefined();

      vi.useRealTimers();
    });
  });

  describe('邊界條件測試', () => {
    it('應該處理 ttlMinutes = 0 (使用預設值)', () => {
      vi.useFakeTimers();
      const now = new Date('2025-01-17T10:00:00Z');
      vi.setSystemTime(now);

      resetContextManager();
      const manager = ContextManager.getInstance({ ttlMinutes: 0 });
      const contextId = manager.createContext();

      // 由於 0 || 30，實際上會使用預設值 30 分鐘
      const contextBefore = manager.getContext(contextId);
      expect(contextBefore).toBeDefined();

      const createdAt = new Date(contextBefore!.createdAt).getTime();
      const expiresAt = new Date(contextBefore!.expiresAt).getTime();
      const ttlMinutes = (expiresAt - createdAt) / (60 * 1000);

      expect(ttlMinutes).toBeCloseTo(30, 0);

      // 前進 29 分鐘，應該仍然有效
      vi.advanceTimersByTime(29 * 60 * 1000);
      expect(manager.getContext(contextId)).toBeDefined();

      // 前進 2 分鐘（總共 31 分鐘），應該過期
      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(manager.getContext(contextId)).toBeUndefined();

      vi.useRealTimers();
    });

    it('應該處理 maxHistorySize = 0 (使用預設值)', () => {
      resetContextManager();
      const manager = ContextManager.getInstance({ maxHistorySize: 0 });
      const contextId = manager.createContext();

      manager.addConversationTurn(contextId, createMockTurn({ content: '訊息 1' }));

      const context = manager.getContext(contextId);

      // 由於 0 || 50，實際上會使用預設值 50
      // 所以新增 1 筆記錄不會被移除
      expect(context!.conversationHistory).toHaveLength(1);
      expect(context!.conversationHistory[0].content).toBe('訊息 1');
    });

    it('應該處理 maxHistorySize = 1', () => {
      resetContextManager();
      const manager = ContextManager.getInstance({ maxHistorySize: 1 });
      const contextId = manager.createContext();

      manager.addConversationTurn(contextId, createMockTurn({ content: '訊息 1' }));
      manager.addConversationTurn(contextId, createMockTurn({ content: '訊息 2' }));

      const context = manager.getContext(contextId);

      expect(context!.conversationHistory).toHaveLength(1);
      expect(context!.conversationHistory[0].content).toBe('訊息 2');
    });

    it('應該處理非常大的 TTL', () => {
      resetContextManager();
      const manager = ContextManager.getInstance({ ttlMinutes: 1000000 });
      const contextId = manager.createContext();
      const context = manager.getContext(contextId);

      const createdAt = new Date(context!.createdAt).getTime();
      const expiresAt = new Date(context!.expiresAt).getTime();
      const ttlMinutes = (expiresAt - createdAt) / (60 * 1000);

      expect(ttlMinutes).toBeCloseTo(1000000, 0);
    });

    it('應該處理空字串作為 contextId', () => {
      const manager = ContextManager.getInstance();
      const context = manager.getContext('');

      expect(context).toBeUndefined();
    });
  });
});
