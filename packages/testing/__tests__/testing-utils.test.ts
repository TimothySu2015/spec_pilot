import { describe, it, expect } from 'vitest';
import {
  createSuccessResponse,
  createErrorResponse,
  delay,
  generateTestId,
} from '../src/index.js';

describe('Testing Utils', () => {
  describe('createSuccessResponse', () => {
    it('應該建立成功回應', () => {
      const data = { message: 'success' };
      const response = createSuccessResponse(data);

      expect(response.status).toBe(200);
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.data).toEqual(data);
    });

    it('應該支援自訂狀態碼', () => {
      const data = { created: true };
      const response = createSuccessResponse(data, 201);

      expect(response.status).toBe(201);
      expect(response.data).toEqual(data);
    });
  });

  describe('createErrorResponse', () => {
    it('應該建立錯誤回應', () => {
      const message = 'Something went wrong';
      const response = createErrorResponse(message);

      expect(response.status).toBe(400);
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(response.data).toMatchObject({
        error: message,
        timestamp: expect.any(String),
      });
    });

    it('應該支援自訂狀態碼', () => {
      const response = createErrorResponse('Not found', 404);

      expect(response.status).toBe(404);
      expect(response.data).toMatchObject({
        error: 'Not found',
      });
    });
  });

  describe('delay', () => {
    it('應該延遲指定時間', async () => {
      const start = Date.now();
      await delay(50);
      const end = Date.now();

      expect(end - start).toBeGreaterThanOrEqual(45); // 允許一些誤差
    });
  });

  describe('generateTestId', () => {
    it('應該產生測試 ID', () => {
      const id = generateTestId();

      expect(id).toMatch(/^test-[a-z0-9]{9}$/);
    });

    it('應該支援自訂前綴', () => {
      const id = generateTestId('custom');

      expect(id).toMatch(/^custom-[a-z0-9]{9}$/);
    });

    it('應該產生唯一 ID', () => {
      const id1 = generateTestId();
      const id2 = generateTestId();

      expect(id1).not.toBe(id2);
    });
  });
});