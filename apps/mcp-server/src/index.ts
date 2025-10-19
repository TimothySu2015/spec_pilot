import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
// import { createStructuredLogger } from '@specpilot/shared'; // 已使用靜默日誌器
import { loadSpec } from '@specpilot/spec-loader';
import { loadFlow } from '@specpilot/flow-parser';
import { EnhancedFlowOrchestrator } from '@specpilot/core-flow';
import { type ExecutionConfig, DiagnosticContextBuilder } from '@specpilot/reporting';
import { overrideConfig, getConfig } from '@specpilot/config';
import { SpecAnalyzer, TestSuiteGenerator, FlowQualityChecker } from '@specpilot/test-suite-generator';
import { FlowValidator } from '@specpilot/flow-validator';
import { stringify as yamlStringify } from 'yaml';
// 匯入使用 rotating-file-stream 的靜默日誌器
import { logger } from './logger.js';

// 建立 MCP Server
const server = new McpServer({
  name: "specpilot-server",
  version: "0.1.0"
});

/**
 * 處理 listSpecs 請求
 */
async function handleListSpecs(directory: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const specsDir = path.resolve(process.cwd(), directory);

  logger.info('listSpecs 方法開始執行', {
    method: 'listSpecs',
    event: 'list_specs_start',
    details: { directory: specsDir }
  });

  try {
    if (!existsSync(specsDir)) {
      return {
        content: [{
          type: "text",
          text: `錯誤：規格目錄 '${specsDir}' 不存在`
        }]
      };
    }

    const files = readdirSync(specsDir)
      .filter(file => {
        const filePath = path.join(specsDir, file);
        const isFile = statSync(filePath).isFile();
        const isSpecFile = /\.(yaml|yml|json)$/i.test(file);
        return isFile && isSpecFile;
      })
      .map(file => {
        const filePath = path.join(specsDir, file);
        const stats = statSync(filePath);
        return {
          name: file,
          path: path.relative(process.cwd(), filePath),
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          type: path.extname(file).toLowerCase()
        };
      });

    logger.info('listSpecs 方法成功完成', {
      method: 'listSpecs',
      event: 'list_specs_success',
      details: { fileCount: files.length }
    });

    return {
      content: [{
        type: "text",
        text: `找到 ${files.length} 個規格檔案：\n\n` +
              files.map(f => `• ${f.name} (${f.size} bytes, 修改時間: ${f.lastModified})`).join('\n')
      }]
    };

  } catch (error) {
    logger.error('listSpecs 方法執行失敗', {
      method: 'listSpecs',
      event: 'list_specs_error',
      details: { error: error instanceof Error ? error.message : '未知錯誤' }
    });

    return {
      content: [{
        type: "text",
        text: `取得規格檔案列表時發生錯誤：${error instanceof Error ? error.message : '未知錯誤'}`
      }]
    };
  }
}

/**
 * 處理 listFlows 請求
 */
async function handleListFlows(directory: string): Promise<{ content: Array<{ type: string; text: string }> }> {
  const flowsDir = path.resolve(process.cwd(), directory);

  logger.info('listFlows 方法開始執行', {
    method: 'listFlows',
    event: 'list_flows_start',
    details: { directory: flowsDir }
  });

  try {
    if (!existsSync(flowsDir)) {
      return {
        content: [{
          type: "text",
          text: `錯誤：流程目錄 '${flowsDir}' 不存在`
        }]
      };
    }

    const files = readdirSync(flowsDir)
      .filter(file => {
        const filePath = path.join(flowsDir, file);
        const isFile = statSync(filePath).isFile();
        const isFlowFile = /\.(yaml|yml)$/i.test(file);
        return isFile && isFlowFile;
      })
      .map(file => {
        const filePath = path.join(flowsDir, file);
        const stats = statSync(filePath);
        return {
          name: file,
          path: path.relative(process.cwd(), filePath),
          size: stats.size,
          lastModified: stats.mtime.toISOString()
        };
      });

    logger.info('listFlows 方法成功完成', {
      method: 'listFlows',
      event: 'list_flows_success',
      details: { fileCount: files.length }
    });

    return {
      content: [{
        type: "text",
        text: `找到 ${files.length} 個流程檔案：\n\n` +
              files.map(f => `• ${f.name} (${f.size} bytes, 修改時間: ${f.lastModified})`).join('\n')
      }]
    };

  } catch (error) {
    logger.error('listFlows 方法執行失敗', {
      method: 'listFlows',
      event: 'list_flows_error',
      details: { error: error instanceof Error ? error.message : '未知錯誤' }
    });

    return {
      content: [{
        type: "text",
        text: `取得流程檔案列表時發生錯誤：${error instanceof Error ? error.message : '未知錯誤'}`
      }]
    };
  }
}

/**
 * 處理 runFlow 請求
 */
