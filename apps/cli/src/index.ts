#!/usr/bin/env node

import { Command } from 'commander';
import { getConfig, overrideConfig } from '@specpilot/config';
import { createStructuredLogger } from '@specpilot/shared';
import { loadSpec } from '@specpilot/spec-loader';
import { loadFlow } from '@specpilot/flow-parser';
import { EnhancedFlowOrchestrator } from '@specpilot/core-flow';
import type { IExecutionConfig } from '@specpilot/reporting';
import { existsSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';

const logger = createStructuredLogger('cli');

/**
 * 驗證檔案路徑是否存在
 */
function validateFilePath(filePath: string, fileType: string): string {
  const resolvedPath = resolve(filePath);
  
  if (!existsSync(resolvedPath)) {
    throw new Error(`${fileType}檔案不存在: ${resolvedPath}`);
  }
  
  return resolvedPath;
}

/**
 * 遮罩敏感資訊
 */
function maskSensitiveInfo(config: Record<string, unknown>): Record<string, unknown> {
  return {
    ...config,
    token: config.token ? '***' : undefined,
  };
}

/**
 * SpecPilot CLI 主程式
 */
async function main(): Promise<void> {
  const program = new Command();

  program
    .name('specpilot')
    .description('SpecPilot API 測試與驗證工具\n\n範例使用方式:\n  specpilot --spec specs/api.yaml --flow flows/test.yaml --baseUrl http://localhost:3000')
    .version('0.1.0');

  program
    .requiredOption('--spec <path>', 'OpenAPI 規格檔案路徑')
    .requiredOption('--flow <path>', 'YAML 測試流程檔案路徑')
    .option('--baseUrl <url>', 'API 基礎 URL')
    .option('--port <number>', 'API 埠號', parseInt)
    .option('--token <token>', 'API 認證 Token')
    .option('--verbose', '啟用詳細輸出')
    .action(async (options) => {
      const executionId = `cli-${Date.now()}`;
      
      try {
        // 記錄 CLI 啟動事件
        logger.info('CLI_START', { 
          executionId,
          event: 'CLI_START',
          options: {
            spec: options.spec,
            flow: options.flow,
            baseUrl: options.baseUrl,
            port: options.port,
            token: options.token ? '***' : undefined,
            verbose: options.verbose
          }
        });

        // 調試輸出，幫助理解執行流程
        if (options.verbose) {
          process.stdout.write(`🔧 [DEBUG] CLI 啟動，執行ID: ${executionId}\n`);
          process.stdout.write(`🔧 [DEBUG] 參數: spec=${options.spec}, flow=${options.flow}\n`);
        }

        // 參數驗證
        let specPath: string;
        let flowPath: string;

        try {
          specPath = validateFilePath(options.spec, 'OpenAPI 規格');
          flowPath = validateFilePath(options.flow, 'YAML 流程');
        } catch (error) {
          logger.error('CLI_FAILURE', {
            executionId,
            event: 'CLI_FAILURE',
            error: error instanceof Error ? error.message : error,
            errorType: 'VALIDATION_ERROR'
          });
          
          process.stderr.write(`❌ ${error instanceof Error ? error.message : error}\n`);
          process.stderr.write('\n使用 --help 查看正確的使用方式\n');
          process.exit(2);
        }

        // 設定覆寫邏輯
        if (options.baseUrl || options.port || options.token) {
          overrideConfig({
            ...(options.baseUrl && { baseUrl: options.baseUrl }),
            ...(options.port && { port: options.port }),
            ...(options.token && { token: options.token }),
          });
        }

        const config = getConfig();
        const maskedConfig = maskSensitiveInfo(config);
        
        logger.info('配置載入完成', { 
          executionId,
          config: maskedConfig 
        });

        // 規格載入
        let spec;
        try {
          spec = await loadSpec({ filePath: specPath, executionId });
          logger.info('SPEC_LOAD_SUMMARY', {
            executionId,
            event: 'SPEC_LOAD_SUMMARY',
            specPath,
            summary: {
              title: spec.info?.title || 'Unknown',
              version: spec.info?.version || 'Unknown',
              pathCount: Object.keys(spec.paths || {}).length,
              componentCount: Object.keys(spec.components?.schemas || {}).length
            }
          });
          
          process.stdout.write(`✓ 規格載入成功: ${spec.info?.title} (${spec.info?.version})\n`);
        } catch (error) {
          logger.error('CLI_FAILURE', {
            executionId,
            event: 'CLI_FAILURE',
            error: error instanceof Error ? error.message : error,
            errorType: 'SPEC_LOAD_ERROR',
            specPath
          });
          
          process.stderr.write(`❌ 規格載入失敗: ${error instanceof Error ? error.message : error}\n`);
          process.exit(2);
        }

        // 流程載入
        let flow;
        try {
          flow = await loadFlow({ filePath: flowPath, executionId });
          logger.info('FLOW_LOAD_SUMMARY', {
            executionId,
            event: 'FLOW_LOAD_SUMMARY',
            flowPath,
            summary: {
              name: flow.name || 'Unknown',
              stepCount: flow.steps?.length || 0,
              hasGlobalConfig: !!flow.config
            }
          });
          
          process.stdout.write(`✓ 流程載入成功: ${flow.name} (${flow.steps?.length || 0} 個步驟)\n`);
        } catch (error) {
          logger.error('CLI_FAILURE', {
            executionId,
            event: 'CLI_FAILURE',
            error: error instanceof Error ? error.message : error,
            errorType: 'FLOW_LOAD_ERROR',
            flowPath
          });
          
          process.stderr.write(`❌ 流程載入失敗: ${error instanceof Error ? error.message : error}\n`);
          process.exit(2);
        }

        // 執行測試流程
        try {
          process.stdout.write('\n🚀 開始執行測試流程...\n');

          const baseUrl = config.baseUrl || 'http://localhost:3000';
          const orchestrator = new EnhancedFlowOrchestrator(undefined, { baseUrl });

          // 準備報表輸出目錄
          const projectRoot = process.cwd();
          const reportDir = join(projectRoot, 'reports');
          const logDir = join(projectRoot, 'logs');

          if (!existsSync(reportDir)) {
            mkdirSync(reportDir, { recursive: true });
          }
          if (!existsSync(logDir)) {
            mkdirSync(logDir, { recursive: true });
          }

          const reportPath = join(reportDir, `result-${executionId}.json`);
          const logPath = join(logDir, `execution-${executionId}.log`);

          // 準備執行配置
          const executionConfig: IExecutionConfig = {
            baseUrl: config.baseUrl || 'http://localhost:3000',
            fallbackUsed: false,
            authNamespaces: []
          };

          // 執行流程
          const result = await orchestrator.executeFlowWithReporting(
            flow,
            executionConfig,
            {
              reportPath,
              enableReporting: true,
              logPath
            }
          );

          // 輸出執行結果摘要（reportSummary 是格式化的字串）
          if (result.reportSummary) {
            process.stdout.write(result.reportSummary);
            process.stdout.write('\n');
          }

          process.stdout.write(`\n📄 報表已產生：${reportPath}\n`);
          process.stdout.write(`📝 日誌已產生：${logPath}\n`);

          // 根據測試結果設定退出碼（檢查結果陣列）
          const hasFailures = result.results.some(r => r.status === 'failed');

          if (hasFailures) {
            const failedCount = result.results.filter(r => r.status === 'failed').length;
            logger.warn('CLI_COMPLETE_WITH_FAILURES', {
              executionId,
              event: 'CLI_COMPLETE_WITH_FAILURES',
              message: 'CLI 執行完成 - 部分測試失敗',
              failedSteps: failedCount
            });

            process.stdout.write('\n⚠️  測試執行完成，但有失敗的步驟\n');
            process.exit(1);
          } else {
            logger.info('CLI_COMPLETE', {
              executionId,
              event: 'CLI_COMPLETE',
              message: 'CLI 執行完成 - 所有測試通過'
            });

            process.stdout.write('\n✅ 測試執行完成 - 所有步驟通過\n');
            process.exit(0);
          }

        } catch (error) {
          logger.error('CLI_EXECUTION_FAILURE', {
            executionId,
            event: 'CLI_EXECUTION_FAILURE',
            error: error instanceof Error ? error.message : error,
            errorType: 'EXECUTION_ERROR'
          });

          process.stderr.write(`\n❌ 測試執行失敗：${error instanceof Error ? error.message : error}\n`);
          process.exit(2);
        }

      } catch (error) {
        logger.error('CLI_FAILURE', {
          executionId,
          event: 'CLI_FAILURE',
          error: error instanceof Error ? error.message : error,
          errorType: 'UNKNOWN_ERROR'
        });
        
        process.stderr.write(`❌ 未預期的錯誤: ${error instanceof Error ? error.message : error}\n`);
        process.exit(2);
      }
    });

  // 添加完整的幫助資訊
  program.addHelpText('after', `
範例:
  $ specpilot --spec specs/petstore.yaml --flow flows/crud_test.yaml
  $ specpilot --spec specs/api.yaml --flow flows/test.yaml --baseUrl https://api.example.com
  $ specpilot --spec specs/api.yaml --flow flows/test.yaml --token abc123 --verbose

退出碼:
  0 - 執行成功
  1 - 測試失敗  
  2 - 系統錯誤 (設定錯誤、檔案不存在等)
`);

  await program.parseAsync(process.argv);
}

// 執行主程式
// 當檔案作為主模組執行時（包括透過 tsx 執行）
const isMainModule = import.meta.url.includes('index.ts') || import.meta.url.includes('index.js');
if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(`未處理的錯誤: ${error}\n`);
    process.exit(1);
  });
}