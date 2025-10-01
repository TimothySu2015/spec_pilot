const ErrorFormatter = require('../utils/error-formatter');
const { DiagnosticError } = require('../errors/DiagnosticError');

/**
 * 全域錯誤處理 Middleware
 */
function errorHandler(logger) {
  const formatter = new ErrorFormatter(process.env.NODE_ENV);

  return (err, req, res, next) => {
    // 取得 Request ID
    const requestId = req.id || req.headers['x-request-id'] || generateRequestId();

    // 記錄錯誤日誌
    logger.error({
      message: 'Unhandled error occurred',
      error: err.message,
      stack: err.stack,
      requestId,
      method: req.method,
      path: req.path,
      statusCode: err.statusCode || 500,
    });

    // 決定 HTTP 狀態碼
    const statusCode = err.statusCode || (err instanceof DiagnosticError ? err.statusCode : 500);

    // 格式化錯誤回應
    const errorResponse = formatter.format(err, requestId);

    // 回傳錯誤
    res.status(statusCode).json(errorResponse);
  };
}

/**
 * 生成 Request ID
 */
function generateRequestId() {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = errorHandler;
