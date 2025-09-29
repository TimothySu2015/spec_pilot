import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleRunFlow } from '../../src/handlers/run-flow.js';
import type { IMcpRequest } from '../../src/rpc-handler.js';
import { JSON_RPC_ERROR_CODES } from '../../src/rpc-handler.js';
import { existsSync, writeFileSync, mkdirSync, unlinkSync, rmSync } from 'fs';
import { join } from 'path';

// Mock 外部依賴
vi.mock('@specpilot/shared', () => ({
  createStructuredLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }))
}));

vi.mock('@specpilot/spec-loader', () => ({
  SpecLoader: vi.fn().mockImplementation(() => ({
    loadFromString: vi.fn().mockResolvedValue({
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' }
    })
  }))
}));

vi.mock('@specpilot/flow-parser', () => ({
  FlowParser: vi.fn().mockImplementation(() => ({
    parseFromString: vi.fn().mockResolvedValue({
      id: 'test-flow',
      name: 'Test Flow',
      steps: [
        {
          name: 'test-step',
          request: { url: '/api/test', method: 'GET' }
        }
      ]
    })
  }))
}));

vi.mock('@specpilot/core-flow', () => ({
  EnhancedFlowOrchestrator: vi.fn().mockImplementation(() => ({
    executeFlowWithReporting: vi.fn().mockResolvedValue({
      results: [
        { status: 'passed', duration: 100 },
        { status: 'passed', duration: 150 }
      ],
      reportSummary: '測試執行成功，所有步驟都通過',
      executionId: 'test-execution-id'
    })
  }))
}));

vi.mock('@specpilot/reporting', () => ({
  // 現在只需要 IExecutionConfig 型別
}));

