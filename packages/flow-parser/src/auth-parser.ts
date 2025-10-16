/**
 * Flow 認證設定解析器
 */

import { createStructuredLogger } from '@specpilot/shared';
import type { FlowAuth, TokenExtraction, StaticAuth } from './types.js';

const logger = createStructuredLogger('auth-parser');

/**
 * 認證設定驗證錯誤
 */
export class AuthConfigValidationError extends Error {
  constructor(message: string, public details?: Record<string, unknown>) {
    super(message);
    this.name = 'AuthConfigValidationError';
  }
}

/**
 * 認證解析器類別
 */
export class AuthParser {
  /**
   * 解析步驟層級的認證設定
   */
  static parseStepAuth(authConfig: unknown, stepName: string): FlowAuth | undefined {
    if (!authConfig) {
      return undefined;
    }

    if (typeof authConfig !== 'object' || authConfig === null) {
      throw new AuthConfigValidationError(
        `步驟 "${stepName}" 的認證設定必須是物件`,
        { stepName, receivedType: typeof authConfig }
      );
    }

    const config = authConfig as Record<string, unknown>;

    // 驗證認證類型
    if (!config.type || typeof config.type !== 'string') {
      throw new AuthConfigValidationError(
        `步驟 "${stepName}" 的認證設定缺少有效的 type 欄位`,
        { stepName, receivedType: typeof config.type }
      );
    }

    const authType = config.type as string;
    if (authType !== 'login' && authType !== 'static') {
      throw new AuthConfigValidationError(
        `步驟 "${stepName}" 的認證類型必須是 "login" 或 "static"`,
        { stepName, receivedType: authType }
      );
    }

    const result: FlowAuth = {
      type: authType as 'login' | 'static',
    };

    // 解析登入類型的 Token 提取設定
    if (authType === 'login') {
      if (config.tokenExtraction) {
        result.tokenExtraction = this.parseTokenExtraction(
          config.tokenExtraction,
          stepName
        );
      }
    }

    // 解析靜態類型的命名空間
    if (authType === 'static') {
      if (config.namespace && typeof config.namespace === 'string') {
        result.namespace = config.namespace;
      }
    }

    logger.debug('步驟認證設定解析完成', {
      component: 'auth-parser',
      stepName,
      authType,
      hasTokenExtraction: !!result.tokenExtraction,
      namespace: result.namespace,
    });

    return result;
  }

  /**
   * 解析 Token 提取設定
   */
  private static parseTokenExtraction(
    extractionConfig: unknown,
    stepName: string
  ): TokenExtraction {
    if (typeof extractionConfig !== 'object' || extractionConfig === null) {
      throw new AuthConfigValidationError(
        `步驟 "${stepName}" 的 tokenExtraction 設定必須是物件`,
        { stepName, receivedType: typeof extractionConfig }
      );
    }

    const config = extractionConfig as Record<string, unknown>;

    // 驗證路徑欄位
    if (!config.path || typeof config.path !== 'string') {
      throw new AuthConfigValidationError(
        `步驟 "${stepName}" 的 tokenExtraction.path 必須是非空字串`,
        { stepName, receivedType: typeof config.path }
      );
    }

    const result: TokenExtraction = {
      path: config.path,
    };

    // 解析有效期
    if (config.expiresIn !== undefined) {
      if (typeof config.expiresIn !== 'number' || config.expiresIn <= 0) {
        throw new AuthConfigValidationError(
          `步驟 "${stepName}" 的 tokenExtraction.expiresIn 必須是正整數`,
          { stepName, receivedValue: config.expiresIn }
        );
      }
      result.expiresIn = config.expiresIn;
    }

    // 解析命名空間
    if (config.namespace !== undefined) {
      if (typeof config.namespace !== 'string' || config.namespace.trim() === '') {
        throw new AuthConfigValidationError(
          `步驟 "${stepName}" 的 tokenExtraction.namespace 必須是非空字串`,
          { stepName, receivedValue: config.namespace }
        );
      }
      result.namespace = config.namespace.trim();
    }

    return result;
  }

  /**
   * 解析全域靜態認證設定
   */
  static parseGlobalStaticAuth(staticConfig: unknown): StaticAuth[] {
    if (!staticConfig) {
      return [];
    }

    if (!Array.isArray(staticConfig)) {
      throw new AuthConfigValidationError(
        '全域靜態認證設定必須是陣列',
        { receivedType: typeof staticConfig }
      );
    }

    return staticConfig.map((item, index) => {
      if (typeof item !== 'object' || item === null) {
        throw new AuthConfigValidationError(
          `靜態認證設定項目 ${index} 必須是物件`,
          { index, receivedType: typeof item }
        );
      }

      const config = item as Record<string, unknown>;

      // 驗證命名空間
      if (!config.namespace || typeof config.namespace !== 'string') {
        throw new AuthConfigValidationError(
          `靜態認證設定項目 ${index} 缺少有效的 namespace 欄位`,
          { index, receivedType: typeof config.namespace }
        );
      }

      // 驗證 Token
      if (!config.token || typeof config.token !== 'string') {
        throw new AuthConfigValidationError(
          `靜態認證設定項目 ${index} 缺少有效的 token 欄位`,
          { index, receivedType: typeof config.token }
        );
      }

      const result: StaticAuth = {
        namespace: config.namespace.trim(),
        token: config.token,
      };

      // 解析有效期
      if (config.expiresInSeconds !== undefined) {
        if (typeof config.expiresInSeconds !== 'number' || config.expiresInSeconds <= 0) {
          throw new AuthConfigValidationError(
            `靜態認證設定項目 ${index} 的 expiresInSeconds 必須是正整數`,
            { index, receivedValue: config.expiresInSeconds }
          );
        }
        result.expiresInSeconds = config.expiresInSeconds;
      }

      return result;
    });
  }

  /**
   * 驗證命名空間格式
   */
  static validateNamespace(namespace: string): boolean {
    // 命名空間應該是非空字串，只包含字母數字和底線
    const namespaceRegex = /^[a-zA-Z0-9_]+$/;
    return namespaceRegex.test(namespace.trim());
  }

  /**
   * 驗證 Token 提取路徑格式
   */
  static validateExtractionPath(path: string): boolean {
    // 路徑應該是點分隔的欄位路徑，如 "data.token" 或 "result.accessToken"
    const pathRegex = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/;
    return pathRegex.test(path.trim());
  }
}