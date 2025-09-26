import SwaggerParser from '@apidevtools/swagger-parser';
import type { ISpecDocument, OpenApiDocument } from './types.js';
import { SpecValidationError } from './errors.js';

/**
 * 驗證並展開 OpenAPI 規格
 */
export async function validateAndDereferenceSpec(
  spec: OpenApiDocument,
  context?: { filePath?: string; executionId?: string }
): Promise<OpenApiDocument> {
  try {
    // 使用 swagger-parser 驗證規格
    const validatedSpec = await SwaggerParser.validate(spec);
    
    // 展開所有 $ref 參考
    const dereferencedSpec = await SwaggerParser.dereference(validatedSpec);
    
    return dereferencedSpec as OpenApiDocument;

  } catch (error) {
    // 處理驗證錯誤
    if (isSwaggerParserError(error)) {
      throw new SpecValidationError(
        '規格驗證失敗',
        error.path,
        error.errors || [error],
        {
          originalMessage: error.message,
          invalidSpec: error.invalidSpec || false
        },
        '請檢查 OpenAPI 規格是否符合標準格式',
        context
      );
    }

    // 處理其他錯誤
    throw new SpecValidationError(
      'OpenAPI 規格處理失敗',
      undefined,
      undefined,
      {
        originalError: error instanceof Error ? error.message : String(error)
      },
      '請確認規格內容格式正確',
      context
    );
  }
}

/**
 * 完整驗證並處理 SpecDocument
 */
export async function validateSpecDocument(
  document: ISpecDocument,
  context?: { executionId?: string }
): Promise<ISpecDocument> {
  try {
    // 驗證並展開規格
    const validatedDocument = await validateAndDereferenceSpec(
      document.document,
      { 
        filePath: document.id.startsWith('/') ? document.id : undefined,
        executionId: context?.executionId
      }
    );

    // 重新提取 schemas（展開後可能有變化）
    const schemas = extractSchemas(validatedDocument);

    return {
      ...document,
      document: validatedDocument,
      schemas,
    };

  } catch (error) {
    if (error instanceof SpecValidationError) {
      throw error;
    }

    throw new SpecValidationError(
      '規格文件驗證失敗',
      undefined,
      undefined,
      {
        specId: document.id,
        originalError: error instanceof Error ? error.message : String(error)
      },
      '請檢查 OpenAPI 規格內容',
      context
    );
  }
}

/**
 * 提取展開後的 schemas
 */
function extractSchemas(document: OpenApiDocument): Record<string, unknown> {
  const schemas: Record<string, unknown> = {};

  // OpenAPI 3.0/3.1 的 components.schemas
  if ('components' in document && document.components?.schemas) {
    Object.assign(schemas, document.components.schemas);
  }

  return schemas;
}

/**
 * 檢查是否為 swagger-parser 錯誤
 */
function isSwaggerParserError(error: unknown): error is ISwaggerParserError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as unknown as ISwaggerParserError).message === 'string'
  );
}

/**
 * swagger-parser 錯誤介面
 */
interface ISwaggerParserError {
  message: string;
  path?: string;
  errors?: unknown[];
  invalidSpec?: boolean;
}

/**
 * 取得規格基本資訊（用於日誌）
 */
export function getSpecInfo(document: OpenApiDocument): {
  version?: string;
  pathCount: number;
  schemaCount: number;
  title?: string;
} {
  const info = {
    version: undefined as string | undefined,
    pathCount: 0,
    schemaCount: 0,
    title: undefined as string | undefined,
  };

  // OpenAPI 版本
  if ('openapi' in document) {
    info.version = document.openapi;
  } else if ('swagger' in document) {
    info.version = document.swagger;
  }

  // 標題
  if (document.info?.title) {
    info.title = document.info.title;
  }

  // 路徑數量
  if (document.paths) {
    info.pathCount = Object.keys(document.paths).length;
  }

  // Schema 數量
  if ('components' in document && document.components?.schemas) {
    info.schemaCount = Object.keys(document.components.schemas).length;
  }

  return info;
}