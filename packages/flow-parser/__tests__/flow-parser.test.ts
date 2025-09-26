import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FlowParser } from '../src/index.js';
import { readFileSync } from 'fs';

vi.mock('fs');

describe('FlowParser', () => {
  let parser: FlowParser;
  const mockReadFileSync = vi.mocked(readFileSync);

  beforeEach(() => {
    parser = new FlowParser();
    vi.clearAllMocks();
  });

  describe('parseFromFile', () => {
    it('應該解析有效的 YAML 流程檔案', async () => {
      const yamlContent = `
name: Test Flow
description: Test flow description
steps:
  - name: Step 1
    method: GET
    url: /api/test
  - name: Step 2
    method: POST
    url: /api/create
    headers:
      Content-Type: application/json
    body:
      name: test
`;

      mockReadFileSync.mockReturnValue(yamlContent);

      const result = await parser.parseFromFile('/path/to/flow.yaml');

      expect(result.name).toBe('Test Flow');
      expect(result.description).toBe('Test flow description');
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].name).toBe('Step 1');
      expect(result.steps[0].method).toBe('GET');
      expect(result.steps[1].headers).toEqual({ 'Content-Type': 'application/json' });
    });

    it('應該拒絕無效的 YAML 格式', async () => {
      const invalidYaml = `
invalid: yaml
without: required fields
`;

      mockReadFileSync.mockReturnValue(invalidYaml);

      await expect(parser.parseFromFile('/path/to/invalid.yaml'))
        .rejects.toThrow('無效的流程 YAML 格式');
    });
  });

  describe('parseFromString', () => {
    it('應該從字串解析流程', async () => {
      const yamlContent = `
name: String Flow
steps:
  - name: Test Step
    method: PUT
    url: /api/update
`;

      const result = await parser.parseFromString(yamlContent);

      expect(result.name).toBe('String Flow');
      expect(result.steps[0].method).toBe('PUT');
    });
  });
});