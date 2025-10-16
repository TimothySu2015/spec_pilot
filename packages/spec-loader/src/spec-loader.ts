import type { SpecDocument, SpecLoadOptions, SpecLoadResult } from './types.js';
import { loadSpecFromFile, loadSpecFromContent } from './loader.js';
import { validateSpecDocument } from './validator.js';
import { 
  logSpecLoadStart, 
  logSpecLoadSuccess, 
  logSpecLoadFailure,
  logSpecValidationStart,
  logSpecValidationSuccess,
  logSpecValidationFailure 
} from './logging.js';
import { SpecParseError, SpecValidationError } from './errors.js';

/**
 * 載入並驗證 OpenAPI 規格
 * 
 * @param options - 載入選項，可以是檔案路徑或直接內容
 * @returns 處理後的規格文件
 */
export async function loadSpec(options: SpecLoadOptions): Promise<SpecDocument> {
  const { filePath, content, format, executionId } = options;

  // 檢查輸入參數
  if (!filePath && !content) {
    throw new SpecParseError(
      '必須提供檔案路徑或內容',
      { filePath, contentLength: content?.length },
      '請提供 filePath 或 content 參數',
      { executionId }
    );
  }

  if (filePath && content) {
    throw new SpecParseError(
      '不能同時提供檔案路徑和內容',
      { filePath, contentLength: content.length },
      '請只提供 filePath 或 content 其中一個參數',
      { executionId }
    );
  }

  let document: SpecDocument;

  try {
    // 第一階段：載入規格
    if (filePath) {
      logSpecLoadStart({ filePath }, format, executionId);
      document = await loadSpecFromFile(filePath, executionId);
    } else {
      logSpecLoadStart({ contentLength: content!.length }, format, executionId);
      document = await loadSpecFromContent(content!, format, executionId);
    }

    logSpecLoadSuccess(document);

    // 第二階段：驗證規格
    logSpecValidationStart(document.id);
    
    const originalSchemaCount = Object.keys(document.schemas).length;
    const validatedDocument = await validateSpecDocument(document, { executionId });
    const finalSchemaCount = Object.keys(validatedDocument.schemas).length;

    logSpecValidationSuccess(validatedDocument, {
      dereferenced: true,
      originalSchemaCount,
      finalSchemaCount,
    });

    return validatedDocument;

  } catch (error) {
    // 記錄載入失敗
    if (error instanceof SpecParseError) {
      logSpecLoadFailure(error, 
        filePath ? { filePath } : { contentLength: content!.length }, 
        format
      );
    } else if (error instanceof SpecValidationError) {
      logSpecValidationFailure(
        document?.id || 'unknown', 
        error,
        {
          path: error.path,
          validationErrors: error.validationErrors,
        }
      );
    } else {
      const unknownError = error instanceof Error ? error : new Error(String(error));
      logSpecLoadFailure(unknownError,
        filePath ? { filePath } : { contentLength: content!.length },
        format
      );
    }

    // 重新拋出錯誤
    throw error;
  }
}

/**
 * 載入並驗證 OpenAPI 規格（安全版本，回傳結果物件）
 * 
 * @param options - 載入選項
 * @returns 包含成功狀態和結果的物件
 */
export async function loadSpecSafe(options: SpecLoadOptions): Promise<SpecLoadResult> {
  try {
    const document = await loadSpec(options);
    return {
      success: true,
      document,
    };
  } catch (error) {
    const err = error as SpecParseError | SpecValidationError | Error;
    
    return {
      success: false,
      error: {
        code: (err as unknown as { code?: number }).code || 1502,
        message: err.message,
        details: (err as unknown as { details?: Record<string, unknown> }).details,
        hint: (err as unknown as { hint?: string }).hint,
      },
    };
  }
}