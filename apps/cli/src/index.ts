#!/usr/bin/env node

import { Command } from 'commander';
import { getConfig, overrideConfig } from '@specpilot/config';
import { createStructuredLogger } from '@specpilot/shared';

const logger = createStructuredLogger('cli');

/**
 * SpecPilot CLI 主程式
 */
async function main(): Promise<void> {
  const program = new Command();

  program
    .name('specpilot')
    .description('API 測試與驗證工具')
    .version('0.1.0');

  program
    .option('--spec <path>', 'OpenAPI 規格檔案路徑')
    .option('--flow <path>', 'YAML 測試流程檔案路徑')
    .option('--baseUrl <url>', 'API 基礎 URL')
    .option('--port <number>', 'API 埠號', parseInt)
    .option('--token <token>', 'API 認證 Token')
    .option('--verbose', '啟用詳細輸出')
    .action(async (options) => {
      try {
        logger.info('SpecPilot CLI 啟動', { options });

        // 覆寫設定
        if (options.baseUrl || options.port || options.token) {
          overrideConfig({
            ...(options.baseUrl && { baseUrl: options.baseUrl }),
            ...(options.port && { port: options.port }),
            ...(options.token && { token: options.token }),
          });
        }

        const config = getConfig();
        logger.info('使用設定', { config });

        // TODO: 實作核心測試執行邏輯
        logger.warn('核心測試引擎尚未實作 - 待後續 Story 完成');
        
        if (!options.spec) {
          logger.error('缺少必要參數：--spec');
          process.exit(1);
        }

        if (!options.flow) {
          logger.error('缺少必要參數：--flow');
          process.exit(1);
        }

        logger.info('CLI 執行完成');
      } catch (error) {
        logger.error('CLI 執行失敗', { error: error instanceof Error ? error.message : error });
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

// 執行主程式
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('未處理的錯誤:', error);
    process.exit(1);
  });
}