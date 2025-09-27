/**
 * 認證相關錯誤類別
 */

import { BaseError } from './base-error.js';

/**
 * 認證錯誤基底類別
 */
export abstract class AuthenticationError extends BaseError {
  constructor(
    message: string,
    code: number,
    details?: Record<string, unknown>,
    hint?: string,
    context?: Record<string, unknown>
  ) {
    const authContext = {
      component: 'authentication',
      ...context
    };
    super(message, code, details, hint, authContext);
  }

  /**
   * 取得遮罩後的詳細資訊（隱藏 Token 等敏感資料）
   */
  getMaskedDetails(): Record<string, unknown> {
    if (!this.details) {
      return {};
    }

    const masked = { ...this.details };
    const sensitiveKeys = ['token', 'authorization', 'password', 'secret', 'key'];

    for (const [key, value] of Object.entries(masked)) {
      if (typeof value === 'string' && value.startsWith('Bearer ')) {
        masked[key] = 'Bearer ***';
      } else if (sensitiveKeys.some(sensitive =>
        key.toLowerCase().includes(sensitive.toLowerCase())
      )) {
        masked[key] = '***';
      }
    }

    return masked;
  }

  /**
   * 序列化錯誤為 JSON 格式（遮罩敏感資料）
   */
  toJSON(): Record<string, unknown> {
    const json = super.toJSON();
    json.details = this.getMaskedDetails();
    return json;
  }
}

/**
 * Token 缺失錯誤 (1501)
 */
export class TokenMissingError extends AuthenticationError {
  constructor(
    namespace: string,
    details?: Record<string, unknown>,
    context?: Record<string, unknown>
  ) {
    super(
      `命名空間 "${namespace}" 的 Token 不存在`,
      1501,
      { namespace, ...details },
      '請檢查 Token 設定或環境變數配置',
      context
    );
  }

  static create(namespace: string, context?: Record<string, unknown>): TokenMissingError {
    return new TokenMissingError(namespace, undefined, context);
  }

  static withDetails(
    namespace: string,
    details: Record<string, unknown>,
    context?: Record<string, unknown>
  ): TokenMissingError {
    return new TokenMissingError(namespace, details, context);
  }
}

/**
 * Token 過期錯誤 (1502)
 */
export class TokenExpiredError extends AuthenticationError {
  constructor(
    namespace: string,
    expiredAt: string,
    details?: Record<string, unknown>,
    context?: Record<string, unknown>
  ) {
    super(
      `命名空間 "${namespace}" 的 Token 已於 ${expiredAt} 過期`,
      1502,
      { namespace, expiredAt, ...details },
      '請重新登入以取得新的 Token',
      context
    );
  }

  static create(
    namespace: string,
    expiredAt: Date,
    context?: Record<string, unknown>
  ): TokenExpiredError {
    return new TokenExpiredError(
      namespace,
      expiredAt.toISOString(),
      undefined,
      context
    );
  }

  static withDetails(
    namespace: string,
    expiredAt: Date,
    details: Record<string, unknown>,
    context?: Record<string, unknown>
  ): TokenExpiredError {
    return new TokenExpiredError(
      namespace,
      expiredAt.toISOString(),
      details,
      context
    );
  }
}

/**
 * 認證失敗錯誤 (1503)
 */
export class AuthenticationFailedError extends AuthenticationError {
  constructor(
    stepName: string,
    statusCode?: number,
    details?: Record<string, unknown>,
    context?: Record<string, unknown>
  ) {
    const statusText = statusCode ? ` (HTTP ${statusCode})` : '';
    super(
      `步驟 "${stepName}" 認證失敗${statusText}`,
      1503,
      { stepName, statusCode, ...details },
      statusCode === 401
        ? '請檢查認證憑證是否正確'
        : statusCode === 403
        ? '請檢查是否有足夠的權限'
        : '請檢查認證設定與 API 端點',
      context
    );
  }

  static create(
    stepName: string,
    context?: Record<string, unknown>
  ): AuthenticationFailedError {
    return new AuthenticationFailedError(stepName, undefined, undefined, context);
  }

  static withStatusCode(
    stepName: string,
    statusCode: number,
    context?: Record<string, unknown>
  ): AuthenticationFailedError {
    return new AuthenticationFailedError(stepName, statusCode, undefined, context);
  }

  static withDetails(
    stepName: string,
    statusCode: number,
    details: Record<string, unknown>,
    context?: Record<string, unknown>
  ): AuthenticationFailedError {
    return new AuthenticationFailedError(stepName, statusCode, details, context);
  }
}

/**
 * Token 提取失敗錯誤 (1504)
 */
