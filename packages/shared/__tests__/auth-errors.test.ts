import { describe, it, expect } from 'vitest';
import {
  AuthenticationError,
  TokenMissingError,
  TokenExpiredError,
  AuthenticationFailedError,
  TokenExtractionError,
  EnvironmentVariableMissingError,
  AuthConfigInvalidError,
  AuthErrorFactory
} from '../src/errors/auth-errors.js';

describe('認證錯誤類別', () => {
  describe('AuthenticationError 基底類別', () => {
    class TestAuthError extends AuthenticationError {
      constructor(message: string) {
        super(message, 9999, { test: true }, 'test hint', { testContext: true });
      }
    }

    it('應該自動設定 component 為 authentication', () => {
      const error = new TestAuthError('測試錯誤');

      expect(error.context?.component).toBe('authentication');
      expect(error.context?.testContext).toBe(true);
    });

    it('應該遮罩敏感資料', () => {
      const error = new TestAuthError('測試錯誤');
      error.details!.token = 'secret_token_value';
      error.details!.authorization = 'Bearer secret_bearer_token';
      error.details!.password = 'secret_password';
      error.details!.normalField = 'normal_value';

      const maskedDetails = error.getMaskedDetails();

      expect(maskedDetails.token).toBe('***');
      expect(maskedDetails.authorization).toBe('Bearer ***');
      expect(maskedDetails.password).toBe('***');
      expect(maskedDetails.normalField).toBe('normal_value');
    });

    it('應該在 JSON 序列化時遮罩敏感資料', () => {
      const error = new TestAuthError('測試錯誤');
      error.details!.token = 'secret_token_value';
      error.details!.normalField = 'normal_value';

      const json = error.toJSON();

      expect((json.details as any)?.token).toBe('***');
      expect((json.details as any)?.normalField).toBe('normal_value');
    });
  });

  describe('TokenMissingError', () => {
    it('應該創建 Token 缺失錯誤', () => {
      const error = TokenMissingError.create('api_v1');

      expect(error.code).toBe(1501);
      expect(error.message).toBe('命名空間 "api_v1" 的 Token 不存在');
      expect(error.details?.namespace).toBe('api_v1');
      expect(error.hint).toBe('請檢查 Token 設定或環境變數配置');
    });

    it('應該支援額外詳細資訊', () => {
      const details = { envVar: 'SPEC_PILOT_TOKEN_API_V1' };
      const context = { executionId: 'exec-123' };
      const error = TokenMissingError.withDetails('api_v1', details, context);

      expect(error.details?.namespace).toBe('api_v1');
      expect(error.details?.envVar).toBe('SPEC_PILOT_TOKEN_API_V1');
      expect(error.context?.executionId).toBe('exec-123');
    });
  });

  describe('TokenExpiredError', () => {
    it('應該創建 Token 過期錯誤', () => {
      const expiredAt = new Date('2025-01-01T00:00:00.000Z');
      const error = TokenExpiredError.create('api_v1', expiredAt);

      expect(error.code).toBe(1502);
      expect(error.message).toBe('命名空間 "api_v1" 的 Token 已於 2025-01-01T00:00:00.000Z 過期');
      expect(error.details?.namespace).toBe('api_v1');
      expect(error.details?.expiredAt).toBe('2025-01-01T00:00:00.000Z');
      expect(error.hint).toBe('請重新登入以取得新的 Token');
    });

    it('應該支援額外詳細資訊', () => {
      const expiredAt = new Date('2025-01-01T00:00:00.000Z');
      const details = { lastUsed: '2024-12-31T23:59:59.000Z' };
      const context = { stepName: 'api_call' };
      const error = TokenExpiredError.withDetails('api_v1', expiredAt, details, context);

      expect(error.details?.lastUsed).toBe('2024-12-31T23:59:59.000Z');
      expect(error.context?.stepName).toBe('api_call');
    });
  });

  describe('AuthenticationFailedError', () => {
    it('應該創建基本認證失敗錯誤', () => {
      const error = AuthenticationFailedError.create('login_step');

      expect(error.code).toBe(1503);
      expect(error.message).toBe('步驟 "login_step" 認證失敗');
      expect(error.details?.stepName).toBe('login_step');
    });

    it('應該支援 HTTP 狀態碼', () => {
      const error = AuthenticationFailedError.withStatusCode('login_step', 401);

      expect(error.message).toBe('步驟 "login_step" 認證失敗 (HTTP 401)');
      expect(error.details?.statusCode).toBe(401);
      expect(error.hint).toBe('請檢查認證憑證是否正確');
    });

    it('應該針對不同 HTTP 狀態碼提供不同提示', () => {
      const error401 = AuthenticationFailedError.withStatusCode('step', 401);
      expect(error401.hint).toBe('請檢查認證憑證是否正確');

      const error403 = AuthenticationFailedError.withStatusCode('step', 403);
      expect(error403.hint).toBe('請檢查是否有足夠的權限');

      const error500 = AuthenticationFailedError.withStatusCode('step', 500);
      expect(error500.hint).toBe('請檢查認證設定與 API 端點');
    });

    it('應該支援額外詳細資訊', () => {
      const details = { responseBody: 'Invalid credentials' };
      const context = { executionId: 'exec-456' };
      const error = AuthenticationFailedError.withDetails('login_step', 401, details, context);

      expect(error.details?.responseBody).toBe('Invalid credentials');
      expect(error.context?.executionId).toBe('exec-456');
    });
  });

  describe('TokenExtractionError', () => {
    it('應該創建 Token 提取失敗錯誤', () => {
      const error = TokenExtractionError.create('login_step', 'data.token');

      expect(error.code).toBe(1504);
      expect(error.message).toBe('步驟 "login_step" 無法從回應中提取 Token（路徑：data.token）');
      expect(error.details?.stepName).toBe('login_step');
      expect(error.details?.extractionPath).toBe('data.token');
      expect(error.hint).toBe('請檢查 Token 提取路徑是否正確，或 API 回應格式是否符合預期');
    });

    it('應該支援額外詳細資訊', () => {
      const details = { responseStructure: { result: { id: 123 } } };
      const error = TokenExtractionError.withDetails('login_step', 'data.token', details);

      expect(error.details?.responseStructure).toEqual({ result: { id: 123 } });
    });
  });

  describe('EnvironmentVariableMissingError', () => {
    it('應該創建環境變數缺失錯誤', () => {
      const error = EnvironmentVariableMissingError.create('API_TOKEN');

      expect(error.code).toBe(1505);
      expect(error.message).toBe('環境變數 "API_TOKEN" 未設定');
      expect(error.details?.envVarName).toBe('API_TOKEN');
      expect(error.hint).toBe('請在 .env 檔案或系統環境變數中設定此值');
    });

    it('應該支援命名空間', () => {
      const error = EnvironmentVariableMissingError.withNamespace('API_TOKEN', 'api_v1');

      expect(error.message).toBe('環境變數 "API_TOKEN" 未設定 (命名空間：api_v1)');
      expect(error.details?.namespace).toBe('api_v1');
    });
  });

  describe('AuthConfigInvalidError', () => {
    it('應該創建認證設定無效錯誤', () => {
      const error = AuthConfigInvalidError.create('tokenExtraction.path', '路徑格式不正確');

      expect(error.code).toBe(1506);
      expect(error.message).toBe('認證設定 "tokenExtraction.path" 無效：路徑格式不正確');
      expect(error.details?.configField).toBe('tokenExtraction.path');
      expect(error.details?.reason).toBe('路徑格式不正確');
      expect(error.hint).toBe('請檢查認證設定格式是否正確');
    });

    it('應該支援額外詳細資訊', () => {
      const details = { currentValue: 'invalid..path', expectedFormat: 'field.subfield' };
      const error = AuthConfigInvalidError.withDetails(
        'tokenExtraction.path',
        '路徑格式不正確',
        details
      );

      expect(error.details?.currentValue).toBe('invalid..path');
      expect(error.details?.expectedFormat).toBe('field.subfield');
    });
  });

  describe('AuthErrorFactory', () => {
    it('應該透過工廠方法創建 Token 缺失錯誤', () => {
      const error = AuthErrorFactory.tokenMissing('api_v1', { executionId: 'exec-123' });

      expect(error).toBeInstanceOf(TokenMissingError);
      expect(error.details?.namespace).toBe('api_v1');
      expect(error.context?.executionId).toBe('exec-123');
    });

    it('應該透過工廠方法創建 Token 過期錯誤', () => {
      const expiredAt = new Date('2025-01-01T00:00:00.000Z');
      const error = AuthErrorFactory.tokenExpired('api_v1', expiredAt);

      expect(error).toBeInstanceOf(TokenExpiredError);
      expect(error.details?.namespace).toBe('api_v1');
    });

    it('應該透過工廠方法創建認證失敗錯誤', () => {
      const error = AuthErrorFactory.authenticationFailed('login_step', 401);

      expect(error).toBeInstanceOf(AuthenticationFailedError);
      expect(error.details?.stepName).toBe('login_step');
      expect(error.details?.statusCode).toBe(401);
    });

    it('應該透過工廠方法創建 Token 提取失敗錯誤', () => {
      const error = AuthErrorFactory.tokenExtractionFailed('login_step', 'data.token');

      expect(error).toBeInstanceOf(TokenExtractionError);
      expect(error.details?.stepName).toBe('login_step');
      expect(error.details?.extractionPath).toBe('data.token');
    });

    it('應該透過工廠方法創建環境變數缺失錯誤', () => {
      const error = AuthErrorFactory.environmentVariableMissing('API_TOKEN', 'api_v1');

      expect(error).toBeInstanceOf(EnvironmentVariableMissingError);
      expect(error.details?.envVarName).toBe('API_TOKEN');
      expect(error.details?.namespace).toBe('api_v1');
    });

    it('應該透過工廠方法創建認證設定無效錯誤', () => {
      const error = AuthErrorFactory.authConfigInvalid('tokenExtraction', '格式錯誤');

      expect(error).toBeInstanceOf(AuthConfigInvalidError);
      expect(error.details?.configField).toBe('tokenExtraction');
      expect(error.details?.reason).toBe('格式錯誤');
    });
  });
});