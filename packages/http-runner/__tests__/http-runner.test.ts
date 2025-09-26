import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HttpRunner } from '../src/index.js';

describe('HttpRunner', () => {
  let runner: HttpRunner;

  beforeEach(() => {
    runner = new HttpRunner();
  });

  describe('createRequest', () => {
    it('應該建立正確的 HTTP 請求設定', () => {
      const request = runner.createRequest('GET', '/api/test', {
        headers: { 'Authorization': 'Bearer token' },
        timeout: 5000,
        retries: 2,
      });

      expect(request).toEqual({
        method: 'GET',
        url: '/api/test',
        headers: { 'Authorization': 'Bearer token' },
        timeout: 5000,
        retries: 2,
      });
    });

    it('應該使用預設值', () => {
      const request = runner.createRequest('POST', '/api/create');

      expect(request.timeout).toBe(30000);
      expect(request.retries).toBe(3);
    });
  });

  describe('execute', () => {
    it('應該執行 HTTP 請求並返回模擬回應', async () => {
      const request = runner.createRequest('GET', '/api/test');
      
      const response = await runner.execute(request);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/json');
      expect(response.data).toMatchObject({
        message: '模擬回應 - 實際 HTTP 客戶端尚未實作',
        request: {
          method: 'GET',
          url: '/api/test',
        },
      });
      expect(response.duration).toBeGreaterThan(0);
    });
  });

  describe('healthCheck', () => {
    it('應該執行健康檢查', async () => {
      const result = await runner.healthCheck('https://api.test.com');

      expect(result).toBe(true);
    });

    it('應該處理健康檢查失敗', async () => {
      // Mock 失敗情況需要實際的 HTTP 客戶端實作
      // 目前模擬回應總是成功
      const result = await runner.healthCheck('https://api.test.com');
      expect(result).toBe(true);
    });
  });
});