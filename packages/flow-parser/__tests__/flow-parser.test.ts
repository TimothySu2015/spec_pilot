import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import {
  loadFlow,
  loadFlowSafe,
  loadFlowFromFile,
  loadFlowFromContent,
  FlowLoader,
  FlowParseError,
  FlowValidationError,
  HttpMethod,
} from '../src/index.js';
import { StructuredLogger } from '@specpilot/shared';

vi.mock('fs');
const mockReadFileSync = vi.mocked(readFileSync);

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
} as unknown as StructuredLogger;

describe('Flow Parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadFlow', () => {
    it('應該能從檔案載入符合新結構的 Flow', async () => {
      const yaml = `
name: 測試流程
steps:
  - name: 取得資料
    request:
      method: GET
      path: /api/test
    expect:
      statusCode: 200
`;
      mockReadFileSync.mockReturnValue(yaml);

      const result = await loadFlow({
        filePath: '/test/path/flow.yaml',
        executionId: 'test-123',
      }, mockLogger);

      expect(result.id).toBe('測試流程');
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].request.method).toBe('GET');
      expect(result.steps[0].request.path).toBe('/api/test');
      expect(result.steps[0].expect.statusCode).toBe(200);
      expect(result.rawContent).toBe(yaml);
    });

    it('應該能從內容字串載入並轉換 validation 與 capture', async () => {
      const yaml = `
name: 字串流程
steps:
  - name: 建立資料
    request:
      method: POST
      path: /api/create
      body:
        name: "新資料"
    expect:
      statusCode: 201
    validation:
      - rule: notNull
        path: id
    capture:
      - variableName: created_id
        path: id
`;

      const result = await loadFlow({
        content: yaml,
        executionId: 'content-456',
      }, mockLogger);

      expect(result.id).toBe('字串流程');
      expect(result.steps[0].request.method).toBe('POST');
      expect(result.steps[0].expect.custom).toHaveLength(1);
      expect(result.steps[0].expect.custom?.[0]).toMatchObject({ type: 'notNull', field: 'id' });
      expect(result.steps[0].capture).toEqual({ created_id: 'id' });
    });

    it('檔案不存在時應該拋出 FlowParseError', async () => {
      mockReadFileSync.mockImplementation(() => {
        const error = new Error('ENOENT: no such file or directory');
        error.name = 'ENOENT';
        throw error;
      });

      await expect(loadFlow({ filePath: '/not/found.yaml' }, mockLogger)).rejects.toThrow(FlowParseError);
    });

    it('YAML 格式錯誤時應該拋出 FlowParseError', async () => {
      const invalidYaml = `
invalid: yaml: format:
  - improper: indentation
`;
      mockReadFileSync.mockReturnValue(invalidYaml);

      await expect(loadFlow({ filePath: '/test/invalid.yaml' }, mockLogger)).rejects.toThrow(FlowParseError);
    });

    it('未提供 filePath 或 content 時應該拋出錯誤', async () => {
      await expect(loadFlow({}, mockLogger)).rejects.toThrow(/filePath/);
    });
  });

  describe('loadFlowSafe', () => {
    it('成功載入時應該回傳成功結果', async () => {
      const yaml = `
name: 安全流程
steps:
  - name: 健康檢查
    request:
      method: GET
      path: /health
    expect:
      statusCode: 200
`;
      mockReadFileSync.mockReturnValue(yaml);

      const result = await loadFlowSafe({ filePath: '/safe/flow.yaml' }, mockLogger);

      expect(result.success).toBe(true);
      expect(result.flow?.id).toBe('安全流程');
      expect(result.error).toBeUndefined();
    });

    it('當 schema 驗證失敗時應該包裝錯誤', async () => {
      const yaml = `
name: 無步驟流程
steps: []
`;

      const result = await loadFlowSafe({ content: yaml }, mockLogger);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Flow YAML');
      expect(result.flow).toBeUndefined();
    });
  });

  describe('便利函式', () => {
    it('loadFlowFromFile 應該委派給 loadFlow', async () => {
      const yaml = `
name: 測試
steps:
  - name: 範例
    request:
      method: GET
      path: /test
    expect:
      statusCode: 200
`;
      mockReadFileSync.mockReturnValue(yaml);

      const result = await loadFlowFromFile('/flows/test.yaml', 'exec-1', mockLogger);
      expect(result.id).toBe('測試');
    });

    it('loadFlowFromContent 應該委派給 loadFlow', async () => {
      const yaml = `
name: 直接內容
steps:
  - name: 範例
    request:
      method: GET
      path: /test
    expect:
      statusCode: 200
`;

      const result = await loadFlowFromContent(yaml, 'exec-2', mockLogger);
      expect(result.id).toBe('直接內容');
    });
  });

  describe('FlowLoader 詳細轉換', () => {
    let loader: FlowLoader;

    beforeEach(() => {
      loader = new FlowLoader(mockLogger);
    });

    it('應該解析 capture 與 validation 為內部結構', async () => {
      const yaml = `
name: 轉換流程
steps:
  - name: 處理
    request:
      method: POST
      path: /process
    expect:
      statusCode: 201
      bodyFields:
        - fieldName: data.id
          validationMode: any
    validation:
      - rule: contains
        path: message
        value: success
    capture:
      - variableName: data_id
        path: data.id
`;

      const result = await loader.loadFlowFromContent(yaml, 'convert-1');
      const step = result.steps[0];

      expect(step.expect.statusCode).toBe(201);
      expect(step.expect.custom).toHaveLength(2);
      expect(step.expect.custom?.[0]).toMatchObject({ type: 'notNull', field: 'data.id' });
      expect(step.expect.custom?.[1]).toEqual({ type: 'contains', field: 'message', value: 'success' });
      expect(step.capture).toEqual({ data_id: 'data.id' });
    });

    it('應該驗證 HTTP 方法是否合法', async () => {
      const yaml = `
name: 非法方法
steps:
  - name: 無效方法
    request:
      method: FETCH
      path: /invalid
    expect:
      statusCode: 200
`;

      await expect(loader.loadFlowFromContent(yaml, 'invalid-method')).rejects.toThrow(FlowValidationError);
    });

    it('應該合併 globals.baseUrl 與頂層 baseUrl', async () => {
      const yaml = `
name: 全域設定
baseUrl: http://fallback.local

globals:
  headers:
    X-Trace: test

steps:
  - name: 測試
    request:
      method: GET
      path: /hello
    expect:
      statusCode: 200
`;

      const result = await loader.loadFlowFromContent(yaml, 'globals-1');

      expect(result.globals?.baseUrl).toBe('http://fallback.local');
      expect(result.globals?.headers).toEqual({ 'X-Trace': 'test' });
    });
  });
});


