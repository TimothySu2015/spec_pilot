import type { IMcpRequest, IMcpResponse } from '../rpc-handler.js';
import { createSuccessResponse } from '../rpc-handler.js';

/**
 * 處理 getReport 方法
 */
export function handleGetReport(request: IMcpRequest): IMcpResponse {
  // TODO: 實作報表取得功能 - 需要報表模組
  const result = {
    report: null,
    message: '報表模組尚未實作，待後續 Story 完成',
  };

  return createSuccessResponse(result, request.id || null);
}