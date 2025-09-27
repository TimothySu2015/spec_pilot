import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  getConfig, 
  getBaseUrl, 
  getPort, 
  getToken, 
  resetConfigCache,
  overrideConfig,
  type ISpecPilotConfig 
} from '../src/index.js';

describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetConfigCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetConfigCache();
  });

  describe('getConfig', () => {
    it('應該回傳預設設定值', () => {
      delete process.env.SPEC_PILOT_BASE_URL;
      delete process.env.SPEC_PILOT_PORT;
      delete process.env.SPEC_PILOT_TOKEN;

      const config = getConfig();
      
      expect(config).toEqual({
        baseUrl: undefined,
        port: 443,
        token: undefined,
        environment: 'test', // 測試環境下 NODE_ENV 會是 'test'
        auth: {
          static: [],
          namespaces: {},
          defaultExpirySeconds: 3600
        }
      });
    });

    it('應該從環境變數載入設定', () => {
      process.env.SPEC_PILOT_BASE_URL = 'https://api.example.com';
      process.env.SPEC_PILOT_PORT = '8080';
      process.env.SPEC_PILOT_TOKEN = 'test-token';
      process.env.NODE_ENV = 'production';

      const config = getConfig();
      
      expect(config).toEqual({
        baseUrl: 'https://api.example.com',
        port: 8080,
        token: 'test-token',
        environment: 'production',
        auth: {
          static: [],
          namespaces: {},
          defaultExpirySeconds: 3600
        }
      });
    });

    it('應該快取設定值', () => {
      process.env.SPEC_PILOT_BASE_URL = 'https://api.example.com';
      
      const config1 = getConfig();
      
      // 修改環境變數不會影響已快取的設定
      process.env.SPEC_PILOT_BASE_URL = 'https://api2.example.com';
      const config2 = getConfig();
      
      expect(config1).toEqual(config2);
    });
  });

  describe('getBaseUrl', () => {
    it('應該回傳 baseUrl', () => {
      process.env.SPEC_PILOT_BASE_URL = 'https://api.example.com';
      
      expect(getBaseUrl()).toBe('https://api.example.com');
    });

    it('當 baseUrl 未設定時應該回傳 undefined', () => {
      delete process.env.SPEC_PILOT_BASE_URL;
      
      expect(getBaseUrl()).toBeUndefined();
    });
  });

  describe('getPort', () => {
    it('應該回傳設定的埠號', () => {
      process.env.SPEC_PILOT_PORT = '3000';
      
      expect(getPort()).toBe(3000);
    });

    it('應該回傳預設埠號', () => {
      delete process.env.SPEC_PILOT_PORT;
      
      expect(getPort()).toBe(443);
    });
  });

  describe('getToken', () => {
    it('應該回傳設定的 token', () => {
      process.env.SPEC_PILOT_TOKEN = 'test-token';
      
      expect(getToken()).toBe('test-token');
    });

    it('當 token 未設定時應該回傳 undefined', () => {
      delete process.env.SPEC_PILOT_TOKEN;
      
      expect(getToken()).toBeUndefined();
    });
  });

  describe('overrideConfig', () => {
    it('應該覆寫設定值', () => {
      process.env.SPEC_PILOT_BASE_URL = 'https://api.example.com';
      process.env.SPEC_PILOT_PORT = '443';
      
      const originalConfig = getConfig();
      expect(originalConfig.port).toBe(443);
      
      overrideConfig({ port: 8080 });
      
      const overriddenConfig = getConfig();
      expect(overriddenConfig.port).toBe(8080);
      expect(overriddenConfig.baseUrl).toBe('https://api.example.com'); // 其他值保持不變
    });

    it('應該驗證覆寫的設定值', () => {
      expect(() => {
        overrideConfig({ port: -1 });
      }).toThrow();
    });
  });
});