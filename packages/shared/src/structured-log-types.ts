/**
 * 結構化日誌的類型定義
 */

/**
 * 請求摘要
 */
export interface IRequestSummary {
  /** HTTP 方法 */
  method: string;
  /** 完整 URL */
  url: string;
  /** Header 雜湊值 */
  headerHash: string;
  /** Body 雜湊值 */
  bodyHash: string;
}

/**
 * 回應摘要
 */
export interface IResponseSummary {
  /** HTTP 狀態碼 */
  statusCode: number;
  /** 驗證結果列表 */
  validationResults: string[];
  /** 錯誤詳情（如果有） */
  errorMessage?: string;
}

/**
 * 結構化日誌項目
 */
export interface IStructuredLogEntry {
  /** 時間戳 */
  timestamp: string;
  /** 日誌級別 */
  level: 'debug' | 'info' | 'warn' | 'error';
  /** 執行 ID */
  executionId: string;
  /** 元件名稱 */
  component: string;
  /** 事件代碼 */
  event: string;
  /** 訊息內容 */
  message: string;
  /** 步驟名稱（可選） */
  stepName?: string;
  /** 執行時長（毫秒，可選） */
  duration?: number;
  /** 請求摘要（可選） */
  requestSummary?: IRequestSummary;
  /** 回應摘要（可選） */
  responseSummary?: IResponseSummary;
  /** 其他詳細資訊 */
  details?: Record<string, unknown>;
}

/**
 * 日誌輪替配置
 */
export interface ILogRotationConfig {
  /** 單檔最大尺寸 */
  maxFileSize: string;
  /** 保留檔案數量 */
  maxFiles: number;
  /** 日期批次格式 */
  datePattern: string;
  /** 是否壓縮舊檔案 */
  compress: boolean;
  /** 幾天後壓縮 */
  archiveAfterDays: number;
}