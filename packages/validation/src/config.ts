// import { getConfig } from '@specpilot/config'; // 暫時未使用

/**
 * 驗證設定介面
 */
export interface IValidationConfig {
  strict: boolean;
  allErrors: boolean;
  verbose: boolean;
  maxSchemaSize: number;
  customRuleTimeout: number;
}

/**
 * 預設驗證設定
 */
export const DEFAULT_VALIDATION_CONFIG: IValidationConfig = {
  strict: false,
  allErrors: true,
  verbose: true,
  maxSchemaSize: 1024 * 1024, // 1MB
  customRuleTimeout: 5000, // 5 seconds
};

/**
 * 取得驗證設定
 */
export function getValidationConfig(): IValidationConfig {
  // const globalConfig = getConfig(); // 暫時未使用

  // 從環境變數或設定檔中讀取驗證相關設定
  const validationConfig: Partial<IValidationConfig> = {
    strict: process.env.SPEC_PILOT_VALIDATION_STRICT === 'true',
    allErrors: process.env.SPEC_PILOT_VALIDATION_ALL_ERRORS !== 'false',
    verbose: process.env.SPEC_PILOT_VALIDATION_VERBOSE !== 'false',
    maxSchemaSize: process.env.SPEC_PILOT_VALIDATION_MAX_SCHEMA_SIZE ?
      parseInt(process.env.SPEC_PILOT_VALIDATION_MAX_SCHEMA_SIZE, 10) :
      undefined,
    customRuleTimeout: process.env.SPEC_PILOT_VALIDATION_CUSTOM_RULE_TIMEOUT ?
      parseInt(process.env.SPEC_PILOT_VALIDATION_CUSTOM_RULE_TIMEOUT, 10) :
      undefined,
  };

  // 合併預設設定與用戶設定
  return {
    ...DEFAULT_VALIDATION_CONFIG,
    ...validationConfig,
  };
}

/**
 * 驗證工廠設定
 */
export interface IValidationFactoryConfig {
  validation: IValidationConfig;
  enableSchemaCache: boolean;
  enableCustomRules: boolean;
}

/**
 * 取得驗證工廠設定
 */
export function getValidationFactoryConfig(): IValidationFactoryConfig {
  return {
    validation: getValidationConfig(),
    enableSchemaCache: process.env.SPEC_PILOT_VALIDATION_SCHEMA_CACHE !== 'false',
    enableCustomRules: process.env.SPEC_PILOT_VALIDATION_CUSTOM_RULES !== 'false',
  };
}