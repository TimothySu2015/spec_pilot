import * as fs from 'fs';
import * as path from 'path';
import type { IMcpRequest, IMcpResponse, IGetReportResult } from '../rpc-handler.js';
import { createSuccessResponse, createErrorResponse, validateGetReportParams, JSON_RPC_ERROR_CODES } from '../rpc-handler.js';
import { ReportValidator, DiagnosticContextBuilder } from '@specpilot/reporting';
import { createStructuredLogger } from '@specpilot/shared';
import type { IExecutionReport } from '@specpilot/reporting';

const logger = createStructuredLogger('mcp-server');

/**
 * 取得報表檔案搜尋路徑（按優先順序）
 * 支援環境變數配置以提高彈性
 */
function getReportPaths(): string[] {
  // 從環境變數讀取自訂路徑，格式為以逗號分隔的路徑列表
  const customPaths = process.env.SPEC_PILOT_REPORT_PATHS;

  if (customPaths) {
    return customPaths.split(',').map(path => path.trim()).filter(path => path.length > 0);
  }

  // 預設路徑（向後兼容）
  return [
    'reports/result.json',
    'test-reports/test-report.json'
  ];
}

/**
 * 處理 getReport 方法
 */
export function handleGetReport(request: IMcpRequest): IMcpResponse {
  const requestId = request.id || null;

  logger.info('get_report_start', {
    component: 'mcp-server',
    method: 'getReport',
    requestId,
  });

  try {
    // 驗證參數
    const paramValidation = validateGetReportParams(request.params);
    if (!paramValidation.isValid) {
      logger.error('get_report_error', {
        component: 'mcp-server',
        method: 'getReport',
        error: 'Invalid parameters',
        details: paramValidation.error,
      });

      return createErrorResponse(
        JSON_RPC_ERROR_CODES.INVALID_PARAMS,
        paramValidation.error || '參數驗證失敗',
        requestId
      );
    }

    // 按優先順序搜尋報表檔案
    let reportPath: string | null = null;
    let reportContent: string | null = null;
    const reportPaths = getReportPaths();

    for (const candidatePath of reportPaths) {
      try {
        // 使用當前工作目錄解析路徑
        const fullPath = path.resolve(process.cwd(), candidatePath);
        if (fs.existsSync(fullPath)) {
          reportPath = candidatePath; // 保留相對路徑用於回應
          reportContent = fs.readFileSync(fullPath, 'utf8');
          break;
        }
      } catch (error) {
        // 繼續搜尋下一個路徑
        logger.debug('檔案存取失敗，嘗試下一個路徑', {
          path: candidatePath,
          error: error instanceof Error ? error.message : '未知錯誤',
        });
        continue;
      }
    }

    // 檢查是否找到報表檔案
    if (!reportPath || !reportContent) {
      logger.error('get_report_error', {
        component: 'mcp-server',
        method: 'getReport',
        error: 'Report file not found',
        searchedPaths: reportPaths,
      });

      return createErrorResponse(
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
        '找不到測試報表檔案',
        requestId
      );
    }

    // 解析 JSON
    let parsedReport: unknown;
    try {
      parsedReport = JSON.parse(reportContent);
    } catch (parseError) {
      logger.error('get_report_error', {
        component: 'mcp-server',
        method: 'getReport',
        error: 'JSON parse error',
        details: parseError instanceof Error ? parseError.message : '未知解析錯誤',
        reportPath,
      });

      return createErrorResponse(
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
        '報表檔案格式無效',
        requestId
      );
    }

    // 驗證報表格式
    const validator = new ReportValidator();
    const validationResult = validator.validateReport(parsedReport);

    if (!validationResult.valid) {
      logger.error('get_report_error', {
        component: 'mcp-server',
        method: 'getReport',
        error: 'Report validation failed',
        validationErrors: validationResult.errors.slice(0, 3), // 只記錄前 3 個錯誤
        reportPath,
      });

      return createErrorResponse(
        JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
        '報表檔案格式無效',
        requestId
      );
    }

    // 類型斷言為執行報表
    const report = parsedReport as IExecutionReport;

    // ✨ 階段 3: 建立或取得診斷上下文
    let diagnosticContext = report.diagnosticContext || null;

    // 如果報表中沒有診斷上下文，則現場建立（向下相容舊報表）
    if (!diagnosticContext && report.summary.failedSteps > 0) {
      logger.info('報表中無診斷上下文，現場建立', {
        component: 'mcp-server',
        method: 'getReport',
        executionId: report.executionId,
        failedSteps: report.summary.failedSteps,
        requestId,
      });

      const diagnosticBuilder = new DiagnosticContextBuilder();
      diagnosticContext = diagnosticBuilder.build(report);

      // 📝 記錄完整的診斷上下文（供除錯與確認）
      if (diagnosticContext) {
        logger.info('diagnostic_context_generated', {
          component: 'mcp-server',
          method: 'getReport',
          executionId: report.executionId,
          source: 'on-demand',
          diagnosticContext: JSON.stringify(diagnosticContext, null, 2),
          requestId,
        });
      }
    } else if (diagnosticContext) {
      logger.info('使用報表中的診斷上下文', {
        component: 'mcp-server',
        method: 'getReport',
        executionId: report.executionId,
        source: 'report',
        failureCount: diagnosticContext.failureCount,
        requestId,
      });
    } else {
      logger.info('無失敗步驟，無需診斷上下文', {
        component: 'mcp-server',
        method: 'getReport',
        executionId: report.executionId,
        requestId,
      });
    }

    // 建立回應結果
    const result: IGetReportResult = {
      reportPath,
      executionId: report.executionId,
      status: report.status,
      reportSummary: {
        totalSteps: report.summary.totalSteps,
        successfulSteps: report.summary.successfulSteps,
        failedSteps: report.summary.failedSteps,
        skippedSteps: report.summary.skippedSteps,
        duration: report.duration,
      },
      report,
      diagnosticContext: diagnosticContext || undefined, // 只在有失敗時才有診斷上下文
    };

    logger.info('get_report_success', {
      component: 'mcp-server',
      method: 'getReport',
      reportPath,
      executionId: report.executionId,
      status: report.status,
      hasDiagnosticContext: !!diagnosticContext,
      failureCount: diagnosticContext?.failureCount || 0,
      requestId,
    });

    return createSuccessResponse(result, requestId);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';

    logger.error('get_report_error', {
      component: 'mcp-server',
      method: 'getReport',
      error: 'Unexpected error',
      details: errorMessage,
      requestId,
    });

    return createErrorResponse(
      JSON_RPC_ERROR_CODES.INTERNAL_ERROR,
      '無法讀取報表檔案',
      requestId
    );
  }
}