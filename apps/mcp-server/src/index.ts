import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readdirSync, statSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
// import { createStructuredLogger } from '@specpilot/shared'; // 已使用靜默日誌器
import { loadSpec } from '@specpilot/spec-loader';
import { loadFlow } from '@specpilot/flow-parser';
import { EnhancedFlowOrchestrator } from '@specpilot/core-flow';
import { type IExecutionConfig } from '@specpilot/reporting';
import { overrideConfig } from '@specpilot/config';

// 為 MCP Server 建立靜默日誌記錄器（避免干擾 stdio transport）
const logger = {
  info: (message: string, context?: unknown): void => {
    // 寫入檔案而非 stdout/stderr
    const logsDir = path.join(process.cwd(), 'logs');
    const logPath = path.join(logsDir, 'mcp-server.log');
    try {
      // 確保 logs 目錄存在
      if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true });
      }
      const logEntry = JSON.stringify({
        level: 'info',
        time: new Date().toISOString(),
        message,
        context
      }) + '\n';
      writeFileSync(logPath, logEntry, { flag: 'a' });
    } catch (e) {
      // 靜默處理日誌錯誤
    }
  },
  error: (message: string, context?: unknown): void => {
    const logsDir = path.join(process.cwd(), 'logs');
    const logPath = path.join(logsDir, 'mcp-server.log');
    try {
      // 確保 logs 目錄存在
      if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true });
      }
      const logEntry = JSON.stringify({
        level: 'error',
        time: new Date().toISOString(),
        message,
        context
      }) + '\n';
      writeFileSync(logPath, logEntry, { flag: 'a' });
    } catch (e) {
      // 靜默處理日誌錯誤
    }
  }
};

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
    const finalBaseUrl = baseUrl || config.baseUrl || 'http://localhost:3000';
    const orchestrator = new EnhancedFlowOrchestrator(undefined, { baseUrl: finalBaseUrl });

    // 準備執行配置
    const executionConfig: IExecutionConfig = {
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

    logger.info('runFlow 方法成功完成', {
      executionId,
      method: 'runFlow',
      event: 'run_flow_success',
      details: {
        totalSteps: result.steps?.length || 0,
        success: result.success
      }
    });

    return {
      content: [{
        type: "text",
        text: `測試執行完成（真實 HTTP 測試）！\n\n` +
              `執行 ID: ${executionId}\n` +
              `結果: ${result.success ? '成功' : '失敗'}\n` +
              `總步驟數: ${result.steps?.length || 0}\n` +
              `成功步驟: ${result.steps?.filter(s => s.status === 'passed')?.length || 0}\n` +
              `失敗步驟: ${result.steps?.filter(s => s.status === 'failed')?.length || 0}\n\n` +
              `報表摘要：\n${flowResult.reportSummary || '無報表摘要'}\n\n` +
              `執行詳情：已產生完整報表與日誌`
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