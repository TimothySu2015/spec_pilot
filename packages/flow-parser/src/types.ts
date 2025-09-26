/**
 * Flow Parser 類型定義
 */

/**
 * HTTP 方法枚舉
 */
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS'
}

/**
 * Flow 載入選項介面
 */
export interface IFlowLoadOptions {
  /** 檔案路徑（與 content 二選一） */
  filePath?: string;
  /** 直接內容（與 filePath 二選一） */
  content?: string;
  /** 內容格式，預設為 yaml */
  format?: 'yaml';
  /** 執行 ID，用於日誌關聯 */
  executionId?: string;
}

/**
 * HTTP 請求設定
 */
export interface IFlowRequest {
  /** HTTP 方法 */
  method: HttpMethod;
  /** 請求路徑 */
  path: string;
  /** 請求標頭 */
  headers?: Record<string, string>;
  /** 請求主體 */
  body?: unknown;
  /** 查詢參數 */
  query?: Record<string, string>;
}

/**
 * 重試政策設定
 */
export interface IRetryPolicy {
  /** 最大重試次數 */
  maxRetries?: number;
  /** 重試間隔（毫秒） */
  delayMs?: number;
  /** 指數退避倍數 */
  backoffMultiplier?: number;
}

/**
 * 期望驗證設定
 */
export interface IFlowExpectations {
  /** 期望的 HTTP 狀態碼 */
  status?: number;
  /** JSON Schema 驗證 */
  schema?: string;
  /** 自訂驗證規則 */
  custom?: Array<{
    /** 驗證類型 */
    type: 'notNull' | 'regex' | 'contains';
    /** 目標欄位路徑 */
    field: string;
    /** 驗證值 */
    value?: string | number | boolean;
    /** 錯誤訊息 */
    message?: string;
  }>;
}

/**
 * Flow 步驟介面
 */
export interface IFlowStep {
  /** 步驟名稱 */
  name: string;
  /** HTTP 請求設定 */
  request: IFlowRequest;
  /** 期望驗證設定 */
  expectations: IFlowExpectations;
  /** 重試政策 */
  retryPolicy?: IRetryPolicy;
}

/**
 * Flow 全域設定
 */
export interface IFlowGlobals {
  /** 基礎 URL */
  baseUrl?: string;
  /** 全域標頭 */
  headers?: Record<string, string>;
  /** 認證憑證 */
  auth?: {
    /** 認證類型 */
    type: 'bearer' | 'basic';
    /** 憑證值 */
    token: string;
  };
  /** 全域重試政策 */
  retryPolicy?: IRetryPolicy;
}

/**
 * Flow 定義介面
 */
export interface IFlowDefinition {
  /** Flow ID */
  id: string;
  /** 原始內容 */
  rawContent: string;
  /** Flow 步驟列表 */
  steps: IFlowStep[];
  /** 全域設定 */
  globals?: IFlowGlobals;
}

/**
 * Flow 載入結果（安全版本，不拋出錯誤）
 */
export interface IFlowLoadResult {
  /** 是否成功 */
  success: boolean;
  /** Flow 定義（成功時） */
  flow?: IFlowDefinition;
  /** 錯誤訊息（失敗時） */
  error?: string;
  /** 錯誤詳細資訊（失敗時） */
  details?: Record<string, unknown>;
}