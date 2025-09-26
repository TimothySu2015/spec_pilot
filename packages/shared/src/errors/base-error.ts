/**
 * 共用錯誤基底類別
 */
export abstract class BaseError extends Error {
  public readonly code: number;
  public readonly details?: Record<string, unknown>;
  public readonly hint?: string;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: number,
    details?: Record<string, unknown>,
    hint?: string,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.hint = hint;
    this.context = context;
    this.timestamp = new Date().toISOString();

    // 確保堆疊追蹤正確顯示
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * 序列化錯誤為 JSON 格式
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      hint: this.hint,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  /**
   * 格式化錯誤為可讀的字串
   */
  toString(): string {
    let result = `${this.name} [${this.code}]: ${this.message}`;
    
    if (this.hint) {
      result += `\nHint: ${this.hint}`;
    }
    
    if (this.details && Object.keys(this.details).length > 0) {
      result += `\nDetails: ${JSON.stringify(this.details, null, 2)}`;
    }
    
    return result;
  }
}