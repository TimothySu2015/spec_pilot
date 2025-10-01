const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const User = require('../models/User');
const { ResourceNotFoundError, ValidationError } = require('../errors/DiagnosticError');

/**
 * GET /api/users
 * 取得所有使用者 (需認證)
 */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const users = await User.findAll();
    const sanitizedUsers = users.map(user => User.sanitizeUser(user));
    res.json({
      message: '取得使用者清單成功',
      data: sanitizedUsers,
      total: sanitizedUsers.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/users/:id
 * 取得單一使用者 (需認證)
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      throw new ResourceNotFoundError(
        'User',
        req.params.id,
        {
          hint: '請確認使用者 ID 是否正確,或該使用者是否已被刪除'
        }
      );
    }

    res.json({
      message: '取得使用者成功',
      data: User.sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/users
 * 建立使用者 (需認證)
 */
router.post('/', authenticateToken, async (req, res, next) => {
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
    }
    if (age && age < 18) {
      errors.push({ field: 'age', error: '年齡必須大於或等於 18', received: age });
    }

    if (errors.length > 0) {
      throw new ValidationError(
        '請求資料驗證失敗',
        errors,
        { hint: '請檢查並修正以下欄位' }
      );
    }

    // 檢查使用者是否已存在
    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      throw new ValidationError(
        '使用者名稱已被使用',
        [{ field: 'username', error: '此使用者名稱已存在', received: username }],
        { hint: '請使用其他使用者名稱' }
      );
    }

    // 建立使用者
    const newUser = await User.create({ username, email, password, age });

    res.status(201).json({
      message: '建立使用者成功',
      data: User.sanitizeUser(newUser),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/users/:id
 * 更新使用者 (需認證)
 */
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { username, email, password, age } = req.body;

    // 驗證欄位
    const errors = [];
    if (email && !isValidEmail(email)) {
      errors.push({ field: 'email', error: 'email 格式不正確', received: email });
    }
    if (age && age < 18) {
      errors.push({ field: 'age', error: '年齡必須大於或等於 18', received: age });
    }

    if (errors.length > 0) {
      throw new ValidationError(
        '請求資料驗證失敗',
        errors,
        { hint: '請檢查並修正以下欄位' }
      );
    }

    // 檢查使用者是否存在
    const existingUser = await User.findById(req.params.id);
    if (!existingUser) {
      throw new ResourceNotFoundError(
        'User',
        req.params.id,
        { hint: '請確認使用者 ID 是否正確' }
      );
    }

    // 更新使用者
    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (password) updateData.password = password;
    if (age !== undefined) updateData.age = age;

    const updatedUser = await User.update(req.params.id, updateData);

    res.json({
      message: '更新使用者成功',
      data: User.sanitizeUser(updatedUser),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/users/:id
 * 刪除使用者 (需認證)
 */
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new ResourceNotFoundError(
        'User',
        req.params.id,
        { hint: '請確認使用者 ID 是否正確' }
      );
    }

    await User.delete(req.params.id);

    res.json({
      message: '刪除使用者成功',
      data: { id: parseInt(req.params.id) },
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