async function handleRunFlow(params: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }> }> {
  const executionId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  logger.info('runFlow 方法開始執行', {
    executionId,
    method: 'runFlow',
    event: 'run_flow_start',
    details: { hasParams: !!params }
  });

  try {
    const { spec, flow } = params;

    // 使用環境變數作為預設值
    const baseUrl = params.baseUrl || process.env.SPEC_PILOT_BASE_URL;
    const port = params.port || (process.env.SPEC_PILOT_PORT ? parseInt(process.env.SPEC_PILOT_PORT, 10) : undefined);
    const token = params.token || process.env.SPEC_PILOT_TOKEN;

    if (!spec || !flow) {
      return {
        content: [{
          type: "text",
          text: "錯誤：必須提供 spec 和 flow 參數"
        }]
      };
    }

    // 載入規格
    let specData;
    if (spec.includes('\n') || spec.startsWith('{')) {
      // 內嵌內容
      specData = spec;
    } else {
      // 檔案路徑
      const specPath = path.resolve(process.cwd(), spec);
      if (!existsSync(specPath)) {
        return {
          content: [{
            type: "text",
            text: `錯誤：規格檔案 '${specPath}' 不存在`
          }]
        };
      }
      specData = readFileSync(specPath, 'utf-8');
    }

    // 載入流程
    let flowData;
    if (flow.includes('\n') || flow.startsWith('flow:')) {
      // 內嵌內容
      flowData = flow;
    } else {
      // 檔案路徑
      const flowPath = path.resolve(process.cwd(), flow);
      if (!existsSync(flowPath)) {
        return {
          content: [{
            type: "text",
            text: `錯誤：流程檔案 '${flowPath}' 不存在`
          }]
        };
      }
      flowData = readFileSync(flowPath, 'utf-8');
    }

    // 解析規格和流程
    await loadSpec({ content: specData, executionId });
    const parsedFlow = await loadFlow({ content: flowData, executionId });

    // 如果有提供執行選項，注入到 Flow 定義中
    if (params.options) {
      parsedFlow.options = parsedFlow.options || {};

      if (params.options.failFast !== undefined) {
        parsedFlow.options.failFast = params.options.failFast;
        logger.info('已設定 failFast 選項', {
          executionId,
          method: 'runFlow',
          event: 'option_set',
          details: { failFast: params.options.failFast }
        });
      }

      if (params.options.retryCount !== undefined) {
        parsedFlow.options.retryCount = params.options.retryCount;
        logger.info('已設定 retryCount 選項', {
          executionId,
          method: 'runFlow',
          event: 'option_set',
          details: { retryCount: params.options.retryCount }
        });
      }

      if (params.options.timeout !== undefined) {
        parsedFlow.options.timeout = params.options.timeout;
        logger.info('已設定 timeout 選項', {
          executionId,
          method: 'runFlow',
          event: 'option_set',
          details: { timeout: params.options.timeout }
        });
      }
    }

    // 如果有提供配置參數，覆寫全域配置
    if (baseUrl || port || token) {
      const configOverrides: Record<string, unknown> = {};
      if (baseUrl) configOverrides.baseUrl = baseUrl;
      if (port) configOverrides.port = port;
      if (token) configOverrides.token = token;

      overrideConfig(configOverrides);

      logger.info('已覆寫配置', {
        executionId,
        method: 'runFlow',
        event: 'config_override',
        details: {
          hasBaseUrl: !!baseUrl,
          hasPort: !!port,
          hasToken: !!token
        }
      });
    }

    // 執行流程（使用增強版）
    const config = getConfig();
    const finalBaseUrl = baseUrl || config.baseUrl || 'http://localhost:3000';
    const orchestrator = new EnhancedFlowOrchestrator(undefined, { baseUrl: finalBaseUrl });

    // 準備執行配置
    const executionConfig: ExecutionConfig = {
      baseUrl: finalBaseUrl,
      fallbackUsed: false,
      authNamespaces: []
    };

    // 使用增強版執行並自動產生報表
    const flowResult = await orchestrator.executeFlowWithReporting(
      parsedFlow,
      executionConfig,
      {
        executionId,
        enableReporting: true
      }
    );

    const result = {
      steps: flowResult.results,
      success: flowResult.results.every(r => r.status !== 'failed')
    };

    // ✨ 建立診斷上下文（如果有失敗步驟）
    let diagnosticContext = null;
    let diagnosticSummary = '';

    if (!result.success) {
      // 讀取剛產生的報表檔案
      const reportsDir = path.resolve(process.cwd(), 'reports');
      const reportFile = path.join(reportsDir, 'result.json');

      logger.info('嘗試讀取報表以建立診斷上下文', {
        executionId,
        method: 'runFlow',
        event: 'reading_report_for_diagnosis',
        reportFile
      });

      if (existsSync(reportFile)) {
        try {
          const reportContent = readFileSync(reportFile, 'utf-8');
          const report = JSON.parse(reportContent);

          const diagnosticBuilder = new DiagnosticContextBuilder();
          diagnosticContext = diagnosticBuilder.build(report);

          if (diagnosticContext) {
            logger.info('診斷上下文已建立', {
              executionId,
              method: 'runFlow',
              event: 'diagnostic_context_created',
              details: {
                failureCount: diagnosticContext.failureCount,
                errorPatterns: diagnosticContext.errorPatterns.length,
                quickDiagnosis: diagnosticContext.diagnosticHints.quickDiagnosis
              }
            });

            // 產生診斷摘要文字
            diagnosticSummary = `\n📊 診斷摘要：\n` +
                              `   ${diagnosticContext.diagnosticHints.quickDiagnosis}\n\n` +
                              `💡 可能原因：\n` +
                              diagnosticContext.diagnosticHints.likelyCauses.map(c => `   • ${c}`).join('\n') + '\n\n' +
                              `🔧 建議動作：\n` +
                              diagnosticContext.diagnosticHints.suggestedActions.map(a => `   • ${a}`).join('\n');
          }
        } catch (error) {
          logger.error('讀取報表或建立診斷上下文失敗', {
            executionId,
            method: 'runFlow',
            event: 'diagnostic_context_error',
            error: error instanceof Error ? error.message : '未知錯誤'
          });
        }
      } else {
        logger.warn('報表檔案不存在，無法建立診斷上下文', {
          executionId,
          method: 'runFlow',
          reportFile
        });
      }
    }

    logger.info('runFlow 方法成功完成', {
      executionId,
      method: 'runFlow',
      event: 'run_flow_success',
      details: {
        totalSteps: result.steps?.length || 0,
        success: result.success,
        hasDiagnosticContext: !!diagnosticContext
      }
    });

    return {
      content: [{
        type: "text",
        text: `測試執行完成（真實 HTTP 測試）！\n\n` +
              `執行 ID: ${executionId}\n` +
              `結果: ${result.success ? '✅ 成功' : '❌ 失敗'}\n` +
              `總步驟數: ${result.steps?.length || 0}\n` +
              `成功步驟: ${result.steps?.filter(s => s.status === 'passed')?.length || 0}\n` +
              `失敗步驟: ${result.steps?.filter(s => s.status === 'failed')?.length || 0}\n\n` +
              `報表摘要：\n${flowResult.reportSummary || '無報表摘要'}\n` +
              (diagnosticSummary || '') + '\n\n' +
              `📁 執行詳情：已產生完整報表與日誌\n` +
              `   呼叫getReport 查看完整診斷報表`
      }]
    };

  } catch (error) {
    logger.error('runFlow 方法執行失敗', {
      executionId,
      method: 'runFlow',
      event: 'run_flow_error',
      details: { error: error instanceof Error ? error.message : '未知錯誤' }
    });

    return {
      content: [{
        type: "text",
        text: `執行測試流程時發生錯誤：${error instanceof Error ? error.message : '未知錯誤'}`
      }]
    };
  }
}

