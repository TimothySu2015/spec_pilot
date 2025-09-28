import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import path from 'path';
import { handleListFlows } from '../../src/handlers/list-flows.js';
import type { IMcpRequest } from '../../src/rpc-handler.js';

// Mock logger
vi.mock('@specpilot/shared', () => ({
  createEnhancedStructuredLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('list-flows 處理器', () => {
  const testBaseDir = path.join(process.cwd(), 'test-base-flows');
  const testFlowsDir = path.join(testBaseDir, 'flows');
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();

    // 建立測試基礎目錄
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
    mkdirSync(testBaseDir, { recursive: true });
    mkdirSync(testFlowsDir, { recursive: true });

    // 建立測試檔案
    writeFileSync(path.join(testFlowsDir, 'user_crud.yaml'), 'name: User CRUD Test');
    writeFileSync(path.join(testFlowsDir, 'user_login.yml'), 'name: User Login Test');
    writeFileSync(path.join(testFlowsDir, 'admin_flow.yaml'), 'name: Admin Flow Test');
    writeFileSync(path.join(testFlowsDir, 'test_basic.yaml'), 'name: Basic Test');
    writeFileSync(path.join(testFlowsDir, 'readme.txt'), 'This is not a flow file');

    // 建立子目錄
    mkdirSync(path.join(testFlowsDir, 'custom'));
    writeFileSync(path.join(testFlowsDir, 'custom', 'special.yaml'), 'name: Special Test');

    // Mock process.cwd() 以指向測試基礎目錄
    vi.spyOn(process, 'cwd').mockReturnValue(testBaseDir);
  });

  afterEach(() => {
    // 清理測試目錄
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it('應該成功列出 flows 目錄中的所有流程檔案', () => {
    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'listFlows',
      id: 'test-1',
    };

    const response = handleListFlows(request);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('test-1');
    expect(response.error).toBeUndefined();
    expect(Array.isArray(response.result)).toBe(true);

    const files = response.result as any[];
    expect(files).toHaveLength(4);

    const fileNames = files.map(f => f.name).sort();
    expect(fileNames).toEqual(['admin_flow.yaml', 'test_basic.yaml', 'user_crud.yaml', 'user_login.yml']);
  });

  it('應該支援 prefix 篩選', () => {
    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'listFlows',
      params: { prefix: 'user_' },
      id: 'test-2',
    };

    const response = handleListFlows(request);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('test-2');
    expect(response.error).toBeUndefined();

    const files = response.result as any[];
    expect(files).toHaveLength(2);

    const fileNames = files.map(f => f.name).sort();
    expect(fileNames).toEqual(['user_crud.yaml', 'user_login.yml']);
  });

  it('應該支援 filename 篩選', () => {
    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'listFlows',
      params: { filename: 'admin_flow.yaml' },
      id: 'test-3',
    };

    const response = handleListFlows(request);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('test-3');
    expect(response.error).toBeUndefined();

    const files = response.result as any[];
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('admin_flow.yaml');
  });

  it('應該支援 directory 參數', () => {
    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'listFlows',
      params: { directory: 'custom' },
      id: 'test-4',
    };

    const response = handleListFlows(request);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('test-4');
    expect(response.error).toBeUndefined();

    const files = response.result as any[];
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('special.yaml');
    expect(files[0].path).toBe(path.join('flows', 'custom', 'special.yaml'));
  });

  it('應該支援多條件組合篩選', () => {
    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'listFlows',
      params: { prefix: 'test_', filename: 'test_basic.yaml' },
      id: 'test-5',
    };

    const response = handleListFlows(request);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('test-5');
    expect(response.error).toBeUndefined();

    const files = response.result as any[];
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('test_basic.yaml');
  });

  it('應該在沒有符合檔案時回傳空陣列', () => {
    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'listFlows',
      params: { prefix: 'nonexistent_' },
      id: 'test-6',
    };

    const response = handleListFlows(request);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('test-6');
    expect(response.error).toBeUndefined();
    expect(response.result).toEqual([]);
  });

  it('應該在目錄不存在時回傳錯誤', () => {
    // 刪除測試目錄
    rmSync(testFlowsDir, { recursive: true, force: true });

    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'listFlows',
      id: 'test-7',
    };

    const response = handleListFlows(request);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('test-7');
    expect(response.result).toBeUndefined();
    expect(response.error).toEqual({
      code: -32603,
      message: 'flows 目錄不存在',
      data: { code: 'ENOENT' },
    });
  });

  it('應該拒絕包含路徑遍歷的 directory 參數', () => {
    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'listFlows',
      params: { directory: '../other' },
      id: 'test-8',
    };

    const response = handleListFlows(request);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('test-8');
    expect(response.result).toBeUndefined();
    expect(response.error?.code).toBe(-32602);
    expect(response.error?.message).toContain('無效的目錄參數');
  });

  it('應該拒絕絕對路徑的 directory 參數', () => {
    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'listFlows',
      params: { directory: '/absolute/path' },
      id: 'test-9',
    };

    const response = handleListFlows(request);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('test-9');
    expect(response.result).toBeUndefined();
    expect(response.error?.code).toBe(-32602);
  });

  it('應該拒絕包含非法字符的 prefix 參數', () => {
    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'listFlows',
      params: { prefix: 'test<>' },
      id: 'test-10',
    };

    const response = handleListFlows(request);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('test-10');
    expect(response.result).toBeUndefined();
    expect(response.error?.code).toBe(-32602);
    expect(response.error?.message).toContain('參數驗證失敗');
  });

  it('應該拒絕空的 filename 參數', () => {
    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'listFlows',
      params: { filename: '  ' },
      id: 'test-11',
    };

    const response = handleListFlows(request);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('test-11');
    expect(response.result).toBeUndefined();
    expect(response.error?.code).toBe(-32602);
  });

  it('應該正確處理沒有 id 的請求', () => {
    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'listFlows',
    };

    const response = handleListFlows(request);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(null);
    expect(Array.isArray(response.result)).toBe(true);
  });

  it('應該正確識別不同的檔案副檔名', () => {
    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'listFlows',
      id: 'test-12',
    };

    const response = handleListFlows(request);

    const files = response.result as any[];
    const extensions = files.map(f => f.extension).sort();
    expect(extensions).toEqual(['yaml', 'yaml', 'yaml', 'yml']);
  });


  it('應該處理包含控制字符的參數', () => {
    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'listFlows',
      params: { prefix: 'test\x00' }, // 包含 null 控制字符
      id: 'test-control-char',
    };

    const response = handleListFlows(request);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('test-control-char');
    expect(response.result).toBeUndefined();
    expect(response.error?.code).toBe(-32602);
    expect(response.error?.message).toContain('參數驗證失敗');
  });
});