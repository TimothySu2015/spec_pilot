/**
 * Flow Parser 專用型別定義
 */

/**
 * HTTP 方法列舉
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
 * Flow 載入選項
 */
export interface IFlowLoadOptions {
  /** 檔案路徑（與 content 擇一） */
  filePath?: string;
  /** 直接給定內容（與 filePath 擇一） */
  content?: string;
  /** 內容格式，預設 yaml */
  format?: 'yaml';
  /** 執行 ID，方便追蹤流程 */
  executionId?: string;
}

/**
 * HTTP 請求設定
 */
export interface IFlowRequest {
  /** HTTP 方法 */
  method: HttpMethod;
  /** 請求路徑 */
  path?: string;
  /** 完整請求 URL（與 path 擇一） */
  url?: string;
  /** 請求標頭 */
  headers?: Record<string, string>;
  /** 請求本文 */
  body?: unknown;
  /** Query 參數 */
  query?: Record<string, string>;
}

/**
 * 重試策略
 */
export interface IRetryPolicy {
  /** 最大重試次數 */
  maxRetries?: number;
  /** 初始延遲毫秒數 */
  delayMs?: number;
  /** 指數退避倍率 */
  backoffMultiplier?: number;
}

/**
 * Flow 執行選項
 */
export interface IFlowOptions {
  timeout?: number;
  retryCount?: number;
  failFast?: boolean;
}

/**
 * Flow 報告設定
 */
export interface IReportingOptions {
  outputPath?: string;
  format?: 'json' | 'html' | 'markdown';
  verbose?: boolean;
}

/**
 * 回應驗證設定
 */
export interface IFlowExpectations {
  /** 預期的 HTTP 狀態碼 */
  status?: number;
  /** JSON Schema 名稱 */
  schema?: string;
  /** 預期的回應 body (JSON 深度比對驗證) */
  body?: unknown;
  /** 自訂驗證規則 */
  custom?: Array<{
    /** 驗證類型 */
    type: 'notNull' | 'regex' | 'contains' | 'unknown';
    /** 檢查欄位 */
    field: string;
    /** 期望值 */
    value?: string | number | boolean;
    /** 覆寫錯誤訊息 */
    message?: string;
  }>;
}

/**
 * Token 擷取設定
 */
export interface ITokenExtraction {
  /** Token 擷取路徑，例如 data.token */
  path: string;
  /** Token 逾時秒數 */
  expiresIn?: number;
  /** Token 命名空間 */
  namespace?: string;
}

/**
 * 步驟層級認證設定
 */
export interface IFlowAuth {
  /** 認證類型 */
  type: 'login' | 'static';
  /** 登入型別所需的 token 擷取設定 */
  tokenExtraction?: ITokenExtraction;
  /** 命名空間（靜態 token 用） */
  namespace?: string;
}

/**
 * Flow 步驟定義
 */
export interface IFlowStep {
  /** 步驟名稱 */
  name: string;
  /** 步驟描述 */
  description?: string;
  /** HTTP 請求設定 */
  request: IFlowRequest;
  /** 回應驗證設定 */
  expectations: IFlowExpectations;
  /** 重試策略 */
  retryPolicy?: IRetryPolicy;
  /** 步驟認證 */
  auth?: IFlowAuth;
  /** Capture 設定：變數名稱 -> JSON Path */
  capture?: Record<string, string>;
}

/**
 * 靜態認證設定
 */
export interface IStaticAuth {
  /** 命名空間 */
  namespace: string;
  /** Token */
  token: string;
  /** Token 逾時秒數 */
  expiresInSeconds?: number;
}

/**
 * Flow 全域設定
 */
export interface IFlowGlobals {
  /** 基礎 URL */
  baseUrl?: string;
  /** 共用標頭 */
  headers?: Record<string, string>;
  /** 認證設定 */
  auth?: {
    type: 'bearer';
    token: string;
  } | {
    static?: IStaticAuth[];
  };
  /** 共用重試策略 */
  retryPolicy?: IRetryPolicy;
}

/**
 * Flow 定義
 */
export interface IFlowDefinition {
  /** Flow ID */
  id: string;
  /** 原始內容 */
  rawContent: string;
  /** 步驟列表 */
  steps: IFlowStep[];
  /** 全域設定 */
  globals?: IFlowGlobals;
  /** 流程變數 */
  variables?: Record<string, unknown>;
  /** 執行選項 */
  options?: IFlowOptions;
  /** 報告設定 */
  reporting?: IReportingOptions;
}

/**
 * Flow 載入結果
 */
export interface IFlowLoadResult {
  /** 是否成功 */
  success: boolean;
  /** 成功時的 Flow 定義 */
  flow?: IFlowDefinition;
  /** 失敗訊息 */
  error?: string;
  /** 失敗詳情 */
  details?: Record<string, unknown>;
}
