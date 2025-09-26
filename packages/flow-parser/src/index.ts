/**
 * Flow Parser 主要匯出介面
 */

import { createStructuredLogger, IStructuredLogger } from '@specpilot/shared';
import { FlowLoader } from './loader.js';
import { IFlowDefinition, IFlowLoadOptions, IFlowLoadResult } from './types.js';

// 匯出所有類型
export * from './types.js';
export * from './errors.js';
export { FlowLoader } from './loader.js';

// 預設的 logger 實例
const defaultLogger = createStructuredLogger('flow-parser');

/**
 * 載入 Flow 定義（根據參數自動判斷輸入類型）
 * 會拋出錯誤，適用於需要明確錯誤處理的情境
 */
export async function loadFlow(
  options: IFlowLoadOptions,
  logger?: IStructuredLogger
): Promise<IFlowDefinition> {
  const loader = new FlowLoader(logger || defaultLogger);
  const executionId = options.executionId || generateExecutionId();

  // 根據參數判斷載入方式
  if (options.filePath) {
    return await loader.loadFlowFromFile(options.filePath, executionId);
  } else if (options.content) {
    return await loader.loadFlowFromContent(options.content, executionId);
  } else {
    throw new Error('必須提供 filePath 或 content 參數');
  }
}

/**
 * 安全版本的 Flow 載入函式（包裝版本，不拋出錯誤）
 * 回傳結果物件，適用於需要優雅錯誤處理的情境
 */
export async function loadFlowSafe(
  options: IFlowLoadOptions,
  logger?: IStructuredLogger
): Promise<IFlowLoadResult> {
  try {
    const flow = await loadFlow(options, logger);
    return {
      success: true,
      flow
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      details: error instanceof Error && 'details' in error 
        ? (error as { details?: Record<string, unknown> }).details 
        : undefined
    };
  }
}

/**
 * 便利函式：從檔案路徑載入 Flow
 */
export async function loadFlowFromFile(
  filePath: string,
  executionId?: string,
  logger?: IStructuredLogger
): Promise<IFlowDefinition> {
  return loadFlow({ filePath, executionId }, logger);
}

/**
 * 便利函式：從內容載入 Flow
 */
export async function loadFlowFromContent(
  content: string,
  executionId?: string,
  logger?: IStructuredLogger
): Promise<IFlowDefinition> {
  return loadFlow({ content, executionId }, logger);
}

/**
 * 產生唯一的執行 ID
 */
function generateExecutionId(): string {
  return `flow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}