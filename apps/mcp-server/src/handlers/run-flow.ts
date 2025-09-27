import type { IMcpRequest, IMcpResponse } from '../rpc-handler.js';
import { createSuccessResponse } from '../rpc-handler.js';

/**
 * 處理 runFlow 方法
 */
export function handleRunFlow(request: IMcpRequest): IMcpResponse {
  // TODO: 實作測試執行功能 - 需要核心執行引擎
  const result = {
    status: 'pending',
    message: '核心執行引擎尚未實作，待後續 Story 完成',
  };

  return createSuccessResponse(result, request.id || null);
}