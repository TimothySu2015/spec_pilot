/**
 * Flow Generator - 對話式測試流程產生器
 *
 * 透過自然語言描述產生 API 測試流程，支援多輪對話逐步完善測試細節
 */

// 匯出核心類別
export { NLPFlowParser } from './nlp-parser.js';
export { IntentRecognizer } from './intent-recognizer.js';
export { ContextManager } from './context-manager.js';
export { FlowBuilder } from './flow-builder.js';
export { SuggestionEngine } from './suggestion-engine.js';

// 匯出型別定義
export type {
  ParsedIntent,
  EndpointInfo,
  EndpointMatch,
  ConversationContext,
  ConversationTurn,
  Suggestion,
  FlowStepConfig,
  NLPParserConfig,
  IntentRecognizerConfig,
  ContextManagerConfig,
} from './types.js';