/**
 * 處理 getReport 請求
 */
async function handleGetReport(executionId?: string, format: string = 'json'): Promise<{ content: Array<{ type: string; text: string }> }> {
  logger.info('getReport 方法開始執行', {
    method: 'getReport',
    event: 'get_report_start',
    details: { executionId, format }
  });

  try {
    const reportsDir = path.resolve(process.cwd(), 'reports');

    if (!existsSync(reportsDir)) {
      return {
        content: [{
          type: "text",
          text: "尚無任何測試報表"
        }]
      };
    }

    let reportFile;
    if (executionId) {
      reportFile = path.join(reportsDir, `${executionId}.json`);
    } else {
      // 取得最新報表
      const reportFiles = readdirSync(reportsDir)
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(reportsDir, file);
          return {
            file,
            path: filePath,
            mtime: statSync(filePath).mtime
          };
        })
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      if (reportFiles.length === 0) {
        return {
          content: [{
            type: "text",
            text: "尚無任何測試報表"
          }]
        };
      }

      reportFile = reportFiles[0].path;
    }

    if (!existsSync(reportFile)) {
      return {
        content: [{
          type: "text",
          text: `找不到指定的報表檔案：${executionId || '最新報表'}`
        }]
      };
    }

    const reportContent = readFileSync(reportFile, 'utf-8');
    const report = JSON.parse(reportContent);

    logger.info('getReport 方法成功完成', {
      method: 'getReport',
      event: 'get_report_success',
      details: { reportFile: path.basename(reportFile) }
    });

    if (format === 'summary') {
      return {
        content: [{
          type: "text",
          text: `測試報表摘要：\n\n` +
                `執行 ID: ${report.executionId}\n` +
                `執行時間: ${report.timestamp}\n` +
                `結果: ${report.success ? '成功' : '失敗'}\n` +
                `總步驟數: ${report.totalSteps || 0}\n` +
                `成功步驟: ${report.successfulSteps || 0}\n` +
                `失敗步驟: ${report.failedSteps || 0}`
        }]
      };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(report, null, 2)
      }]
    };

  } catch (error) {
    logger.error('getReport 方法執行失敗', {
      method: 'getReport',
      event: 'get_report_error',
      details: { error: error instanceof Error ? error.message : '未知錯誤' }
    });

    return {
      content: [{
        type: "text",
        text: `取得測試報表時發生錯誤：${error instanceof Error ? error.message : '未知錯誤'}`
      }]
    };
  }
}

