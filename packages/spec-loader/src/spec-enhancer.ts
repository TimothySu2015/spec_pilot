/**
 * SpecEnhancer - OpenAPI 規格增強器
 *
 * 自動補充 OpenAPI 規格中缺少的 operationId，
 * 使用 yaml.parseDocument() 保留原檔案格式、註解和縮排。
 */

import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { access, constants } from 'node:fs';
import { parseDocument, Document } from 'yaml';
import type { Scalar, YAMLMap, Pair } from 'yaml';
import { SpecFileNotFoundError, SpecParseError } from './errors.js';

/**
 * operationId 補充資訊
 */
export interface OperationIdAddition {
  method: string;
  path: string;
  generatedId: string;
}

/**
 * 增強結果
 */
export interface EnhanceResult {
  /** 是否成功 */
  success: boolean;
  /** 修改的檔案路徑 */
  filePath: string;
  /** 備份檔案路徑（如果建立了備份） */
  backupPath?: string;
  /** 新增的 operationId 清單 */
  additions: OperationIdAddition[];
  /** 總端點數 */
  totalEndpoints: number;
  /** 錯誤訊息（失敗時） */
  error?: string;
}

/**
 * SpecEnhancer 選項
 */
export interface SpecEnhancerOptions {
  /** 是否建立備份（預設 true） */
  createBackup?: boolean;
  /** 備份檔案後綴（預設 .bak） */
  backupSuffix?: string;
  /** 是否為 dryRun 模式（預設 false） */
  dryRun?: boolean;
}

/**
 * HTTP 方法清單
 */
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

/**
 * OpenAPI 規格增強器
 */
export class SpecEnhancer {
  private options: Required<SpecEnhancerOptions>;

  constructor(options: SpecEnhancerOptions = {}) {
    this.options = {
      createBackup: options.createBackup ?? true,
      backupSuffix: options.backupSuffix ?? '.bak',
      dryRun: options.dryRun ?? false,
    };
  }

  /**
   * 自動補充缺少的 operationId
   *
   * @param specPath - OpenAPI 規格檔案路徑
   * @returns 增強結果
   */
  async addOperationIds(specPath: string): Promise<EnhanceResult> {
    // 1. 檢查檔案是否存在
    try {
      await new Promise<void>((resolve, reject) => {
        access(specPath, constants.F_OK, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch {
      throw new SpecFileNotFoundError(specPath);
    }

    // 2. 檢查檔案是否可寫入（非 dryRun 時）
    if (!this.options.dryRun) {
      try {
        await new Promise<void>((resolve, reject) => {
          access(specPath, constants.W_OK, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } catch {
        return {
          success: false,
          filePath: specPath,
          additions: [],
          totalEndpoints: 0,
          error: `檔案無寫入權限: ${specPath}`,
        };
      }
    }

    try {
      // 3. 讀取檔案內容
      const content = await readFile(specPath, 'utf-8');

      // 4. 使用 parseDocument 保留格式
      const doc = parseDocument(content);

      // 5. 檢測缺少的 operationId 並補充
      const additions = await this.processDocument(doc);

      // 6. 如果是 dryRun，只返回結果不寫入
      if (this.options.dryRun) {
        return {
          success: true,
          filePath: specPath,
          additions,
          totalEndpoints: this.countTotalEndpoints(doc),
        };
      }

      // 7. 建立備份（如果啟用）
      let backupPath: string | undefined;
      if (this.options.createBackup && additions.length > 0) {
        backupPath = specPath + this.options.backupSuffix;
        await copyFile(specPath, backupPath);
      }

      // 8. 寫回檔案（只有在有修改時）
      if (additions.length > 0) {
        const modifiedContent = doc.toString();
        await writeFile(specPath, modifiedContent, 'utf-8');
      }

      return {
        success: true,
        filePath: specPath,
        backupPath,
        additions,
        totalEndpoints: this.countTotalEndpoints(doc),
      };
    } catch (error) {
      if (error instanceof SpecFileNotFoundError) {
        throw error;
      }

      return {
        success: false,
        filePath: specPath,
        additions: [],
        totalEndpoints: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 處理 YAML 文件，補充缺少的 operationId
   */
  private processDocument(doc: Document): OperationIdAddition[] {
    const additions: OperationIdAddition[] = [];

    // 取得 paths 節點
    const root = doc.contents as YAMLMap;
    if (!root || !root.has) {
      return additions;
    }

    const paths = root.get('paths') as YAMLMap;
    if (!paths || !paths.items) {
      return additions;
    }

    // 遍歷所有路徑
    for (const pathPair of paths.items) {
      const path = (pathPair.key as Scalar).value as string;
      const pathItem = pathPair.value as YAMLMap;

      if (!pathItem || !pathItem.items) continue;

      // 遍歷所有 HTTP 方法
      for (const methodPair of pathItem.items) {
        const method = String((methodPair.key as Scalar).value).toLowerCase();

        // 只處理 HTTP 方法
        if (!HTTP_METHODS.includes(method as any)) continue;

        const operation = methodPair.value as YAMLMap;
        if (!operation || !operation.items) continue;

        // 檢查是否缺少 operationId
        const hasOperationId = operation.has('operationId');

        if (!hasOperationId) {
          // 產生 operationId
          const generatedId = this.generateOperationId(method, path);

          // 新增到 operation
          operation.set('operationId', generatedId);

          additions.push({
            method: method.toUpperCase(),
            path,
            generatedId,
          });
        }
      }
    }

    return additions;
  }

  /**
   * 計算總端點數
   */
  private countTotalEndpoints(doc: Document): number {
    let count = 0;

    const root = doc.contents as YAMLMap;
    if (!root || !root.has) {
      return count;
    }

    const paths = root.get('paths') as YAMLMap;
    if (!paths || !paths.items) {
      return count;
    }

    for (const pathPair of paths.items) {
      const pathItem = pathPair.value as YAMLMap;
      if (!pathItem || !pathItem.items) continue;

      for (const methodPair of pathItem.items) {
        const method = String((methodPair.key as Scalar).value).toLowerCase();
        if (HTTP_METHODS.includes(method as any)) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * 自動產生 operationId
   * 例如: POST /api/users -> createApiUsers
   *
   * 邏輯與 test-suite-generator 的 SpecAnalyzer 一致
   */
  private generateOperationId(method: string, path: string): string {
    // 移除路徑參數並轉換為駝峰命名
    const segments = path
      .split('/')
      .filter(Boolean)
      .map((seg) => seg.replace(/\{.*?\}/g, '')) // 移除 {id} 等參數
      .filter(Boolean)
      .map((seg) => {
        // 每個 segment 都首字母大寫
        return seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase();
      });

    const methodPrefix = this.getMethodPrefix(method);
    return methodPrefix + segments.join('');
  }

  /**
   * 取得方法前綴
   */
  private getMethodPrefix(method: string): string {
    const prefixMap: Record<string, string> = {
      get: 'get',
      post: 'create',
      put: 'update',
      patch: 'patch',
      delete: 'delete',
    };
    return prefixMap[method.toLowerCase()] || method.toLowerCase();
  }
}
