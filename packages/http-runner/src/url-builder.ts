import { createStructuredLogger } from '@specpilot/shared';
import type { UrlBuilderOptions } from './types.js';

const logger = createStructuredLogger('url-builder');

/**
 * URL 建構工具類別，處理 baseUrl 拼接、變數替換、URL 編碼等功能
 */
export class UrlBuilder {
  /**
   * 建構完整的 URL
   */
  static build(options: UrlBuilderOptions): string {
    const { baseUrl, path, pathParams = {}, queryParams = {} } = options;

    try {
      // 驗證必要參數
      if (!baseUrl || baseUrl.trim() === '') {
        throw new Error('baseUrl 不能為空');
      }

      // 標準化 baseUrl（移除尾隨斜線）
      const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

      // 標準化 path（確保以斜線開頭）
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;

      // 替換路徑參數
      const resolvedPath = this.replacePathParameters(normalizedPath, pathParams);

      // 建構基礎 URL
      const fullUrl = `${normalizedBaseUrl}${resolvedPath}`;

      // 添加查詢參數
      const finalUrl = this.appendQueryParameters(fullUrl, queryParams);

      logger.debug('URL 建構完成', {
        component: 'url-builder',
        originalPath: path,
        resolvedPath,
        baseUrl: normalizedBaseUrl,
        finalUrl,
        pathParams,
        queryParams,
      });

      return finalUrl;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      logger.error('URL 建構失敗', {
        component: 'url-builder',
        baseUrl,
        path,
        pathParams,
        queryParams,
        error: errorMessage,
      });
      throw new Error(`URL 建構失敗: ${errorMessage}`);
    }
  }

  /**
   * 替換路徑參數 (例如: /users/{id} -> /users/123)
   */
  private static replacePathParameters(path: string, pathParams: Record<string, string>): string {
    let resolvedPath = path;

    for (const [key, value] of Object.entries(pathParams)) {
      // 支援 {key} 和 :key 兩種格式
      const patterns = [
        new RegExp(`\\{${key}\\}`, 'g'),
        new RegExp(`:${key}(?=/|$)`, 'g'),
      ];

      for (const pattern of patterns) {
        if (resolvedPath.match(pattern)) {
          const encodedValue = encodeURIComponent(value);
          resolvedPath = resolvedPath.replace(pattern, encodedValue);

          logger.debug('路徑參數替換', {
            component: 'url-builder',
            key,
            originalValue: value,
            encodedValue,
            pattern: pattern.source,
          });
        }
      }
    }

    // 檢查是否還有未解析的參數
    const unresolvedParams = resolvedPath.match(/[{:]\w+[}]?/g);
    if (unresolvedParams) {
      logger.warn('發現未解析的路徑參數', {
        component: 'url-builder',
        path: resolvedPath,
        unresolvedParams,
      });
    }

    return resolvedPath;
  }

  /**
   * 添加查詢參數
   */
  private static appendQueryParameters(url: string, queryParams: Record<string, string>): string {
    if (Object.keys(queryParams).length === 0) {
      return url;
    }

    const urlObj = new URL(url);

    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== null) {
        urlObj.searchParams.set(key, String(value));
      }
    }

    return urlObj.toString();
  }

  /**
   * 解析 URL 並提取元件
   */
  static parse(url: string): {
    protocol: string;
    hostname: string;
    port: string | null;
    pathname: string;
    search: string;
    hash: string;
    searchParams: Record<string, string>;
  } {
    try {
      const urlObj = new URL(url);
      const searchParams: Record<string, string> = {};

      urlObj.searchParams.forEach((value, key) => {
        searchParams[key] = value;
      });

      return {
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        port: urlObj.port || null,
        pathname: urlObj.pathname,
        search: urlObj.search,
        hash: urlObj.hash,
        searchParams,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      logger.error('URL 解析失敗', {
        component: 'url-builder',
        url,
        error: errorMessage,
      });
      throw new Error(`無效的 URL: ${url}`);
    }
  }

  /**
   * 驗證 URL 格式
   */
  static validate(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 標準化 URL（移除重複斜線、標準化編碼等）
   */
  static normalize(url: string): string {
    try {
      const urlObj = new URL(url);

      // 標準化路徑（移除重複斜線）
      urlObj.pathname = urlObj.pathname.replace(/\/+/g, '/');

      // 移除尾隨斜線（除非是根路徑）
      if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
        urlObj.pathname = urlObj.pathname.slice(0, -1);
      }

      return urlObj.toString();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      logger.error('URL 標準化失敗', {
        component: 'url-builder',
        url,
        error: errorMessage,
      });
      throw new Error(`URL 標準化失敗: ${errorMessage}`);
    }
  }

  /**
   * 檢查特殊字元並進行適當編碼
   */
  static encodeSpecialCharacters(text: string): string {
    // 編碼特殊字元，但保留 URL 路徑中的常見字元
    // 注意：& 符號需要被編碼為 %26
    return text
      .replace(/[^\w\-._~:/?#[\]@!$'()*+,;=%]/g, (char) =>
        encodeURIComponent(char)
      );
  }
}