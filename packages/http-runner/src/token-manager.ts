import { createStructuredLogger } from '@specpilot/shared';
import type { TokenInfo } from './types.js';

const logger = createStructuredLogger('token-manager');

/**
 * JWT Token 管理器，處理 Token 儲存、檢索、注入與命名空間隔離
 */
export class TokenManager {
  private tokens = new Map<string, TokenInfo>();
  private readonly defaultNamespace = 'default';

  /**
   * 儲存 Token
   */
  setToken(token: string, namespace: string = this.defaultNamespace, expiresAt?: Date): void {
    if (!token || typeof token !== 'string') {
      throw new Error('Token 必須是非空字串');
    }

    const tokenInfo: TokenInfo = {
      token,
      namespace,
      expiresAt,
    };

    this.tokens.set(namespace, tokenInfo);

    logger.info('Token 已儲存', {
      component: 'token-manager',
      namespace,
      hasExpiry: !!expiresAt,
      expiresAt: expiresAt?.toISOString(),
    });
  }

  /**
   * 取得指定命名空間的 Token
   */
  getToken(namespace: string = this.defaultNamespace): string | null {
    const tokenInfo = this.tokens.get(namespace);

    if (!tokenInfo) {
      logger.debug('Token 不存在', {
        component: 'token-manager',
        namespace,
      });
      return null;
    }

    // 檢查 Token 是否已過期
    if (tokenInfo.expiresAt && tokenInfo.expiresAt <= new Date()) {
      logger.warn('Token 已過期', {
        component: 'token-manager',
        namespace,
        expiresAt: tokenInfo.expiresAt.toISOString(),
      });
      this.removeToken(namespace);
      return null;
    }

    logger.debug('Token 取得成功', {
      component: 'token-manager',
      namespace,
      hasExpiry: !!tokenInfo.expiresAt,
    });

    return tokenInfo.token;
  }

  /**
   * 移除指定命名空間的 Token
   */
  removeToken(namespace: string = this.defaultNamespace): boolean {
    const existed = this.tokens.delete(namespace);

    if (existed) {
      logger.info('Token 已移除', {
        component: 'token-manager',
        namespace,
      });
    } else {
      logger.debug('嘗試移除不存在的 Token', {
        component: 'token-manager',
        namespace,
      });
    }

    return existed;
  }

  /**
   * 清除所有 Token
   */
  clearAllTokens(): void {
    const count = this.tokens.size;
    this.tokens.clear();

    logger.info('所有 Token 已清除', {
      component: 'token-manager',
      count,
    });
  }

  /**
   * 取得所有可用的命名空間
   */
  getNamespaces(): string[] {
    return Array.from(this.tokens.keys());
  }

  /**
   * 檢查指定命名空間是否有有效的 Token
   */
  hasValidToken(namespace: string = this.defaultNamespace): boolean {
    return this.getToken(namespace) !== null;
  }

  /**
   * 為 HTTP 請求注入 Authorization header
   */
  injectAuthHeader(
    headers: Record<string, string> = {},
    namespace: string = this.defaultNamespace
  ): Record<string, string> {
    const token = this.getToken(namespace);

    if (!token) {
      logger.debug('無可用 Token，跳過 Authorization header 注入', {
        component: 'token-manager',
        namespace,
      });
      return headers;
    }

    const newHeaders = { ...headers };
    newHeaders['Authorization'] = `Bearer ${token}`;

    logger.debug('Authorization header 已注入', {
      component: 'token-manager',
      namespace,
      event: 'TOKEN_INJECTED',
    });

    return newHeaders;
  }

  /**
   * 從 HTTP 回應中提取 Token
   */
  extractTokenFromResponse(
    response: unknown,
    extractionPath: string = 'token',
    namespace: string = this.defaultNamespace,
    expiresIn?: number
  ): string | null {
    try {
      const token = this.extractValueFromPath(response, extractionPath);

      if (!token || typeof token !== 'string') {
        logger.warn('回應中未找到有效的 Token', {
          component: 'token-manager',
          extractionPath,
          namespace,
        });
        return null;
      }

      // 計算過期時間
      let expiresAt: Date | undefined;
      if (expiresIn) {
        expiresAt = new Date(Date.now() + expiresIn * 1000);
      }

      this.setToken(token, namespace, expiresAt);

      logger.info('Token 從回應中提取並儲存', {
        component: 'token-manager',
        extractionPath,
        namespace,
        hasExpiry: !!expiresAt,
      });

      return token;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      logger.error('Token 提取失敗', {
        component: 'token-manager',
        extractionPath,
        namespace,
        error: errorMessage,
      });
      return null;
    }
  }

  /**
   * 從設定檔載入靜態 Token
   */
  loadStaticToken(
    tokenValue: string,
    namespace: string = this.defaultNamespace,
    expiresIn?: number
  ): void {
    if (!tokenValue) {
      logger.warn('設定檔中的 Token 值為空', {
        component: 'token-manager',
        namespace,
      });
      return;
    }

    let expiresAt: Date | undefined;
    if (expiresIn) {
      expiresAt = new Date(Date.now() + expiresIn * 1000);
    }

    this.setToken(tokenValue, namespace, expiresAt);

    logger.info('靜態 Token 從設定檔載入', {
      component: 'token-manager',
      namespace,
      hasExpiry: !!expiresAt,
    });
  }

  /**
   * 從物件路徑提取值（支援點記號路徑如 "data.token"）
   */
  private extractValueFromPath(obj: unknown, path: string): unknown {
    if (!obj || !path) {
      return null;
    }

    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return null;
      }

      if (typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return null;
      }
    }

    return current;
  }

  /**
   * 取得 Token 資訊（遮罩敏感資料）
   */
  getTokenInfo(namespace: string = this.defaultNamespace): {
    namespace: string;
    hasToken: boolean;
    isExpired: boolean;
    expiresAt?: string;
  } | null {
    const tokenInfo = this.tokens.get(namespace);

    if (!tokenInfo) {
      return null;
    }

    const isExpired = tokenInfo.expiresAt ? tokenInfo.expiresAt <= new Date() : false;

    return {
      namespace,
      hasToken: true,
      isExpired,
      expiresAt: tokenInfo.expiresAt?.toISOString(),
    };
  }

  /**
   * 取得所有 Token 資訊概覽
   */
  getAllTokensInfo(): Array<{
    namespace: string;
    hasToken: boolean;
    isExpired: boolean;
    expiresAt?: string;
  }> {
    return this.getNamespaces()
      .map(namespace => this.getTokenInfo(namespace))
      .filter((info): info is NonNullable<typeof info> => info !== null);
  }
}