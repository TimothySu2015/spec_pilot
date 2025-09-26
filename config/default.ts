export default {
  server: {
    port: 443,
    host: 'localhost',
  },
  api: {
    timeout: 30000,
    retries: 3,
  },
  logging: {
    level: 'info',
    file: 'logs/specpilot.log',
    console: true,
  },
  testing: {
    parallel: true,
    timeout: 60000,
  },
};