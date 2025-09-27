/**
 * 認證設定管理模組
 */

import { z } from 'zod';
import { createStructuredLogger } from '@specpilot/shared';

const logger = createStructuredLogger('auth-config');

/**
 * 靜態 Token 設定 Schema
 */
const StaticTokenSchema = z.object({
  /** 命名空間 */
  namespace: z.string().min(1),
  /** Token 值（可使用環境變數格式 ${VAR_NAME}） */
  token: z.string().min(1),
  /** Token 有效期（秒） */
  expiresInSeconds: z.number().int().positive().optional(),
});

/**
 * 命名空間設定 Schema
 */
const NamespaceConfigSchema = z.object({
  /** 認證失敗時是否自動重試 */
  retryOnAuthFailure: z.boolean().optional().default(false),
  /** 命名空間描述 */
  description: z.string().optional(),
});

/**
 * 認證設定 Schema
 */
const AuthConfigSchema = z.object({
  /** 靜態 Token 設定 */
  static: z.array(StaticTokenSchema).optional().default([]),
  /** 命名空間設定 */
  namespaces: z.record(z.string(), NamespaceConfigSchema).optional().default({}),
  /** 預設 Token 過期時間（秒） */
  defaultExpirySeconds: z.number().int().positive().optional().default(3600),
});

export type IStaticToken = z.infer<typeof StaticTokenSchema>;
export type INamespaceConfig = z.infer<typeof NamespaceConfigSchema>;
export type IAuthConfig = z.infer<typeof AuthConfigSchema>;

/**
 * 認證設定管理器
 */
export class AuthConfigManager {
  private authConfig: IAuthConfig;

  constructor(authConfig?: Partial<IAuthConfig>) {
    this.authConfig = AuthConfigSchema.parse(authConfig || {});
    this.loadFromEnvironment();
  }

  /**
   * 從環境變數載入認證設定
   */
  private loadFromEnvironment(): void {
    // 載入預設過期時間
    if (process.env.SPEC_PILOT_AUTH_DEFAULT_EXPIRY) {
      const defaultExpiry = parseInt(process.env.SPEC_PILOT_AUTH_DEFAULT_EXPIRY, 10);
      if (!isNaN(defaultExpiry) && defaultExpiry > 0) {
        this.authConfig.defaultExpirySeconds = defaultExpiry;
      }
    }

    // 載入自動重試設定
    if (process.env.SPEC_PILOT_AUTH_RETRY_ON_FAILURE) {
      const retryNamespaces = process.env.SPEC_PILOT_AUTH_RETRY_ON_FAILURE
        .split(',')
        .map(ns => ns.trim())
        .filter(ns => ns.length > 0);

      for (const namespace of retryNamespaces) {
        if (!this.authConfig.namespaces[namespace]) {
          this.authConfig.namespaces[namespace] = {};
        }
        this.authConfig.namespaces[namespace].retryOnAuthFailure = true;
      }
    }

    // 動態載入命名空間 Token
    this.loadNamespaceTokensFromEnv();

    logger.debug('認證設定已從環境變數載入', {
      component: 'auth-config',
      staticTokenCount: this.authConfig.static?.length || 0,
      namespacesCount: Object.keys(this.authConfig.namespaces).length,
      defaultExpirySeconds: this.authConfig.defaultExpirySeconds
    });
  }

  /**
   * 從環境變數載入命名空間 Token
   */
  private loadNamespaceTokensFromEnv(): void {
    const envPrefix = 'SPEC_PILOT_TOKEN_';

    Object.keys(process.env).forEach(envKey => {
      if (envKey.startsWith(envPrefix)) {
        const namespace = envKey.substring(envPrefix.length).toLowerCase();
        const tokenValue = process.env[envKey];

        if (tokenValue && namespace) {
          // 檢查是否已存在相同命名空間的靜態設定
          const existingIndex = this.authConfig.static?.findIndex(
            token => token.namespace === namespace
          );

          if (existingIndex !== undefined && existingIndex >= 0) {
            // 覆寫現有設定
            this.authConfig.static![existingIndex].token = tokenValue;
          } else {
            // 新增新的靜態 Token
            this.authConfig.static = this.authConfig.static || [];
            this.authConfig.static.push({
              namespace,
              token: tokenValue,
              expiresInSeconds: this.authConfig.defaultExpirySeconds
            });
          }

          logger.debug('從環境變數載入 Token', {
            component: 'auth-config',
            namespace,
            envKey,
            event: 'ENV_TOKEN_LOADED'
          });
        }
      }
    });
  }

  /**
   * 取得所有靜態 Token 設定
   */
  getStaticTokens(): IStaticToken[] {
    return this.authConfig.static || [];
  }

