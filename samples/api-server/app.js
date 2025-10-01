const express = require('express');
const errorHandler = require('./middleware/error-handler');
const logger = require('./utils/logger');

const app = express();

// ===== Middleware =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request ID Middleware
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // 記錄請求
  logger.info({
    message: 'Incoming request',
    requestId: req.id,
    method: req.method,
    path: req.path,
    query: req.query,
  });

  next();
});

// ===== Routes =====
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));

// 健康檢查端點
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 根路徑
app.get('/', (req, res) => {
  res.json({
    message: 'SpecPilot Sample API Server',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        refresh: 'POST /api/auth/refresh',
      },
      users: {
        list: 'GET /api/users (需認證)',
        get: 'GET /api/users/:id (需認證)',
        create: 'POST /api/users (需認證)',
        update: 'PUT /api/users/:id (需認證)',
        delete: 'DELETE /api/users/:id (需認證)',
      },
    },
  });
});

// ===== 錯誤處理 =====

// 404 處理 (必須在所有路由之後)
app.use((req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `找不到路徑: ${req.method} ${req.path}`,
    timestamp: new Date().toISOString(),
  });
});

// 全域錯誤處理 Middleware (必須在最後)
app.use(errorHandler(logger));

module.exports = app;
