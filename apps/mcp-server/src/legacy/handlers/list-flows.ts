import { readdirSync, statSync, existsSync } from 'fs';
import path from 'path';
import type { IMcpRequest, IMcpResponse, IFileListItem } from '../rpc-handler.js';
import { createSuccessResponse, createErrorResponse, JSON_RPC_ERROR_CODES } from '../rpc-handler.js';
import { createEnhancedStructuredLogger } from '@specpilot/shared';

const logger = createEnhancedStructuredLogger('mcp-server');

/**
 * listFlows 方法的參數介面
 */
interface IListFlowsParams {
  directory?: string;
  prefix?: string;
  filename?: string;
}

/**
 * 驗證目錄參數，確保安全性
 */
function validateDirectory(directory: string): string {
  // 移除前後空白
  const normalized = directory.trim();

  // 檢查非法字符（避免控制字符 ASCII 0-31）
  const invalidChars = /[<>:"|?*]/;
  const hasControlChars = normalized.charCodeAt ? Array.from(normalized).some(char => {
    const code = char.charCodeAt(0);
    return code >= 0 && code <= 31;
  }) : false;

  if (invalidChars.test(normalized) || hasControlChars) {
    throw new Error('目錄名稱包含非法字符');
  }

  // 檢查路徑遍歷
  if (normalized.includes('..') || path.isAbsolute(normalized)) {
    throw new Error('不允許路徑遍歷或絕對路徑');
  }

  // 確保在 flows 目錄下
  const flowsDir = path.resolve(process.cwd(), 'flows');
  const targetDir = path.resolve(flowsDir, normalized);

  if (!targetDir.startsWith(flowsDir)) {
    throw new Error('目錄必須在 flows 目錄下');
  }

  return targetDir;
}

/**
 * 驗證字串參數（prefix 或 filename）
 */
function validateStringParam(param: string, name: string): string {
  const normalized = param.trim();

  if (normalized.length === 0) {
    throw new Error(`${name} 不能為空`);
  }

  // 檢查非法字符（避免控制字符 ASCII 0-31）
  const invalidChars = /[<>:"/\\|?*]/;
  const hasControlChars = normalized.charCodeAt ? Array.from(normalized).some(char => {
    const code = char.charCodeAt(0);
    return code >= 0 && code <= 31;
  }) : false;

  if (invalidChars.test(normalized) || hasControlChars) {
    throw new Error(`${name} 包含非法字符`);
  }

  return normalized;
}

/**
 * 處理 listFlows 方法
 */
export function handleListFlows(request: IMcpRequest): IMcpResponse {
  const startTime = Date.now();
  const params = (request.params as IListFlowsParams) || {};

  // 預設使用 flows 目錄
  let targetDir: string;
  try {
    if (params.directory) {
      targetDir = validateDirectory(params.directory);
    } else {
      targetDir = path.resolve(process.cwd(), 'flows');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid directory parameter';

    logger.error('listFlows 參數驗證失敗', {
      method: 'listFlows',
      event: 'list_flows_error',
      details: {
        directory: params.directory,
        error: errorMessage
      }
    });

    return createErrorResponse(
      JSON_RPC_ERROR_CODES.INVALID_PARAMS,
      `無效的目錄參數: ${errorMessage}`,
      request.id || null,
      { invalidParam: 'directory' }
    );
  }

  // 驗證其他參數
  let prefix: string | undefined;
  let filename: string | undefined;

  try {
    if (params.prefix) {
      prefix = validateStringParam(params.prefix, 'prefix');
    }
    if (params.filename) {
      filename = validateStringParam(params.filename, 'filename');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid parameter';

    logger.error('listFlows 參數驗證失敗', {
      method: 'listFlows',
      event: 'list_flows_error',
      details: {
        prefix: params.prefix,
        filename: params.filename,
        error: errorMessage
      }
    });

    return createErrorResponse(
      JSON_RPC_ERROR_CODES.INVALID_PARAMS,
      `參數驗證失敗: ${errorMessage}`,
      request.id || null,
      { invalidParams: { prefix: params.prefix, filename: params.filename } }
    );
  }

  logger.info('listFlows 方法開始執行', {
    method: 'listFlows',
    event: 'list_flows_start',
    details: {
      directory: targetDir,
      prefix,
      filename
    }
  });

  try {
    // 檢查目錄是否存在
    if (!existsSync(targetDir)) {
      logger.error('flows 目錄不存在', {
        method: 'listFlows',
        event: 'list_flows_error',
        details: { directory: targetDir, error: 'ENOENT' }
      });

      return createErrorResponse(
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
        'flows 目錄不存在',
        request.id || null,
        { code: 'ENOENT' }
      );
    }

    // 讀取目錄內容
    const files = readdirSync(targetDir);
    const flowFiles: IFileListItem[] = [];

    for (const file of files) {
      const filePath = path.join(targetDir, file);
      const stats = statSync(filePath);

      // 只處理檔案，跳過目錄
      if (!stats.isFile()) {
        continue;
      }

      const extension = path.extname(file).toLowerCase();

      // 只包含 .yaml、.yml 檔案
      if (!['.yaml', '.yml'].includes(extension)) {
        continue;
      }

      // 套用篩選條件
      if (prefix && !file.startsWith(prefix)) {
        continue;
      }

      if (filename && file !== filename) {
        continue;
      }

      flowFiles.push({
        name: file,
        path: path.relative(process.cwd(), filePath),
        size: stats.size,
        extension: extension.substring(1) // 移除開頭的點
      });
    }

    const duration = Date.now() - startTime;

    logger.info('listFlows 方法執行成功', {
      method: 'listFlows',
      event: 'list_flows_success',
      details: {
        directory: targetDir,
        prefix,
        filename,
        fileCount: flowFiles.length,
        duration
      }
    });

    return createSuccessResponse(flowFiles, request.id || null);

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('listFlows 方法執行失敗', {
      method: 'listFlows',
      event: 'list_flows_error',
      details: {
        directory: targetDir,
        prefix,
        filename,
        error: errorMessage,
        duration
      }
    });

    return createErrorResponse(
      JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      `檔案系統錯誤: ${errorMessage}`,
      request.id || null,
      { originalError: errorMessage }
    );
  }
}