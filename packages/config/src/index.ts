import { config } from 'dotenv-flow';
import { z } from 'zod';
import { AuthConfigManager, type AuthConfig } from './auth-config.js';

// 初始化環境變數載入
config({
  path: process.cwd(),
  pattern: '.env*',
  default_node_env: 'development',
});

/**
 * SpecPilot 設定 Schema
 */
const SpecPilotConfigSchema = z.object({
  baseUrl: z.string().url().optional(),
  port: z.number().int().positive().optional().default(443),
  token: z.string().optional(),
  environment: z.enum(['development', 'production', 'staging', 'test']).default('development'),
  /** 認證設定 */
  auth: z.any().optional(),
});

export type SpecPilotConfig = z.infer<typeof SpecPilotConfigSchema> & {
  auth?: AuthConfig;
};

/**
 * 從環境變數載入並驗證設定
 */
function loadConfigFromEnv(): SpecPilotConfig {
  const rawConfig = {
    baseUrl: process.env.SPEC_PILOT_BASE_URL,
    port: process.env.SPEC_PILOT_PORT ? parseInt(process.env.SPEC_PILOT_PORT, 10) : undefined,
    token: process.env.SPEC_PILOT_TOKEN,
    environment: process.env.NODE_ENV as 'development' | 'production' | 'staging' | 'test' | undefined,
  };

  return SpecPilotConfigSchema.parse(rawConfig);
}

let cachedConfig: SpecPilotConfig | null = null;
let authConfigManager: AuthConfigManager | null = null;

/**
 * 取得完整設定物件
 */
export function getConfig(): SpecPilotConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfigFromEnv();
    // 載入認證設定
    cachedConfig.auth = getAuthConfig();
  }
  return cachedConfig;
}

/**
 * 取得 API Base URL
 */
export function getBaseUrl(): string | undefined {
  return getConfig().baseUrl;
}

/**
 * 取得 API 埠號
 */
export function getPort(): number {
  return getConfig().port;
}

/**
 * 取得 API 認證 Token
 */
export function getToken(): string | undefined {
  return getConfig().token;
}

/**
 * 重置設定快取（主要用於測試）
 */
export function resetConfigCache(): void {
  cachedConfig = null;
  authConfigManager = null;
}

/**
 * 覆寫設定值（主要用於 CLI/MCP 參數覆寫）
 */
export function overrideConfig(overrides: Partial<SpecPilotConfig>): void {
  const currentConfig = getConfig();
  cachedConfig = SpecPilotConfigSchema.parse({
    ...currentConfig,
    ...overrides,
  });
}

/**
 * 取得認證設定管理器
 */
export function getAuthConfigManager(): AuthConfigManager {
  if (!authConfigManager) {
    authConfigManager = new AuthConfigManager();
  }
  return authConfigManager;
}

/**
 * 取得認證設定
 */
export function getAuthConfig(): AuthConfig {
  return getAuthConfigManager().getConfig();
}

/**
 * 取得所有靜態 Token 設定
 */
export function getStaticTokens() {
  return getAuthConfigManager().getStaticTokens();
}

/**
 * 取得指定命名空間的靜態 Token
 */
export function getStaticToken(namespace: string) {
  return getAuthConfigManager().getStaticToken(namespace);
}

/**
 * 取得命名空間設定
 */
export function getNamespaceConfig(namespace: string) {
  return getAuthConfigManager().getNamespaceConfig(namespace);
}

/**
 * 取得預設 Token 過期時間
 */
export function getDefaultExpirySeconds(): number {
  return getAuthConfigManager().getDefaultExpirySeconds();
}

// 匯出認證設定相關類型和類別
export { AuthConfigManager, type AuthConfig, type StaticToken, type NamespaceConfig } from './auth-config.js';