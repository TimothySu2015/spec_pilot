/**
 * Test Suite Generator Types
 * 自動化測試套件產生器的型別定義
 */

import type { FlowDefinition, FlowStep } from '@specpilot/flow-parser';
import type { OpenAPIDocument } from '@specpilot/spec-loader';

/**
 * 端點資訊
 */
export interface EndpointInfo {
  path: string;
  method: string;
  operationId: string;
  summary?: string;
  description?: string;
  requestSchema?: JSONSchema;
  responseSchemas: Record<number, JSONSchema>;
  security?: Array<Record<string, string[]>>;
  examples?: Record<string, unknown>;
  parameters?: ParameterInfo[];
}

/**
 * 參數資訊
 */
export interface ParameterInfo {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  schema?: JSONSchema;
  description?: string;
}

/**
 * JSON Schema 定義
 */
export interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  enum?: unknown[];
  examples?: unknown[];
  [key: string]: unknown;
}

/**
 * 依賴關係圖
 */
export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

/**
 * 依賴節點
 */
export interface DependencyNode {
  operationId: string;
  endpoint: EndpointInfo;
  resourceType?: string;
}

/**
 * 依賴邊
 */
export interface DependencyEdge {
  from: string;
  to: string;
  type: 'creates' | 'requires' | 'modifies' | 'deletes';
  variable?: string;
}

/**
 * 認證流程資訊
 */
export interface AuthFlowInfo {
  operationId: string;
  endpoint: EndpointInfo;
  credentialFields: string[];
  tokenField: string;
}

/**
 * 測試案例類型
 */
export type TestCaseType = 'success' | 'error' | 'edge' | 'auth';

/**
 * 產生選項
 */
export interface GenerationOptions {
  includeSuccessCases?: boolean;
  includeErrorCases?: boolean;
  includeEdgeCases?: boolean;
  includeAuthTests?: boolean;
  generateFlows?: boolean;
  endpoints?: string[];
}

/**
 * 測試套件摘要
 */
export interface TestSuiteSummary {
  totalTests: number;
  successTests: number;
  errorTests: number;
  edgeTests: number;
  endpoints: string[];
}

/**
 * 規格分析器配置
 */
export interface SpecAnalyzerConfig {
  spec: OpenAPIDocument;
}

/**
 * CRUD 產生器配置
 */
export interface CRUDGeneratorConfig {
  useExamples?: boolean;
  generateValidations?: boolean;
}

/**
 * 錯誤案例產生器配置
 */
export interface ErrorCaseGeneratorConfig {
  includeMissingFields?: boolean;
  includeInvalidFormats?: boolean;
  includeAuthErrors?: boolean;
}
