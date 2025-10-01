const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateTokenPair, verifyToken } = require('../utils/jwt');
const { AuthenticationError, ValidationError } = require('../errors/DiagnosticError');

/**
 * POST /api/auth/login
 * 使用者登入
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // 驗證必填欄位
    if (!username || !password) {
      throw new ValidationError(
        '登入資料不完整',
        [
          !username && { field: 'username', error: 'username 為必填欄位' },
          !password && { field: 'password', error: 'password 為必填欄位' },
        ].filter(Boolean),
        { hint: '請提供 username 和 password' }
      );
    }

    // 查詢使用者
    const user = await User.findByUsername(username);
    if (!user) {
      throw new AuthenticationError(
        '使用者名稱或密碼錯誤',
        { hint: '請確認您的登入資訊是否正確' }
      );
    }

    // 驗證密碼
    const isPasswordValid = await User.comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new AuthenticationError(
        '使用者名稱或密碼錯誤',
        { hint: '請確認您的登入資訊是否正確' }
      );
    }

    // 生成 Token
    const tokens = generateTokenPair({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    res.json({
      message: '登入成功',
      user: User.sanitizeUser(user),
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/refresh
 * 刷新 Access Token
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError(
        '缺少 Refresh Token',
        [{ field: 'refreshToken', error: 'refreshToken 為必填欄位' }],
        { hint: '請在請求中提供 refreshToken' }
      );
    }

    // 驗證 Refresh Token
    let decoded;
    try {
      decoded = verifyToken(refreshToken);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AuthenticationError(
          `Refresh Token 已於 ${err.expiredAt.toISOString()} 過期`,
          {
            hint: '請重新登入',
            details: {
              expired_at: err.expiredAt.toISOString(),
              current_time: new Date().toISOString(),
            }
          }
        );
      }
      throw new AuthenticationError(
        'Refresh Token 無效',
        {
          hint: '請重新登入',
          details: { reason: err.message }
        }
      );
    }

    // 生成新的 Token 對
    const tokens = generateTokenPair({
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email,
    });

    res.json({
      message: 'Token 刷新成功',
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/register
 * 使用者註冊
 */
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password, age } = req.body;

    // 驗證必填欄位
    const errors = [];
    if (!username) {
      errors.push({ field: 'username', error: 'username 為必填欄位' });
    }
    if (!email) {
      errors.push({ field: 'email', error: 'email 為必填欄位' });
    } else if (!isValidEmail(email)) {
      errors.push({ field: 'email', error: 'email 格式不正確', received: email });
    }
    if (!password) {
      errors.push({ field: 'password', error: 'password 為必填欄位' });
    } else if (password.length < 6) {
      errors.push({ field: 'password', error: '密碼長度至少需要 6 個字元', received: password.length });
    }
    if (age && age < 18) {
      errors.push({ field: 'age', error: '年齡必須大於或等於 18', received: age });
    }

    if (errors.length > 0) {
      throw new ValidationError(
        '註冊資料驗證失敗',
        errors,
        { hint: '請檢查並修正以下欄位' }
      );
    }

    // 檢查使用者是否已存在
    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      throw new ValidationError(
        '使用者名稱已被使用',
        [{ field: 'username', error: '此使用者名稱已被註冊', received: username }],
        { hint: '請使用其他使用者名稱' }
      );
    }

    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      throw new ValidationError(
        'Email 已被使用',
        [{ field: 'email', error: '此 Email 已被註冊', received: email }],
        { hint: '請使用其他 Email 或嘗試登入' }
      );
    }

    // 建立使用者
    const newUser = await User.create({ username, email, password, age });

    // 生成 Token
    const tokens = generateTokenPair({
      userId: newUser.id,
      username: newUser.username,
      email: newUser.email,
    });

    res.status(201).json({
      message: '註冊成功',
      user: User.sanitizeUser(newUser),
      ...tokens,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * 驗證 Email 格式
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = router;
