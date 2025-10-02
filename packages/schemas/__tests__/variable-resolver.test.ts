import { describe, it, expect } from 'vitest';
import { VariableResolver } from '../src/utils/variable-resolver';

describe('VariableResolver', () => {
  const resolver = new VariableResolver();

  it('應該解析字串中的變數', () => {
    const input = 'Hello {{name}}!';
    const variables = { name: 'World' };

    const result = resolver.resolve(input, variables);
    expect(result).toBe('Hello World!');
  });

  it('應該解析物件中的變數', () => {
    const input = {
      username: '{{user}}',
      password: '{{pwd}}',
      port: 3000,
    };
    const variables = { user: 'admin', pwd: 'secret' };

    const result = resolver.resolve(input, variables);
    expect(result).toEqual({
      username: 'admin',
      password: 'secret',
      port: 3000,
    });
  });

  it('應該解析陣列中的變數', () => {
    const input = ['{{base}}/api', '{{base}}/auth'];
    const variables = { base: 'http://localhost' };

    const result = resolver.resolve(input, variables);
    expect(result).toEqual(['http://localhost/api', 'http://localhost/auth']);
  });

  it('應該保留未定義的變數', () => {
    const input = 'Value: {{undefined_var}}';
    const variables = {};

    const result = resolver.resolve(input, variables);
    expect(result).toBe('Value: {{undefined_var}}');
  });

  it('應該記錄未定義變數的警告', () => {
    const input = {
      url: '{{api_url}}',
      token: '{{auth_token}}',
    };
    const variables = { api_url: 'http://localhost' };

    const result = resolver.resolveWithValidation(input, variables);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].variable).toBe('auth_token');
    expect(result.resolved).toEqual({
      url: 'http://localhost',
      token: '{{auth_token}}',
    });
  });

  it('應該處理巢狀物件的變數解析', () => {
    const input = {
      request: {
        headers: {
          Authorization: 'Bearer {{token}}',
        },
        body: {
          username: '{{user}}',
        },
      },
    };
    const variables = { token: 'abc123', user: 'admin' };

    const result = resolver.resolve(input, variables);
    expect(result).toEqual({
      request: {
        headers: {
          Authorization: 'Bearer abc123',
        },
        body: {
          username: 'admin',
        },
      },
    });
  });
});