  /**
   * 取得指定命名空間的靜態 Token
   */
  getStaticToken(namespace: string): IStaticToken | undefined {
    return this.authConfig.static?.find(token => token.namespace === namespace);
  }

  /**
   * 新增或更新靜態 Token
   */
  setStaticToken(staticToken: IStaticToken): void {
    this.authConfig.static = this.authConfig.static || [];

    const existingIndex = this.authConfig.static.findIndex(
      token => token.namespace === staticToken.namespace
    );

    if (existingIndex >= 0) {
      this.authConfig.static[existingIndex] = staticToken;
    } else {
      this.authConfig.static.push(staticToken);
    }

    logger.info('靜態 Token 設定已更新', {
      component: 'auth-config',
      namespace: staticToken.namespace,
      hasExpiry: !!staticToken.expiresInSeconds
    });
  }

  /**
   * 移除指定命名空間的靜態 Token
   */
  removeStaticToken(namespace: string): boolean {
    if (!this.authConfig.static) {
      return false;
    }

    const initialLength = this.authConfig.static.length;
    this.authConfig.static = this.authConfig.static.filter(
      token => token.namespace !== namespace
    );

    const removed = this.authConfig.static.length < initialLength;

    if (removed) {
      logger.info('靜態 Token 設定已移除', {
        component: 'auth-config',
        namespace
      });
    }

    return removed;
  }

  /**
   * 取得命名空間設定
   */
  getNamespaceConfig(namespace: string): INamespaceConfig {
    return this.authConfig.namespaces[namespace] || {
      retryOnAuthFailure: false
    };
  }

  /**
   * 設定命名空間配置
   */
  setNamespaceConfig(namespace: string, config: INamespaceConfig): void {
    this.authConfig.namespaces[namespace] = config;

    logger.info('命名空間設定已更新', {
      component: 'auth-config',
      namespace,
      retryOnAuthFailure: config.retryOnAuthFailure,
      hasDescription: !!config.description
    });
  }

  /**
   * 取得預設 Token 過期時間
   */
  getDefaultExpirySeconds(): number {
    return this.authConfig.defaultExpirySeconds;
  }

  /**
   * 設定預設 Token 過期時間
   */
  setDefaultExpirySeconds(seconds: number): void {
    if (seconds <= 0) {
      throw new Error('預設過期時間必須是正整數');
    }

    this.authConfig.defaultExpirySeconds = seconds;

    logger.info('預設 Token 過期時間已更新', {
      component: 'auth-config',
      defaultExpirySeconds: seconds
    });
  }

  /**
   * 解析環境變數格式的 Token 值
   */
  resolveTokenValue(tokenValue: string): string | null {
    if (tokenValue.startsWith('${') && tokenValue.endsWith('}')) {
      const envVarName = tokenValue.slice(2, -1);
      const envValue = process.env[envVarName];

      if (!envValue) {
        logger.warn('環境變數未設定', {
          component: 'auth-config',
          envVarName,
          tokenValue,
          event: 'ENV_VAR_MISSING'
        });
        return null;
      }

      return envValue;
    }

    return tokenValue;
  }

  /**
   * 驗證認證設定
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 驗證靜態 Token
    for (const staticToken of this.authConfig.static || []) {
      if (!staticToken.namespace.trim()) {
        errors.push(`靜態 Token 的命名空間不能為空`);
      }

      if (!staticToken.token.trim()) {
        errors.push(`命名空間 "${staticToken.namespace}" 的 Token 值不能為空`);
      }

      if (staticToken.expiresInSeconds !== undefined && staticToken.expiresInSeconds <= 0) {
        errors.push(`命名空間 "${staticToken.namespace}" 的過期時間必須是正整數`);
      }

      // 檢查環境變數格式的 Token 是否可解析
      const resolvedToken = this.resolveTokenValue(staticToken.token);
      if (!resolvedToken) {
        errors.push(`命名空間 "${staticToken.namespace}" 的 Token 值無法解析`);
      }
    }

    // 檢查重複的命名空間
    const namespaces = (this.authConfig.static || []).map(token => token.namespace);
    const duplicates = namespaces.filter((namespace, index) =>
      namespaces.indexOf(namespace) !== index
    );

    for (const duplicate of new Set(duplicates)) {
      errors.push(`命名空間 "${duplicate}" 出現重複設定`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 取得完整認證設定
   */
  getConfig(): IAuthConfig {
    return { ...this.authConfig };
  }

  /**
   * 重設設定（主要用於測試）
   */
  reset(): void {
    this.authConfig = AuthConfigSchema.parse({});
    this.loadFromEnvironment();
  }
}