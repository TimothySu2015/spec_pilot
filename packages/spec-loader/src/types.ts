import type { OpenAPIV3, OpenAPIV3_1 } from '@apidevtools/swagger-parser';

/**
 * OpenAPI 規格文件類型
 */
export type OpenApiDocument = OpenAPIV3.Document | OpenAPIV3_1.Document;

/**
 * 規格文件載入選項
 */
export interface SpecLoadOptions {
  /** 檔案路徑（用於從檔案系統載入） */
  filePath?: string;
  /** 直接內容（用於從字串載入） */
  content?: string;
  /** 內容格式，如未指定將自動推斷 */
  format?: 'json' | 'yaml';
  /** 執行 ID，用於日誌追蹤 */
  executionId?: string;
}

/**
 * 規格文件
 */
export interface SpecDocument {
  /** 唯一標識符，使用檔案路徑或內容 SHA-256 雜湊 */
  id: string;
  /** 原始內容（JSON 或 YAML 字串） */
  rawContent: string;
  /** 解析後的 OpenAPI 文件 */
  document: OpenApiDocument;
  /** 提取的 schemas，供後續驗證使用 */
  schemas: Record<string, unknown>;
  /** 載入時間戳 */
  loadedAt: string;
}

/**
 * 規格載入結果
 */
export interface SpecLoadResult {
  /** 是否成功 */
  success: boolean;
  /** 規格文件（成功時） */
  document?: SpecDocument;
  /** 錯誤訊息（失敗時） */
  error?: {
    code: number;
    message: string;
    details?: Record<string, unknown>;
    hint?: string;
  };
}

/**
 * 支援的檔案副檔名
 */
export const SUPPORTED_EXTENSIONS = ['.json', '.yaml', '.yml'] as const;

/**
 * 檔案格式類型
 */
export type FileFormat = 'json' | 'yaml';

/**
 * 內容類型檢測結果
 */
export interface ContentTypeDetection {
  format: FileFormat;
  confidence: number;
}

