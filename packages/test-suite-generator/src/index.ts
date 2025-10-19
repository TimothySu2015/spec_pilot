/**
 * Test Suite Generator - 自動化測試套件產生器
 *
 * 根據 OpenAPI 規格自動產生完整的測試案例集（CRUD、邊界測試、錯誤處理）
 */

// 匯出核心類別
export { SpecAnalyzer } from './spec-analyzer.js';
export { CRUDGenerator } from './crud-generator.js';
export { ErrorCaseGenerator } from './error-case-generator.js';
export { EdgeCaseGenerator } from './edge-case-generator.js';
export { DependencyResolver } from './dependency-resolver.js';
export { TestSuiteGenerator } from './test-suite-generator.js';
export { DataSynthesizer } from './data-synthesizer.js';
export { FlowQualityChecker } from './flow-quality-checker.js';

// 匯出型別定義
export type {
  EndpointInfo,
  ParameterInfo,
  JSONSchema,
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  AuthFlowInfo,
  TestCaseType,
  GenerationOptions,
  TestSuiteSummary,
  SpecAnalyzerConfig,
  CRUDGeneratorConfig,
  ErrorCaseGeneratorConfig,
  MissingOperationIdInfo,
  SpecDetectionResult,
} from './types.js';

export type {
  QualityIssue,
  QualityReport,
  FixSuggestion,
} from './flow-quality-checker.js';
