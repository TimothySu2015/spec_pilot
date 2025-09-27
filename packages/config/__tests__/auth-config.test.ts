import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthConfigManager } from '../src/auth-config.js';

describe('AuthConfigManager', () => {
  let authConfigManager: AuthConfigManager;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // 備份原始環境變數
    originalEnv = { ...process.env };
    authConfigManager = new AuthConfigManager();
  });

  afterEach(() => {
    // 還原環境變數
    process.env = originalEnv;
  });

  describe('基本功能', () => {
    it('應該初始化預設設定', () => {
      const config = authConfigManager.getConfig();

      expect(config).toEqual({
        static: [],
        namespaces: {},
        defaultExpirySeconds: 3600
      });
    });

    it('應該設定和取得靜態 Token', () => {
      const staticToken = {
        namespace: 'api_v1',
        token: 'test_token',
        expiresInSeconds: 7200
      };

      authConfigManager.setStaticToken(staticToken);

      const retrieved = authConfigManager.getStaticToken('api_v1');
      expect(retrieved).toEqual(staticToken);

      const allTokens = authConfigManager.getStaticTokens();
      expect(allTokens).toHaveLength(1);
      expect(allTokens[0]).toEqual(staticToken);
    });

    it('應該移除靜態 Token', () => {
      const staticToken = {
        namespace: 'api_v1',
        token: 'test_token'
      };

      authConfigManager.setStaticToken(staticToken);
      expect(authConfigManager.getStaticToken('api_v1')).toEqual(staticToken);

      const removed = authConfigManager.removeStaticToken('api_v1');
      expect(removed).toBe(true);
      expect(authConfigManager.getStaticToken('api_v1')).toBeUndefined();

      const removedAgain = authConfigManager.removeStaticToken('api_v1');
      expect(removedAgain).toBe(false);
    });

    it('應該更新現有的靜態 Token', () => {
      const initialToken = {
        namespace: 'api_v1',
        token: 'initial_token'
      };

      const updatedToken = {
        namespace: 'api_v1',
        token: 'updated_token',
        expiresInSeconds: 3600
      };

      authConfigManager.setStaticToken(initialToken);
      authConfigManager.setStaticToken(updatedToken);

      const tokens = authConfigManager.getStaticTokens();
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toEqual(updatedToken);
    });
  });

  describe('命名空間設定', () => {
    it('應該設定和取得命名空間配置', () => {
      const namespaceConfig = {
        retryOnAuthFailure: true,
        description: 'API v1 服務'
      };

      authConfigManager.setNamespaceConfig('api_v1', namespaceConfig);

      const retrieved = authConfigManager.getNamespaceConfig('api_v1');
      expect(retrieved).toEqual(namespaceConfig);
    });

    it('應該返回預設命名空間配置', () => {
      const defaultConfig = authConfigManager.getNamespaceConfig('non_existent');
      expect(defaultConfig).toEqual({
        retryOnAuthFailure: false
      });
    });
  });

  describe('預設過期時間', () => {
    it('應該設定和取得預設過期時間', () => {
      authConfigManager.setDefaultExpirySeconds(7200);
      expect(authConfigManager.getDefaultExpirySeconds()).toBe(7200);
    });

    it('應該拒絕非正整數的過期時間', () => {
      expect(() => {
        authConfigManager.setDefaultExpirySeconds(0);
      }).toThrow('預設過期時間必須是正整數');

      expect(() => {
        authConfigManager.setDefaultExpirySeconds(-1);
      }).toThrow('預設過期時間必須是正整數');
    });
  });

  describe('環境變數處理', () => {
    it('應該從環境變數載入預設過期時間', () => {
      process.env.SPEC_PILOT_AUTH_DEFAULT_EXPIRY = '7200';

      const manager = new AuthConfigManager();
      expect(manager.getDefaultExpirySeconds()).toBe(7200);
    });

    it('應該從環境變數載入重試設定', () => {
      process.env.SPEC_PILOT_AUTH_RETRY_ON_FAILURE = 'api_v1,api_v2';

      const manager = new AuthConfigManager();

      expect(manager.getNamespaceConfig('api_v1').retryOnAuthFailure).toBe(true);
      expect(manager.getNamespaceConfig('api_v2').retryOnAuthFailure).toBe(true);
      expect(manager.getNamespaceConfig('api_v3').retryOnAuthFailure).toBe(false);
    });

    it('應該從環境變數載入命名空間 Token', () => {
      process.env.SPEC_PILOT_TOKEN_API_V1 = 'env_token_v1';
      process.env.SPEC_PILOT_TOKEN_API_V2 = 'env_token_v2';

      const manager = new AuthConfigManager();
      const tokens = manager.getStaticTokens();

      expect(tokens).toHaveLength(2);

      const apiV1Token = manager.getStaticToken('api_v1');
      expect(apiV1Token?.token).toBe('env_token_v1');

      const apiV2Token = manager.getStaticToken('api_v2');
      expect(apiV2Token?.token).toBe('env_token_v2');
    });

    it('應該解析環境變數格式的 Token 值', () => {
      process.env.MY_API_TOKEN = 'actual_token_value';

      const resolvedToken = authConfigManager.resolveTokenValue('${MY_API_TOKEN}');
      expect(resolvedToken).toBe('actual_token_value');

      const directToken = authConfigManager.resolveTokenValue('direct_token');
      expect(directToken).toBe('direct_token');

      const missingToken = authConfigManager.resolveTokenValue('${MISSING_TOKEN}');
      expect(missingToken).toBeNull();
    });
  });

  describe('設定驗證', () => {
    it('應該驗證有效的設定', () => {
      authConfigManager.setStaticToken({
        namespace: 'api_v1',
        token: 'valid_token',
        expiresInSeconds: 3600
      });

      const validation = authConfigManager.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('應該檢測空命名空間', () => {
      authConfigManager.setStaticToken({
        namespace: '',
        token: 'valid_token'
      });

      const validation = authConfigManager.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('靜態 Token 的命名空間不能為空');
    });

    it('應該檢測空 Token 值', () => {
      authConfigManager.setStaticToken({
        namespace: 'api_v1',
        token: ''
      });

      const validation = authConfigManager.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('命名空間 "api_v1" 的 Token 值不能為空');
    });

    it('應該檢測無效的過期時間', () => {
      authConfigManager.setStaticToken({
        namespace: 'api_v1',
        token: 'valid_token',
        expiresInSeconds: -1
      });

      const validation = authConfigManager.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('命名空間 "api_v1" 的過期時間必須是正整數');
    });

    it('應該檢測重複的命名空間', () => {
      // 新建一個帶有重複命名空間的設定管理器
      const duplicateConfig = {
        static: [
          { namespace: 'api_v1', token: 'token1' },
          { namespace: 'api_v1', token: 'token2' }
        ]
      };

      const managerWithDuplicates = new AuthConfigManager(duplicateConfig);
      const validation = managerWithDuplicates.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('命名空間 "api_v1" 出現重複設定');
    });

    it('應該檢測無法解析的環境變數 Token', () => {
      authConfigManager.setStaticToken({
        namespace: 'api_v1',
        token: '${MISSING_ENV_VAR}'
      });

      const validation = authConfigManager.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('命名空間 "api_v1" 的 Token 值無法解析');
    });
  });

  describe('重設功能', () => {
    it('應該重設所有設定', () => {
      authConfigManager.setStaticToken({
        namespace: 'api_v1',
        token: 'test_token'
      });
      authConfigManager.setDefaultExpirySeconds(7200);

      authConfigManager.reset();

      expect(authConfigManager.getStaticTokens()).toHaveLength(0);
      expect(authConfigManager.getDefaultExpirySeconds()).toBe(3600);
    });
  });
});