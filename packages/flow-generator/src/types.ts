/**
 * Flow Generator Types
 * 對話式 Flow 產生器的型別定義
 */

import type { FlowDefinition, FlowStep } from '@specpilot/flow-parser';
import type { OpenAPIDocument } from '@specpilot/spec-loader';

/**
 * 解析後的使用者意圖
 */
export interface ParsedIntent {
  /** 動作類型 */
  action: 'create_flow' | 'add_step' | 'modify_step' | 'add_validation';
  /** 提取的實體 */
  entities: {
    endpoint?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    parameters?: Record<string, unknown>;
    validations?: Array<{
      field: string;
      rule: string;
      value?: unknown;
    }>;
  };
  /** 識別信心度 (0-1) */
  confidence: number;
}

/**
 * 端點資訊
 */
export interface EndpointInfo {
  path: string;
  method: string;
  operationId: string;
  summary?: string;
  description?: string;
  parameters?: Array<{
    name: string;
    in: 'path' | 'query' | 'header' | 'cookie';
    required?: boolean;
    schema?: unknown;
  }>;
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: unknown }>;
  };
  responses?: Record<string, unknown>;
  security?: Array<Record<string, string[]>>;
}

/**
 * 端點匹配結果
 */
export interface EndpointMatch {
  endpoint: EndpointInfo;
  operationId: string;
  confidence: number;
  reason: string;
}

/**
 * 對話回合
 */
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  parsedIntent?: ParsedIntent;
}

/**
 * 對話上下文
 */
export interface ConversationContext {
  contextId: string;
  currentFlow: Partial<FlowDefinition>;
  extractedVariables: Record<string, string>;
  conversationHistory: ConversationTurn[];
  createdAt: string;
  expiresAt: string;
}

/**
 * 智能建議
 */
export interface Suggestion {
  type: 'missing_required' | 'variable_suggestion' | 'validation_suggestion' | 'auth_required';
  message: string;
  action?: string;
  data?: unknown;
}

/**
 * Flow Builder 步驟配置
 */
export interface FlowStepConfig {
  /** 步驟名稱 (必填) */
  name?: string;
  /** 步驟描述 */
  description?: string;
  /** 操作 ID (可選,用於向後相容) */
  operationId?: string;
  /** HTTP 方法 */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  /** API 路徑 */
  path?: string;
  /** 預期狀態碼 */
  expectedStatusCode?: number;
  /** 請求參數 */
  parameters?: {
    body?: unknown;
    query?: Record<string, unknown>;
    headers?: Record<string, unknown>;
  };
  /** 變數提取 (key: 變數名稱, value: JSON path) */
  extractVariables?: Record<string, string>;
  /**
   * 驗證規則 (舊格式)
   * @deprecated 請使用 customRules 代替
   */
  validations?: Array<{
    field: string;
    rule: string;
    value?: unknown;
  }>;

  /**
   * 自訂驗證規則 (推薦格式)
   * 支援 Phase 10 新增的 8 個驗證規則
   */
  customRules?: Array<{
    field?: string;
    path?: string;    // 向後相容
    rule: 'notNull' | 'regex' | 'contains' | 'equals' | 'notContains' | 'greaterThan' | 'lessThan' | 'length';
    value?: string | number;
    expected?: string | number | boolean | null | object;
    min?: number;
    max?: number;
    message?: string;
  }>;
}

/**
 * NLP 解析器配置
 */
export interface NLPParserConfig {
  spec: OpenAPIDocument;
  enableKeywordMatching?: boolean;
  enableSemanticMatching?: boolean;
}

/**
 * 意圖識別器配置
 */
export interface IntentRecognizerConfig {
  spec: OpenAPIDocument;
  minConfidence?: number;
  maxResults?: number;
}

/**
 * 上下文管理器配置
 */
export interface ContextManagerConfig {
  ttlMinutes?: number;
  maxHistorySize?: number;
}
