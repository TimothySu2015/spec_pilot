import { describe, it, expect } from 'vitest';
import { exportToYaml } from '../src/utils/export-yaml';
import YAML from 'yaml';

describe('exportToYaml', () => {
  it('應該產生格式正確的 YAML', () => {
    const flow = {
      name: '測試流程',
      baseUrl: 'http://localhost:3000',
      variables: {
        username: 'admin',
        password: '123456',
      },
      steps: [
        {
          name: '登入',
          request: {
            method: 'POST',
            path: '/auth/login',
          },
          expect: {
            statusCode: 200,
          },
        },
      ],
    };

    const yaml = exportToYaml(flow as any);

    // 驗證可以被解析回來
    const parsed = YAML.parse(yaml);
    expect(parsed).toEqual(flow);
  });

  it('應該保持數字字串為字串型別', () => {
    const flow = {
      name: '測試',
      baseUrl: 'http://localhost',
      variables: {
        password: '123456',
        port: '8080',
      },
      steps: [],
    };

    const yaml = exportToYaml(flow as any);

    expect(yaml).toContain("password: '123456'");
    expect(yaml).toContain("port: '8080'");
  });

  it('應該使用一致的縮排', () => {
    const flow = {
      name: '測試',
      baseUrl: 'http://localhost',
      steps: [
        {
          name: '步驟',
          request: {
            method: 'GET',
            path: '/api',
          },
          expect: {
            statusCode: 200,
          },
        },
      ],
    };

    const yaml = exportToYaml(flow as any);
    const lines = yaml.split('\n');

    // 檢查縮排格式
    expect(lines.some((line) => line.match(/^  - name:/))).toBe(true);
    expect(lines.some((line) => line.match(/^    request:/))).toBe(true);
  });
});
