import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenManager } from '@specpilot/http-runner';
import { AuthHandler } from '../src/auth-handler.js';
import type { IFlowStep, IStaticAuth } from '@specpilot/flow-parser';

// Mock TokenManager
vi.mock('@specpilot/http-runner', () => ({
  TokenManager: vi.fn().mockImplementation(() => ({
    extractTokenFromResponse: vi.fn(),
    loadStaticToken: vi.fn(),
    hasValidToken: vi.fn(),
    injectAuthHeader: vi.fn(),
    getTokenInfo: vi.fn(),
    getAllTokensInfo: vi.fn(),
    removeToken: vi.fn(),
    clearAllTokens: vi.fn(),
  }))
}));

describe('AuthHandler', () => {
  let authHandler: AuthHandler;
  let mockTokenManager: jest.Mocked<TokenManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTokenManager = new TokenManager() as jest.Mocked<TokenManager>;
    authHandler = new AuthHandler(mockTokenManager);
  });

  describe('handleStepAuth', () => {
    it('應該成功處理登入類型認證', async () => {
      const step: IFlowStep = {
        name: 'login_step',
        request: { method: 'POST' as any, path: '/auth/login' },
        expectations: {},
        auth: {
          type: 'login',
          tokenExtraction: {
            path: 'data.token',
            expiresIn: 3600,
            namespace: 'api_v1'
          }
        }
      };

      const response = {
        data: { token: 'test_token_value' }
      };

      mockTokenManager.extractTokenFromResponse.mockReturnValue('test_token_value');

      const result = await authHandler.handleStepAuth(step, response, 'exec_123');

      expect(result.success).toBe(true);
      expect(mockTokenManager.extractTokenFromResponse).toHaveBeenCalledWith(
        response,
        'data.token',
        'api_v1',
        3600
      );
    });

    it('應該處理登入認證的 Token 提取失敗', async () => {
      const step: IFlowStep = {
        name: 'login_step',
        request: { method: 'POST' as any, path: '/auth/login' },
        expectations: {},
        auth: {
          type: 'login',
          tokenExtraction: {
            path: 'data.token'
          }
        }
      };

      mockTokenManager.extractTokenFromResponse.mockReturnValue(null);

      const result = await authHandler.handleStepAuth(step, {}, 'exec_123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('無法從回應中提取 Token');
    });

    it('應該成功處理靜態類型認證', async () => {
      const step: IFlowStep = {
        name: 'api_call',
        request: { method: 'GET' as any, path: '/users' },
        expectations: {},
        auth: {
          type: 'static',
          namespace: 'external_api'
        }
      };

      mockTokenManager.hasValidToken.mockReturnValue(true);

      const result = await authHandler.handleStepAuth(step, undefined, 'exec_123');

      expect(result.success).toBe(true);
      expect(mockTokenManager.hasValidToken).toHaveBeenCalledWith('external_api');
    });

    it('應該處理靜態認證的 Token 缺失', async () => {
      const step: IFlowStep = {
        name: 'api_call',
        request: { method: 'GET' as any, path: '/users' },
        expectations: {},
        auth: {
          type: 'static',
          namespace: 'missing_api'
        }
      };

      mockTokenManager.hasValidToken.mockReturnValue(false);

      const result = await authHandler.handleStepAuth(step, undefined, 'exec_123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Token 不存在或已過期');
    });

    it('應該返回成功如果步驟沒有認證設定', async () => {
      const step: IFlowStep = {
        name: 'public_api',
        request: { method: 'GET' as any, path: '/public' },
        expectations: {}
      };

      const result = await authHandler.handleStepAuth(step, undefined, 'exec_123');

      expect(result.success).toBe(true);
    });
  });

  describe('loadGlobalStaticAuth', () => {
    it('應該成功載入靜態認證設定', async () => {
      const staticConfigs: IStaticAuth[] = [
        {
          namespace: 'api_v1',
          token: 'static_token_1',
          expiresInSeconds: 3600
        },
        {
          namespace: 'api_v2',
          token: 'static_token_2'
        }
      ];

      const results = await authHandler.loadGlobalStaticAuth(staticConfigs, 'exec_123');

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockTokenManager.loadStaticToken).toHaveBeenCalledTimes(2);
    });

    it('應該處理環境變數格式的 Token', async () => {
      const staticConfigs: IStaticAuth[] = [
        {
          namespace: 'api_v1',
          token: '${TEST_TOKEN}',
          expiresInSeconds: 3600
        }
      ];

      // 設定環境變數
      process.env.TEST_TOKEN = 'env_token_value';

      const results = await authHandler.loadGlobalStaticAuth(staticConfigs, 'exec_123');

      expect(results[0].success).toBe(true);
      expect(mockTokenManager.loadStaticToken).toHaveBeenCalledWith(
        'env_token_value',
        'api_v1',
        3600
      );

      // 清理環境變數
      delete process.env.TEST_TOKEN;
    });

    it('應該處理環境變數未設定的情況', async () => {
      const staticConfigs: IStaticAuth[] = [
        {
          namespace: 'api_v1',
          token: '${MISSING_TOKEN}'
        }
      ];

      const results = await authHandler.loadGlobalStaticAuth(staticConfigs, 'exec_123');

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('環境變數 MISSING_TOKEN 未設定');
    });
  });

  describe('injectAuthHeaders', () => {
    it('應該注入認證 Header', () => {
      const headers = { 'Content-Type': 'application/json' };
      const expectedHeaders = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test_token'
      };

      mockTokenManager.injectAuthHeader.mockReturnValue(expectedHeaders);

      const result = authHandler.injectAuthHeaders(headers, 'api_v1');

      expect(result).toEqual(expectedHeaders);
      expect(mockTokenManager.injectAuthHeader).toHaveBeenCalledWith(headers, 'api_v1');
    });
  });

  describe('Token 狀態管理', () => {
    it('應該取得 Token 狀態', () => {
      const mockTokenInfo = {
        hasToken: true,
        isExpired: false,
        expiresAt: '2025-01-01T00:00:00.000Z'
      };

      mockTokenManager.getTokenInfo.mockReturnValue(mockTokenInfo);

      const result = authHandler.getTokenStatus('api_v1');

      expect(result).toEqual({
        hasToken: true,
        isExpired: false,
        expiresAt: '2025-01-01T00:00:00.000Z'
      });
    });

    it('應該取得所有 Token 狀態', () => {
      const mockTokensInfo = [
        { namespace: 'api_v1', hasToken: true, isExpired: false },
        { namespace: 'api_v2', hasToken: true, isExpired: true }
      ];

      mockTokenManager.getAllTokensInfo.mockReturnValue(mockTokensInfo);

      const result = authHandler.getAllTokensStatus();

      expect(result).toEqual(mockTokensInfo);
    });

    it('應該清除指定命名空間的 Token', () => {
      mockTokenManager.removeToken.mockReturnValue(true);

      const result = authHandler.clearToken('api_v1');

      expect(result).toBe(true);
      expect(mockTokenManager.removeToken).toHaveBeenCalledWith('api_v1');
    });

    it('應該清除所有 Token', () => {
      authHandler.clearAllTokens();

      expect(mockTokenManager.clearAllTokens).toHaveBeenCalled();
    });
  });
});