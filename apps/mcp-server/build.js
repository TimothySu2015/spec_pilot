#!/usr/bin/env node

import { execSync } from 'child_process';
import { chmodSync, renameSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  console.log('🔨 Building MCP Server with tsup...');

  // 使用 tsup 建置，確保使用本地設定檔
  execSync('pnpm exec tsup', {
    cwd: __dirname,
    stdio: 'inherit',
  });

  // 保持 index.cjs 命名（因為 package.json 設定 "type": "module"）
  const distPath = join(__dirname, 'dist', 'index.cjs');

  // 設定執行檔權限
  try {
    chmodSync(distPath, '755');
  } catch (err) {
    // Windows 可能無法設定權限，忽略錯誤
  }

  console.log('✅ MCP Server build completed');
  console.log(`📄 Output: ${distPath}`);
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}