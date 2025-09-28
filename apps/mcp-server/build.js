#!/usr/bin/env node

import { spawn } from 'child_process';
import { writeFileSync, readFileSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 使用 tsx 編譯並生成獨立的 JavaScript 檔案
const buildProcess = spawn('pnpm', ['exec', 'tsx', 'src/index.ts'], {
  cwd: __dirname,
  stdio: ['inherit', 'pipe', 'pipe']
});

// 創建 wrapper 腳本
const wrapperScript = `#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// 使用 tsx 運行 TypeScript 檔案
const child = spawn('pnpm', ['exec', 'tsx', path.join(__dirname, 'src', 'index.ts')], {
  stdio: 'inherit',
  cwd: __dirname
});

child.on('exit', (code) => {
  process.exit(code);
});

child.on('error', (err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});
`;

// 寫入 wrapper 腳本
const distPath = join(__dirname, 'dist', 'index.js');
writeFileSync(distPath, wrapperScript, 'utf8');

// 設定可執行權限
try {
  chmodSync(distPath, '755');
} catch (err) {
  // Windows 可能無法設定權限，忽略錯誤
}

console.log('✅ MCP Server build completed');
console.log(`📄 Output: ${distPath}`);