import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenManager } from '../src/token-manager.js';

describe('TokenManager', () => {
  let tokenManager: TokenManager;

  beforeEach(() => {
    tokenManager = new TokenManager();
  });

  describe('基本 Token 管理', () => {
    it('應該儲存和取得 Token', () => {
      const token = 'test-token-123';

      tokenManager.setToken(token);
      const retrievedToken = tokenManager.getToken();

      expect(retrievedToken).toBe(token);
    });

    it('應該支援命名空間', () => {
      const userToken = 'user-token';
      const adminToken = 'admin-token';

      tokenManager.setToken(userToken, 'user');
      tokenManager.setToken(adminToken, 'admin');

      expect(tokenManager.getToken('user')).toBe(userToken);
      expect(tokenManager.getToken('admin')).toBe(adminToken);
      expect(tokenManager.getToken()).toBeNull(); // default namespace
    });

    it('應該移除 Token', () => {
      tokenManager.setToken('test-token');

      const removed = tokenManager.removeToken();
      expect(removed).toBe(true);
      expect(tokenManager.getToken()).toBeNull();
    });

    it('應該清除所有 Token', () => {
      tokenManager.setToken('token1', 'namespace1');
      tokenManager.setToken('token2', 'namespace2');

      tokenManager.clearAllTokens();

      expect(tokenManager.getToken('namespace1')).toBeNull();
      expect(tokenManager.getToken('namespace2')).toBeNull();
      expect(tokenManager.getNamespaces()).toHaveLength(0);
    });
  });

  describe('Token 過期處理', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('應該設定過期時間', () => {
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour
      tokenManager.setToken('test-token', 'default', expiresAt);

      const tokenInfo = tokenManager.getTokenInfo();
      expect(tokenInfo?.expiresAt).toBe(expiresAt.toISOString());
    });

    it('應該返回未過期的 Token', () => {
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour
      tokenManager.setToken('test-token', 'default', expiresAt);

      const token = tokenManager.getToken();
      expect(token).toBe('test-token');
    });

    it('應該拒絕已過期的 Token', () => {
      const expiresAt = new Date(Date.now() + 1000); // 1 second
      tokenManager.setToken('test-token', 'default', expiresAt);

      // 快進時間到過期後
      vi.advanceTimersByTime(2000);

      const token = tokenManager.getToken();
      expect(token).toBeNull();
    });

    it('應該自動清除過期的 Token', () => {
      const expiresAt = new Date(Date.now() + 1000);
      tokenManager.setToken('test-token', 'default', expiresAt);

      vi.advanceTimersByTime(2000);
      tokenManager.getToken(); // 觸發過期檢查

      expect(tokenManager.getNamespaces()).toHaveLength(0);
    });
  });

  describe('Token 驗證', () => {
    it('應該拒絕無效的 Token', () => {
      expect(() => tokenManager.setToken('')).toThrow('Token 必須是非空字串');
      expect(() => tokenManager.setToken(null as any)).toThrow('Token 必須是非空字串');
      expect(() => tokenManager.setToken(undefined as any)).toThrow('Token 必須是非空字串');
    });

    it('應該檢查 Token 有效性', () => {
      expect(tokenManager.hasValidToken()).toBe(false);

      tokenManager.setToken('valid-token');
      expect(tokenManager.hasValidToken()).toBe(true);
    });
  });

  describe('Authorization Header 注入', () => {
    it('應該注入 Authorization header', () => {
      tokenManager.setToken('bearer-token');

      const headers = tokenManager.injectAuthHeader({
        'content-type': 'application/json',
      });

      expect(headers).toEqual({
        'content-type': 'application/json',
        'Authorization': 'Bearer bearer-token',
      });
    });

    it('應該處理空 headers', () => {
      tokenManager.setToken('bearer-token');

      const headers = tokenManager.injectAuthHeader();
      expect(headers).toEqual({
        'Authorization': 'Bearer bearer-token',
      });
    });

    it('無 Token 時應該跳過注入', () => {
      const originalHeaders = {
        'content-type': 'application/json',
      };

      const headers = tokenManager.injectAuthHeader(originalHeaders);
      expect(headers).toEqual(originalHeaders);
    });

    it('應該支援指定命名空間', () => {
      tokenManager.setToken('admin-token', 'admin');

      const headers = tokenManager.injectAuthHeader({}, 'admin');
      expect(headers['Authorization']).toBe('Bearer admin-token');
    });
  });

  describe('Token 提取', () => {
    it('應該從回應中提取 Token', () => {
      const response = {
        token: 'extracted-token',
        user: { id: 1, name: 'test' },
      };

      const token = tokenManager.extractTokenFromResponse(response, 'token');
      expect(token).toBe('extracted-token');
      expect(tokenManager.getToken()).toBe('extracted-token');
    });

    it('應該支援深層路徑提取', () => {
      const response = {
        data: {
          auth: {
            token: 'deep-token',
          },
        },
      };

      const token = tokenManager.extractTokenFromResponse(response, 'data.auth.token');
      expect(token).toBe('deep-token');
    });

    it('應該處理提取失敗', () => {
      const response = {
        user: { id: 1, name: 'test' },
      };

      const token = tokenManager.extractTokenFromResponse(response, 'nonexistent.token');
      expect(token).toBeNull();
    });

    it('應該設定過期時間', () => {
      const response = { token: 'timed-token' };
      const expiresIn = 3600; // 1 hour

      tokenManager.extractTokenFromResponse(response, 'token', 'default', expiresIn);

      const tokenInfo = tokenManager.getTokenInfo();
      expect(tokenInfo?.hasToken).toBe(true);
      expect(tokenInfo?.expiresAt).toBeDefined();
    });
  });

  describe('靜態 Token 載入', () => {
    it('應該載入靜態 Token', () => {
      tokenManager.loadStaticToken('static-token');
      expect(tokenManager.getToken()).toBe('static-token');
    });

    it('應該處理空的靜態 Token', () => {
      tokenManager.loadStaticToken('');
      expect(tokenManager.getToken()).toBeNull();
    });

    it('應該支援過期時間', () => {
      tokenManager.loadStaticToken('static-token', 'default', 3600);

      const tokenInfo = tokenManager.getTokenInfo();
      expect(tokenInfo?.hasToken).toBe(true);
      expect(tokenInfo?.expiresAt).toBeDefined();
    });
  });

  describe('Token 資訊查詢', () => {
    it('應該返回 Token 資訊', () => {
      const expiresAt = new Date(Date.now() + 3600000);
      tokenManager.setToken('info-token', 'test', expiresAt);

      const info = tokenManager.getTokenInfo('test');
      expect(info).toEqual({
        namespace: 'test',
        hasToken: true,
        isExpired: false,
        expiresAt: expiresAt.toISOString(),
      });
    });

    it('應該返回所有 Token 資訊', () => {
      tokenManager.setToken('token1', 'ns1');
      tokenManager.setToken('token2', 'ns2');

      const allInfo = tokenManager.getAllTokensInfo();
      expect(allInfo).toHaveLength(2);
      expect(allInfo.map(info => info.namespace)).toEqual(['ns1', 'ns2']);
    });

    it('應該返回空資訊當 Token 不存在', () => {
      const info = tokenManager.getTokenInfo('nonexistent');
      expect(info).toBeNull();
    });
  });

  describe('命名空間管理', () => {
    it('應該返回所有命名空間', () => {
      tokenManager.setToken('token1', 'namespace1');
      tokenManager.setToken('token2', 'namespace2');
      tokenManager.setToken('token3', 'namespace3');

      const namespaces = tokenManager.getNamespaces();
      expect(namespaces).toEqual(['namespace1', 'namespace2', 'namespace3']);
    });

    it('應該處理移除後的命名空間變更', () => {
      tokenManager.setToken('token1', 'namespace1');
      tokenManager.setToken('token2', 'namespace2');

      tokenManager.removeToken('namespace1');

      const namespaces = tokenManager.getNamespaces();
      expect(namespaces).toEqual(['namespace2']);
    });
  });
});