export class TokenExtractionError extends AuthenticationError {
  constructor(
    stepName: string,
    extractionPath: string,
    details?: Record<string, unknown>,
    context?: Record<string, unknown>
  ) {
    super(
      `步驟 "${stepName}" 無法從回應中提取 Token（路徑：${extractionPath}）`,
      1504,
      { stepName, extractionPath, ...details },
      '請檢查 Token 提取路徑是否正確，或 API 回應格式是否符合預期',
      context
    );
  }

  static create(
    stepName: string,
    extractionPath: string,
    context?: Record<string, unknown>
  ): TokenExtractionError {
    return new TokenExtractionError(stepName, extractionPath, undefined, context);
  }

  static withDetails(
    stepName: string,
    extractionPath: string,
    details: Record<string, unknown>,
    context?: Record<string, unknown>
  ): TokenExtractionError {
    return new TokenExtractionError(stepName, extractionPath, details, context);
  }
}

/**
 * 環境變數缺失錯誤 (1505)
 */
export class EnvironmentVariableMissingError extends AuthenticationError {
  constructor(
    envVarName: string,
    namespace?: string,
    details?: Record<string, unknown>,
    context?: Record<string, unknown>
  ) {
    const namespaceText = namespace ? ` (命名空間：${namespace})` : '';
    super(
      `環境變數 "${envVarName}" 未設定${namespaceText}`,
      1505,
      { envVarName, namespace, ...details },
      '請在 .env 檔案或系統環境變數中設定此值',
      context
    );
  }

  static create(
    envVarName: string,
    context?: Record<string, unknown>
  ): EnvironmentVariableMissingError {
    return new EnvironmentVariableMissingError(envVarName, undefined, undefined, context);
  }

  static withNamespace(
    envVarName: string,
    namespace: string,
    context?: Record<string, unknown>
  ): EnvironmentVariableMissingError {
    return new EnvironmentVariableMissingError(envVarName, namespace, undefined, context);
  }
}

/**
 * 認證設定無效錯誤 (1506)
 */
export class AuthConfigInvalidError extends AuthenticationError {
  constructor(
    configField: string,
    reason: string,
    details?: Record<string, unknown>,
    context?: Record<string, unknown>
  ) {
    super(
      `認證設定 "${configField}" 無效：${reason}`,
      1506,
      { configField, reason, ...details },
      '請檢查認證設定格式是否正確',
      context
    );
  }

  static create(
    configField: string,
    reason: string,
    context?: Record<string, unknown>
  ): AuthConfigInvalidError {
    return new AuthConfigInvalidError(configField, reason, undefined, context);
  }

  static withDetails(
    configField: string,
    reason: string,
    details: Record<string, unknown>,
    context?: Record<string, unknown>
  ): AuthConfigInvalidError {
    return new AuthConfigInvalidError(configField, reason, details, context);
  }
}

/**
 * 工廠函式：根據錯誤類型和上下文創建適當的認證錯誤
 */
export class AuthErrorFactory {
  /**
   * 創建 Token 缺失錯誤
   */
  static tokenMissing(
    namespace: string,
    context?: Record<string, unknown>
  ): TokenMissingError {
    return TokenMissingError.create(namespace, context);
  }

  /**
   * 創建 Token 過期錯誤
   */
  static tokenExpired(
    namespace: string,
    expiredAt: Date,
    context?: Record<string, unknown>
  ): TokenExpiredError {
    return TokenExpiredError.create(namespace, expiredAt, context);
  }

  /**
   * 創建認證失敗錯誤
   */
  static authenticationFailed(
    stepName: string,
    statusCode?: number,
    context?: Record<string, unknown>
  ): AuthenticationFailedError {
    return statusCode
      ? AuthenticationFailedError.withStatusCode(stepName, statusCode, context)
      : AuthenticationFailedError.create(stepName, context);
  }

  /**
   * 創建 Token 提取失敗錯誤
   */
  static tokenExtractionFailed(
    stepName: string,
    extractionPath: string,
    context?: Record<string, unknown>
  ): TokenExtractionError {
    return TokenExtractionError.create(stepName, extractionPath, context);
  }

  /**
   * 創建環境變數缺失錯誤
   */
  static environmentVariableMissing(
    envVarName: string,
    namespace?: string,
    context?: Record<string, unknown>
  ): EnvironmentVariableMissingError {
    return namespace
      ? EnvironmentVariableMissingError.withNamespace(envVarName, namespace, context)
      : EnvironmentVariableMissingError.create(envVarName, context);
  }

  /**
   * 創建認證設定無效錯誤
   */
  static authConfigInvalid(
    configField: string,
    reason: string,
    context?: Record<string, unknown>
  ): AuthConfigInvalidError {
    return AuthConfigInvalidError.create(configField, reason, context);
  }
}