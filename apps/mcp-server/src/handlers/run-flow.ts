import type { IMcpRequest, IMcpResponse, IRunFlowParams, IRunFlowResult, IRunFlowOptions } from '../rpc-handler.js';
import { createSuccessResponse, createErrorResponse, validateRunFlowParams, JSON_RPC_ERROR_CODES } from '../rpc-handler.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join, resolve, relative } from 'path';
import { createStructuredLogger } from '@specpilot/shared';
import { loadSpec } from '@specpilot/spec-loader';
import { loadFlow } from '@specpilot/flow-parser';
import { FlowOrchestrator } from '@specpilot/core-flow';
import { ReportGenerator } from '@specpilot/reporting';

const logger = createStructuredLogger('mcp-server');

/**
 * 處理 runFlow 方法
 */
export async function handleRunFlow(request: IMcpRequest): Promise<IMcpResponse> {
  const executionId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  logger.info('run_flow_start', {
    executionId,
    method: 'runFlow',
    component: 'mcp-server',
    details: {
      hasParams: !!request.params,
      requestId: request.id
    }
  });

  try {
    // 驗證參數
    const validation = validateRunFlowParams(request.params);
    if (!validation.isValid) {
      logger.error('run_flow_error', {
        executionId,
        method: 'runFlow',
        component: 'mcp-server',
        details: {
          error: validation.error,
          type: 'parameter_validation'
        }
      });

      return createErrorResponse(
        JSON_RPC_ERROR_CODES.INVALID_PARAMS,
        validation.error!,
        request.id || null
      );
    }

    const params = validation.params!;
    const startTime = Date.now();

    let specContent: string;
    let flowContent: string;
    let tempFiles: string[] = [];

    try {
      // 處理檔案模式或內容模式
      if (params.spec && params.flow) {
        // 檔案模式
        const result = await handleFileMode(params.spec, params.flow, executionId);
        specContent = result.specContent;
        flowContent = result.flowContent;
      } else if (params.specContent && params.flowContent) {
        // 內容模式
        const result = await handleContentMode(params.specContent, params.flowContent, executionId);
        specContent = result.specContent;
        flowContent = result.flowContent;
        tempFiles = result.tempFiles;
      } else {
        throw new Error('無效的參數組合');
      }

      // 載入並驗證 OpenAPI 規格
      await loadSpec({ content: specContent, executionId });

      // 解析 YAML 測試流程
      const flowDefinition = await loadFlow({ content: flowContent, executionId });

      // 處理設定覆寫
      const overrideConfig = createConfigOverride(params);

      // 執行測試流程（套用覆寫設定）
      const orchestrator = new FlowOrchestrator();

      // 將覆寫設定注入到流程定義中
      const enhancedFlowDefinition = applyConfigOverrides(flowDefinition, overrideConfig);

      const testResults = await orchestrator.executeFlowDefinition(enhancedFlowDefinition, executionId);

      // 產生報表
      const reportGenerator = new ReportGenerator();
      const report = reportGenerator.generateReport(
        flowDefinition.name || 'Unnamed Flow',
        testResults,
        {
          baseUrl: params.baseUrl,
          port: params.port
        },
        {
          executionId,
          mode: params.spec ? 'file' : 'content',
          timestamp: new Date().toISOString()
        }
      );

      // 儲存報表
      const reportsDir = 'reports';
      if (!existsSync(reportsDir)) {
        mkdirSync(reportsDir, { recursive: true });
      }

      const reportPath = join(reportsDir, `${executionId}.json`);
      reportGenerator.saveReport(report, reportPath);

      // 建立回應
      const response: IRunFlowResult = {
        executionId,
        status: determineExecutionStatus(testResults),
        reportSummary: report.summary,
        reportPath: relative(process.cwd(), reportPath)
      };

      const duration = Date.now() - startTime;

      logger.info('run_flow_success', {
        executionId,
        method: 'runFlow',
        component: 'mcp-server',
        details: {
          duration,
          status: response.status,
          summary: response.reportSummary,
          mode: params.spec ? 'file' : 'content'
        }
      });

      return createSuccessResponse(response, request.id || null);

    } finally {
      // 清理臨時檔案
      cleanupTempFiles(tempFiles, executionId);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';

    logger.error('run_flow_error', {
      executionId,
      method: 'runFlow',
      component: 'mcp-server',
      details: {
        error: errorMessage,
        type: 'execution_error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });

    return createErrorResponse(
      JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      `執行失敗: ${errorMessage}`,
      request.id || null
    );
  }
}

/**
 * 處理檔案模式
 */
async function handleFileMode(specPath: string, flowPath: string, executionId: string): Promise<{
  specContent: string;
  flowContent: string;
}> {
  // 安全路徑驗證
  const projectRoot = process.cwd();
  const resolvedSpecPath = resolve(projectRoot, specPath);
  const resolvedFlowPath = resolve(projectRoot, flowPath);

  // 檢查路徑是否在專案目錄內
  if (!resolvedSpecPath.startsWith(projectRoot) || !resolvedFlowPath.startsWith(projectRoot)) {
    throw new Error('檔案路徑必須在專案目錄內');
  }

  // 拒絕包含 .. 的路徑
  if (specPath.includes('..') || flowPath.includes('..')) {
    throw new Error('檔案路徑不能包含 ".." ');
  }

  // 檢查檔案存在性
  if (!existsSync(resolvedSpecPath)) {
    throw new Error(`OpenAPI 規格檔案不存在: ${specPath}`);
  }

  if (!existsSync(resolvedFlowPath)) {
    throw new Error(`測試流程檔案不存在: ${flowPath}`);
  }

  logger.info('載入檔案', {
    executionId,
    specPath,
    flowPath,
    component: 'mcp-server'
  });

  // 讀取檔案內容
  const specContent = readFileSync(resolvedSpecPath, 'utf8');
  const flowContent = readFileSync(resolvedFlowPath, 'utf8');

  return { specContent, flowContent };
}

/**
 * 處理內容模式
 */
async function handleContentMode(specContent: string, flowContent: string, executionId: string): Promise<{
  specContent: string;
  flowContent: string;
  tempFiles: string[];
}> {
  const tempDir = 'temp';
  const tempFiles: string[] = [];

  try {
    // 確保臨時目錄存在
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    // 建立臨時檔案
    const timestamp = Date.now();
    const specTempPath = join(tempDir, `run-${executionId}-${timestamp}.spec.json`);
    const flowTempPath = join(tempDir, `run-${executionId}-${timestamp}.flow.yaml`);

    // 寫入臨時檔案
    writeFileSync(specTempPath, specContent, 'utf8');
    writeFileSync(flowTempPath, flowContent, 'utf8');

    tempFiles.push(specTempPath, flowTempPath);

    logger.info('建立臨時檔案', {
      executionId,
      tempFiles,
      component: 'mcp-server'
    });

    return { specContent, flowContent, tempFiles };

  } catch (error) {
    // 如果建立臨時檔案失敗，清理已建立的檔案
    cleanupTempFiles(tempFiles, executionId);
    throw error;
  }
}

/**
 * 清理臨時檔案
 */
function cleanupTempFiles(tempFiles: string[], executionId: string): void {
  if (tempFiles.length === 0) return;

  try {
    tempFiles.forEach(filePath => {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    });

    logger.info('清理臨時檔案', {
      executionId,
      cleanedFiles: tempFiles.length,
      component: 'mcp-server'
    });

  } catch (error) {
    logger.error('清理臨時檔案失敗', {
      executionId,
      tempFiles,
      error: error instanceof Error ? error.message : '未知錯誤',
      component: 'mcp-server'
    });
  }
}

/**
 * 建立設定覆寫物件
 */
function createConfigOverride(params: IRunFlowParams): IRunFlowOptions {
  const overrides: IRunFlowOptions = {};

  if (params.baseUrl) {
    overrides.baseUrl = params.baseUrl;
  }

  if (params.port) {
    overrides.port = params.port;
  }

  if (params.token) {
    overrides.token = params.token;
  }

  return overrides;
}

/**
 * 將設定覆寫套用到流程定義
 */
function applyConfigOverrides(flowDefinition: Record<string, unknown>, overrides: IRunFlowOptions): Record<string, unknown> {
  // 深拷貝流程定義以避免修改原始物件
  const enhanced = JSON.parse(JSON.stringify(flowDefinition));

  // 處理 baseUrl 覆寫
  if (overrides.baseUrl) {
    // 更新所有步驟的 URL
    if (enhanced.steps && Array.isArray(enhanced.steps)) {
      enhanced.steps.forEach((step: Record<string, unknown>) => {
        if (step.request && typeof step.request === 'object' && step.request !== null) {
          const request = step.request as Record<string, unknown>;
          if (request.url && typeof request.url === 'string') {
            // 如果是相對路徑，則結合新的 baseUrl
            if (!request.url.startsWith('http')) {
              const cleanBaseUrl = overrides.baseUrl!.replace(/\/$/, '');
              const cleanPath = request.url.replace(/^\//, '');
              request.url = `${cleanBaseUrl}/${cleanPath}`;
            }
          }
        }
      });
    }

    // 記錄覆寫資訊（遮罩敏感資料）
    logger.info('套用 baseUrl 覆寫', {
      originalBaseUrl: enhanced.baseUrl || 'N/A',
      newBaseUrl: overrides.baseUrl,
      component: 'mcp-server'
    });
  }

  // 處理 port 覆寫
  if (overrides.port) {
    enhanced.port = overrides.port;

    logger.info('套用 port 覆寫', {
      originalPort: enhanced.port || 'N/A',
      newPort: overrides.port,
      component: 'mcp-server'
    });
  }

  // 處理 token 覆寫
  if (overrides.token) {
    // 確保全域認證設定存在
    if (!enhanced.globals) {
      enhanced.globals = {};
    }
    if (!enhanced.globals.auth) {
      enhanced.globals.auth = {};
    }
    if (!enhanced.globals.auth.static) {
      enhanced.globals.auth.static = {};
    }

    // 覆寫預設命名空間的 token
    enhanced.globals.auth.static.default = {
      type: 'bearer',
      token: overrides.token
    };

    logger.info('套用 token 覆寫', {
      hasToken: !!overrides.token,
      tokenLength: overrides.token.length,
      maskedToken: `${overrides.token.substring(0, 8)}***`,
      component: 'mcp-server'
    });
  }

  return enhanced;
}

/**
 * 決定執行狀態
 */
function determineExecutionStatus(testResults: Array<{ status: string }>): 'success' | 'partial_failure' | 'failure' {
  const passed = testResults.filter(r => r.status === 'passed').length;
  const failed = testResults.filter(r => r.status === 'failed').length;

  if (failed === 0) {
    return 'success';
  } else if (passed > 0) {
    return 'partial_failure';
  } else {
    return 'failure';
  }
}