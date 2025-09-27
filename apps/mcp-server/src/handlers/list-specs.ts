import type { IMcpRequest, IMcpResponse } from '../rpc-handler.js';
import { createSuccessResponse } from '../rpc-handler.js';

/**
 * 處理 listSpecs 方法
 */
export function handleListSpecs(request: IMcpRequest): IMcpResponse {
  // TODO: 實作 OpenAPI 規格列表功能 - 需要 spec-loader 模組
  const result = {
    specs: ['待實作 - 需要 spec-loader 模組'],
    message: '核心模組尚未實作，待後續 Story 完成',
  };

  return createSuccessResponse(result, request.id || null);
}