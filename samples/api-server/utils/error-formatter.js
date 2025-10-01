const fs = require('fs');
const path = require('path');

/**
 * 錯誤格式化工具
 */
class ErrorFormatter {
  constructor(environment = 'development') {
    this.environment = environment;
    this.config = this.getConfig(environment);
  }

  /**
   * 取得環境配置
   */
  getConfig(env) {
    const configs = {
      development: {
        includeStackTrace: true,
        includeSourceContext: true,
        maxStackDepth: 20,
      },
      test: {
        includeStackTrace: true,
        includeSourceContext: false,
        maxStackDepth: 10,
      },
      staging: {
        includeStackTrace: true,
        includeSourceContext: false,
        maxStackDepth: 10,
      },
      production: {
        includeStackTrace: false,
        includeSourceContext: false,
        maxStackDepth: 0,
      },
    };
    return configs[env] || configs.production;
  }

  /**
   * 格式化錯誤為診斷友善的格式
   */
  format(error, requestId = null) {
    const formatted = {
      error: this.getErrorCode(error),
      message: this.getMessage(error),
      hint: error.hint,
      details: this.sanitizeDetails(error.details),
      documentation_url: error.documentationUrl,
      request_id: requestId,
      timestamp: new Date().toISOString(),
    };

    // ✨ 加入 Stack Trace (如果配置允許)
    if (this.config.includeStackTrace && error.stack) {
      formatted.stack_trace = this.formatStackTrace(error.stack);
    }

    // ✨ 加入原始碼上下文 (如果配置允許)
    if (this.config.includeSourceContext && error.stack) {
      formatted.source_context = this.extractSourceContext(error.stack);
    }

    // 移除 undefined 值
    return this.removeUndefined(formatted);
  }

  /**
   * 取得錯誤代碼
   */
  getErrorCode(error) {
    if (error.errorCode) return error.errorCode;
    if (error.name === 'ValidationError') return 'VALIDATION_ERROR';
    if (error.name === 'UnauthorizedError') return 'AUTHENTICATION_FAILED';
    return 'INTERNAL_SERVER_ERROR';
  }

  /**
   * 取得錯誤訊息
   */
  getMessage(error) {
    // 在正式環境隱藏內部錯誤細節
    if (this.environment === 'production' && !error.errorCode) {
      return '伺服器內部錯誤';
    }
    return error.message || '未知錯誤';
  }

  /**
   * 格式化 Stack Trace
   */
  formatStackTrace(stack) {
    return stack
      .split('\n')
      .slice(0, this.config.maxStackDepth)
      .map(line => this.simplifyPath(line.trim()))
      .filter(line => line.length > 0);
  }

  /**
   * 簡化路徑 (移除敏感資訊)
   */
  simplifyPath(line) {
    const projectRoot = process.cwd();
    return line.replace(projectRoot, '.');
  }

  /**
   * 提取原始碼上下文
   */
  extractSourceContext(stack) {
    try {
      // 解析第一行 stack trace
      const match = stack.match(/at\s+(?:.*?\s+)?\(?(.+?):(\d+):(\d+)\)?/);
      if (!match) return null;

      const [, filePath, lineNum, colNum] = match;
      const line = parseInt(lineNum);

      // 檢查檔案是否存在
      if (!fs.existsSync(filePath)) return null;

      // 讀取檔案
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const lines = fileContent.split('\n');

      // 提取錯誤行前後各 3 行
      const startLine = Math.max(0, line - 4);
      const endLine = Math.min(lines.length, line + 3);

      const context = [];
      for (let i = startLine; i < endLine; i++) {
        context.push({
          line: i + 1,
          code: lines[i],
          is_error: i + 1 === line,
        });
      }

      return {
        file: this.simplifyPath(filePath),
        line: line,
        column: parseInt(colNum),
        context: context,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * 清理敏感資料
   */
  sanitizeDetails(details) {
    if (!details) return undefined;

    const sanitized = { ...details };
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'api_key', 'private_key'];

    const sanitize = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(item => sanitize(item));
      }

      if (typeof obj === 'object' && obj !== null) {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          const lowerKey = key.toLowerCase();
          const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk));

          if (isSensitive) {
            result[key] = '***';
          } else if (typeof value === 'object') {
            result[key] = sanitize(value);
          } else {
            result[key] = value;
          }
        }
        return result;
      }

      return obj;
    };

    return sanitize(sanitized);
  }

  /**
   * 移除 undefined 值
   */
  removeUndefined(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
}

module.exports = ErrorFormatter;
