import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { HttpRunner } from '../src/index.js';

describe('HttpRunner', () => {
  let runner: HttpRunner;

  beforeEach(() => {
    runner = new HttpRunner({
      baseUrl: 'https://api.test.com',
      http: { timeout: 5000 },
      retry: { retries: 2, delay: 100 },
    });

    if (!nock.isActive()) {
      nock.activate();
    }
  });

  afterEach(() => {
    nock.cleanAll();
    nock.restore();
  });

  describe('建構函式', () => {
    it('應該使用預設設定建立實例', () => {
      const defaultRunner = new HttpRunner();
      const status = defaultRunner.getStatus();

      expect(status.httpClient.timeout).toBe(30000);
      expect(status.retry.retries).toBe(3);
      expect(status.circuitBreaker.state).toBe('CLOSED');
    });

    it('應該使用自訂設定', () => {
      const status = runner.getStatus();

      expect(status.httpClient.timeout).toBe(5000);
      expect(status.retry.retries).toBe(2);
    });
  });

  describe('HTTP 方法', () => {
    it('應該執行 GET 請求', async () => {
      const mockData = { id: 1, name: 'test' };

      nock('https://api.test.com')
        .get('/users/1')
        .reply(200, mockData);

      const response = await runner.get('/users/1');

      expect(response.status).toBe(200);
      expect(response.data).toEqual(mockData);
    });

    it('應該執行 POST 請求', async () => {
      const requestData = { name: 'new user' };
      const responseData = { id: 2, ...requestData };

      nock('https://api.test.com')
        .post('/users', requestData)
        .reply(201, responseData);

      const response = await runner.post('/users', requestData);

      expect(response.status).toBe(201);
      expect(response.data).toEqual(responseData);
    });

    it('應該執行 PUT 請求', async () => {
      const updateData = { name: 'updated user' };

      nock('https://api.test.com')
        .put('/users/1', updateData)
        .reply(200, updateData);

      const response = await runner.put('/users/1', updateData);

      expect(response.status).toBe(200);
    });

    it('應該執行 PATCH 請求', async () => {
      const patchData = { email: 'new@example.com' };

      nock('https://api.test.com')
        .patch('/users/1', patchData)
        .reply(200, patchData);

      const response = await runner.patch('/users/1', patchData);

      expect(response.status).toBe(200);
    });

    it('應該執行 DELETE 請求', async () => {
      nock('https://api.test.com')
        .delete('/users/1')
        .reply(204);

      const response = await runner.delete('/users/1');

      expect(response.status).toBe(204);
    });
  });

  describe('URL 建構', () => {
    it('應該拼接 baseUrl 與路徑', async () => {
      nock('https://api.test.com')
        .get('/users')
        .reply(200, []);

      const response = await runner.get('/users');
      expect(response.status).toBe(200);
    });

    it('應該處理路徑參數', async () => {
      nock('https://api.test.com')
        .get('/users/123/posts/456')
        .reply(200, { userId: 123, postId: 456 });

      const response = await runner.get('/users/{id}/posts/{postId}', {
        pathParams: { id: '123', postId: '456' },
      });

      expect(response.status).toBe(200);
    });

    it('應該處理查詢參數', async () => {
      nock('https://api.test.com')
        .get('/users')
        .query({ page: '1', limit: '10' })
        .reply(200, []);

      const response = await runner.get('/users', {
        queryParams: { page: '1', limit: '10' },
      });

      expect(response.status).toBe(200);
    });

    it('應該處理完整 URL', async () => {
      nock('https://external.api.com')
        .get('/data')
        .reply(200, { external: true });

      const response = await runner.get('https://external.api.com/data');

      expect(response.status).toBe(200);
      expect(response.data).toEqual({ external: true });
    });
  });

  describe('Token 管理', () => {
    it('應該注入 Authorization header', async () => {
      runner.getTokenManager().setToken('test-token');

      nock('https://api.test.com')
        .get('/protected')
        .matchHeader('authorization', 'Bearer test-token')
        .reply(200, { authorized: true });

      const response = await runner.get('/protected');

      expect(response.status).toBe(200);
      expect(response.data).toEqual({ authorized: true });
    });

    it('應該支援命名空間 Token', async () => {
      runner.getTokenManager().setToken('admin-token', 'admin');

      nock('https://api.test.com')
        .get('/admin/users')
        .matchHeader('authorization', 'Bearer admin-token')
        .reply(200, { users: [] });

      const response = await runner.get('/admin/users', {
        tokenNamespace: 'admin',
      });

      expect(response.status).toBe(200);
    });

    it('應該從回應中提取 Token', async () => {
      nock('https://api.test.com')
        .post('/login')
        .reply(200, { token: 'new-token', user: { id: 1 } });

      await runner.post('/login', { email: 'test@example.com' }, {
        extractToken: { path: 'token' },
      });

      const tokenManager = runner.getTokenManager();
      expect(tokenManager.getToken()).toBe('new-token');
    });
  });

  describe('健康檢查', () => {
    it('應該執行健康檢查', async () => {
      nock('https://api.test.com')
        .get('/health')
        .reply(200, { status: 'healthy' });

      const result = await runner.healthCheck();
      expect(result).toBe(true);
    });

    it('應該處理健康檢查失敗', async () => {
      nock('https://api.test.com')
        .get('/health')
        .reply(500);

      const result = await runner.healthCheck();
      expect(result).toBe(false);
    });

    it('應該支援自訂健康檢查 URL', async () => {
      nock('https://api.test.com')
        .get('/custom-health')
        .reply(200);

      const result = await runner.healthCheck('/custom-health');
      expect(result).toBe(true);
    });
  });

  describe('錯誤處理與重試', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('應該正常處理回應（即使是錯誤狀態碼）', async () => {
      nock('https://api.test.com')
        .get('/unstable')
        .reply(500, { error: 'Server Error' });

      const response = await runner.get('/unstable');

      expect(response.status).toBe(500);
      expect(response.data).toEqual({ error: 'Server Error' });
    });

    it('應該處理網路錯誤', async () => {
      nock('https://api.test.com')
        .get('/network-error')
        .replyWithError('Network Error');

      // ✨ 修改: 現在回傳虛擬 response 而不是拋出錯誤
      const response = await runner.get('/network-error');

      expect(response.status).toBe(0);
      expect(response.data).toHaveProperty('_network_error', true);
      expect(response.data).toHaveProperty('error', 'NETWORK_ERROR');
    });
  });

  describe('系統狀態', () => {
    it('應該返回完整的系統狀態', () => {
      const status = runner.getStatus();

      expect(status).toHaveProperty('httpClient');
      expect(status).toHaveProperty('retry');
      expect(status).toHaveProperty('circuitBreaker');
      expect(status).toHaveProperty('tokens');

      expect(status.httpClient.timeout).toBe(5000);
      expect(status.retry.retries).toBe(2);
      expect(status.circuitBreaker.state).toBe('CLOSED');
      expect(Array.isArray(status.tokens)).toBe(true);
    });
  });

  describe('設定更新', () => {
    it('應該更新 HTTP 客戶端設定', () => {
      runner.updateHttpConfig({ timeout: 15000 });

      const status = runner.getStatus();
      expect(status.httpClient.timeout).toBe(15000);
    });

    it('應該重置斷路器', () => {
      runner.resetCircuitBreaker();

      const status = runner.getStatus();
      expect(status.circuitBreaker.state).toBe('CLOSED');
      expect(status.circuitBreaker.failureCount).toBe(0);
    });
  });

  describe('Token 管理器存取', () => {
    it('應該提供 Token 管理器存取', () => {
      const tokenManager = runner.getTokenManager();

      tokenManager.setToken('access-token');
      expect(tokenManager.getToken()).toBe('access-token');
    });
  });
});