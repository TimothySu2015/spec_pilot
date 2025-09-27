import { createStructuredLogger } from '@specpilot/shared';
import { getConfig } from '@specpilot/config';

const logger = createStructuredLogger('mcp-server');

/**
 * MCP JSON-RPC 2.0 回應介面
 */
interface IMcpResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * MCP JSON-RPC 2.0 請求介面
 */
interface IMcpRequest {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
  id?: string | number;
}

/**
 * MCP Server 實作
 */
class McpServer {
  private config = getConfig();

  /**
   * 處理 MCP 請求
   */
  async handleRequest(request: IMcpRequest): Promise<IMcpResponse> {
    logger.info('收到 MCP 請求', { method: request.method, id: request.id });

    try {
      switch (request.method) {
        case 'listSpecs':
          return this.handleListSpecs(request);
        case 'listFlows':
          return this.handleListFlows(request);
        case 'runFlow':
          return this.handleRunFlow(request);
        case 'getReport':
          return this.handleGetReport(request);
        default:
          throw new Error(`未知的方法: ${request.method}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      logger.error('MCP 請求處理失敗', { 
        method: request.method, 
        id: request.id, 
        error: errorMessage 
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

  private handleListSpecs(request: IMcpRequest): IMcpResponse {
    // TODO: 實作 OpenAPI 規格列表功能
    return {
      jsonrpc: '2.0',
      id: request.id || null,
      result: {
        specs: ['待實作 - 需要 spec-loader 模組'],
        message: '核心模組尚未實作，待後續 Story 完成',
      },
    };
  }

  private handleListFlows(request: IMcpRequest): IMcpResponse {
    // TODO: 實作測試流程列表功能
    return {
      jsonrpc: '2.0',
      id: request.id || null,
      result: {
        flows: ['待實作 - 需要 flow-parser 模組'],
        message: '核心模組尚未實作，待後續 Story 完成',
      },
    };
  }

  private handleRunFlow(request: IMcpRequest): IMcpResponse {
    // TODO: 實作測試執行功能
    return {
      jsonrpc: '2.0',
      id: request.id || null,
      result: {
        status: 'pending',
        message: '核心執行引擎尚未實作，待後續 Story 完成',
      },
    };
  }

  private handleGetReport(request: IMcpRequest): IMcpResponse {
    // TODO: 實作報表取得功能
    return {
      jsonrpc: '2.0',
      id: request.id || null,
      result: {
        report: null,
        message: '報表模組尚未實作，待後續 Story 完成',
      },
    };
  }

  /**
   * 啟動 MCP 伺服器
   */
  async start(): Promise<void> {
    logger.info('SpecPilot MCP Server 啟動', { config: this.config });
    
    // 模擬伺服器監聽（實際實作需要 JSON-RPC 傳輸層）
    logger.info('MCP Server 正在監聽 stdin/stdout');
    
    // 等待輸入
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (data: string) => {
      try {
        const request: IMcpRequest = JSON.parse(data.trim());
        const response = await this.handleRequest(request);
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (error) {
        const errorResponse: IMcpResponse = {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error',
          },
        };
        process.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    });

    logger.info('MCP Server 已啟動完成');
  }
}

/**
 * 主程式
 */
async function main(): Promise<void> {
  const server = new McpServer();
  await server.start();
}

// 執行主程式
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('未處理的錯誤:', error);
    process.exit(1);
  });
}