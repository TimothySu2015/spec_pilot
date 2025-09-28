/**
 * MCP JSON-RPC 2.0 請求介面
 */
export interface IMcpRequest {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
  id?: string | number;
}

/**
 * MCP JSON-RPC 2.0 回應介面
 */
export interface IMcpResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * 檔案清單項目介面
 */
export interface IFileListItem {
  name: string;
  path: string;
  size: number;
  extension: string;
}

/**
 * JSON-RPC 錯誤碼常數
 */
export const JSON_RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

/**
 * 驗證 JSON-RPC 請求格式
 */
export function validateMcpRequest(data: unknown): data is IMcpRequest {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const request = data as Record<string, unknown>;

  // 檢查必要欄位
  if (request.jsonrpc !== '2.0') {
    return false;
  }

  if (!request.method || typeof request.method !== 'string') {
    return false;
  }

  // id 是可選的，但如果存在必須是 string 或 number
  if (request.id !== undefined && typeof request.id !== 'string' && typeof request.id !== 'number') {
    return false;
  }

  return true;
}

/**
 * 建立標準 JSON-RPC 錯誤回應
 */
export function createErrorResponse(
  code: number,
  message: string,
  id: string | number | null = null,
  data?: unknown
): IMcpResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data,
    },
  };
}

/**
 * runFlow 方法參數介面
 */
export interface IRunFlowParams {
  // 檔案模式參數
  spec?: string;
  flow?: string;

  // 內容模式參數
  specContent?: string;
  flowContent?: string;

  // 覆寫設定參數
  baseUrl?: string;
  port?: number;
  token?: string;
}

/**
 * runFlow 覆寫設定介面
 */
export interface IRunFlowOptions {
  baseUrl?: string;
  port?: number;
  token?: string;
}

/**
 * runFlow 執行結果介面
 */
export interface IRunFlowResult {
  executionId: string;
  status: 'success' | 'partial_failure' | 'failure';
  reportSummary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  reportPath?: string;
  errorMessage?: string;
}

/**
 * 驗證 runFlow 參數
 */
export function validateRunFlowParams(params: unknown): {
  isValid: boolean;
  error?: string;
  params?: IRunFlowParams
} {
  if (!params || typeof params !== 'object') {
    return { isValid: false, error: '參數必須是物件' };
  }

  const runFlowParams = params as IRunFlowParams;

  // 檢查是否為檔案模式
  const hasFileMode = runFlowParams.spec || runFlowParams.flow;
  // 檢查是否為內容模式
  const hasContentMode = runFlowParams.specContent || runFlowParams.flowContent;

  // 兩種模式互斥
  if (hasFileMode && hasContentMode) {
    return { isValid: false, error: '檔案模式與內容模式不能同時使用' };
  }

  // 必須選擇其中一種模式
  if (!hasFileMode && !hasContentMode) {
    return { isValid: false, error: '必須提供檔案模式或內容模式參數' };
  }

  // 檔案模式需要完整參數
  if (hasFileMode && (!runFlowParams.spec || !runFlowParams.flow)) {
    return { isValid: false, error: '檔案模式需要同時提供 spec 和 flow 參數' };
  }

  // 內容模式需要完整參數
  if (hasContentMode && (!runFlowParams.specContent || !runFlowParams.flowContent)) {
    return { isValid: false, error: '內容模式需要同時提供 specContent 和 flowContent 參數' };
  }

  // 檢查內容大小限制（10MB = 10 * 1024 * 1024 bytes）
  const maxSize = 10 * 1024 * 1024;
  if (runFlowParams.specContent && runFlowParams.specContent.length > maxSize) {
    return { isValid: false, error: 'specContent 大小超過 10MB 限制' };
  }
  if (runFlowParams.flowContent && runFlowParams.flowContent.length > maxSize) {
    return { isValid: false, error: 'flowContent 大小超過 10MB 限制' };
  }

  // 驗證 URL 格式
  if (runFlowParams.baseUrl) {
    try {
      new URL(runFlowParams.baseUrl);
    } catch {
      return { isValid: false, error: 'baseUrl 格式無效' };
    }
  }

  // 驗證埠號範圍
  if (runFlowParams.port && (runFlowParams.port < 1 || runFlowParams.port > 65535)) {
    return { isValid: false, error: '埠號必須在 1-65535 範圍內' };
  }

  // 檢查 URL 與埠號的一致性
  if (runFlowParams.baseUrl && runFlowParams.port) {
    const url = new URL(runFlowParams.baseUrl);
    const isHttps = url.protocol === 'https:';
    const isHttp = url.protocol === 'http:';

    if (isHttps && runFlowParams.port === 80) {
      return { isValid: false, error: 'HTTPS URL 不應使用 80 埠' };
    }
    if (isHttp && runFlowParams.port === 443) {
      return { isValid: false, error: 'HTTP URL 不應使用 443 埠' };
    }
  }

  return { isValid: true, params: runFlowParams };
}

/**
 * getReport 方法參數介面（目前無參數，預留未來擴展）
 */
export interface IGetReportParams {
  // 預留給未來擴展，例如：指定報表類型、時間範圍等
}

/**
 * getReport 方法回應介面
 */
export interface IGetReportResult {
  reportPath: string; // 實際讀取的報表檔案路徑
  executionId: string; // 從報表中提取的執行 ID
  status: 'success' | 'partial' | 'failure'; // 從報表中提取的狀態
  reportSummary: {
    totalSteps: number;
    successfulSteps: number;
    failedSteps: number;
    skippedSteps: number;
    duration: number; // 毫秒
  };
  report: unknown; // 完整報表內容
}

/**
 * 驗證 getReport 參數
 */
export function validateGetReportParams(params: unknown): {
  isValid: boolean;
  error?: string;
  params?: IGetReportParams;
} {
  // 目前版本無參數要求，但需要基礎驗證結構
  if (params !== undefined && params !== null && typeof params !== 'object') {
    return { isValid: false, error: '參數必須是物件或為空' };
  }

  // 如果有參數，轉換為空物件（預留未來擴展）
  const getReportParams: IGetReportParams = {};

  return { isValid: true, params: getReportParams };
}

/**
 * 建立標準 JSON-RPC 成功回應
 */
export function createSuccessResponse(
  result: unknown,
  id: string | number | null
): IMcpResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}