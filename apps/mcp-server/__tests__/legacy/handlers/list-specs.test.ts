import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { handleListSpecs } from '../../src/handlers/list-specs.js';
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

describe('list-specs 處理器', () => {
  const testBaseDir = path.join(process.cwd(), 'test-base');
  const testSpecsDir = path.join(testBaseDir, 'specs');
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();

    // 建立測試基礎目錄
    if (existsSync(testBaseDir)) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
    mkdirSync(testBaseDir, { recursive: true });
    mkdirSync(testSpecsDir, { recursive: true });

    // 建立測試檔案
    writeFileSync(path.join(testSpecsDir, 'api.json'), JSON.stringify({ openapi: '3.0.0' }));
    writeFileSync(path.join(testSpecsDir, 'petstore.yaml'), 'openapi: 3.0.0\ninfo:\n  title: Petstore');
    writeFileSync(path.join(testSpecsDir, 'minimal.yml'), 'openapi: 3.0.0');
    writeFileSync(path.join(testSpecsDir, 'readme.txt'), 'This is not a spec file');
    mkdirSync(path.join(testSpecsDir, 'subdir'));

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

  it('應該成功列出 specs 目錄中的所有規格檔案', () => {
    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'listSpecs',
      id: 'test-1',
    };

    const response = handleListSpecs(request);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('test-1');
    expect(response.error).toBeUndefined();
    expect(Array.isArray(response.result)).toBe(true);

    const files = response.result as any[];
    expect(files).toHaveLength(3);

    const fileNames = files.map(f => f.name).sort();
    expect(fileNames).toEqual(['api.json', 'minimal.yml', 'petstore.yaml']);

    // 檢查檔案屬性
    const jsonFile = files.find(f => f.name === 'api.json');
    expect(jsonFile?.name).toBe('api.json');
    expect(jsonFile?.path).toBe(path.join('specs', 'api.json'));
    expect(jsonFile?.extension).toBe('json');
    expect(typeof jsonFile?.size).toBe('number');

    const yamlFile = files.find(f => f.name === 'petstore.yaml');
    expect(yamlFile?.name).toBe('petstore.yaml');
    expect(yamlFile?.path).toBe(path.join('specs', 'petstore.yaml'));
    expect(yamlFile?.extension).toBe('yaml');
    expect(typeof yamlFile?.size).toBe('number');
  });

  it('應該在沒有符合檔案時回傳空陣列', () => {
    // 清空目錄，只留下非規格檔案
    rmSync(testSpecsDir, { recursive: true, force: true });
    mkdirSync(testSpecsDir, { recursive: true });
    writeFileSync(path.join(testSpecsDir, 'readme.txt'), 'Not a spec file');

    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'listSpecs',
      id: 'test-2',
    };

    const response = handleListSpecs(request);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('test-2');
    expect(response.error).toBeUndefined();
    expect(response.result).toEqual([]);
  });

  it('應該在目錄不存在時回傳錯誤', () => {
    // 刪除測試目錄
    rmSync(testSpecsDir, { recursive: true, force: true });

    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'listSpecs',
      id: 'test-3',
    };

    const response = handleListSpecs(request);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('test-3');
    expect(response.result).toBeUndefined();
    expect(response.error).toEqual({
      code: -32603,
      message: 'specs 目錄不存在',
      data: { code: 'ENOENT' },
    });
  });

  it('應該正確處理沒有 id 的請求', () => {
    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'listSpecs',
    };

    const response = handleListSpecs(request);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(null);
    expect(Array.isArray(response.result)).toBe(true);
  });

  it('應該跳過子目錄而不包含在結果中', () => {
    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'listSpecs',
      id: 'test-4',
    };

    const response = handleListSpecs(request);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe('test-4');
    expect(response.error).toBeUndefined();

    const files = response.result as any[];
    // 不應該包含 subdir
    expect(files.every(f => f.name !== 'subdir')).toBe(true);
  });

  it('應該正確識別不同的檔案副檔名', () => {
    const request: IMcpRequest = {
      jsonrpc: '2.0',
      method: 'listSpecs',
      id: 'test-5',
    };

    const response = handleListSpecs(request);

    const files = response.result as any[];
    const extensions = files.map(f => f.extension).sort();
    expect(extensions).toEqual(['json', 'yaml', 'yml']);
  });


});