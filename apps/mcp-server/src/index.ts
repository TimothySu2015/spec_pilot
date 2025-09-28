import { bootstrapMcpServer } from './bootstrap.js';

/**
 * 主程式入口點
 */
async function main(): Promise<void> {
  // 透過 bootstrapMcpServer 啟動服務
  const server = bootstrapMcpServer();

  // 啟動服務並綁定 STDIN/STDOUT
  server.start();
}

// 執行主程式
// 修正：使用 fileURLToPath 來正確比較路徑
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const currentFile = fileURLToPath(import.meta.url);
const entryFile = resolve(process.argv[1] || '');

if (currentFile === entryFile || process.argv[1]?.endsWith('index.ts')) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('未處理的錯誤:', error);
    process.exit(1);
  });
}