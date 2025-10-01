require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  logger.info({
    message: 'Server started successfully',
    port: PORT,
    host: HOST,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
  });

  console.log(`\n🚀 SpecPilot Sample API Server`);
  console.log(`📡 Server running at http://${HOST}:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\n✅ Ready to accept requests\n`);
});

// 優雅關閉
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// 未捕獲的異常處理
process.on('uncaughtException', (error) => {
  logger.error({
    message: 'Uncaught Exception',
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({
    message: 'Unhandled Rejection',
    reason: reason,
    promise: promise,
  });
});

module.exports = server;
