import { BaseError, ERROR_CODES } from '@specpilot/shared';

/**
 * 規格解析錯誤
 * 當 JSON/YAML 解析失敗時拋出
 */
export class SpecParseError extends BaseError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    hint?: string,
    context?: Record<string, unknown>
  ) {
    super(message, ERROR_CODES.SPEC_ERROR, details, hint, context);
  }
}

/**
 * 規格驗證錯誤
 * 當 swagger-parser 驗證失敗時拋出
 */
export class SpecValidationError extends BaseError {
  public readonly path?: string;
  public readonly validationErrors?: unknown[];

  constructor(
    message: string,
    path?: string,
    validationErrors?: unknown[],
    details?: Record<string, unknown>,
    hint?: string,
    context?: Record<string, unknown>
  ) {
    super(message, ERROR_CODES.SPEC_ERROR, details, hint, context);
    this.path = path;
    this.validationErrors = validationErrors;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      path: this.path,
      validationErrors: this.validationErrors,
    };
  }
}

/**
 * 檔案不存在錯誤
 */
export class SpecFileNotFoundError extends BaseError {
  public readonly filePath: string;

  constructor(filePath: string, context?: Record<string, unknown>) {
    super(
      `規格檔案不存在: ${filePath}`,
      ERROR_CODES.SPEC_ERROR,
      { filePath },
      '請檢查檔案路徑是否正確',
      context
    );
    this.filePath = filePath;
  }
}

/**
 * 不支援的檔案格式錯誤
 */
export class UnsupportedFormatError extends BaseError {
  public readonly format?: string;
  public readonly supportedFormats: string[];

  constructor(
    format?: string,
    supportedFormats: string[] = ['.json', '.yaml', '.yml'],
    context?: Record<string, unknown>
  ) {
    super(
      format 
        ? `不支援的檔案格式: ${format}` 
        : '無法識別檔案格式',
      ERROR_CODES.SPEC_ERROR,
      { format, supportedFormats },
      `支援的格式: ${supportedFormats.join(', ')}`,
      context
    );
    this.format = format;
    this.supportedFormats = supportedFormats;
  }
}