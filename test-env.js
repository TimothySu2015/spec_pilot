#!/usr/bin/env node

// 測試腳本：檢查環境變數是否能被 MCP Server 讀取

console.log('=== 環境變數測試 ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('SPEC_PILOT_BASE_URL:', process.env.SPEC_PILOT_BASE_URL);
console.log('SPEC_PILOT_PORT:', process.env.SPEC_PILOT_PORT);
console.log('SPEC_PILOT_TOKEN:', process.env.SPEC_PILOT_TOKEN ? '***' : undefined);

console.log('\n=== 所有 SPEC_PILOT_ 開頭的環境變數 ===');
Object.keys(process.env)
  .filter(key => key.startsWith('SPEC_PILOT_'))
  .forEach(key => {
    const value = key.includes('TOKEN') ? '***' : process.env[key];
    console.log(`${key}:`, value);
  });

console.log('\n=== process.cwd() ===');
console.log('Working Directory:', process.cwd());