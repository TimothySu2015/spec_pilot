import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import type { FileFormat, ContentTypeDetection, SUPPORTED_EXTENSIONS } from './types.js';

/**
 * 根據檔案副檔名判斷格式
 */
export function getFormatFromExtension(filePath: string): FileFormat | null {
  const ext = extname(filePath).toLowerCase();
  
  switch (ext) {
    case '.json':
      return 'json';
    case '.yaml':
    case '.yml':
      return 'yaml';
    default:
      return null;
  }
}

/**
 * 檢查是否為支援的副檔名
 */
export function isSupportedExtension(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase() as typeof SUPPORTED_EXTENSIONS[number];
  return ['.json', '.yaml', '.yml'].includes(ext);
}

/**
 * 推斷內容格式
 * 基於內容的第一個非空白字符判斷
 */
export function detectContentFormat(content: string): ContentTypeDetection {
  const trimmed = content.trim();
  
  if (!trimmed) {
    return { format: 'json', confidence: 0 };
  }
  
  const firstChar = trimmed[0];
  
  // JSON 通常以 { 或 [ 開始
  if (firstChar === '{' || firstChar === '[') {
    return { format: 'json', confidence: 0.9 };
  }
  
  // YAML 的一些常見特徵
  if (
    trimmed.startsWith('---') ||           // YAML 文件分隔符
    trimmed.startsWith('openapi:') ||       // OpenAPI YAML
    trimmed.startsWith('swagger:') ||       // Swagger YAML
    /^[a-zA-Z_][a-zA-Z0-9_]*:\s/.test(trimmed) // YAML key: value 格式
  ) {
    return { format: 'yaml', confidence: 0.8 };
  }
  
  // 如果有多行且包含冒號，可能是 YAML
  if (trimmed.includes('\n') && trimmed.includes(':')) {
    return { format: 'yaml', confidence: 0.6 };
  }
  
  // 預設為 JSON，但信心度較低
  return { format: 'json', confidence: 0.3 };
}

/**
 * 生成內容的 SHA-256 雜湊
 */
export function generateContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * 生成規格文件 ID
 * 如果有檔案路徑，使用檔案路徑；否則使用內容雜湊
 */
export function generateSpecId(filePath?: string, content?: string): string {
  if (filePath) {
    return filePath;
  }
  
  if (content) {
    return `content-${generateContentHash(content).substring(0, 16)}`;
  }
  
  throw new Error('無法生成規格 ID：缺少檔案路徑或內容');
}

/**
 * 遮罩敏感資訊
 * 根據錯誤處理策略遮罩敏感欄位
 */
export function maskSensitiveFields(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const masked = { ...obj };
  
  // 遞迴處理巢狀物件
  function maskObject(target: Record<string, unknown>, path: string[] = []): void {
    for (const [key, value] of Object.entries(target)) {
      const currentPath = [...path, key];
      const pathStr = currentPath.join('.');
      
      // 檢查是否為敏感欄位
      if (shouldMaskField(pathStr, key)) {
        target[key] = '***';
        continue;
      }
      
      // 遞迴處理物件和陣列
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          target[key] = value.map((item, index) => {
            if (item && typeof item === 'object') {
              const itemCopy = { ...item };
              maskObject(itemCopy as Record<string, unknown>, [...currentPath, index.toString()]);
              return itemCopy;
            }
            return item;
          });
        } else {
          maskObject(value as Record<string, unknown>, currentPath);
        }
      }
    }
  }
  
  maskObject(masked);
  return masked;
}

/**
 * 判斷是否需要遮罩的欄位
 */
function shouldMaskField(path: string, fieldName: string): boolean {
  const sensitivePatterns = [
    /servers\.\d+\.url/,                    // servers[*].url
    /securitySchemes\..*\.flows\..*\.tokenUrl/, // securitySchemes.*.flows.*.tokenUrl
    /securitySchemes\..*\.clientSecret/,    // securitySchemes.*.clientSecret
    /authorization/i,                       // 包含 authorization 的欄位
    /token/i,                              // 包含 token 的欄位  
    /secret/i,                             // 包含 secret 的欄位
    /password/i,                           // 包含 password 的欄位
    /key/i                                 // 包含 key 的欄位
  ];
  
  return sensitivePatterns.some(pattern => pattern.test(path) || pattern.test(fieldName));
}