/**
 * 處理 generateFlow 請求
 */
async function handleGenerateFlow(params: {
  specPath: string;
  options?: {
    endpoints?: string[];
    includeSuccessCases?: boolean;
    includeErrorCases?: boolean;
    includeEdgeCases?: boolean;
    generateFlows?: boolean;
  };
}): Promise<{ content: Array<{ type: string; text: string }> }> {
  logger.info('generateFlow 方法開始執行', {
    method: 'generateFlow',
    event: 'generate_flow_start',
    details: { specPath: params.specPath, options: params.options }
  });

  try {
    // 1. 載入 OpenAPI 規格
    const specPath = path.resolve(process.cwd(), params.specPath);
    if (!existsSync(specPath)) {
      return {
        content: [{
          type: "text",
          text: `錯誤：找不到規格檔案 '${specPath}'`
        }]
      };
    }

    logger.info('開始載入規格', {
      method: 'generateFlow',
      event: 'loading_spec',
      details: { specPath }
    });

    const specDoc = await loadSpec({ filePath: specPath });

    // 驗證載入的規格
    if (!specDoc || !specDoc.document) {
      logger.error('規格載入失敗：document 為空', {
        method: 'generateFlow',
        event: 'spec_validation_failed',
        details: {
          hasSpecDoc: !!specDoc,
          hasDocument: !!specDoc?.document
        }
      });

      return {
        content: [{
          type: "text",
          text: `錯誤：規格載入失敗，document 為空`
        }]
      };
    }

    if (!(specDoc.document as any)?.paths) {
      logger.error('規格缺少 paths', {
        method: 'generateFlow',
        event: 'spec_validation_failed',
        details: {
          documentKeys: Object.keys(specDoc.document)
        }
      });

      return {
        content: [{
          type: "text",
          text: `錯誤：規格文件缺少 paths 定義\n可用的 keys: ${Object.keys(specDoc.document).join(', ')}`
        }]
      };
    }

    logger.info('規格載入完成', {
      method: 'generateFlow',
      event: 'spec_loaded',
      details: {
        hasDocument: !!specDoc.document,
        documentType: typeof specDoc.document,
        documentKeys: specDoc.document ? Object.keys(specDoc.document).slice(0, 15) : [],
        hasPaths: !!(specDoc.document as any)?.paths,
        pathsType: typeof (specDoc.document as any)?.paths,
        pathsKeys: (specDoc.document as any)?.paths ? Object.keys((specDoc.document as any).paths) : []
      }
    });

    // 2. 分析規格
    const analyzerConfig = { spec: specDoc.document };

    logger.info('建立分析器', {
      method: 'generateFlow',
      event: 'creating_analyzer',
      details: {
        hasConfig: !!analyzerConfig,
        hasSpec: !!analyzerConfig.spec,
        specType: typeof analyzerConfig.spec
      }
    });

    const analyzer = new SpecAnalyzer(analyzerConfig);

    // 3. 產生測試套件
    logger.info('開始產生測試套件', {
      method: 'generateFlow',
      event: 'generating_test_suite'
    });

    const generator = new TestSuiteGenerator(analyzer, params.options || {});
    const flow = generator.generate(params.options || {});

    // 4. 轉換為 YAML
    const flowYaml = yamlStringify(flow);

    logger.info('generateFlow 方法成功完成', {
      method: 'generateFlow',
      event: 'generate_flow_success',
      details: { stepsCount: flow.steps.length }
    });

    return {
      content: [{
        type: "text",
        text: `✅ 成功產生測試 Flow\n\n` +
              `📊 統計資訊：\n` +
              `- 總步驟數：${flow.steps.length}\n` +
              `- 端點數：${(flow as any).metadata?.summary?.endpoints?.length || 0}\n` +
              `- 成功案例：${(flow as any).metadata?.summary?.successTests || 0}\n` +
              `- 錯誤案例：${(flow as any).metadata?.summary?.errorTests || 0}\n\n` +
              `📝 生成的 Flow YAML：\n\`\`\`yaml\n${flowYaml}\n\`\`\``
      }]
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    const errorStack = error instanceof Error ? error.stack : '';

    logger.error('generateFlow 方法執行失敗', {
      method: 'generateFlow',
      event: 'generate_flow_error',
      details: {
        error: errorMessage,
        stack: errorStack
      }
    });

    return {
      content: [{
        type: "text",
        text: `產生 Flow 時發生錯誤：${errorMessage}\n\n堆疊追蹤：\n${errorStack}`
      }]
    };
  }
}

/**
 * 處理 validateFlow 請求
 */
async function handleValidateFlow(params: {
  flowContent: string;
  specPath: string;
}): Promise<{ content: Array<{ type: string; text: string }> }> {
  logger.info('validateFlow 方法開始執行', {
    method: 'validateFlow',
    event: 'validate_flow_start'
  });

  try {
    const { parse: yamlParse } = await import('yaml');

    // 1. 載入 OpenAPI 規格
    const specPath = path.resolve(process.cwd(), params.specPath);
    if (!existsSync(specPath)) {
      return {
        content: [{
          type: "text",
          text: `錯誤：找不到規格檔案 '${specPath}'`
        }]
      };
    }

    const specDoc = await loadSpec({ filePath: specPath });

    // 2. 解析 Flow YAML
    const flowData = yamlParse(params.flowContent);

    // 3. 建立驗證器
    const validator = new FlowValidator({
      spec: specDoc.document,
      schemaOptions: { strict: false },
      semanticOptions: {
        checkOperationIds: false,
        checkVariableReferences: true,
        checkAuthFlow: false,
      },
    });

    // 4. 執行驗證
    const result = validator.validate(flowData as any);

    logger.info('validateFlow 方法成功完成', {
      method: 'validateFlow',
      event: 'validate_flow_success',
      details: {
        valid: result.valid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length
      }
    });

    if (result.valid) {
      return {
        content: [{
          type: "text",
          text: `✅ Flow 驗證通過！\n\n` +
                `📊 驗證結果：\n` +
                `- 總錯誤數：0\n` +
                `- 警告數：${result.warnings.length}\n` +
                (result.warnings.length > 0 ? `\n⚠️ 警告：\n${result.warnings.map((w, i) => `${i + 1}. ${w.message}`).join('\n')}` : '')
        }]
      };
    } else {
      return {
        content: [{
          type: "text",
          text: `❌ Flow 驗證失敗\n\n` +
                `📊 驗證結果：\n` +
                `- 總錯誤數：${result.errors.length}\n` +
                `- 警告數：${result.warnings.length}\n\n` +
                `🔴 錯誤清單：\n${result.errors.map((e, i) => `${i + 1}. [${e.path || 'flow'}] ${e.message}`).join('\n')}\n\n` +
                (result.warnings.length > 0 ? `⚠️ 警告清單：\n${result.warnings.map((w, i) => `${i + 1}. ${w.message}`).join('\n')}` : '')
        }]
      };
    }

  } catch (error) {
    logger.error('validateFlow 方法執行失敗', {
      method: 'validateFlow',
      event: 'validate_flow_error',
      details: { error: error instanceof Error ? error.message : '未知錯誤' }
    });

    return {
      content: [{
        type: "text",
        text: `驗證 Flow 時發生錯誤：${error instanceof Error ? error.message : '未知錯誤'}`
      }]
    };
  }
}

/**
 * 處理 checkFlowQuality 請求
 */
async function handleCheckFlowQuality(params: {
  flowContent: string;
  specPath: string;
}): Promise<{ content: Array<{ type: string; text: string }> }> {
  logger.info('checkFlowQuality 方法開始執行', {
    method: 'checkFlowQuality',
    event: 'check_quality_start'
  });

  try {
    const { parse: yamlParse } = await import('yaml');

    // 1. 載入 OpenAPI 規格
    const specPath = path.resolve(process.cwd(), params.specPath);
    if (!existsSync(specPath)) {
      return {
        content: [{
          type: "text",
          text: `錯誤：找不到規格檔案 '${specPath}'`
        }]
      };
    }

    const specDoc = await loadSpec({ filePath: specPath });

    // 2. 解析 Flow YAML
    const flowData = yamlParse(params.flowContent);

    // 3. 執行品質檢查
    const checker = new FlowQualityChecker(specDoc.document, flowData);
    const report = checker.check();

    // 4. 產生修正建議
    const suggestions = checker.generateFixSuggestions(report);

    logger.info('checkFlowQuality 方法成功完成', {
      method: 'checkFlowQuality',
      event: 'check_quality_success',
      details: {
        score: report.score,
        totalIssues: report.totalIssues
      }
    });

    let resultText = `📊 Flow 品質檢查報告\n\n` +
                     `總評分：${report.score}/100\n` +
                     `總問題數：${report.totalIssues}\n` +
                     `  - 錯誤：${report.errors}\n` +
                     `  - 警告：${report.warnings}\n` +
                     `  - 資訊：${report.infos}\n\n`;

    if (report.totalIssues === 0) {
      resultText += `✅ 未發現任何問題！Flow 品質良好。`;
    } else {
      // 顯示前 10 個問題
      resultText += `🔍 主要問題（顯示前 10 個）：\n\n`;
      report.issues.slice(0, 10).forEach((issue, i) => {
        const icon = issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        resultText += `${i + 1}. ${icon} [${issue.type}]\n`;
        resultText += `   位置：${issue.location}\n`;
        resultText += `   問題：${issue.message}\n`;
        resultText += `   建議：${issue.suggestion}\n\n`;
      });

      if (report.totalIssues > 10) {
        resultText += `... 還有 ${report.totalIssues - 10} 個問題未顯示\n\n`;
      }

      // 顯示修正建議
      if (suggestions.length > 0) {
        resultText += `\n💡 自動修正建議（顯示前 5 個）：\n\n`;
        suggestions.slice(0, 5).forEach((suggestion, i) => {
          resultText += `${i + 1}. 步驟 ${suggestion.stepIndex}：${suggestion.fieldPath}\n`;
          resultText += `   當前值：${JSON.stringify(suggestion.currentValue)}\n`;
          resultText += `   建議值：${JSON.stringify(suggestion.suggestedValue)}\n`;
          resultText += `   原因：${suggestion.reason}\n\n`;
        });
      }
    }

    return {
      content: [{
        type: "text",
        text: resultText
      }]
    };

  } catch (error) {
    logger.error('checkFlowQuality 方法執行失敗', {
      method: 'checkFlowQuality',
      event: 'check_quality_error',
      details: { error: error instanceof Error ? error.message : '未知錯誤' }
    });

    return {
      content: [{
        type: "text",
        text: `檢查 Flow 品質時發生錯誤：${error instanceof Error ? error.message : '未知錯誤'}`
      }]
    };
  }
}

/**
 * 處理 saveFlow 請求
 */
async function handleSaveFlow(params: {
  flowContent: string;
  fileName: string;
}): Promise<{ content: Array<{ type: string; text: string }> }> {
  logger.info('saveFlow 方法開始執行', {
    method: 'saveFlow',
    event: 'save_flow_start',
    details: { fileName: params.fileName }
  });

  try {
    // 1. 確保 flows 目錄存在
    const flowsDir = path.resolve(process.cwd(), 'flows');
    if (!existsSync(flowsDir)) {
      mkdirSync(flowsDir, { recursive: true });
    }

    // 2. 確保檔案名稱以 .yaml 結尾
    let fileName = params.fileName;
    if (!fileName.endsWith('.yaml') && !fileName.endsWith('.yml')) {
      fileName += '.yaml';
    }

    // 3. 儲存檔案
    const filePath = path.join(flowsDir, fileName);
    writeFileSync(filePath, params.flowContent, 'utf-8');

    logger.info('saveFlow 方法成功完成', {
      method: 'saveFlow',
      event: 'save_flow_success',
      details: { filePath }
    });

    return {
      content: [{
        type: "text",
        text: `✅ Flow 已成功儲存\n\n` +
              `📁 儲存路徑：${path.relative(process.cwd(), filePath)}\n` +
              `📝 檔案大小：${Buffer.byteLength(params.flowContent, 'utf-8')} bytes`
      }]
    };

  } catch (error) {
    logger.error('saveFlow 方法執行失敗', {
      method: 'saveFlow',
      event: 'save_flow_error',
      details: { error: error instanceof Error ? error.message : '未知錯誤' }
    });

    return {
      content: [{
        type: "text",
        text: `儲存 Flow 時發生錯誤：${error instanceof Error ? error.message : '未知錯誤'}`
      }]
    };
  }
}

/**
 * 處理 checkOperationIds 請求
 */
async function handleCheckOperationIds(params: {
  specPath: string;
}): Promise<{ content: Array<{ type: string; text: string }> }> {
  logger.info('checkOperationIds 方法開始執行', {
    method: 'checkOperationIds',
    event: 'check_operation_ids_start',
    details: { specPath: params.specPath }
  });

  try {
    // 1. 載入 OpenAPI 規格
    const specPath = path.resolve(process.cwd(), params.specPath);
    if (!existsSync(specPath)) {
      return {
        content: [{
          type: "text",
          text: `錯誤：找不到規格檔案 '${specPath}'`
        }]
      };
    }

    const executionId = `check-${Date.now()}`;
    const specDoc = await loadSpec({ filePath: specPath, executionId });

    // 2. 調用 SpecAnalyzer.detectIssues() 檢測
    const analyzer = new SpecAnalyzer({ spec: specDoc.document });
    const issues = analyzer.detectIssues();

    // 3. 檢查檔案可修改性
    const isModifiable = analyzer.checkIfModifiable(specPath);

    // 4. 格式化輸出
    let resultText = `📊 OpenAPI 規格檢測結果\n\n`;
    resultText += `📄 規格檔案：${path.relative(process.cwd(), specPath)}\n`;
    resultText += `🔢 總端點數：${issues.totalEndpoints}\n\n`;

    if (!issues.hasIssues) {
      resultText += `✅ 所有端點都已定義 operationId\n`;
    } else {
      resultText += `⚠️ 發現 ${issues.missingOperationIds.length} 個端點缺少 operationId：\n\n`;
      issues.missingOperationIds.forEach((item, i) => {
        resultText += `${i + 1}. ${item.method} ${item.path}\n`;
        resultText += `   💡 建議 operationId: ${item.suggestedId}\n\n`;
      });

      // 5. 根據可修改性提供建議
      resultText += `\n💡 解決方案：\n`;
      if (isModifiable) {
        resultText += `\n**方式 1（推薦）**: 修改 OpenAPI 規格檔案\n`;
        resultText += `- 手動編輯規格檔案，加入建議的 operationId\n`;
        resultText += `- 或使用 addOperationIds 工具自動修改（未來功能）\n`;
        resultText += `\n**方式 2**: 使用 "METHOD /path" 格式過濾端點\n`;
        resultText += `- 範例：endpoints: ['POST /users', 'GET /users/{id}']\n`;
        resultText += `\n**方式 3**: 使用 "/path" 格式匹配所有方法\n`;
        resultText += `- 範例：endpoints: ['/users', '/products']\n`;
        resultText += `\n**方式 4**: 不指定 endpoints 參數產生所有端點\n`;
      } else {
        resultText += `\n⚠️ 此規格檔案為唯讀，無法修改。建議使用：\n`;
        resultText += `\n**方式 1**: 使用 "METHOD /path" 格式過濾端點\n`;
        resultText += `- 範例：endpoints: ['POST /users', 'GET /users/{id}']\n`;
        resultText += `\n**方式 2**: 使用 "/path" 格式匹配所有方法\n`;
        resultText += `- 範例：endpoints: ['/users', '/products']\n`;
        resultText += `\n**方式 3**: 不指定 endpoints 參數產生所有端點\n`;
      }
    }

    logger.info('checkOperationIds 方法成功完成', {
      method: 'checkOperationIds',
      event: 'check_operation_ids_success',
      details: {
        missingCount: issues.missingOperationIds.length,
        isModifiable
      }
    });

    return {
      content: [{
        type: "text",
        text: resultText
      }]
    };

  } catch (error) {
    logger.error('checkOperationIds 方法執行失敗', {
      method: 'checkOperationIds',
      event: 'check_operation_ids_error',
      details: { error: error instanceof Error ? error.message : '未知錯誤' }
    });

    return {
      content: [{
        type: "text",
        text: `檢測 operationId 時發生錯誤：${error instanceof Error ? error.message : '未知錯誤'}`
      }]
    };
  }
}

// 註冊 listSpecs 工具
server.registerTool("listSpecs", {
  title: "列出 OpenAPI 規格檔案",
  description: "取得可用的 OpenAPI 規格檔案列表",
  inputSchema: {
    directory: z.string().optional().describe("規格檔案目錄路徑，預設為 'specs'")
  }
}, async ({ directory = 'specs' }) => {
  return handleListSpecs(directory);
});

// 註冊 listFlows 工具
server.registerTool("listFlows", {
  title: "列出測試流程檔案",
  description: "取得可用的 YAML 測試流程檔案列表",
  inputSchema: {
    directory: z.string().optional().describe("流程檔案目錄路徑，預設為 'flows'")
  }
}, async ({ directory = 'flows' }) => {
  return handleListFlows(directory);
});

// 註冊 runFlow 工具
server.registerTool("runFlow", {
  title: "執行測試流程",
  description: "執行指定的 API 測試流程並產生報表",
  inputSchema: {
    spec: z.string().describe("OpenAPI 規格檔案路徑或內容"),
    flow: z.string().describe("測試流程檔案路徑或 YAML 內容"),
    baseUrl: z.string().optional().describe("API 基礎 URL"),
    port: z.number().optional().describe("API 埠號"),
    token: z.string().optional().describe("API 認證 Token"),
    options: z.object({
      failFast: z.boolean().optional().describe("遇到錯誤時立即停止"),
      retryCount: z.number().optional().describe("重試次數"),
      timeout: z.number().optional().describe("請求逾時時間（毫秒）")
    }).optional()
  }
}, async (params) => {
  return handleRunFlow(params);
});

// 註冊 getReport 工具
server.registerTool("getReport", {
  title: "取得測試報表",
  description: "取得最新的測試執行報表",
  inputSchema: {
    executionId: z.string().optional().describe("特定執行 ID，若未指定則取得最新報表"),
    format: z.enum(['json', 'summary']).optional().describe("報表格式")
  }
}, async ({ executionId, format = 'json' }) => {
  return handleGetReport(executionId, format);
});

// 註冊 generateFlow 工具
server.registerTool("generateFlow", {
  title: "產生測試 Flow",
  description: "根據 OpenAPI 規格自動產生測試流程 YAML。\n\n" +
               "⚠️ 重要：產生後必須執行驗證與修正流程\n\n" +
               "標準工作流程（AI 必須自動遵循）：\n" +
               "1. 調用 generateFlow 產生測試 Flow\n" +
               "2. 立即在同一個 response 中並行調用：\n" +
               "   - validateFlow：檢查格式與語義\n" +
               "   - checkFlowQuality：檢查品質與合理性\n" +
               "3. 分析驗證結果：\n" +
               "   - 若 validateFlow 失敗，修正 YAML 格式問題\n" +
               "   - 若 checkFlowQuality 分數 < 80，修正品質問題\n" +
               "4. 若有問題，修正後重複步驟 2-3，直到：\n" +
               "   - validateFlow 通過（valid: true）\n" +
               "   - checkFlowQuality 分數 ≥ 80\n" +
               "5. 驗證通過後，使用 saveFlow 儲存最終版本\n\n" +
               "注意：validateFlow 和 checkFlowQuality 必須並行調用以提升效率。",
  inputSchema: {
    specPath: z.string().describe("OpenAPI 規格檔案路徑（相對於專案根目錄）"),
    options: z.object({
      endpoints: z.array(z.string()).optional().describe("要產生測試的端點 operationId 列表（若未指定則產生所有端點）"),
      includeSuccessCases: z.boolean().optional().describe("是否包含成功案例（預設：true）"),
      includeErrorCases: z.boolean().optional().describe("是否包含錯誤案例（預設：false）"),
      includeEdgeCases: z.boolean().optional().describe("是否包含邊界測試（預設：false）"),
      generateFlows: z.boolean().optional().describe("是否產生流程串接測試（預設：false）")
    }).optional()
  }
}, async (params) => {
  return handleGenerateFlow(params);
});

// 註冊 validateFlow 工具
server.registerTool("validateFlow", {
  title: "驗證 Flow 格式",
  description: "驗證測試 Flow 的格式與語義是否正確",
  inputSchema: {
    flowContent: z.string().describe("Flow YAML 內容"),
    specPath: z.string().describe("OpenAPI 規格檔案路徑（用於語義驗證）")
  }
}, async (params) => {
  return handleValidateFlow(params);
});

// 註冊 checkFlowQuality 工具
server.registerTool("checkFlowQuality", {
  title: "檢查 Flow 品質",
  description: "檢查測試 Flow 的合理性並提供改進建議",
  inputSchema: {
    flowContent: z.string().describe("Flow YAML 內容"),
    specPath: z.string().describe("OpenAPI 規格檔案路徑")
  }
}, async (params) => {
  return handleCheckFlowQuality(params);
});

// 註冊 saveFlow 工具
server.registerTool("saveFlow", {
  title: "儲存 Flow 檔案",
  description: "將測試 Flow YAML 儲存到 flows 目錄",
  inputSchema: {
    flowContent: z.string().describe("Flow YAML 內容"),
    fileName: z.string().describe("檔案名稱（自動加上 .yaml 副檔名）")
  }
}, async (params) => {
  return handleSaveFlow(params);
});

// 註冊 checkOperationIds 工具
server.registerTool("checkOperationIds", {
  title: "檢測 operationId",
  description: "檢查 OpenAPI 規格中缺少 operationId 的端點，並提供修正建議。這個工具可以幫助你找出規格中沒有定義 operationId 的端點，並建議合適的名稱。如果你在使用 generateFlow 時無法預知自動產生的 operationId，可以先使用這個工具檢測。",
  inputSchema: {
    specPath: z.string().describe("OpenAPI 規格檔案路徑（相對於專案根目錄）")
  }
}, async (params) => {
  return handleCheckOperationIds(params);
});

// 啟動 MCP Server（使用官方範例的方式）
async function startServer(): Promise<void> {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('SpecPilot MCP Server 已啟動', {
      event: 'server_start',
      details: { transport: 'stdio' }
    });
  } catch (error) {
    logger.error('MCP Server 啟動失敗', {
      event: 'server_error',
      details: { error: error instanceof Error ? error.message : '未知錯誤' }
    });
    process.exit(1);
  }
}

// 立即啟動伺服器
startServer();