/**
 * Generate Flow Handler - 對話式 Flow 產生
 */

import type { IMcpRequest, IMcpResponse } from '../rpc-handler.js';
import { createSuccessResponse, createErrorResponse, JSON_RPC_ERROR_CODES } from '../rpc-handler.js';
import { createStructuredLogger } from '@specpilot/shared';
import { loadSpec } from '@specpilot/spec-loader';
import { NLPFlowParser, IntentRecognizer, ContextManager, FlowBuilder, SuggestionEngine } from '@specpilot/flow-generator';
import { FlowValidator } from '@specpilot/flow-validator';
import { stringify } from 'yaml';

const logger = createStructuredLogger('mcp-server');

/**
 * generateFlow 參數介面
 */
interface IGenerateFlowParams {
  description: string;
  spec?: string;
  specContent?: string;
  contextId?: string;
  autoValidate?: boolean;
}

/**
 * generateFlow 結果介面
 */
interface IGenerateFlowResult {
  flowYaml: string;
  contextId: string;
  suggestions: Array<{
    type: string;
    message: string;
  }>;
  confidence: number;
}

/**
 * 處理 generateFlow 方法
 */
export async function handleGenerateFlow(request: IMcpRequest): Promise<IMcpResponse> {
  const executionId = `gen-flow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  logger.info('generate_flow_start', {
    executionId,
    method: 'generateFlow',
    component: 'mcp-server',
  });

  try {
    // 驗證參數
    const params = request.params as IGenerateFlowParams;

    if (!params || !params.description) {
      return createErrorResponse(
        JSON_RPC_ERROR_CODES.INVALID_PARAMS,
        '缺少必要參數: description',
        request.id || null
      );
    }

    if (!params.spec && !params.specContent) {
      return createErrorResponse(
        JSON_RPC_ERROR_CODES.INVALID_PARAMS,
        '必須提供 spec 或 specContent 參數',
        request.id || null
      );
    }

    // 載入 OpenAPI 規格
    const specContent = params.specContent || (await import('fs')).readFileSync(params.spec!, 'utf-8');
    const specDoc = await loadSpec({ content: specContent, executionId });

    // 取得或建立對話上下文
    const contextManager = ContextManager.getInstance();
    const contextId = params.contextId || contextManager.createContext();
    const context = contextManager.getContext(contextId);

    if (!context) {
      return createErrorResponse(
        JSON_RPC_ERROR_CODES.INVALID_PARAMS,
        '對話上下文不存在或已過期',
        request.id || null
      );
    }

    // 解析使用者意圖
    const parser = new NLPFlowParser({ spec: specDoc });
    const intent = await parser.parse(params.description, context);

    // 推薦端點
    const recognizer = new IntentRecognizer({
      spec: specDoc,
      minConfidence: 0.3,
      maxResults: 5,
    });
    const endpoints = recognizer.recommendEndpoints(intent);

    if (endpoints.length === 0) {
      // 更新對話記錄
      contextManager.addConversationTurn(contextId, {
        role: 'user',
        content: params.description,
        timestamp: new Date().toISOString(),
        parsedIntent: intent,
      });

      return createSuccessResponse<IGenerateFlowResult>(
        {
          flowYaml: '',
          contextId,
          suggestions: [
            {
              type: 'error',
              message: '無法從描述中識別出相關的 API 端點。請提供更多細節。',
            },
          ],
          confidence: 0,
        },
        request.id || null
      );
    }

    // 建構 Flow 步驟
    const builder = new FlowBuilder();
    builder.setName('對話式產生的測試流程').addStep({
      operationId: endpoints[0].operationId,
      parameters: intent.entities.parameters,
    });

    // 提供智能建議
    const suggestionEngine = new SuggestionEngine();
    const suggestions = suggestionEngine.getSuggestions(builder.getCurrentStep() || {}, endpoints[0].endpoint);

    // 建構 Flow
    const flow = builder.build();

    // 驗證產生的 Flow（如果啟用）
    if (params.autoValidate !== false) {
      const validator = new FlowValidator({
        spec: specDoc,
        schemaOptions: { strict: false },
        semanticOptions: {
          checkOperationIds: true,
          checkVariableReferences: true,
        },
      });

      const validationResult = validator.validate(flow);

      if (!validationResult.valid) {
        logger.warn('generate_flow_validation_failed', {
          executionId,
          errors: validationResult.errors,
        });

        suggestions.push({
          type: 'validation_error',
          message: `驗證失敗: ${validationResult.errors.map((e) => e.message).join(', ')}`,
        });
      }
    }

    // 更新上下文
    contextManager.updateContext(contextId, {
      currentFlow: flow,
    });

    contextManager.addConversationTurn(contextId, {
      role: 'user',
      content: params.description,
      timestamp: new Date().toISOString(),
      parsedIntent: intent,
    });

    // 轉換為 YAML
    const yamlContent = stringify(flow);

    logger.info('generate_flow_success', {
      executionId,
      contextId,
      stepsCount: flow.steps.length,
    });

    return createSuccessResponse<IGenerateFlowResult>(
      {
        flowYaml: yamlContent,
        contextId,
        suggestions: suggestions.map((s) => ({
          type: s.type,
          message: s.message,
        })),
        confidence: endpoints[0].confidence,
      },
      request.id || null
    );
  } catch (error) {
    logger.error('generate_flow_error', {
      executionId,
      error: error instanceof Error ? error.message : '未知錯誤',
    });

    return createErrorResponse(
      JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : '產生 Flow 時發生錯誤',
      request.id || null
    );
  }
}
