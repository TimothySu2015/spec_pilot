import { createStructuredLogger } from '@specpilot/shared';
import { type IFlowDefinition } from '@specpilot/core-flow';
import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';

const logger = createStructuredLogger('flow-parser');

/**
 * YAML 流程解析器
 */
export class FlowParser {
  /**
   * 從 YAML 檔案解析測試流程
   */
  async parseFromFile(filePath: string): Promise<IFlowDefinition> {
    logger.info('解析 YAML 流程檔案', { filePath });

    try {
      const content = readFileSync(filePath, 'utf8');
      const yamlData = parseYaml(content);

      if (!this.validateFlowYaml(yamlData)) {
        throw new Error('無效的流程 YAML 格式');
      }

      const flow: IFlowDefinition = {
        name: yamlData.name,
        description: yamlData.description,
        steps: yamlData.steps.map((step: unknown) => {
          const s = step as Record<string, unknown>;
          return {
            name: s.name as string,
            method: s.method as string,
            url: s.url as string,
            headers: s.headers as Record<string, string> | undefined,
            body: s.body,
            validation: s.validation,
            fallback: s.fallback,
          };
        }),
      };

      logger.info('流程解析成功', { 
        flowName: flow.name,
        stepCount: flow.steps.length,
      });

      return flow;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      logger.error('流程解析失敗', { filePath, error: errorMessage });
      throw error;
    }
  }

  /**
   * 驗證流程 YAML 格式
   */
  private validateFlowYaml(data: unknown): boolean {
    if (!data || typeof data !== 'object') {
      logger.error('YAML 資料不是有效的物件');
      return false;
    }

    const flow = data as Record<string, unknown>;

    if (!flow.name || typeof flow.name !== 'string') {
      logger.error('缺少或無效的流程名稱');
      return false;
    }

    if (!Array.isArray(flow.steps)) {
      logger.error('缺少或無效的流程步驟');
      return false;
    }

    for (const [index, step] of flow.steps.entries()) {
      if (!step || typeof step !== 'object') {
        logger.error('無效的步驟格式', { stepIndex: index });
        return false;
      }

      const s = step as Record<string, unknown>;
      if (!s.name || !s.method || !s.url) {
        logger.error('步驟缺少必要欄位', { 
          stepIndex: index, 
          hasName: !!s.name,
          hasMethod: !!s.method,
          hasUrl: !!s.url,
        });
        return false;
      }
    }

    logger.debug('流程 YAML 驗證通過');
    return true;
  }

  /**
   * 從字串解析流程
   */
  async parseFromString(yamlContent: string): Promise<IFlowDefinition> {
    logger.info('解析流程字串');

    try {
      const yamlData = parseYaml(yamlContent);

      if (!this.validateFlowYaml(yamlData)) {
        throw new Error('無效的流程 YAML 格式');
      }

      const flow: IFlowDefinition = {
        name: yamlData.name,
        description: yamlData.description,
        steps: yamlData.steps.map((step: unknown) => {
          const s = step as Record<string, unknown>;
          return {
            name: s.name as string,
            method: s.method as string,
            url: s.url as string,
            headers: s.headers as Record<string, string> | undefined,
            body: s.body,
            validation: s.validation,
            fallback: s.fallback,
          };
        }),
      };

      logger.info('流程字串解析成功', { 
        flowName: flow.name,
        stepCount: flow.steps.length,
      });

      return flow;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      logger.error('流程字串解析失敗', { error: errorMessage });
      throw error;
    }
  }
}