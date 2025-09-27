import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ReportingIntegration } from '../src/reporting-integration.js';
import type { IFlowDefinition as FlowParserDefinition, IFlowStep as FlowParserStep } from '@specpilot/flow-parser';
import type { ExecutionConfig } from '@specpilot/reporting';
import type { ITestResult } from '../src/index.js';

describe('ReportingIntegration', () => {
  let reportingIntegration: ReportingIntegration;
  const executionId = 'test-execution-123';

  beforeEach(() => {
    reportingIntegration = new ReportingIntegration(executionId);
  });

  describe('記錄流程執行', () => {
    test('應該正確記錄流程開始', () => {
      const flowDefinition: FlowParserDefinition = {
        id: 'test-flow',
        name: 'Test Flow',
        version: '1.0.0',
        steps: [
          {
            name: 'test_step',
            request: {
              method: 'GET',
              url: '/test',
              headers: {}
            }
          }
        ]
      };

      const config: ExecutionConfig = {
        baseUrl: 'https://api.example.com',
        fallbackUsed: false,
        authNamespaces: []
      };

      // 這應該不會拋出錯誤
      expect(() => {
        reportingIntegration.recordFlowStart(flowDefinition, config);
      }).not.toThrow();

      // 驗證收集的步驟資料已被清空
      expect(reportingIntegration.getCollectedSteps()).toHaveLength(0);
    });

    test('應該正確記錄步驟開始', () => {
      const step: FlowParserStep = {
        name: 'test_step',
        request: {
          method: 'POST',
          url: '/api/test',
          headers: { 'Content-Type': 'application/json' }
        },
        auth: {
          type: 'static',
          namespace: 'default'
        }
      };

      expect(() => {
        reportingIntegration.recordStepStart(step);
      }).not.toThrow();
    });

    test('應該正確記錄步驟完成', () => {
      const step: FlowParserStep = {
        name: 'test_step',
        request: {
          method: 'GET',
          url: '/test',
          headers: {}
        }
      };

      const testResult: ITestResult = {
        status: 'passed',
        duration: 1500,
        response: { data: 'test' }
      };

      const request = {
        method: 'GET',
        url: 'https://api.example.com/test',
        headers: { 'Accept': 'application/json' },
        body: null
      };

      const response = {
        statusCode: 200,
        validationResults: ['status_check_passed'],
        errorMessage: undefined
      };

      reportingIntegration.recordStepComplete(step, testResult, request, response);

      const collectedSteps = reportingIntegration.getCollectedSteps();
      expect(collectedSteps).toHaveLength(1);
      expect(collectedSteps[0].name).toBe('test_step');
      expect(collectedSteps[0].status).toBe('success');
      expect(collectedSteps[0].duration).toBe(1500);
    });

    test('應該正確記錄步驟失敗', () => {
      const step: FlowParserStep = {
        name: 'failing_step',
        request: {
          method: 'POST',
          url: '/fail',
          headers: {}
        }
      };

      const testResult: ITestResult = {
        status: 'failed',
        duration: 800,
        error: 'Network timeout',
        authStatus: {
          hasAuth: false,
          authSuccess: false,
          authError: 'Authentication failed'
        }
      };

      const request = {
        method: 'POST',
        url: 'https://api.example.com/fail',
        headers: {},
        body: { test: 'data' }
      };

      const response = {
        statusCode: 500,
        validationResults: ['status_check_failed'],
        errorMessage: 'Internal Server Error'
      };

      reportingIntegration.recordStepComplete(step, testResult, request, response);

      const collectedSteps = reportingIntegration.getCollectedSteps();
      expect(collectedSteps).toHaveLength(1);
      expect(collectedSteps[0].name).toBe('failing_step');
      expect(collectedSteps[0].status).toBe('failure');
      expect(collectedSteps[0].response.errorMessage).toBe('Internal Server Error');
    });
  });

  describe('報表產生', () => {
    test('應該產生完整的流程報表', async () => {
      const flowDefinition: FlowParserDefinition = {
        id: 'report-test-flow',
        name: 'Report Test Flow',
        version: '1.0.0',
        steps: []
      };

      const config: ExecutionConfig = {
        baseUrl: 'https://api.example.com',
        fallbackUsed: false,
        authNamespaces: ['default']
      };

      // 記錄流程開始
      reportingIntegration.recordFlowStart(flowDefinition, config);

      // 模擬添加一些步驟資料
      const step: FlowParserStep = {
        name: 'sample_step',
        request: {
          method: 'GET',
          url: '/sample',
          headers: {}
        }
      };

      const testResult: ITestResult = {
        status: 'passed',
        duration: 1000
      };

      reportingIntegration.recordStepComplete(step, testResult, {
        method: 'GET',
        url: 'https://api.example.com/sample',
        headers: {},
        body: null
      }, {
        statusCode: 200,
        validationResults: ['success'],
        errorMessage: undefined
      });

      // 產生報表
      const reportSummary = await reportingIntegration.recordFlowComplete(
        executionId,
        'report-test-flow',
        config,
        'test-reports/test-report.json'
      );

      expect(reportSummary).toContain('測試執行完成');
      expect(reportSummary).toContain('test-reports/test-report.json');
    });

    test('應該處理報表產生失敗', async () => {
      const config: ExecutionConfig = {
        baseUrl: 'https://api.example.com',
        fallbackUsed: false,
        authNamespaces: []
      };

      // 使用無效路徑觸發錯誤
      const reportSummary = await reportingIntegration.recordFlowComplete(
        executionId,
        'failing-flow',
        config,
        '/invalid/path/report.json'
      );

      expect(reportSummary).toContain('報表產生失敗');
    });
  });

  describe('驗證與備援記錄', () => {
    test('應該記錄驗證成功', () => {
      expect(() => {
        reportingIntegration.recordValidationResult(
          'test_step',
          ['schema_valid', 'business_rule_passed'],
          true
        );
      }).not.toThrow();
    });

    test('應該記錄驗證失敗', () => {
      expect(() => {
        reportingIntegration.recordValidationResult(
          'test_step',
          ['schema_invalid'],
          false
        );
      }).not.toThrow();
    });

    test('應該記錄備援使用', () => {
      expect(() => {
        reportingIntegration.recordFallbackUsed(
          'test_step',
          'https://api.example.com/original',
          'https://fallback.example.com/endpoint'
        );
      }).not.toThrow();
    });
  });

  describe('資料管理', () => {
    test('應該正確清除收集的資料', () => {
      // 先添加一些資料
      const step: FlowParserStep = {
        name: 'test_step',
        request: { method: 'GET', url: '/test', headers: {} }
      };

      reportingIntegration.recordStepComplete(step, {
        status: 'passed',
        duration: 1000
      }, {
        method: 'GET',
        url: '/test',
        headers: {},
        body: null
      }, {
        statusCode: 200,
        validationResults: [],
        errorMessage: undefined
      });

      expect(reportingIntegration.getCollectedSteps()).toHaveLength(1);

      // 清除資料
      reportingIntegration.clearCollectedData();

      expect(reportingIntegration.getCollectedSteps()).toHaveLength(0);
    });

    test('應該正確取得收集的步驟資料', () => {
      const steps = reportingIntegration.getCollectedSteps();
      expect(Array.isArray(steps)).toBe(true);

      // 應該回傳複本，不是原始陣列
      const step: FlowParserStep = {
        name: 'test_step',
        request: { method: 'GET', url: '/test', headers: {} }
      };

      reportingIntegration.recordStepComplete(step, {
        status: 'passed',
        duration: 1000
      }, {
        method: 'GET',
        url: '/test',
        headers: {},
        body: null
      }, {
        statusCode: 200,
        validationResults: [],
        errorMessage: undefined
      });

      const stepsAfter = reportingIntegration.getCollectedSteps();
      expect(stepsAfter).not.toBe(steps); // 不同的物件參考
    });
  });

  describe('流程失敗處理', () => {
    test('應該正確處理流程失敗', async () => {
      const config: ExecutionConfig = {
        baseUrl: 'https://api.example.com',
        fallbackUsed: false,
        authNamespaces: []
      };

      // 測試流程失敗記錄
      await expect(
        reportingIntegration.recordFlowFailure(
          executionId,
          'failing-flow',
          config,
          'Network connection failed'
        )
      ).resolves.not.toThrow();
    });
  });
});