/**
 * 認證設定整合測試
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthConfigManager, getAuthConfigManager, resetConfigCache } from '@specpilot/config';

describe('認證設定整合測試', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    resetConfigCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetConfigCache();
  });

  describe('環境變數整合', () => {
    it('應該從環境變數載入多個命名空間 Token', () => {
      // 設定多個環境變數
      process.env.SPEC_PILOT_TOKEN_API_V1 = 'token_api_v1';
      process.env.SPEC_PILOT_TOKEN_USER_SERVICE = 'token_user_service';
      process.env.SPEC_PILOT_TOKEN_EXTERNAL = 'token_external';

      const manager = new AuthConfigManager();
      const staticTokens = manager.getStaticTokens();

      expect(staticTokens).toHaveLength(3);

      const apiV1Token = staticTokens.find(t => t.namespace === 'api_v1');
      const userServiceToken = staticTokens.find(t => t.namespace === 'user_service');
      const externalToken = staticTokens.find(t => t.namespace === 'external');

      expect(apiV1Token?.token).toBe('token_api_v1');
      expect(userServiceToken?.token).toBe('token_user_service');
      expect(externalToken?.token).toBe('token_external');
    });

    it('應該從環境變數載入認證設定', () => {
      process.env.SPEC_PILOT_AUTH_DEFAULT_EXPIRY = '7200';
      process.env.SPEC_PILOT_AUTH_RETRY_ON_FAILURE = 'api_v1,user_service';

      const manager = new AuthConfigManager();

      expect(manager.getDefaultExpirySeconds()).toBe(7200);
      expect(manager.getNamespaceConfig('api_v1').retryOnAuthFailure).toBe(true);
      expect(manager.getNamespaceConfig('user_service').retryOnAuthFailure).toBe(true);
      expect(manager.getNamespaceConfig('other_service').retryOnAuthFailure).toBe(false);
    });

    it('應該處理無效的環境變數', () => {
      process.env.SPEC_PILOT_AUTH_DEFAULT_EXPIRY = 'invalid_number';
      process.env.SPEC_PILOT_AUTH_RETRY_ON_FAILURE = ''; // 空字串

      const manager = new AuthConfigManager();

      // 無效數字應該使用預設值
      expect(manager.getDefaultExpirySeconds()).toBe(3600);

      // 空字串應該不影響設定
      expect(manager.getNamespaceConfig('any_service').retryOnAuthFailure).toBe(false);
    });
  });

  describe('設定驗證整合', () => {
    it('應該檢測到各種設定錯誤', () => {
      const manager = new AuthConfigManager();

      // 新增有問題的設定
      manager.setStaticToken({
        namespace: '',
        token: 'valid_token'
      });

      manager.setStaticToken({
        namespace: 'valid_namespace',
        token: ''
      });

      manager.setStaticToken({
        namespace: 'invalid_expiry',
        token: 'valid_token',
        expiresInSeconds: -1
      });

      manager.setStaticToken({
        namespace: 'missing_env',
        token: '${DEFINITELY_MISSING_ENV_VAR}'
      });

      const validation = manager.validate();

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('靜態 Token 的命名空間不能為空');
      expect(validation.errors).toContain('命名空間 "valid_namespace" 的 Token 值不能為空');
      expect(validation.errors).toContain('命名空間 "invalid_expiry" 的過期時間必須是正整數');
      expect(validation.errors).toContain('命名空間 "missing_env" 的 Token 值無法解析');
    });

    it('應該通過有效設定的驗證', () => {
      process.env.TEST_TOKEN = 'env_token_value';

      const manager = new AuthConfigManager();

      manager.setStaticToken({
        namespace: 'service_a',
        token: 'direct_token',
        expiresInSeconds: 3600
      });

      manager.setStaticToken({
        namespace: 'service_b',
        token: '${TEST_TOKEN}',
        expiresInSeconds: 7200
      });

      const validation = manager.validate();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('設定覆寫與優先級', () => {
    it('應該正確處理環境變數覆寫靜態設定', () => {
      const initialConfig = {
        static: [
          {
            namespace: 'api_v1',
            token: 'config_token',
            expiresInSeconds: 3600
          }
        ]
      };

      // 設定環境變數
      process.env.SPEC_PILOT_TOKEN_API_V1 = 'env_override_token';

      const manager = new AuthConfigManager(initialConfig);
      const staticToken = manager.getStaticToken('api_v1');

      // 環境變數應該覆寫初始設定
      expect(staticToken?.token).toBe('env_override_token');
      expect(staticToken?.expiresInSeconds).toBe(3600); // 保持原有過期時間
    });

    it('應該合併命名空間設定', () => {
      const initialConfig = {
        namespaces: {
          'api_v1': {
            description: 'API v1 服務',
            retryOnAuthFailure: false
          }
        }
      };

      // 環境變數設定重試
      process.env.SPEC_PILOT_AUTH_RETRY_ON_FAILURE = 'api_v1,api_v2';

      const manager = new AuthConfigManager(initialConfig);

      const apiV1Config = manager.getNamespaceConfig('api_v1');
      const apiV2Config = manager.getNamespaceConfig('api_v2');

      expect(apiV1Config.description).toBe('API v1 服務');
      expect(apiV1Config.retryOnAuthFailure).toBe(true); // 環境變數覆寫
      expect(apiV2Config.retryOnAuthFailure).toBe(true); // 環境變數新增
    });
  });

  describe('Token 解析與格式處理', () => {
    it('應該正確解析環境變數格式的 Token', () => {
      process.env.MY_API_TOKEN = 'actual_token_value';
      process.env.NESTED_TOKEN = '${MY_API_TOKEN}'; // 巢狀引用（不支援）

      const manager = new AuthConfigManager();

      const directResolve = manager.resolveTokenValue('direct_token');
      const envResolve = manager.resolveTokenValue('${MY_API_TOKEN}');
      const missingResolve = manager.resolveTokenValue('${MISSING_VAR}');
      const nestedResolve = manager.resolveTokenValue('${NESTED_TOKEN}');

      expect(directResolve).toBe('direct_token');
      expect(envResolve).toBe('actual_token_value');
      expect(missingResolve).toBeNull();
      expect(nestedResolve).toBe('${MY_API_TOKEN}'); // 不解析巢狀引用
    });

    it('應該處理特殊字元與格式', () => {
      process.env.SPECIAL_TOKEN = 'token-with-special_chars.123!@#';
      process.env.BEARER_TOKEN = 'Bearer actual_bearer_token';

      const manager = new AuthConfigManager();

      const specialResolve = manager.resolveTokenValue('${SPECIAL_TOKEN}');
      const bearerResolve = manager.resolveTokenValue('${BEARER_TOKEN}');

      expect(specialResolve).toBe('token-with-special_chars.123!@#');
      expect(bearerResolve).toBe('Bearer actual_bearer_token');
    });
  });

  describe('配置管理生命週期', () => {
    it('應該支援動態設定更新', () => {
      const manager = new AuthConfigManager();

      // 初始設定
      manager.setStaticToken({
        namespace: 'service',
        token: 'initial_token',
        expiresInSeconds: 3600
      });

      expect(manager.getStaticToken('service')?.token).toBe('initial_token');

      // 更新設定
      manager.setStaticToken({
        namespace: 'service',
        token: 'updated_token',
        expiresInSeconds: 7200
      });

      expect(manager.getStaticToken('service')?.token).toBe('updated_token');
      expect(manager.getStaticToken('service')?.expiresInSeconds).toBe(7200);

      // 移除設定
      const removed = manager.removeStaticToken('service');
      expect(removed).toBe(true);
      expect(manager.getStaticToken('service')).toBeUndefined();
    });

    it('應該支援設定重設', () => {
      process.env.SPEC_PILOT_TOKEN_TEST = 'test_token';

      const manager = new AuthConfigManager();

      manager.setStaticToken({
        namespace: 'manual',
        token: 'manual_token'
      });

      manager.setDefaultExpirySeconds(7200);

      // 驗證設定已載入
      expect(manager.getStaticTokens().length).toBeGreaterThan(0);
      expect(manager.getDefaultExpirySeconds()).toBe(7200);

      // 重設設定
      manager.reset();

      // 驗證重設後的狀態
      const tokensAfterReset = manager.getStaticTokens();
      expect(tokensAfterReset.some(t => t.namespace === 'manual')).toBe(false);
      expect(tokensAfterReset.some(t => t.namespace === 'test')).toBe(true); // 環境變數仍會載入
      expect(manager.getDefaultExpirySeconds()).toBe(3600); // 回到預設值
    });
  });

  describe('整合應用情境', () => {
    it('應該模擬完整的生產環境設定', () => {
      // 模擬生產環境變數
      process.env.SPEC_PILOT_TOKEN_API_GATEWAY = 'prod_gateway_token';
      process.env.SPEC_PILOT_TOKEN_USER_SERVICE = 'prod_user_token';
      process.env.SPEC_PILOT_TOKEN_PAYMENT_SERVICE = 'prod_payment_token';
      process.env.SPEC_PILOT_AUTH_DEFAULT_EXPIRY = '3600';
      process.env.SPEC_PILOT_AUTH_RETRY_ON_FAILURE = 'api_gateway,payment_service';

      const manager = getAuthConfigManager();
      const staticTokens = manager.getStaticTokens();

      // 驗證所有服務 Token 都已載入
      expect(staticTokens).toHaveLength(3);
      expect(staticTokens.find(t => t.namespace === 'api_gateway')?.token).toBe('prod_gateway_token');
      expect(staticTokens.find(t => t.namespace === 'user_service')?.token).toBe('prod_user_token');
      expect(staticTokens.find(t => t.namespace === 'payment_service')?.token).toBe('prod_payment_token');

      // 驗證重試設定
      expect(manager.getNamespaceConfig('api_gateway').retryOnAuthFailure).toBe(true);
      expect(manager.getNamespaceConfig('payment_service').retryOnAuthFailure).toBe(true);
      expect(manager.getNamespaceConfig('user_service').retryOnAuthFailure).toBe(false);

      // 驗證所有設定有效
      const validation = manager.validate();
      expect(validation.isValid).toBe(true);
    });
  });
});