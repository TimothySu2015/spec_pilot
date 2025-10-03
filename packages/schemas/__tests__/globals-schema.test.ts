import { describe, it, expect } from 'vitest';
import { RetryPolicySchema, GlobalsSchema } from '../src/globals-schema';

describe('Globals Schema', () => {
  describe('RetryPolicySchema', () => {
    it('應該接受合法的重試策略', () => {
      const valid = {
        maxRetries: 3,
        delayMs: 1000,
        backoffMultiplier: 2,
      };
      expect(() => RetryPolicySchema.parse(valid)).not.toThrow();
    });

    it('超過限制時應該驗證失敗', () => {
      const invalid = {
        maxRetries: 10,
      };
      expect(() => RetryPolicySchema.parse(invalid)).toThrow();
    });
  });

  describe('GlobalsSchema', () => {
    it('應該接受完整的 globals 設定', () => {
      const valid = {
        baseUrl: 'https://api.example.com',
        headers: {
          'Content-Type': 'application/json',
        },
        auth: {
          type: 'bearer',
          token: 'abc123',
        },
        retryPolicy: {
          maxRetries: 3,
          delayMs: 1000,
        },
      };
      expect(() => GlobalsSchema.parse(valid)).not.toThrow();
    });
  });
});
