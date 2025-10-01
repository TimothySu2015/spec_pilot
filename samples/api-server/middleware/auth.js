const { verifyToken } = require('../utils/jwt');
const { AuthenticationError } = require('../errors/DiagnosticError');

/**
 * JWT 認證 Middleware
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(new AuthenticationError(
      '缺少認證 Token',
      { hint: '請在 Authorization Header 中提供 Bearer Token' }
    ));
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AuthenticationError(
        `認證 Token 已於 ${err.expiredAt.toISOString()} 過期`,
        {
          hint: '請使用 POST /api/auth/refresh 端點刷新 Token',
          details: {
            expired_at: err.expiredAt.toISOString(),
            current_time: new Date().toISOString(),
          }
        }
      ));
    }

    if (err.name === 'JsonWebTokenError') {
      return next(new AuthenticationError(
        'Token 無效或已被撤銷',
        {
          hint: '請重新登入取得新的 Token',
          details: { reason: err.message }
        }
      ));
    }

    return next(new AuthenticationError(
      'Token 驗證失敗',
      {
        hint: '請重新登入',
        details: { reason: err.message }
      }
    ));
  }
}

module.exports = authenticateToken;
