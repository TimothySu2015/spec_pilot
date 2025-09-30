/**
 * 完整執行報表的類型定義
 * 符合 Story 2.4 需求規格
 */

/**
 * 錯誤詳情（失敗時才包含）
 */
export interface IErrorDetails {
  /** 完整錯誤回應 body（已遮罩敏感資料） */
  body: unknown;
  /** 回應 Headers（已遮罩敏感資料） */
  headers: Record<string, string>;
  /** 回應時間（毫秒） */
  responseTime: number;
  /** 原始 body 大小（bytes） */
  bodySize: number;
  /** 是否被截斷 */
  bodyTruncated: boolean;
}

/**
 * 步驟執行結果
 */
export interface IStepResult {
  /** 步驟名稱 */
  name: string;
  /** 執行狀態 */
  status: 'success' | 'failure' | 'skipped';
  /** 開始時間 */
  startTime: string;
  /** 執行時長（毫秒） */
  duration: number;
  /** 請求摘要 */
  request: {
    /** HTTP 方法 */
    method: string;
    /** 完整 URL */
    url: string;
    /** Header 雜湊值 */
    headerHash: string;
    /** Body 雜湊值 */
    bodyHash: string;
  };
  /** 回應摘要 */
  response: {
    /** HTTP 狀態碼 */
    statusCode: number;
    /** 是否成功 */
    success: boolean;
    /** 驗證結果列表 */
    validationResults: string[];
    /** 錯誤訊息（如果有） */
    errorMessage: string | null;
    /** ✨ 新增: 失敗時的完整錯誤資訊 */
    errorDetails?: IErrorDetails;
  };
}

/**
 * 執行配置資訊
 */
export interface IExecutionConfig {
  /** 基礎 URL */
  baseUrl: string;
  /** 是否使用備援 */
  fallbackUsed: boolean;
  /** 認證命名空間 */
  authNamespaces: string[];
}

/**
 * 執行摘要
 */
export interface IExecutionSummary {
  /** 總步驟數 */
  totalSteps: number;
  /** 成功步驟數 */
  successfulSteps: number;
  /** 失敗步驟數 */
  failedSteps: number;
  /** 跳過步驟數 */
  skippedSteps: number;
}

/**
 * 完整執行報表
 */
export interface IExecutionReport {
  /** 執行 ID */
  executionId: string;
  /** 流程 ID */
  flowId: string;
  /** 開始時間 */
  startTime: string;
  /** 結束時間 */
  endTime: string;
  /** 總執行時長（毫秒） */
  duration: number;
  /** 整體狀態 */
  status: 'success' | 'failure' | 'partial';
  /** 執行摘要 */
  summary: IExecutionSummary;
  /** 步驟結果列表 */
  steps: IStepResult[];
  /** 執行配置 */
  config: IExecutionConfig;
}

/**
 * 部分報表（用於錯誤恢復）
 */
export interface IPartialExecutionReport extends Omit<IExecutionReport, 'endTime' | 'duration' | 'status'> {
  /** 產生時間 */
  generatedAt: string;
  /** 失敗原因 */
  failureReason: string;
}

/**
 * 類型別名，用於向後兼容
 */
export type ExecutionReport = IExecutionReport;
export type StepResult = IStepResult;
export type ExecutionSummary = IExecutionSummary;
export type ExecutionConfig = IExecutionConfig;
export type ErrorDetails = IErrorDetails;