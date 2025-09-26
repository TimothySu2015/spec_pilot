import { createStructuredLogger } from '@specpilot/shared';
import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';

const logger = createStructuredLogger('spec-loader');

/**
 * OpenAPI 規格介面
 */
export interface IOpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, unknown>;
  components?: {
    schemas?: Record<string, unknown>;
    responses?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    examples?: Record<string, unknown>;
    requestBodies?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
    links?: Record<string, unknown>;
    callbacks?: Record<string, unknown>;
  };
}

/**
 * OpenAPI 規格載入器
 */
export class SpecLoader {
  /**
   * 從檔案載入 OpenAPI 規格
   */
  async loadFromFile(filePath: string): Promise<IOpenApiSpec> {
    logger.info('載入 OpenAPI 規格檔案', { filePath });

    try {
      const content = readFileSync(filePath, 'utf8');
      
      let spec: IOpenApiSpec;
      
      if (filePath.endsWith('.json')) {
        spec = JSON.parse(content);
      } else if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        spec = parseYaml(content);
      } else {
        throw new Error(`不支援的檔案格式: ${filePath}`);
      }

      // 基本驗證
      if (!this.validateSpec(spec)) {
        throw new Error('無效的 OpenAPI 規格');
      }

      logger.info('OpenAPI 規格載入成功', { 
        title: spec.info.title,
        version: spec.info.version,
        pathCount: Object.keys(spec.paths).length,
      });

      return spec;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      logger.error('OpenAPI 規格載入失敗', { filePath, error: errorMessage });
      throw error;
    }
  }

  /**
   * 驗證 OpenAPI 規格格式
   */
  private validateSpec(spec: unknown): spec is IOpenApiSpec {
    if (!spec || typeof spec !== 'object') {
      logger.error('規格不是有效的物件');
      return false;
    }

    const s = spec as Partial<IOpenApiSpec>;

    if (!s.openapi || !s.info || !s.paths) {
      logger.error('缺少必要的 OpenAPI 欄位', {
        hasOpenapi: !!s.openapi,
        hasInfo: !!s.info,
        hasPaths: !!s.paths,
      });
      return false;
    }

    if (!s.info.title || !s.info.version) {
      logger.error('缺少必要的 info 欄位');
      return false;
    }

    logger.debug('OpenAPI 規格驗證通過');
    return true;
  }

  /**
   * 列出規格中的所有端點
   */
  listEndpoints(spec: IOpenApiSpec): Array<{
    path: string;
    method: string;
    operationId?: string;
    summary?: string;
  }> {
    const endpoints: Array<{
      path: string;
      method: string;
      operationId?: string;
      summary?: string;
    }> = [];

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      if (typeof pathItem === 'object' && pathItem !== null) {
        const methods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
        
        for (const method of methods) {
          const operation = (pathItem as Record<string, unknown>)[method];
          if (operation && typeof operation === 'object') {
            const op = operation as Record<string, unknown>;
            endpoints.push({
              path,
              method: method.toUpperCase(),
              operationId: typeof op.operationId === 'string' ? op.operationId : undefined,
              summary: typeof op.summary === 'string' ? op.summary : undefined,
            });
          }
        }
      }
    }

    logger.info('列出規格端點', { endpointCount: endpoints.length });
    return endpoints;
  }
}