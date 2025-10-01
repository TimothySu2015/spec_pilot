/**
 * 診斷友善的錯誤基礎類別
 */
class DiagnosticError extends Error {
  constructor(errorCode, message, statusCode = 500, options = {}) {
    super(message);
    this.name = 'DiagnosticError';
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.hint = options.hint;
    this.details = options.details;
    this.documentationUrl = options.documentationUrl;

    // 保留原始 stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.errorCode,
      message: this.message,
      hint: this.hint,
      details: this.details,
      documentation_url: this.documentationUrl,
    };
  }
}

// ===== 常見錯誤類型 =====

/**
 * 認證錯誤
 */
class AuthenticationError extends DiagnosticError {
  constructor(message, options = {}) {
    super('AUTHENTICATION_FAILED', message, 401, {
      ...options,
      documentationUrl: options.documentationUrl || 'https://api.example.com/docs/errors/auth'
    });
  }
}

/**
 * 授權錯誤
 */
class AuthorizationError extends DiagnosticError {
  constructor(message, options = {}) {
    super('AUTHORIZATION_FAILED', message, 403, {
      ...options,
      documentationUrl: options.documentationUrl || 'https://api.example.com/docs/errors/auth'
    });
  }
}

/**
 * 資源不存在
 */
class ResourceNotFoundError extends DiagnosticError {
  constructor(resourceType, resourceId, options = {}) {
    super(
      'RESOURCE_NOT_FOUND',
      `找不到 ${resourceType} 資源: ${resourceId}`,
      404,
      {
        hint: options.hint || '請確認資源 ID 是否正確',
        details: { resourceType, resourceId, ...options.details }
      }
    );
  }
}

/**
 * 驗證錯誤
 */
class ValidationError extends DiagnosticError {
  constructor(message, validationErrors, options = {}) {
    super('VALIDATION_ERROR', message, 400, {
      hint: options.hint || '請檢查請求資料格式是否正確',
      details: { fields: validationErrors }
    });
  }
}

/**
 * 資料庫錯誤
 */
class DatabaseError extends DiagnosticError {
  constructor(message, options = {}) {
    super('DATABASE_ERROR', message, 500, {
      hint: options.hint || '請檢查資料庫連線狀態',
      details: options.details,
      documentationUrl: 'https://api.example.com/docs/errors/database'
    });
  }
}

module.exports = {
  DiagnosticError,
  AuthenticationError,
  AuthorizationError,
  ResourceNotFoundError,
  ValidationError,
  DatabaseError,
};
