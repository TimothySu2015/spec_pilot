/**
 * MCP Server 靜默日誌器 (使用 rotating-file-stream 實作日誌輪轉)
 *
 * 特點:
 * - 只寫入檔案,不輸出到 stdout/stderr (避免干擾 MCP Stdio Transport)
 * - 自動輪轉日誌檔案 (基於檔案大小或時間)
 * - 自動壓縮舊日誌 (節省空間)
 * - 自動清理過期日誌
 */

import * as rfs from 'rotating-file-stream';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

// 確保 logs 目錄存在
const logsDir = path.join(process.cwd(), 'logs');
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
}

// 建立輪轉日誌串流
const logStream = rfs.createStream('mcp-server.log', {
  size: '10M',      // 每個檔案最大 10MB
  interval: '1d',   // 或每天輪轉一次 (兩個條件任一滿足就輪轉)
  compress: 'gzip', // 壓縮舊檔案 (節省 ~90% 空間)
  path: logsDir,
  maxFiles: 7,      // 保留最多 7 個舊檔案
});

/**
 * 日誌器介面
 */
export const logger = {
  /**
   * 記錄資訊訊息
   */
  info: (message: string, context?: unknown): void => {
    try {
      const logEntry = JSON.stringify({
        level: 'info',
        time: new Date().toISOString(),
        message,
        context
      }) + '\n';

      logStream.write(logEntry);
    } catch (e) {
      // 靜默處理錯誤,避免影響主程式
    }
  },

  /**
   * 記錄警告訊息
   */
  warn: (message: string, context?: unknown): void => {
    try {
      const logEntry = JSON.stringify({
        level: 'warn',
        time: new Date().toISOString(),
        message,
        context
      }) + '\n';

      logStream.write(logEntry);
    } catch (e) {
      // 靜默處理錯誤,避免影響主程式
    }
  },

  /**
   * 記錄錯誤訊息
   */
  error: (message: string, context?: unknown): void => {
    try {
      const logEntry = JSON.stringify({
        level: 'error',
        time: new Date().toISOString(),
        message,
        context
      }) + '\n';

      logStream.write(logEntry);
    } catch (e) {
      // 靜默處理錯誤,避免影響主程式
    }
  }
};
