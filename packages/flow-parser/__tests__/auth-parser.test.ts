import { describe, it, expect } from 'vitest';
import { AuthParser, AuthConfigValidationError } from '../src/auth-parser.js';

describe('AuthParser', () => {
  describe('parseStepAuth', () => {
    it('應該解析登入類型的認證設定', () => {
      const authConfig = {
        type: 'login',
        tokenExtraction: {
          path: 'data.token',
          expiresIn: 3600,
          namespace: 'api_v1'
        }
      };

      const result = AuthParser.parseStepAuth(authConfig, 'test_step');

      expect(result).toEqual({
        type: 'login',
        tokenExtraction: {
          path: 'data.token',
          expiresIn: 3600,
          namespace: 'api_v1'
        }
      });
    });

    it('應該解析靜態類型的認證設定', () => {
      const authConfig = {
        type: 'static',
        namespace: 'external_api'
      };

      const result = AuthParser.parseStepAuth(authConfig, 'test_step');

      expect(result).toEqual({
        type: 'static',
        namespace: 'external_api'
      });
    });

    it('應該返回 undefined 如果認證設定為 null', () => {
      const result = AuthParser.parseStepAuth(null, 'test_step');
      expect(result).toBeUndefined();
    });

    it('應該拋出錯誤如果認證設定不是物件', () => {
      expect(() => {
        AuthParser.parseStepAuth('invalid', 'test_step');
      }).toThrow(AuthConfigValidationError);
    });

    it('應該拋出錯誤如果缺少 type 欄位', () => {
      const authConfig = {
        tokenExtraction: { path: 'data.token' }
      };

      expect(() => {
        AuthParser.parseStepAuth(authConfig, 'test_step');
      }).toThrow(AuthConfigValidationError);
    });

    it('應該拋出錯誤如果 type 欄位無效', () => {
      const authConfig = {
        type: 'invalid_type'
      };

      expect(() => {
        AuthParser.parseStepAuth(authConfig, 'test_step');
      }).toThrow(AuthConfigValidationError);
    });

    it('應該拋出錯誤如果 tokenExtraction 不是物件', () => {
      const authConfig = {
        type: 'login',
        tokenExtraction: 'invalid'
      };

      expect(() => {
        AuthParser.parseStepAuth(authConfig, 'test_step');
      }).toThrow(AuthConfigValidationError);
    });

    it('應該拋出錯誤如果 tokenExtraction.path 缺失', () => {
      const authConfig = {
        type: 'login',
        tokenExtraction: {
          expiresIn: 3600
        }
      };

      expect(() => {
        AuthParser.parseStepAuth(authConfig, 'test_step');
      }).toThrow(AuthConfigValidationError);
    });

    it('應該拋出錯誤如果 expiresIn 不是正整數', () => {
      const authConfig = {
        type: 'login',
        tokenExtraction: {
          path: 'data.token',
          expiresIn: -1
        }
      };

      expect(() => {
        AuthParser.parseStepAuth(authConfig, 'test_step');
      }).toThrow(AuthConfigValidationError);
    });
  });

  describe('parseGlobalStaticAuth', () => {
    it('應該解析有效的靜態認證陣列', () => {
      const staticConfig = [
        {
          namespace: 'api_v1',
          token: 'token_value_1',
          expiresInSeconds: 3600
        },
        {
          namespace: 'api_v2',
          token: 'token_value_2'
        }
      ];

      const result = AuthParser.parseGlobalStaticAuth(staticConfig);

      expect(result).toEqual([
        {
          namespace: 'api_v1',
          token: 'token_value_1',
          expiresInSeconds: 3600
        },
        {
          namespace: 'api_v2',
          token: 'token_value_2'
        }
      ]);
    });

    it('應該返回空陣列如果設定為 null', () => {
      const result = AuthParser.parseGlobalStaticAuth(null);
      expect(result).toEqual([]);
    });

    it('應該拋出錯誤如果設定不是陣列', () => {
      expect(() => {
        AuthParser.parseGlobalStaticAuth('invalid');
      }).toThrow(AuthConfigValidationError);
    });

    it('應該拋出錯誤如果陣列項目不是物件', () => {
      const staticConfig = ['invalid'];

      expect(() => {
        AuthParser.parseGlobalStaticAuth(staticConfig);
      }).toThrow(AuthConfigValidationError);
    });

    it('應該拋出錯誤如果缺少 namespace 欄位', () => {
      const staticConfig = [
        {
          token: 'token_value'
        }
      ];

      expect(() => {
        AuthParser.parseGlobalStaticAuth(staticConfig);
      }).toThrow(AuthConfigValidationError);
    });

    it('應該拋出錯誤如果缺少 token 欄位', () => {
      const staticConfig = [
        {
          namespace: 'api_v1'
        }
      ];

      expect(() => {
        AuthParser.parseGlobalStaticAuth(staticConfig);
      }).toThrow(AuthConfigValidationError);
    });

    it('應該拋出錯誤如果 expiresInSeconds 不是正整數', () => {
      const staticConfig = [
        {
          namespace: 'api_v1',
          token: 'token_value',
          expiresInSeconds: -1
        }
      ];

      expect(() => {
        AuthParser.parseGlobalStaticAuth(staticConfig);
      }).toThrow(AuthConfigValidationError);
    });
  });

  describe('validateNamespace', () => {
    it('應該驗證有效的命名空間', () => {
      expect(AuthParser.validateNamespace('api_v1')).toBe(true);
      expect(AuthParser.validateNamespace('user_service')).toBe(true);
      expect(AuthParser.validateNamespace('API123')).toBe(true);
    });

    it('應該拒絕無效的命名空間', () => {
      expect(AuthParser.validateNamespace('api-v1')).toBe(false);
      expect(AuthParser.validateNamespace('api.v1')).toBe(false);
      expect(AuthParser.validateNamespace('api v1')).toBe(false);
      expect(AuthParser.validateNamespace('')).toBe(false);
    });
  });

  describe('validateExtractionPath', () => {
    it('應該驗證有效的提取路徑', () => {
      expect(AuthParser.validateExtractionPath('token')).toBe(true);
      expect(AuthParser.validateExtractionPath('data.token')).toBe(true);
      expect(AuthParser.validateExtractionPath('result.auth.accessToken')).toBe(true);
    });

    it('應該拒絕無效的提取路徑', () => {
      expect(AuthParser.validateExtractionPath('data-token')).toBe(false);
      expect(AuthParser.validateExtractionPath('data..token')).toBe(false);
      expect(AuthParser.validateExtractionPath('.token')).toBe(false);
      expect(AuthParser.validateExtractionPath('token.')).toBe(false);
      expect(AuthParser.validateExtractionPath('')).toBe(false);
    });
  });
});