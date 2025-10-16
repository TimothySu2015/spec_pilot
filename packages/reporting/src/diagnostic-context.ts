// 診斷上下文型別定義

/**
 * 錯誤類型
 */
export type ErrorType = 'auth' | 'network' | 'validation' | 'server' | 'unknown';

/**
 * 錯誤分類
 */
export interface ErrorClassification {
  /** 主要錯誤類型 */
  primaryType: ErrorType;
  /** 信心度 (0-100) */
  confidence: number;
  /** 判斷依據 */
  indicators: string[];
  /** 次要類型（如果適用） */
  secondaryType?: ErrorType;
}

/**
 * 失敗步驟診斷資訊
 */
export interface FailedStepDiagnostic {
  /** 步驟名稱 */
  stepName: string;
  /** 步驟索引 */
  stepIndex: number;
  /** HTTP 狀態碼 */
  statusCode: number;
  /** 錯誤分類 */
  classification: ErrorClassification;
  /** 錯誤訊息 */
  errorMessage: string | null;
  /** 是否有完整錯誤詳情 */
  hasErrorDetails: boolean;
  /** 回應時間（毫秒） */
  responseTime?: number;
}

/**
 * 環境診斷資訊
 */
export interface EnvironmentDiagnostic {
  /** 基礎 URL */
  baseUrl: string;
  /** 是否使用備援 */
  fallbackUsed: boolean;
  /** 認證命名空間 */
  authNamespaces: string[];
}

/**
 * 錯誤模式
 */
export interface ErrorPattern {
  /** 模式類型 */
  pattern: 'consecutive_auth_failures' | 'cascading_failures' | 'all_network_errors' | 'same_resource_failures';
  /** 模式描述 */
  description: string;
  /** 可能性 (high/medium/low) */
  likelihood: 'high' | 'medium' | 'low';
  /** 相關步驟索引 */
  affectedSteps: number[];
}

/**
 * 診斷提示
 */
export interface DiagnosticHints {
  /** 快速診斷摘要 */
  quickDiagnosis: string;
  /** 可能原因列表 */
  likelyCauses: string[];
  /** 建議的修復動作 */
  suggestedActions: string[];
  /** 建議詢問的問題（給 Claude 的提示） */
  suggestedQuestions?: string[];
}

/**
 * 相關步驟資訊
 */
export interface RelatedStepInfo {
  /** 步驟索引 */
  stepIndex: number;
  /** 步驟名稱 */
  stepName: string;
  /** 關聯類型 */
  relationship: 'depends_on' | 'same_resource' | 'sequential';
  /** 關聯描述 */
  description: string;
}

/**
 * 完整診斷上下文
 */
export interface DiagnosticContext {
  /** 是否有失敗 */
  hasFailed: boolean;
  /** 失敗步驟數量 */
  failureCount: number;
  /** 失敗步驟診斷列表 */
  failedSteps: FailedStepDiagnostic[];
  /** 環境診斷資訊 */
  environment: EnvironmentDiagnostic;
  /** 偵測到的錯誤模式 */
  errorPatterns: ErrorPattern[];
  /** 診斷提示 */
  diagnosticHints: DiagnosticHints;
  /** 相關步驟資訊 */
  relatedSteps?: RelatedStepInfo[];
}

