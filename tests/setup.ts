import { beforeEach, afterEach } from 'vitest';
import { resetExecutionId } from '@specpilot/shared';

/**
 * 測試前設定
 */
beforeEach(() => {
  // 重置執行 ID
  resetExecutionId();
  
  // 設定測試環境變數
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
});

/**
 * 測試後清理
 */
afterEach(() => {
  // 清理測試建立的環境變數
  delete process.env.SPEC_PILOT_BASE_URL;
  delete process.env.SPEC_PILOT_PORT;
  delete process.env.SPEC_PILOT_TOKEN;
});