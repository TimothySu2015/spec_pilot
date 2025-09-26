import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpecLoader, type IOpenApiSpec } from '../src/index.js';
import { readFileSync } from 'fs';

vi.mock('fs');

describe('SpecLoader', () => {
  let specLoader: SpecLoader;
  const mockReadFileSync = vi.mocked(readFileSync);

  beforeEach(() => {
    specLoader = new SpecLoader();
    vi.clearAllMocks();
  });

  describe('loadFromFile', () => {
    it('應該載入 JSON 格式的 OpenAPI 規格', async () => {
      const mockSpec: IOpenApiSpec = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
        },
        paths: {
          '/test': {
            get: {
              summary: 'Test endpoint',
            },
          },
        },
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(mockSpec));

      const result = await specLoader.loadFromFile('/path/to/spec.json');

      expect(result).toEqual(mockSpec);
      expect(mockReadFileSync).toHaveBeenCalledWith('/path/to/spec.json', 'utf8');
    });

    it('應該載入 YAML 格式的 OpenAPI 規格', async () => {
      const yamlContent = `
openapi: '3.0.0'
info:
  title: Test API
  version: '1.0.0'
paths:
  /test:
    get:
      summary: Test endpoint
`;

      mockReadFileSync.mockReturnValue(yamlContent);

      const result = await specLoader.loadFromFile('/path/to/spec.yaml');

      expect(result.openapi).toBe('3.0.0');
      expect(result.info.title).toBe('Test API');
      expect(result.paths).toBeDefined();
    });

    it('應該拒絕不支援的檔案格式', async () => {
      await expect(
        specLoader.loadFromFile('/path/to/spec.txt')
      ).rejects.toThrow('不支援的檔案格式');
    });

    it('應該拒絕無效的 OpenAPI 規格', async () => {
      const invalidSpec = {
        invalid: 'spec',
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(invalidSpec));

      await expect(
        specLoader.loadFromFile('/path/to/invalid.json')
      ).rejects.toThrow('無效的 OpenAPI 規格');
    });
  });

  describe('listEndpoints', () => {
    it('應該列出所有端點', () => {
      const spec: IOpenApiSpec = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              summary: 'Get all users',
            },
            post: {
              operationId: 'createUser',
              summary: 'Create user',
            },
          },
          '/users/{id}': {
            get: {
              operationId: 'getUser',
            },
          },
        },
      };

      const endpoints = specLoader.listEndpoints(spec);

      expect(endpoints).toHaveLength(3);
      expect(endpoints[0]).toEqual({
        path: '/users',
        method: 'GET',
        operationId: 'getUsers',
        summary: 'Get all users',
      });
      expect(endpoints[1]).toEqual({
        path: '/users',
        method: 'POST',
        operationId: 'createUser',
        summary: 'Create user',
      });
      expect(endpoints[2]).toEqual({
        path: '/users/{id}',
        method: 'GET',
        operationId: 'getUser',
        summary: undefined,
      });
    });
  });
});