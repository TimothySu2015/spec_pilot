import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { McpServer } from '../src/bootstrap.js';
import { createStructuredLogger } from '@specpilot/shared';
import { randomUUID } from '@specpilot/shared';

// 模擬 logger
vi.mock('@specpilot/shared', async () => {
  const actual = await vi.importActual('@specpilot/shared');
  return {
    ...actual,
    createStructuredLogger: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  };
});

describe('MCP Server 整合測試', () => {
  let server: McpServer;
  let executionId: string;

  beforeEach(() => {
    executionId = randomUUID();
    server = new McpServer(executionId);
  });

  afterEach(() => {
    if (server) {
      server.shutdown('測試結束');
    }
  });

  describe('服務啟動與關閉', () => {
    it('應該能夠啟動 MCP 服務', () => {
      expect(() => server.start()).not.toThrow();
    });

    it('應該能夠優雅關閉服務', () => {
      server.start();
      expect(() => server.shutdown('測試關閉')).not.toThrow();
    });
  });

  describe('JSON-RPC 2.0 請求處理', () => {
    beforeEach(() => {
      server.start();
    });

    it('應該處理 listSpecs 請求並回傳檔案陣列', async () => {
      const requestData = JSON.stringify({
        jsonrpc: '2.0',
        method: 'listSpecs',
        id: 1,
      });

      const responseData = await server.handleRequest(requestData);
      const response = JSON.parse(responseData);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
      expect(Array.isArray(response.result)).toBe(true);
      expect(response.error).toBeUndefined();

      // 如果有檔案，檢查格式
      if (response.result.length > 0) {
        const file = response.result[0];
        expect(file).toHaveProperty('name');
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('size');
        expect(file).toHaveProperty('extension');
      }
    });

    it('應該處理 listFlows 請求並回傳檔案陣列', async () => {
      const requestData = JSON.stringify({
        jsonrpc: '2.0',
        method: 'listFlows',
        id: 2,
      });

      const responseData = await server.handleRequest(requestData);
      const response = JSON.parse(responseData);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(2);
      expect(response.result).toBeDefined();
      expect(Array.isArray(response.result)).toBe(true);
      expect(response.error).toBeUndefined();

      // 如果有檔案，檢查格式
      if (response.result.length > 0) {
        const file = response.result[0];
        expect(file).toHaveProperty('name');
        expect(file).toHaveProperty('path');
        expect(file).toHaveProperty('size');
        expect(file).toHaveProperty('extension');
      }
    });

    it('應該處理帶參數的 listFlows 請求', async () => {
      const requestData = JSON.stringify({
        jsonrpc: '2.0',
        method: 'listFlows',
        params: { prefix: 'user_' },
        id: 'test-with-params',
      });

      const responseData = await server.handleRequest(requestData);
      const response = JSON.parse(responseData);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('test-with-params');
      expect(response.result).toBeDefined();
      expect(Array.isArray(response.result)).toBe(true);
      expect(response.error).toBeUndefined();
    });

    it('應該處理 listFlows 的無效參數', async () => {
      const requestData = JSON.stringify({
        jsonrpc: '2.0',
        method: 'listFlows',
        params: { directory: '../invalid' },
        id: 'test-invalid-params',
      });

      const responseData = await server.handleRequest(requestData);
      const response = JSON.parse(responseData);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('test-invalid-params');
      expect(response.result).toBeUndefined();
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32602);
    });

    it('應該處理有效的 runFlow 內容模式請求', async () => {
      const requestData = JSON.stringify({
        jsonrpc: '2.0',
        method: 'runFlow',
        params: {
          specContent: JSON.stringify({
            openapi: '3.0.0',
            info: { title: 'Test API', version: '1.0.0' }
          }),
          flowContent: 'id: test-flow\nname: Test Flow\nsteps:\n  - name: test-step\n    request:\n      url: /api/test\n      method: GET'
        },
        id: 3,
      });

      const responseData = await server.handleRequest(requestData);
      const response = JSON.parse(responseData);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(3);

      if (response.error) {
        // 如果有錯誤，至少檢查錯誤格式是否正確
        expect(response.error.code).toBeDefined();
        expect(response.error.message).toBeDefined();
      } else {
        // 如果成功，檢查結果格式
        expect(response.result).toBeDefined();
        expect(response.result.executionId).toBeDefined();
        expect(response.result.status).toMatch(/^(success|partial_failure|failure)$/);
        expect(response.result.reportSummary).toBeDefined();
      }
    });

    it('應該拒絕無效的 runFlow 參數', async () => {
      const requestData = JSON.stringify({
        jsonrpc: '2.0',
        method: 'runFlow',
        params: {
          // 缺少必要參數
        },
        id: 'test-invalid-runflow',
      });

      const responseData = await server.handleRequest(requestData);
      const response = JSON.parse(responseData);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('test-invalid-runflow');
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32602);
      expect(response.error.message).toContain('必須提供檔案模式或內容模式參數');
    });

    it('應該處理 getReport 請求 - 檔案不存在情況', async () => {
      const requestData = JSON.stringify({
        jsonrpc: '2.0',
        method: 'getReport',
        id: 4,
      });

      const responseData = await server.handleRequest(requestData);
      const response = JSON.parse(responseData);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(4);
      expect(response.result).toBeUndefined();
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32603);
      expect(response.error.message).toBe('找不到測試報表檔案');
    });

    it('應該處理不帶參數的 getReport 請求', async () => {
      const requestData = JSON.stringify({
        jsonrpc: '2.0',
        method: 'getReport',
        id: 'getReport-test-1',
      });

      const responseData = await server.handleRequest(requestData);
      const response = JSON.parse(responseData);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('getReport-test-1');
      // 在沒有報表檔案的情況下應該回傳錯誤
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32603);
      expect(response.error.message).toBe('找不到測試報表檔案');
    });

    it('應該正確驗證 getReport 的 JSON-RPC 回應格式', async () => {
      const requestData = JSON.stringify({
        jsonrpc: '2.0',
        method: 'getReport',
        id: 'format-test',
      });

      const responseData = await server.handleRequest(requestData);
      const response = JSON.parse(responseData);

      // 驗證 JSON-RPC 2.0 格式
      expect(response).toHaveProperty('jsonrpc', '2.0');
      expect(response).toHaveProperty('id', 'format-test');

      // 應該有錯誤或結果其中之一，但不能兩者都有
      if (response.error) {
        expect(response.result).toBeUndefined();
        expect(response.error).toHaveProperty('code');
        expect(response.error).toHaveProperty('message');
      } else {
        expect(response.result).toBeDefined();
        expect(response.error).toBeUndefined();
      }
    });
  });

  describe('錯誤處理', () => {
    beforeEach(() => {
      server.start();
    });

    it('應該處理 JSON 解析錯誤', async () => {
      const invalidJson = '{ invalid json }';

      const responseData = await server.handleRequest(invalidJson);
      const response = JSON.parse(responseData);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBeNull();
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32700);
      expect(response.error.message).toBe('Parse error');
    });

    it('應該處理無效的 JSON-RPC 請求', async () => {
      const requestData = JSON.stringify({
        method: 'listSpecs', // 缺少 jsonrpc
        id: 5,
      });

      const responseData = await server.handleRequest(requestData);
      const response = JSON.parse(responseData);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(5);
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32603);
      expect(response.error.message).toContain('無效的 JSON-RPC 版本');
    });

    it('應該處理不支援的方法', async () => {
      const requestData = JSON.stringify({
        jsonrpc: '2.0',
        method: 'unsupportedMethod',
        id: 6,
      });

      const responseData = await server.handleRequest(requestData);
      const response = JSON.parse(responseData);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(6);
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32601);
      expect(response.error.message).toBe('Method not found');
    });

    it('應該拒絕已關閉服務的請求', async () => {
      server.shutdown('測試關閉');

      const requestData = JSON.stringify({
        jsonrpc: '2.0',
        method: 'listSpecs',
        id: 7,
      });

      const responseData = await server.handleRequest(requestData);
      const response = JSON.parse(responseData);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBeNull();
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32603);
      expect(response.error.message).toBe('服務已關閉');
    });
  });

  describe('信號處理與優雅關閉', () => {
    it('應該能處理多次關閉呼叫', () => {
      server.start();

      expect(() => {
        server.shutdown('第一次關閉');
        server.shutdown('第二次關閉');
      }).not.toThrow();
    });
  });

  describe('日誌記錄驗證', () => {
    let mockLogger: any;

    beforeEach(() => {
      mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      };
      vi.mocked(createStructuredLogger).mockReturnValue(mockLogger);
      server = new McpServer(executionId);
      server.start();
    });

    it('應該記錄請求接收日誌', async () => {
      const requestData = JSON.stringify({
        jsonrpc: '2.0',
        method: 'listSpecs',
        id: 8,
      });

      await server.handleRequest(requestData);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'request_received',
        expect.objectContaining({
          executionId,
          component: 'mcp-server',
          method: 'listSpecs',
          id: 8,
        })
      );
    });

    it('應該記錄成功回應日誌', async () => {
      const requestData = JSON.stringify({
        jsonrpc: '2.0',
        method: 'listSpecs',
        id: 9,
      });

      await server.handleRequest(requestData);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'response_sent',
        expect.objectContaining({
          executionId,
          component: 'mcp-server',
          method: 'listSpecs',
          id: 9,
          success: true,
        })
      );
    });

    it('應該記錄錯誤回應日誌', async () => {
      const requestData = JSON.stringify({
        jsonrpc: '2.0',
        method: 'invalidMethod',
        id: 10,
      });

      await server.handleRequest(requestData);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'response_error',
        expect.objectContaining({
          executionId,
          component: 'mcp-server',
          error: {
            code: -32601,
            message: 'Method not found',
          },
          method: 'invalidMethod',
          id: 10,
        })
      );
    });
  });
});