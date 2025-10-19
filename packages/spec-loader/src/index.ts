// 匯出所有公開 API
export * from './types.js';
export * from './errors.js';
export { loadSpec, loadSpecSafe } from './spec-loader.js';

// 匯出工具函式供進階使用
export { loadSpecFromFile, loadSpecFromContent } from './loader.js';
export { validateAndDereferenceSpec, validateSpecDocument } from './validator.js';

// 匯出 SpecEnhancer (Phase 9.2)
export { SpecEnhancer } from './spec-enhancer.js';
export type {
  OperationIdAddition,
  EnhanceResult,
  SpecEnhancerOptions,
} from './spec-enhancer.js';