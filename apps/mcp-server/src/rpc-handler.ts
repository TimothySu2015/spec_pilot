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