import type { IMcpRequest, IMcpResponse } from '../rpc-handler.js';
import { createSuccessResponse } from '../rpc-handler.js';

/**
 * 處理 listFlows 方法
 */
export function handleListFlows(request: IMcpRequest): IMcpResponse {
  // TODO: 實作測試流程列表功能 - 需要 flow-parser 模組
  const result = {
    flows: ['待實作 - 需要 flow-parser 模組'],
    message: '核心模組尚未實作，待後續 Story 完成',
  };

  return createSuccessResponse(result, request.id || null);
}