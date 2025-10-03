import { describe, it, expect } from 'vitest';
import {
  TokenExtractionSchema,
  LoginAuthSchema,
  BearerAuthSchema,
  StaticAuthItemSchema,
  GlobalAuthSchema,
} from '../src/auth-schema';

describe('Auth Schema', () => {
  describe('TokenExtractionSchema', () => {
    it('應該接受有效的 token 擷取設定', () => {
      const valid = {
        path: 'data.token',
        expiresIn: 3600,
        namespace: 'user',
      };
      expect(() => TokenExtractionSchema.parse(valid)).not.toThrow();
    });

    it('缺少 path 時應該驗證失敗', () => {
      const invalid = {};
      expect(() => TokenExtractionSchema.parse(invalid)).toThrow();
    });
  });

  describe('LoginAuthSchema', () => {
    it('應該接受登入型態認證設定', () => {
      const valid = {
        type: 'login',
        tokenExtraction: { path: 'token' },
      };
      expect(() => LoginAuthSchema.parse(valid)).not.toThrow();
    });
  });

  describe('BearerAuthSchema', () => {
    it('應該接受 Bearer 認證設定', () => {
      const valid = {
        type: 'bearer',
        token: 'abc123',
      };
      expect(() => BearerAuthSchema.parse(valid)).not.toThrow();
    });
  });

  describe('StaticAuthItemSchema', () => {
    it('應該接受靜態 token 條目', () => {
      const valid = {
        namespace: 'user',
        token: 'xyz789',
        expiresInSeconds: 600,
      };
      expect(() => StaticAuthItemSchema.parse(valid)).not.toThrow();
    });
  });

  describe('GlobalAuthSchema', () => {
    it('應該接受 Bearer 設定', () => {
      const valid = {
        type: 'bearer',
        token: 'abc123',
      };
      expect(() => GlobalAuthSchema.parse(valid)).not.toThrow();
    });

    it('應該接受靜態 token 列表', () => {
      const valid = {
        static: [
          { namespace: 'user', token: 'token1' },
          { namespace: 'admin', token: 'token2', expiresInSeconds: 3600 },
        ],
      };
      expect(() => GlobalAuthSchema.parse(valid)).not.toThrow();
    });
  });
});
