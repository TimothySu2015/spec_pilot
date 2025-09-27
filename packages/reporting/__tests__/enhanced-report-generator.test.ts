import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ReportGenerator, type StepInput, type ExecutionConfig } from '../src/report-generator.js';

describe('Enhanced ReportGenerator', () => {
  let reportGenerator: ReportGenerator;
  let testDir: string;

  beforeEach(() => {
    reportGenerator = new ReportGenerator();
    testDir = join(process.cwd(), 'test-temp');
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('generateReport', () => {
    test('應該產生完整的執行報表', () => {
      // Arrange
      const executionId = 'test-execution-123';
      const flowId = 'user_crud_flow';
      const startTime = '2025-09-27T10:30:00.000Z';
      const endTime = '2025-09-27T10:30:15.234Z';
      const config: ExecutionConfig = {
        baseUrl: 'https://api.example.com',
        fallbackUsed: false,
        authNamespaces: ['api_v1'],
      };

      const steps: StepInput[] = [
        {
          name: 'user_login',
          status: 'success',
          startTime: '2025-09-27T10:30:00.100Z',
          duration: 1200,
          request: {
            method: 'POST',
            url: 'https://api.example.com/auth/login',
            headers: { 'Content-Type': 'application/json' },
            body: { username: 'test', password: 'secret' },
          },
          response: {
            statusCode: 200,
            success: true,
            validationResults: ['status_check_passed', 'schema_validation_passed'],
          },
        },
        {
          name: 'get_user_profile',
          status: 'failure',
          startTime: '2025-09-27T10:30:02.000Z',
          duration: 800,
          request: {
            method: 'GET',
            url: 'https://api.example.com/user/profile',
            headers: { Authorization: 'Bearer token123' },
            body: null,
          },
          response: {
            statusCode: 404,
            success: false,
            validationResults: ['status_check_failed'],
            errorMessage: 'User not found',
          },
        },
      ];

      // Act
      const report = reportGenerator.generateReport(
        executionId,
        flowId,
        startTime,
        endTime,
        steps,
        config
      );

      // Assert
      expect(report.executionId).toBe(executionId);
      expect(report.flowId).toBe(flowId);
      expect(report.startTime).toBe(startTime);
      expect(report.endTime).toBe(endTime);
      expect(report.duration).toBe(15234);
      expect(report.status).toBe('partial'); // 有成功也有失敗
      expect(report.summary.totalSteps).toBe(2);
      expect(report.summary.successfulSteps).toBe(1);
      expect(report.summary.failedSteps).toBe(1);
      expect(report.summary.skippedSteps).toBe(0);
      expect(report.steps).toHaveLength(2);
      expect(report.config).toEqual(config);

      // 檢查第一個步驟
      const firstStep = report.steps[0];
      expect(firstStep.name).toBe('user_login');
      expect(firstStep.status).toBe('success');
      expect(firstStep.request.headerHash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(firstStep.request.bodyHash).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(firstStep.response.errorMessage).toBeNull();

      // 檢查第二個步驟
      const secondStep = report.steps[1];
      expect(secondStep.name).toBe('get_user_profile');
      expect(secondStep.status).toBe('failure');
      expect(secondStep.response.errorMessage).toBe('User not found');
    });

    test('應該正確決定報表狀態', () => {
      const config: ExecutionConfig = {
        baseUrl: 'https://api.example.com',
        fallbackUsed: false,
        authNamespaces: [],
      };

      // 全部成功
      const allSuccessSteps: StepInput[] = [
        {
          name: 'step1',
          status: 'success',
          startTime: '2025-09-27T10:30:00.000Z',
          duration: 100,
          request: { method: 'GET', url: 'http://test.com', headers: {}, body: null },
          response: { statusCode: 200, success: true, validationResults: [] },
        },
      ];

      const successReport = reportGenerator.generateReport(
        'exec-1',
        'flow-1',
        '2025-09-27T10:30:00.000Z',
        '2025-09-27T10:30:01.000Z',
        allSuccessSteps,
        config
      );
      expect(successReport.status).toBe('success');

      // 全部失敗
      const allFailureSteps: StepInput[] = [
        {
          name: 'step1',
          status: 'failure',
          startTime: '2025-09-27T10:30:00.000Z',
          duration: 100,
          request: { method: 'GET', url: 'http://test.com', headers: {}, body: null },
          response: { statusCode: 500, success: false, validationResults: [], errorMessage: 'Error' },
        },
      ];

      const failureReport = reportGenerator.generateReport(
        'exec-2',
        'flow-2',
        '2025-09-27T10:30:00.000Z',
        '2025-09-27T10:30:01.000Z',
        allFailureSteps,
        config
      );
      expect(failureReport.status).toBe('failure');
    });
  });

  describe('saveReport', () => {
    test('應該成功儲存報表檔案', async () => {
      // Arrange
      const report = {
        executionId: 'test-exec',
        flowId: 'test-flow',
        startTime: '2025-09-27T10:30:00.000Z',
        endTime: '2025-09-27T10:30:01.000Z',
        duration: 1000,
        status: 'success' as const,
        summary: {
          totalSteps: 1,
          successfulSteps: 1,
          failedSteps: 0,
          skippedSteps: 0,
        },
        steps: [],
        config: {
          baseUrl: 'https://api.example.com',
          fallbackUsed: false,
          authNamespaces: [],
        },
      };

      const filePath = join(testDir, 'test-report.json');

      // Act
      await reportGenerator.saveReport(report, filePath);

      // Assert
      expect(existsSync(filePath)).toBe(true);

      const savedContent = readFileSync(filePath, 'utf8');
      const parsedReport = JSON.parse(savedContent);
      expect(parsedReport.executionId).toBe('test-exec');
      expect(parsedReport.flowId).toBe('test-flow');
    });

    test('應該在目錄不存在時建立目錄', async () => {
      // Arrange
      const report = {
        executionId: 'test-exec',
        flowId: 'test-flow',
        startTime: '2025-09-27T10:30:00.000Z',
        endTime: '2025-09-27T10:30:01.000Z',
        duration: 1000,
        status: 'success' as const,
        summary: { totalSteps: 0, successfulSteps: 0, failedSteps: 0, skippedSteps: 0 },
        steps: [],
        config: { baseUrl: 'https://api.example.com', fallbackUsed: false, authNamespaces: [] },
      };

      const nestedDir = join(testDir, 'nested', 'reports');
      const filePath = join(nestedDir, 'report.json');

      // Act
      await reportGenerator.saveReport(report, filePath);

      // Assert
      expect(existsSync(filePath)).toBe(true);
    });
  });

  describe('generatePartialReport', () => {
    test('應該產生部分報表', () => {
      // Arrange
      const steps: StepInput[] = [
        {
          name: 'completed_step',
          status: 'success',
          startTime: '2025-09-27T10:30:00.000Z',
          duration: 500,
          request: { method: 'GET', url: 'http://test.com', headers: {}, body: null },
          response: { statusCode: 200, success: true, validationResults: [] },
        },
      ];

      const config: ExecutionConfig = {
        baseUrl: 'https://api.example.com',
        fallbackUsed: false,
        authNamespaces: [],
      };

      // Act
      const partialReport = reportGenerator.generatePartialReport(
        'partial-exec',
        'partial-flow',
        '2025-09-27T10:30:00.000Z',
        steps,
        config,
        'Network timeout occurred'
      );

      // Assert
      expect(partialReport.executionId).toBe('partial-exec');
      expect(partialReport.flowId).toBe('partial-flow');
      expect(partialReport.failureReason).toBe('Network timeout occurred');
      expect(partialReport.summary.totalSteps).toBe(1);
      expect(partialReport.summary.successfulSteps).toBe(1);
      expect(partialReport.generatedAt).toBeDefined();
    });
  });

  describe('generateCliSummary', () => {
    test('應該產生正確的 CLI 摘要', () => {
      // Arrange
      const report = {
        executionId: 'cli-test',
        flowId: 'cli-flow',
        startTime: '2025-09-27T10:30:00.000Z',
        endTime: '2025-09-27T10:30:05.000Z',
        duration: 5000,
        status: 'success' as const,
        summary: {
          totalSteps: 3,
          successfulSteps: 3,
          failedSteps: 0,
          skippedSteps: 0,
        },
        steps: [],
        config: {
          baseUrl: 'https://api.example.com',
          fallbackUsed: false,
          authNamespaces: [],
        },
      };

      const reportPath = '/path/to/report.json';

      // Act
      const summary = reportGenerator.generateCliSummary(report, reportPath);

      // Assert
      expect(summary).toContain('✅ 測試執行完成');
      expect(summary).toContain(reportPath);
      expect(summary).toContain('失敗計數：0');
      expect(summary).toContain('成功率：100.0%');
      expect(summary).toContain('總計：3 步驟');
      expect(summary).toContain('執行時間：5000ms');
    });

    test('應該為失敗狀態顯示正確的 emoji', () => {
      // Arrange
      const report = {
        executionId: 'fail-test',
        flowId: 'fail-flow',
        startTime: '2025-09-27T10:30:00.000Z',
        endTime: '2025-09-27T10:30:05.000Z',
        duration: 5000,
        status: 'failure' as const,
        summary: {
          totalSteps: 2,
          successfulSteps: 0,
          failedSteps: 2,
          skippedSteps: 0,
        },
        steps: [],
        config: {
          baseUrl: 'https://api.example.com',
          fallbackUsed: false,
          authNamespaces: [],
        },
      };

      // Act
      const summary = reportGenerator.generateCliSummary(report, '/report.json');

      // Assert
      expect(summary).toContain('❌ 測試執行完成');
      expect(summary).toContain('失敗計數：2');
      expect(summary).toContain('成功率：0.0%');
    });
  });
});