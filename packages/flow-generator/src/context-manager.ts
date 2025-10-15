/**
 * Context Manager - 對話上下文管理
 * 管理多輪對話的狀態與 Flow 建構過程
 */

import type { ConversationContext, ConversationTurn, ContextManagerConfig } from './types.js';
import type { FlowDefinition } from '@specpilot/flow-parser';

export class ContextManager {
  private static instance: ContextManager;
  private contexts = new Map<string, ConversationContext>();
  private config: ContextManagerConfig;

  private constructor(config: ContextManagerConfig = {}) {
    this.config = {
      ttlMinutes: config.ttlMinutes || 30,
      maxHistorySize: config.maxHistorySize || 50,
    };
  }

  /**
   * 取得單例實例
   */
  static getInstance(config?: ContextManagerConfig): ContextManager {
    if (!ContextManager.instance) {
      ContextManager.instance = new ContextManager(config);
    }
    return ContextManager.instance;
  }

  /**
   * 建立新對話上下文
   */
  createContext(): string {
    const contextId = this.generateContextId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (this.config.ttlMinutes! * 60 * 1000));

    this.contexts.set(contextId, {
      contextId,
      currentFlow: { steps: [] },
      extractedVariables: {},
      conversationHistory: [],
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    return contextId;
  }

  /**
   * 取得對話上下文
   */
  getContext(contextId: string): ConversationContext | undefined {
    const context = this.contexts.get(contextId);

    if (!context) {
      return undefined;
    }

    // 檢查是否過期
    if (new Date(context.expiresAt) < new Date()) {
      this.contexts.delete(contextId);
      return undefined;
    }

    return context;
  }

  /**
   * 更新對話上下文
   */
  updateContext(contextId: string, updates: Partial<ConversationContext>): void {
    const context = this.contexts.get(contextId);
    if (context) {
      Object.assign(context, updates);
    }
  }

  /**
   * 新增對話記錄
   */
  addConversationTurn(contextId: string, turn: ConversationTurn): void {
    const context = this.contexts.get(contextId);
    if (context) {
      context.conversationHistory.push(turn);

      // 限制歷史記錄大小
      if (context.conversationHistory.length > this.config.maxHistorySize!) {
        context.conversationHistory.shift();
      }
    }
  }

  /**
   * 取得當前 Flow 狀態
   */
  getCurrentFlow(contextId: string): Partial<FlowDefinition> | undefined {
    return this.contexts.get(contextId)?.currentFlow;
  }

  /**
   * 清除過期的上下文
   */
  cleanupExpiredContexts(): void {
    const now = new Date();
    for (const [contextId, context] of this.contexts.entries()) {
      if (new Date(context.expiresAt) < now) {
        this.contexts.delete(contextId);
      }
    }
  }

  /**
   * 產生唯一的 contextId
   */
  private generateContextId(): string {
    return `ctx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
