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
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('未處理的錯誤:', error);
    process.exit(1);
  });
}