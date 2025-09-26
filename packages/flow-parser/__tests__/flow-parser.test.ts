import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { 
  loadFlow, 
  loadFlowSafe, 
  loadFlowFromFile, 
  loadFlowFromContent,
  FlowLoader,
  FlowParseError,
  FlowValidationError,
  HttpMethod 
} from '../src/index.js';
import { IStructuredLogger } from '@specpilot/shared';

// Mock 檔案系統
vi.mock('fs');
const mockReadFileSync = vi.mocked(readFileSync);

// Mock logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn()
} as unknown as IStructuredLogger;

describe('Flow Parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadFlow', () => {
    it('應該從檔案路徑載入有效的 Flow', async () => {
      const validYaml = `
id: test-flow
name: "測試流程"
steps:
  - name: "測試步驟"
    request:
      method: "GET"
      path: "/api/test"
    expectations:
      status: 200
`;
      mockReadFileSync.mockReturnValue(validYaml);

      const result = await loadFlow({
        filePath: '/test/path/flow.yaml',
        executionId: 'test-123'
      }, mockLogger);

      expect(result.id).toBe('test-flow');
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].name).toBe('測試步驟');
      expect(result.steps[0].request.method).toBe(HttpMethod.GET);
      expect(result.steps[0].request.path).toBe('/api/test');
      expect(result.rawContent).toBe(validYaml);
    });

    it('應該從內容載入有效的 Flow', async () => {
      const validYaml = `
id: content-flow
steps:
  - name: "內容步驟"
    request:
      method: "POST"
      path: "/api/create"
      body:
        name: "測試"
    expectations:
      status: 201
      custom:
        - type: "notNull"
          field: "id"
`;

      const result = await loadFlow({
        content: validYaml,
        executionId: 'test-456'
      }, mockLogger);

      expect(result.id).toBe('content-flow');
      expect(result.steps[0].request.method).toBe(HttpMethod.POST);
      expect(result.steps[0].expectations.custom).toHaveLength(1);
      expect(result.steps[0].expectations.custom![0].type).toBe('notNull');
    });

    it('應該在檔案不存在時拋出 FlowParseError', async () => {
      mockReadFileSync.mockImplementation(() => {
        const error = new Error('ENOENT: no such file or directory');
        error.name = 'ENOENT';
        throw error;
      });

      await expect(loadFlow({
        filePath: '/nonexistent/path.yaml'
      }, mockLogger)).rejects.toThrow(FlowParseError);
    });

    it('應該在 YAML 格式錯誤時拋出 FlowParseError', async () => {
      const invalidYaml = `
invalid: yaml: format:
  - improper: indentation
    missing: quotes
`;
      mockReadFileSync.mockReturnValue(invalidYaml);

      await expect(loadFlow({
        filePath: '/test/invalid.yaml'
      }, mockLogger)).rejects.toThrow(FlowParseError);
    });

    it('應該拋出錯誤當沒有提供 filePath 或 content', async () => {
      await expect(loadFlow({}, mockLogger))
        .rejects.toThrow('必須提供 filePath 或 content 參數');
    });
  });

  describe('loadFlowSafe', () => {
    it('應該返回成功結果對於有效 Flow', async () => {
      const validYaml = `
id: safe-flow
steps:
  - name: "安全步驟"
    request:
      method: "GET"
      path: "/api/safe"
    expectations:
      status: 200
`;

      const result = await loadFlowSafe({
        content: validYaml
      }, mockLogger);

      expect(result.success).toBe(true);
      expect(result.flow).toBeDefined();
      expect(result.flow!.id).toBe('safe-flow');
      expect(result.error).toBeUndefined();
    });

    it('應該返回錯誤結果對於無效 Flow', async () => {
      const invalidYaml = `
id: invalid-flow
steps: []
`;

      const result = await loadFlowSafe({
        content: invalidYaml
      }, mockLogger);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Flow 必須包含至少一個步驟');
      expect(result.flow).toBeUndefined();
    });
  });

  describe('FlowLoader 驗證', () => {
    let loader: FlowLoader;

    beforeEach(() => {
      loader = new FlowLoader(mockLogger);
    });

    it('應該驗證必要欄位：steps', async () => {
      const missingSteps = `
id: missing-steps-flow
name: "缺少步驟"
`;

      await expect(loader.loadFlowFromContent(missingSteps, 'test-123'))
        .rejects.toThrow(FlowValidationError);
    });

    it('應該驗證步驟不能為空', async () => {
      const emptySteps = `
id: empty-steps-flow
steps: []
`;

      await expect(loader.loadFlowFromContent(emptySteps, 'test-123'))
        .rejects.toThrow(FlowValidationError);
    });

    it('應該驗證步驟名稱', async () => {
      const noStepName = `
id: no-name-flow  
steps:
  - request:
      method: "GET"
      path: "/api/test"
`;

      await expect(loader.loadFlowFromContent(noStepName, 'test-123'))
        .rejects.toThrow(FlowValidationError);
    });

    it('應該驗證 HTTP 方法', async () => {
      const invalidMethod = `
id: invalid-method-flow
steps:
  - name: "無效方法"
    request:
      method: "INVALID"
      path: "/api/test"
`;

      await expect(loader.loadFlowFromContent(invalidMethod, 'test-123'))
        .rejects.toThrow(FlowValidationError);
    });

    it('應該驗證請求路徑', async () => {
      const missingPath = `
id: missing-path-flow
steps:
  - name: "缺少路徑"
    request:
      method: "GET"
`;

      await expect(loader.loadFlowFromContent(missingPath, 'test-123'))
        .rejects.toThrow(FlowValidationError);
    });

    it('應該驗證期望設定中的狀態碼', async () => {
      const invalidStatus = `
id: invalid-status-flow
steps:
  - name: "無效狀態碼"
    request:
      method: "GET"
      path: "/api/test"
    expectations:
      status: 999
`;

      await expect(loader.loadFlowFromContent(invalidStatus, 'test-123'))
        .rejects.toThrow(FlowValidationError);
    });

    it('應該驗證自訂規則', async () => {
      const invalidCustomRule = `
id: invalid-custom-flow
steps:
  - name: "無效自訂規則"
    request:
      method: "GET"
      path: "/api/test"
    expectations:
      custom:
        - type: "invalid"
          field: "test"
`;

      await expect(loader.loadFlowFromContent(invalidCustomRule, 'test-123'))
        .rejects.toThrow(FlowValidationError);
    });

    it('應該處理完整的 Flow 定義', async () => {
      const completeYaml = `
id: complete-flow
name: "完整流程測試"
globals:
  baseUrl: "https://api.test.com"
  headers:
    Authorization: "Bearer token123"
  retryPolicy:
    maxRetries: 3
    delayMs: 1000
steps:
  - name: "完整步驟"
    request:
      method: "POST"
      path: "/api/users"
      headers:
        Content-Type: "application/json"
      body:
        name: "測試使用者"
      query:
        include: "profile"
    expectations:
      status: 201
      schema: "User"
      custom:
        - type: "notNull"
          field: "id"
        - type: "regex"
          field: "email"
          value: "^[\\\\w.-]+@[\\\\w.-]+\\\\.[a-zA-Z]{2,}$"
        - type: "contains"
          field: "name"
          value: "測試"
    retryPolicy:
      maxRetries: 2
      delayMs: 500
`;

      const result = await loader.loadFlowFromContent(completeYaml, 'test-complete');

      expect(result.id).toBe('complete-flow');
      expect(result.globals).toBeDefined();
      expect(result.globals!.baseUrl).toBe('https://api.test.com');
      expect(result.steps[0].request.headers).toBeDefined();
      expect(result.steps[0].expectations.custom).toHaveLength(3);
      expect(result.steps[0].retryPolicy).toBeDefined();
    });
  });

  describe('便利函式', () => {
    it('loadFlowFromFile 應該正常工作', async () => {
      const validYaml = `
id: convenience-file
steps:
  - name: "便利測試"
    request:
      method: "GET"
      path: "/api/convenience"
    expectations:
      status: 200
`;
      mockReadFileSync.mockReturnValue(validYaml);

      const result = await loadFlowFromFile('/test/convenience.yaml', 'conv-123', mockLogger);

      expect(result.id).toBe('convenience-file');
    });

    it('loadFlowFromContent 應該正常工作', async () => {
      const validYaml = `
id: convenience-content
steps:
  - name: "內容便利測試"
    request:
      method: "POST"
      path: "/api/content"
    expectations:
      status: 201
`;

      const result = await loadFlowFromContent(validYaml, 'content-123', mockLogger);

      expect(result.id).toBe('convenience-content');
    });
  });

  describe('日誌記錄', () => {
    it('應該記錄載入開始事件', async () => {
      const validYaml = `
id: log-test
steps:
  - name: "日誌測試"
    request:
      method: "GET"
      path: "/api/log"
    expectations:
      status: 200
`;

      await loadFlowFromContent(validYaml, 'log-123', mockLogger);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'FLOW_LOAD_START',
        '開始載入 Flow 內容',
        expect.objectContaining({
          contentLength: expect.any(Number),
          executionId: 'log-123',
          component: 'flow-parser'
        })
      );
    });

    it('應該記錄成功事件', async () => {
      const validYaml = `
id: success-log
steps:
  - name: "成功測試"
    request:
      method: "GET"
      path: "/api/success"
    expectations:
      status: 200
`;

      await loadFlowFromContent(validYaml, 'success-123', mockLogger);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'FLOW_LOAD_SUCCESS',
        'Flow 載入成功',
        expect.objectContaining({
          flowId: 'success-log',
          stepCount: 1,
          hasGlobals: false,
          executionId: 'success-123',
          component: 'flow-parser'
        })
      );
    });

    it('應該記錄失敗事件', async () => {
      const invalidYaml = `
id: failure-log
steps: []
`;

      await expect(loadFlowFromContent(invalidYaml, 'failure-123', mockLogger))
        .rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'FLOW_LOAD_FAILURE',
        'Flow 內容載入失敗',
        expect.objectContaining({
          contentLength: expect.any(Number),
          error: expect.any(String),
          executionId: 'failure-123',
          component: 'flow-parser'
        })
      );
    });
  });
});