describe('handleRunFlow', () => {
  const testSpecsDir = 'test-specs';
  const testFlowsDir = 'test-flows';
  const tempDir = 'temp';
  const reportsDir = 'reports';

  beforeEach(() => {
    // 建立測試目錄
    if (!existsSync(testSpecsDir)) {
      mkdirSync(testSpecsDir, { recursive: true });
    }
    if (!existsSync(testFlowsDir)) {
      mkdirSync(testFlowsDir, { recursive: true });
    }

    // 建立測試檔案
    const testSpec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {}
    };

    const testFlow = {
      id: 'test-flow',
      name: 'Test Flow',
      steps: [{
        name: 'test-step',
        request: { url: '/api/test', method: 'GET' }
      }]
    };

    writeFileSync(join(testSpecsDir, 'test.json'), JSON.stringify(testSpec, null, 2));
    writeFileSync(join(testFlowsDir, 'test.yaml'), 'id: test-flow\nname: Test Flow\nsteps:\n  - name: test-step\n    request:\n      url: /api/test\n      method: GET');
  });

  afterEach(() => {
    // 清理測試檔案
    try {
      if (existsSync(testSpecsDir)) rmSync(testSpecsDir, { recursive: true });
      if (existsSync(testFlowsDir)) rmSync(testFlowsDir, { recursive: true });
      if (existsSync(tempDir)) rmSync(tempDir, { recursive: true });
      if (existsSync(reportsDir)) rmSync(reportsDir, { recursive: true });
    } catch (error) {
      // 忽略清理錯誤
    }
    vi.clearAllMocks();
  });

  describe('參數驗證', () => {
    it('應該拒絕空參數', async () => {
      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'runFlow',
        id: 1
      };

      const response = await handleRunFlow(request);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(JSON_RPC_ERROR_CODES.INVALID_PARAMS);
      expect(response.error!.message).toContain('參數必須是物件');
    });

    it('應該拒絕同時使用檔案模式和內容模式', async () => {
      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'runFlow',
        params: {
          spec: 'test.json',
          flow: 'test.yaml',
          specContent: '{}',
          flowContent: 'test: true'
        },
        id: 1
      };

      const response = await handleRunFlow(request);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(JSON_RPC_ERROR_CODES.INVALID_PARAMS);
      expect(response.error!.message).toContain('檔案模式與內容模式不能同時使用');
    });

    it('應該拒絕不完整的檔案模式參數', async () => {
      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'runFlow',
        params: {
          spec: 'test.json'
          // 缺少 flow 參數
        },
        id: 1
      };

      const response = await handleRunFlow(request);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(JSON_RPC_ERROR_CODES.INVALID_PARAMS);
      expect(response.error!.message).toContain('檔案模式需要同時提供 spec 和 flow 參數');
    });

    it('應該拒絕不完整的內容模式參數', async () => {
      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'runFlow',
        params: {
          specContent: '{}'
          // 缺少 flowContent 參數
        },
        id: 1
      };

      const response = await handleRunFlow(request);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(JSON_RPC_ERROR_CODES.INVALID_PARAMS);
      expect(response.error!.message).toContain('內容模式需要同時提供 specContent 和 flowContent 參數');
    });

    it('應該拒絕超過大小限制的內容', async () => {
      const largeContent = 'x'.repeat(11 * 1024 * 1024); // 11MB

      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'runFlow',
        params: {
          specContent: largeContent,
          flowContent: 'test: true'
        },
        id: 1
      };

      const response = await handleRunFlow(request);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(JSON_RPC_ERROR_CODES.INVALID_PARAMS);
      expect(response.error!.message).toContain('specContent 大小超過 10MB 限制');
    });

    it('應該拒絕無效的 URL 格式', async () => {
      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'runFlow',
        params: {
          specContent: '{}',
          flowContent: 'test: true',
          baseUrl: 'invalid-url'
        },
        id: 1
      };

      const response = await handleRunFlow(request);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(JSON_RPC_ERROR_CODES.INVALID_PARAMS);
      expect(response.error!.message).toContain('baseUrl 格式無效');
    });

    it('應該拒絕無效的埠號範圍', async () => {
      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'runFlow',
        params: {
          specContent: '{}',
          flowContent: 'test: true',
          port: 70000
        },
        id: 1
      };

      const response = await handleRunFlow(request);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(JSON_RPC_ERROR_CODES.INVALID_PARAMS);
      expect(response.error!.message).toContain('埠號必須在 1-65535 範圍內');
    });

    it('應該拒絕 HTTPS URL 配 80 埠', async () => {
      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'runFlow',
        params: {
          specContent: '{}',
          flowContent: 'test: true',
          baseUrl: 'https://api.example.com',
          port: 80
        },
        id: 1
      };

      const response = await handleRunFlow(request);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(JSON_RPC_ERROR_CODES.INVALID_PARAMS);
      expect(response.error!.message).toContain('HTTPS URL 不應使用 80 埠');
    });
  });

  describe('檔案模式處理', () => {
    it('應該成功處理有效的檔案模式請求', async () => {
      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'runFlow',
        params: {
          spec: join(testSpecsDir, 'test.json'),
          flow: join(testFlowsDir, 'test.yaml')
        },
        id: 1
      };

      const response = await handleRunFlow(request);

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();

      const result = response.result as any;
      expect(result.executionId).toBeDefined();
      expect(result.status).toBe('success');
      expect(result.reportSummary).toBeDefined();
    });

    it('應該拒絕包含 .. 的路徑', async () => {
      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'runFlow',
        params: {
          spec: '../test.json',
          flow: 'test.yaml'
        },
        id: 1
      };

      const response = await handleRunFlow(request);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(JSON_RPC_ERROR_CODES.INTERNAL_ERROR);
      expect(response.error!.message).toContain('檔案路徑必須在專案目錄內');
    });

    it('應該處理檔案不存在的情況', async () => {
      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'runFlow',
        params: {
          spec: 'nonexistent.json',
          flow: 'test.yaml'
        },
        id: 1
      };

      const response = await handleRunFlow(request);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(JSON_RPC_ERROR_CODES.INTERNAL_ERROR);
      expect(response.error!.message).toContain('OpenAPI 規格檔案不存在');
    });
  });

  describe('內容模式處理', () => {
    it('應該成功處理有效的內容模式請求', async () => {
      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'runFlow',
        params: {
          specContent: JSON.stringify({
            openapi: '3.0.0',
            info: { title: 'Test API', version: '1.0.0' }
          }),
          flowContent: 'id: test-flow\nname: Test Flow\nsteps:\n  - name: test-step'
        },
        id: 1
      };

      const response = await handleRunFlow(request);

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();

      const result = response.result as any;
      expect(result.executionId).toBeDefined();
      expect(result.status).toBe('success');
      expect(result.reportSummary).toBeDefined();
    });
  });

  describe('設定覆寫功能', () => {
    it('應該正確套用 baseUrl 覆寫', async () => {
      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'runFlow',
        params: {
          specContent: '{"openapi":"3.0.0","info":{"title":"Test","version":"1.0.0"}}',
          flowContent: 'id: test\nname: Test\nsteps: []',
          baseUrl: 'https://api.example.com'
        },
        id: 1
      };

      const response = await handleRunFlow(request);

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
    });

    it('應該正確套用 token 覆寫', async () => {
      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'runFlow',
        params: {
          specContent: '{"openapi":"3.0.0","info":{"title":"Test","version":"1.0.0"}}',
          flowContent: 'id: test\nname: Test\nsteps: []',
          token: 'test-token-123'
        },
        id: 1
      };

      const response = await handleRunFlow(request);

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
    });
  });

  describe('執行狀態判斷', () => {
    it('應該回傳正確的執行狀態', async () => {
      // 重新 mock EnhancedFlowOrchestrator 來回傳部分失敗的結果
      const { EnhancedFlowOrchestrator } = await import('@specpilot/core-flow');

      vi.mocked(EnhancedFlowOrchestrator).mockImplementation(() => ({
        executeFlowWithReporting: vi.fn().mockResolvedValue({
          results: [
            { status: 'passed', duration: 100 },
            { status: 'failed', duration: 150 },
            { status: 'passed', duration: 120 }
          ],
          reportSummary: '部分測試失敗',
          executionId: 'test-execution-id'
        })
      }) as any);

      const request: IMcpRequest = {
        jsonrpc: '2.0',
        method: 'runFlow',
        params: {
          specContent: '{"openapi":"3.0.0","info":{"title":"Test","version":"1.0.0"}}',
          flowContent: 'id: test\nname: Test\nsteps: []'
        },
        id: 1
      };

      const response = await handleRunFlow(request);

      expect(response.error).toBeUndefined();
      const result = response.result as any;
      expect(result.status).toBe('partial_failure');
    });
  });
});