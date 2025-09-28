import { readdirSync, statSync, existsSync } from 'fs';
import path from 'path';
import type { IMcpRequest, IMcpResponse, IFileListItem } from '../rpc-handler.js';
import { createSuccessResponse, createErrorResponse, JSON_RPC_ERROR_CODES } from '../rpc-handler.js';
import { createEnhancedStructuredLogger } from '@specpilot/shared';

const logger = createEnhancedStructuredLogger('mcp-server');

/**
 * 處理 listSpecs 方法
 */
export function handleListSpecs(request: IMcpRequest): IMcpResponse {
  const startTime = Date.now();
  const specsDir = path.resolve(process.cwd(), 'specs');

  logger.info('listSpecs 方法開始執行', {
    method: 'listSpecs',
    event: 'list_specs_start',
    details: { directory: specsDir }
  });

  try {
    // 檢查 specs 目錄是否存在
    if (!existsSync(specsDir)) {
      logger.error('specs 目錄不存在', {
        method: 'listSpecs',
        event: 'list_specs_error',
        details: { directory: specsDir, error: 'ENOENT' }
      });

      return createErrorResponse(
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
        'specs 目錄不存在',
        request.id || null,
        { code: 'ENOENT' }
      );
    }

    // 讀取目錄內容
    const files = readdirSync(specsDir);
    const specFiles: IFileListItem[] = [];

    for (const file of files) {
      const filePath = path.join(specsDir, file);
      const stats = statSync(filePath);

      // 只處理檔案，跳過目錄
      if (!stats.isFile()) {
        continue;
      }

      const extension = path.extname(file).toLowerCase();

      // 只包含 .json、.yaml、.yml 檔案
      if (['.json', '.yaml', '.yml'].includes(extension)) {
        specFiles.push({
          name: file,
          path: path.relative(process.cwd(), filePath),
          size: stats.size,
          extension: extension.substring(1) // 移除開頭的點
        });
      }
    }

    const duration = Date.now() - startTime;

    logger.info('listSpecs 方法執行成功', {
      method: 'listSpecs',
      event: 'list_specs_success',
      details: {
        directory: specsDir,
        fileCount: specFiles.length,
        duration
      }
    });

    return createSuccessResponse(specFiles, request.id || null);

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('listSpecs 方法執行失敗', {
      method: 'listSpecs',
      event: 'list_specs_error',
      details: {
        directory: specsDir,
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