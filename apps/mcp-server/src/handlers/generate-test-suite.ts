/**
 * Generate Test Suite Handler - 自動化測試套件產生
 */

import type { IMcpRequest, IMcpResponse } from '../rpc-handler.js';
import { createSuccessResponse, createErrorResponse, JSON_RPC_ERROR_CODES } from '../rpc-handler.js';
import { createStructuredLogger } from '@specpilot/shared';
import { loadSpec } from '@specpilot/spec-loader';
import { SpecAnalyzer, TestSuiteGenerator, type GenerationOptions, type TestSuiteSummary } from '@specpilot/test-suite-generator';
import { FlowValidator } from '@specpilot/flow-validator';
import { stringify } from 'yaml';

const logger = createStructuredLogger('mcp-server');

/**
 * generateTestSuite 參數介面
 */
interface IGenerateTestSuiteParams {
  spec?: string;
  specContent?: string;
  options?: GenerationOptions;
}

/**
 * generateTestSuite 結果介面
 */
interface IGenerateTestSuiteResult {
  flowYaml: string;
  summary: TestSuiteSummary;
}

/**
 * 處理 generateTestSuite 方法
 */
export async function handleGenerateTestSuite(request: IMcpRequest): Promise<IMcpResponse> {
  const executionId = `gen-suite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  logger.info('generate_test_suite_start', {
    executionId,
    method: 'generateTestSuite',
    component: 'mcp-server',
  });

  try {
    // 驗證參數
    const params = request.params as IGenerateTestSuiteParams;

    if (!params || (!params.spec && !params.specContent)) {
      return createErrorResponse(
        JSON_RPC_ERROR_CODES.INVALID_PARAMS,
        '必須提供 spec 或 specContent 參數',
        request.id || null
      );
    }

    // 載入 OpenAPI 規格
    const specContent = params.specContent || (await import('fs')).readFileSync(params.spec!, 'utf-8');
    const specDoc = await loadSpec({ content: specContent, executionId });

    // 分析規格
    const analyzer = new SpecAnalyzer({ spec: specDoc });
    const endpoints = analyzer.extractEndpoints();

    if (endpoints.length === 0) {
      return createErrorResponse(
        JSON_RPC_ERROR_CODES.INVALID_REQUEST,
        '找不到可產生測試的端點',
        request.id || null
      );
    }

    logger.info('generate_test_suite_analyzing', {
      executionId,
      endpointsCount: endpoints.length,
    });

    // 產生測試套件
    const generator = new TestSuiteGenerator(analyzer, params.options);
    const testSuite = generator.generate(params.options || {
      includeSuccessCases: true,
      includeErrorCases: true,
      includeEdgeCases: true,
      includeAuthTests: true,
    });

    // 驗證產生的 Flow
    const validator = new FlowValidator({
      spec: specDoc,
      schemaOptions: { strict: false },
      semanticOptions: {
        checkOperationIds: true,
        checkVariableReferences: false, // 自動產生的測試可能不需要變數引用
      },
    });

    const validationResult = validator.validate(testSuite);

    if (!validationResult.valid) {
      logger.warn('generate_test_suite_validation_failed', {
        executionId,
        errors: validationResult.errors,
      });

      return createErrorResponse(
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
        `產生的測試套件驗證失敗: ${validationResult.errors.map((e) => e.message).join(', ')}`,
        request.id || null
      );
    }

    // 取得摘要
    const summary = generator.getSummary(testSuite);

    // 轉換為 YAML
    const yamlContent = stringify(testSuite);

    logger.info('generate_test_suite_success', {
      executionId,
      summary,
    });

    return createSuccessResponse<IGenerateTestSuiteResult>(
      {
        flowYaml: yamlContent,
        summary,
      },
      request.id || null
    );
  } catch (error) {
    logger.error('generate_test_suite_error', {
      executionId,
      error: error instanceof Error ? error.message : '未知錯誤',
    });

    return createErrorResponse(
      JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : '產生測試套件時發生錯誤',
      request.id || null
    );
  }
}
