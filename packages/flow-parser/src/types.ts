/**
 * Flow Parser 專用型別定義
 */

/**
 * HTTP 方法類型
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * Flow 載入選項
 */
export interface FlowLoadOptions {
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
export interface FlowRequest {
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
export interface RetryPolicy {
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
export interface FlowOptions {
  timeout?: number;
  retryCount?: number;
  failFast?: boolean;
}

/**
 * Flow 報告設定
 */
export interface ReportingOptions {
  outputPath?: string;
  format?: 'json' | 'html' | 'markdown';
  verbose?: boolean;
}

/**
 * 回應驗證設定
 */
export interface FlowExpectations {
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
export interface TokenExtraction {
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
export interface FlowAuth {
  /** 認證類型 */
  type: 'login' | 'static';
  /** 登入型別所需的 token 擷取設定 */
  tokenExtraction?: TokenExtraction;
  /** 命名空間（靜態 token 用） */
  namespace?: string;
}

/**
 * Flow 步驟定義
 */
export interface FlowStep {
  /** 步驟名稱 */
  name: string;
  /** 步驟描述 */
  description?: string;
  /** HTTP 請求設定 */
  request: FlowRequest;
  /** 回應驗證設定 */
  expectations: FlowExpectations;
  /** 重試策略 */
  retryPolicy?: RetryPolicy;
  /** 步驟認證 */
  auth?: FlowAuth;
  /** Capture 設定：變數名稱 -> JSON Path */
  capture?: Record<string, string>;
}

/**
 * 靜態認證設定
 */
export interface StaticAuth {
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
export interface FlowGlobals {
  /** 基礎 URL */
  baseUrl?: string;
  /** 共用標頭 */
  headers?: Record<string, string>;
  /** 認證設定 */
  auth?: {
    type: 'bearer';
    token: string;
  } | {
    static?: StaticAuth[];
  };
  /** 共用重試策略 */
  retryPolicy?: RetryPolicy;
}

/**
 * Flow 定義
 */
export interface FlowDefinition {
  /** Flow ID */
  id: string;
  /** 原始內容 */
  rawContent: string;
  /** 步驟列表 */
  steps: FlowStep[];
  /** 全域設定 */
  globals?: FlowGlobals;
  /** 流程變數 */
  variables?: Record<string, unknown>;
  /** 執行選項 */
  options?: FlowOptions;
  /** 報告設定 */
  reporting?: ReportingOptions;
}

/**
 * Flow 載入結果
 */
export interface FlowLoadResult {
  /** 是否成功 */
  success: boolean;
  /** 成功時的 Flow 定義 */
  flow?: FlowDefinition;
  /** 失敗訊息 */
  error?: string;
  /** 失敗詳情 */
  details?: Record<string, unknown>;
}

