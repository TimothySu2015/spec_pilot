/**
 * 簡單的 Logger 實作
 * 在實際專案中建議使用 winston 或 pino
 */
class Logger {
  constructor(name = 'app') {
    this.name = name;
  }

  formatMessage(level, message, meta = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      logger: this.name,
      message,
      ...meta,
    });
  }

  info(messageOrMeta, meta = {}) {
    const message = typeof messageOrMeta === 'string' ? messageOrMeta : messageOrMeta.message || 'Info';
    const data = typeof messageOrMeta === 'object' ? messageOrMeta : meta;
    console.log(this.formatMessage('info', message, data));
  }

  error(messageOrMeta, meta = {}) {
    const message = typeof messageOrMeta === 'string' ? messageOrMeta : messageOrMeta.message || 'Error';
    const data = typeof messageOrMeta === 'object' ? messageOrMeta : meta;
    console.error(this.formatMessage('error', message, data));
  }

  warn(messageOrMeta, meta = {}) {
    const message = typeof messageOrMeta === 'string' ? messageOrMeta : messageOrMeta.message || 'Warning';
    const data = typeof messageOrMeta === 'object' ? messageOrMeta : meta;
    console.warn(this.formatMessage('warn', message, data));
  }

  debug(messageOrMeta, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      const message = typeof messageOrMeta === 'string' ? messageOrMeta : messageOrMeta.message || 'Debug';
      const data = typeof messageOrMeta === 'object' ? messageOrMeta : meta;
      console.debug(this.formatMessage('debug', message, data));
    }
  }
}

module.exports = new Logger('api-server');
