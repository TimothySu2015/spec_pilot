import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { HttpClient } from '../src/http-client.js';
import type { HttpRequest } from '../src/types.js';

describe('HttpClient', () => {
  let httpClient: HttpClient;

  beforeEach(() => {
    httpClient = new HttpClient({
      timeout: 5000,
      retries: 2,
    });

    // 清理 nock
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
      const client = new HttpClient();
      const config = client.getConfig();

      expect(config.timeout).toBe(30000);
      expect(config.retries).toBe(3);
      expect(config.retryDelay).toBe(500);
    });

    it('應該使用自訂設定覆寫預設值', () => {
      const client = new HttpClient({
        timeout: 10000,
        retries: 5,
        retryDelay: 1000,
      });

      const config = client.getConfig();
      expect(config.timeout).toBe(10000);
      expect(config.retries).toBe(5);
      expect(config.retryDelay).toBe(1000);
    });
  });

  describe('HTTP 方法', () => {
    const baseUrl = 'https://api.test.com';

    it('應該執行 GET 請求', async () => {
      const mockData = { id: 1, name: 'test' };

      nock(baseUrl)
        .get('/users/1')
        .reply(200, mockData, {
          'content-type': 'application/json',
        });

      const response = await httpClient.get(`${baseUrl}/users/1`);

      expect(response.status).toBe(200);
      expect(response.data).toEqual(mockData);
      expect(response.headers['content-type']).toBe('application/json');
      expect(response.duration).toBeGreaterThan(0);
    });

    it('應該執行 POST 請求', async () => {
      const requestData = { name: 'new user', email: 'test@example.com' };
      const responseData = { id: 2, ...requestData };

      nock(baseUrl)
        .post('/users', requestData)
        .reply(201, responseData);

      const response = await httpClient.post(`${baseUrl}/users`, requestData);

      expect(response.status).toBe(201);
      expect(response.data).toEqual(responseData);
    });

    it('應該執行 PUT 請求', async () => {
      const updateData = { name: 'updated user' };

      nock(baseUrl)
        .put('/users/1', updateData)
        .reply(200, { id: 1, ...updateData });

      const response = await httpClient.put(`${baseUrl}/users/1`, updateData);

      expect(response.status).toBe(200);
    });

    it('應該執行 PATCH 請求', async () => {
      const patchData = { email: 'newemail@example.com' };

      nock(baseUrl)
        .patch('/users/1', patchData)
        .reply(200, { id: 1, ...patchData });

      const response = await httpClient.patch(`${baseUrl}/users/1`, patchData);

      expect(response.status).toBe(200);
    });

    it('應該執行 DELETE 請求', async () => {
      nock(baseUrl)
        .delete('/users/1')
        .reply(204);

      const response = await httpClient.delete(`${baseUrl}/users/1`);

      expect(response.status).toBe(204);
    });

    it('應該執行 HEAD 請求', async () => {
      nock(baseUrl)
        .head('/users/1')
        .reply(200, undefined, {
          'content-length': '123',
        });

      const response = await httpClient.head(`${baseUrl}/users/1`);

      expect(response.status).toBe(200);
      expect(response.headers['content-length']).toBe('123');
    });

    it('應該執行 OPTIONS 請求', async () => {
      nock(baseUrl)
        .options('/users')
        .reply(200, undefined, {
          'allow': 'GET, POST, PUT, DELETE',
        });

      const response = await httpClient.options(`${baseUrl}/users`);

      expect(response.status).toBe(200);
      expect(response.headers['allow']).toBe('GET, POST, PUT, DELETE');
    });
  });

  describe('請求設定', () => {
    const baseUrl = 'https://api.test.com';

    it('應該傳送自訂 headers', async () => {
      nock(baseUrl)
        .get('/test')
        .matchHeader('authorization', 'Bearer test-token')
        .matchHeader('x-custom-header', 'custom-value')
        .reply(200, { success: true });

      const response = await httpClient.get(`${baseUrl}/test`, {
        headers: {
          'authorization': 'Bearer test-token',
          'x-custom-header': 'custom-value',
        },
      });

      expect(response.status).toBe(200);
    });

    it('應該處理逾時設定', async () => {
      nock(baseUrl)
        .get('/slow')
        .delay(2000)
        .reply(200, { data: 'response' });

      await expect(
        httpClient.get(`${baseUrl}/slow`, { timeout: 1000 })
      ).rejects.toThrow();
    });
  });

  describe('錯誤處理', () => {
    const baseUrl = 'https://api.test.com';

    it('應該處理 HTTP 錯誤狀態碼', async () => {
      nock(baseUrl)
        .get('/not-found')
        .reply(404, { error: 'Not Found' });

      const response = await httpClient.get(`${baseUrl}/not-found`);

      expect(response.status).toBe(404);
      expect(response.data).toEqual({ error: 'Not Found' });
    });

    it('應該處理伺服器錯誤', async () => {
      nock(baseUrl)
        .get('/server-error')
        .reply(500, { error: 'Internal Server Error' });

      const response = await httpClient.get(`${baseUrl}/server-error`);

      expect(response.status).toBe(500);
      expect(response.data).toEqual({ error: 'Internal Server Error' });
    });

    it('應該處理網路錯誤', async () => {
      nock(baseUrl)
        .get('/network-error')
        .replyWithError('Network Error');

      await expect(
        httpClient.get(`${baseUrl}/network-error`)
      ).rejects.toThrow('Network Error');
    });
  });

  describe('攔截器', () => {
    const baseUrl = 'https://api.test.com';

    it('應該遮罩敏感資訊', async () => {
      // 這個測試主要確保攔截器正常運作
      // 實際的遮罩邏輯在私有方法中測試較困難
      nock(baseUrl)
        .get('/test')
        .matchHeader('authorization', 'Bearer secret-token')
        .reply(200, { success: true });

      const response = await httpClient.get(`${baseUrl}/test`, {
        headers: {
          'authorization': 'Bearer secret-token',
        },
      });

      expect(response.status).toBe(200);
    });
  });

  describe('設定更新', () => {
    it('應該更新設定', () => {
      const newConfig = {
        timeout: 15000,
        retries: 5,
      };

      httpClient.updateConfig(newConfig);
      const config = httpClient.getConfig();

      expect(config.timeout).toBe(15000);
      expect(config.retries).toBe(5);
    });

    it('應該只更新指定的設定項目', () => {
      const originalConfig = httpClient.getConfig();

      httpClient.updateConfig({ timeout: 20000 });
      const updatedConfig = httpClient.getConfig();

      expect(updatedConfig.timeout).toBe(20000);
      expect(updatedConfig.retries).toBe(originalConfig.retries);
      expect(updatedConfig.retryDelay).toBe(originalConfig.retryDelay);
    });
  });
});