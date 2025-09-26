import { config } from 'dotenv-flow';
import { z } from 'zod';

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
});

export type ISpecPilotConfig = z.infer<typeof SpecPilotConfigSchema>;

/**
 * 從環境變數載入並驗證設定
 */
function loadConfigFromEnv(): ISpecPilotConfig {
  const rawConfig = {
    baseUrl: process.env.SPEC_PILOT_BASE_URL,
    port: process.env.SPEC_PILOT_PORT ? parseInt(process.env.SPEC_PILOT_PORT, 10) : undefined,
    token: process.env.SPEC_PILOT_TOKEN,
    environment: process.env.NODE_ENV as 'development' | 'production' | 'staging' | 'test' | undefined,
  };

  return SpecPilotConfigSchema.parse(rawConfig);
}

let cachedConfig: ISpecPilotConfig | null = null;

/**
 * 取得完整設定物件
 */
export function getConfig(): ISpecPilotConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfigFromEnv();
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
}

/**
 * 覆寫設定值（主要用於 CLI/MCP 參數覆寫）
 */
export function overrideConfig(overrides: Partial<ISpecPilotConfig>): void {
  const currentConfig = getConfig();
  cachedConfig = SpecPilotConfigSchema.parse({
    ...currentConfig,
    ...overrides,
  });
}