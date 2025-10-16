import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import type { SpecDocument, OpenApiDocument } from './types.js';
import { SpecParseError, SpecFileNotFoundError, UnsupportedFormatError } from './errors.js';
import { 
  getFormatFromExtension, 
  isSupportedExtension, 
  detectContentFormat, 
  generateSpecId 
} from './utils.js';

/**
 * 從檔案路徑載入 OpenAPI 規格
 */
export async function loadSpecFromFile(filePath: string, executionId?: string): Promise<SpecDocument> {
  try {
    // 檢查檔案是否存在
    await access(filePath, constants.F_OK);
  } catch {
    throw new SpecFileNotFoundError(filePath, { executionId });
  }

  // 檢查副檔名是否支援
  if (!isSupportedExtension(filePath)) {
    const format = getFormatFromExtension(filePath);
    throw new UnsupportedFormatError(
      format || 'unknown',
      ['.json', '.yaml', '.yml'],
      { executionId, filePath }
    );
  }

  try {
    // 讀取檔案內容
    const rawContent = await readFile(filePath, 'utf-8');
    
    if (!rawContent.trim()) {
      throw new SpecParseError(
        '規格檔案內容為空',
        { filePath },
        '請確認檔案包含有效的 OpenAPI 規格內容',
        { executionId }
      );
    }

    // 根據副檔名確定格式
    const format = getFormatFromExtension(filePath);
    if (!format) {
      throw new UnsupportedFormatError(
        undefined,
        ['.json', '.yaml', '.yml'],
        { executionId, filePath }
      );
    }

    // 解析內容
    const document = await parseContent(rawContent, format, { filePath, executionId });
    
    return {
      id: generateSpecId(filePath),
      rawContent,
      document,
      schemas: extractSchemas(document),
      loadedAt: new Date().toISOString(),
    };

  } catch (error) {
    // 如果是我們自己拋出的錯誤，直接重新拋出
    if (error instanceof SpecParseError || 
        error instanceof SpecFileNotFoundError || 
        error instanceof UnsupportedFormatError) {
      throw error;
    }

    // 包裝其他錯誤
    throw new SpecParseError(
      `讀取規格檔案失敗: ${filePath}`,
      { 
        filePath,
        originalError: error instanceof Error ? error.message : String(error)
      },
      '請檢查檔案權限和內容格式',
      { executionId }
    );
  }
}

/**
 * 從內容字串載入 OpenAPI 規格
 */
export async function loadSpecFromContent(
  content: string,
  format?: 'json' | 'yaml',
  executionId?: string
): Promise<SpecDocument> {
  if (!content.trim()) {
    throw new SpecParseError(
      '規格內容為空',
      { contentLength: content.length },
      '請提供有效的 OpenAPI 規格內容',
      { executionId }
    );
  }

  try {
    // 如果沒有指定格式，自動推斷
    let detectedFormat = format;
    if (!detectedFormat) {
      const detection = detectContentFormat(content);
      detectedFormat = detection.format;
      
      if (detection.confidence < 0.5) {
        throw new SpecParseError(
          '無法識別內容格式',
          { 
            detection,
            contentPreview: content.substring(0, 100)
          },
          '請明確指定格式（json 或 yaml）或檢查內容格式',
          { executionId }
        );
      }
    }

    // 解析內容
    const document = await parseContent(content, detectedFormat, { executionId });
    
    return {
      id: generateSpecId(undefined, content),
      rawContent: content,
      document,
      schemas: extractSchemas(document),
      loadedAt: new Date().toISOString(),
    };

  } catch (error) {
    // 如果是我們自己拋出的錯誤，直接重新拋出
    if (error instanceof SpecParseError) {
      throw error;
    }

    // 包裝其他錯誤
    throw new SpecParseError(
      '解析規格內容失敗',
      { 
        contentLength: content.length,
        format: format || 'auto-detect',
        originalError: error instanceof Error ? error.message : String(error)
      },
      '請檢查內容格式是否正確',
      { executionId }
    );
  }
}

/**
 * 解析內容為 OpenAPI 文件
 */
async function parseContent(
  content: string, 
  format: 'json' | 'yaml',
  context: { filePath?: string; executionId?: string }
): Promise<OpenApiDocument> {
  try {
    let parsed: unknown;

    if (format === 'json') {
      parsed = JSON.parse(content);
    } else {
      parsed = parseYaml(content);
    }

    // 基本類型檢查
    if (!parsed || typeof parsed !== 'object') {
      throw new SpecParseError(
        `${format.toUpperCase()} 解析結果不是物件`,
        { 
          format,
          parsedType: typeof parsed
        },
        '確保內容是有效的 JSON 物件或 YAML 文件',
        context
      );
    }

    return parsed as OpenApiDocument;

  } catch (error) {
    if (error instanceof SpecParseError) {
      throw error;
    }

    // 根據格式提供更具體的錯誤訊息
    const message = `${format.toUpperCase()} 解析失敗`;
    let hint = '請檢查語法是否正確';

    if (format === 'json') {
      if (error instanceof SyntaxError) {
        hint = '請檢查 JSON 語法，確保括號、引號、逗號等符號正確';
      }
    } else {
      hint = '請檢查 YAML 縮排和語法是否正確';
    }

    throw new SpecParseError(
      message,
      {
        format,
        originalError: error instanceof Error ? error.message : String(error)
      },
      hint,
      context
    );
  }
}

/**
 * 提取 OpenAPI 文件中的 schemas
 */
function extractSchemas(document: OpenApiDocument): Record<string, unknown> {
  const schemas: Record<string, unknown> = {};

  // OpenAPI 3.0/3.1 的 components.schemas
  if ('components' in document && document.components?.schemas) {
    Object.assign(schemas, document.components.schemas);
  }

  return schemas;
}