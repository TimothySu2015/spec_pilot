import { createStructuredLogger } from '@specpilot/shared';
import { getConfig, type ISpecPilotConfig } from '@specpilot/config';
import { randomUUID } from '@specpilot/shared';
import type { IMcpRequest, IMcpResponse } from './rpc-handler.js';
import {
  handleListSpecs,
  handleListFlows,
  handleRunFlow,
  handleGetReport
} from './handlers/index.js';

/**
 * MCP Server 類別
 */
export class McpServer {
  private logger;
  private config: ISpecPilotConfig;
  private executionId: string;
  private requestCount = 0;
  private isShutdown = false;

  constructor(executionId: string) {
    this.executionId = executionId;
    this.config = getConfig();
    this.logger = createStructuredLogger('mcp-server');
  }

  /**
   * 處理 JSON-RPC 請求
   */
  async handleRequest(requestData: string): Promise<string> {
    if (this.isShutdown) {
      const errorResponse: IMcpResponse = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: '服務已關閉',
        },
      };
      return JSON.stringify(errorResponse);
    }

    let request: IMcpRequest;
    let response: IMcpResponse;

    try {
      // 解析 JSON-RPC 請求
      request = JSON.parse(requestData.trim());

      // 記錄請求接收日誌
      this.logger.info('request_received', {
        executionId: this.executionId,
        component: 'mcp-server',
        method: request.method,
        id: request.id,
        params: request.params ? JSON.stringify(request.params).substring(0, 100) : undefined,
      });

      this.requestCount++;

      // 處理請求
      response = await this.processRequest(request);

      // 記錄成功回應日誌
      this.logger.info('response_sent', {
        executionId: this.executionId,
        component: 'mcp-server',
        method: request.method,
        id: request.id,
        success: !response.error,
      });

    } catch (parseError) {
      // JSON 解析錯誤
      this.logger.error('response_error', {
        executionId: this.executionId,
        component: 'mcp-server',
        error: {
          code: -32700,
          message: 'Parse error',
        },
        details: parseError instanceof Error ? parseError.message : '未知解析錯誤',
      });

      response = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error',
        },
      };
    }

    return JSON.stringify(response);
  }

  /**
   * 處理已解析的 JSON-RPC 請求
   */
  private async processRequest(request: IMcpRequest): Promise<IMcpResponse> {
    try {
      // 驗證請求格式
      if (request.jsonrpc !== '2.0') {
        throw new Error('無效的 JSON-RPC 版本');
      }

      if (!request.method || typeof request.method !== 'string') {
        throw new Error('無效的方法名稱');
      }

      // 路由至對應處理器
      switch (request.method) {
        case 'listSpecs':
          return handleListSpecs(request);
        case 'listFlows':
          return handleListFlows(request);
        case 'runFlow':
          return handleRunFlow(request);
        case 'getReport':
          return handleGetReport(request);
        default:
          // 未知方法錯誤
          this.logger.error('response_error', {
            executionId: this.executionId,
            component: 'mcp-server',
            error: {
              code: -32601,
              message: 'Method not found',
            },
            method: request.method,
            id: request.id,
          });

          return {
            jsonrpc: '2.0',
            id: request.id || null,
            error: {
              code: -32601,
              message: 'Method not found',
            },
          };
      }
    } catch (error) {
      // 內部錯誤
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';

      this.logger.error('response_error', {
        executionId: this.executionId,
        component: 'mcp-server',
        error: {
          code: -32603,
          message: errorMessage,
        },
        method: request.method,
        id: request.id,
      });

      return {
        jsonrpc: '2.0',
        id: request.id || null,
        error: {
          code: -32603,
          message: errorMessage,
        },
      };
    }
  }

  /**
   * 啟動服務
   */
  start(): void {
    if (this.isShutdown) {
      throw new Error('服務已關閉，無法重新啟動');
    }

    this.logger.info('service_started', {
      executionId: this.executionId,
      component: 'mcp-server',
      config: {
        environment: this.config.environment,
        hasToken: !!this.config.token,
      },
    });

    // 設定 STDIN 處理
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (data: string) => {
      try {
        const response = await this.handleRequest(data);
        process.stdout.write(response + '\n');
      } catch (error) {
        this.logger.error('response_error', {
          executionId: this.executionId,
          component: 'mcp-server',
          error: {
            code: -32603,
            message: '內部處理錯誤',
          },
          details: error instanceof Error ? error.message : '未知錯誤',
        });
      }
    });
  }

  /**
   * 關閉服務
   */
  shutdown(reason: string): void {
    if (this.isShutdown) {
      return;
    }

    this.isShutdown = true;

    // 拒絕未完成的請求並清理資源
    process.stdin.removeAllListeners('data');

    this.logger.info('service_stopped', {
      executionId: this.executionId,
      component: 'mcp-server',
      reason,
      statistics: {
        totalRequests: this.requestCount,
      },
    });
  }
}

/**
 * 啟動 MCP 服務器
 */
export function bootstrapMcpServer(): McpServer {
  const executionId = randomUUID();
  const logger = createStructuredLogger('mcp-server');

  try {
    // 載入設定（確保配置正確）
    getConfig();

    // 建立 MCP Server 實例
    const server = new McpServer(executionId);

    // 設定優雅關閉處理
    const gracefulShutdown = (signal: string): void => {
      logger.info('收到關閉信號', {
        executionId,
        component: 'mcp-server',
        signal,
      });

      server.shutdown(`收到 ${signal} 信號`);
      process.exit(0);
    };

    // 註冊信號監聽器
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // 註冊未處理例外監聽器
    process.on('uncaughtException', (error) => {
      logger.error('未捕捉例外', {
        executionId,
        component: 'mcp-server',
        error: error.message,
        stack: error.stack,
      });

      server.shutdown('未捕捉例外');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('未處理的 Promise rejection', {
        executionId,
        component: 'mcp-server',
        reason: reason instanceof Error ? reason.message : String(reason),
      });

      server.shutdown('未處理的 Promise rejection');
      process.exit(1);
    });

    return server;

  } catch (error) {
    logger.error('服務啟動失敗', {
      executionId,
      component: 'mcp-server',
      error: error instanceof Error ? error.message : '未知錯誤',
    });

    process.exit(1);
  }
}