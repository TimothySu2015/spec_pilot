import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportGenerator, type ITestReport } from '../src/index.js';
import { type TestResult } from '@specpilot/core-flow';

describe('ReportGenerator', () => {
  let generator: ReportGenerator;

  beforeEach(() => {
    generator = new ReportGenerator();
  });

  describe('generateReport', () => {
    it('應該產生完整的測試報表', () => {
      const results: TestResult[] = [
        { status: 'passed', duration: 100 },
        { status: 'failed', duration: 200, error: 'Test error' },
        { status: 'skipped', duration: 0 },
      ];

      const report = generator.generateReport(
        'Test Flow',
        results,
        { baseUrl: 'https://api.test.com', port: 443 },
        { fallbackUsed: true }
      );

      expect(report.flowName).toBe('Test Flow');
      expect(report.summary.total).toBe(3);
      expect(report.summary.passed).toBe(1);
      expect(report.summary.failed).toBe(1);
      expect(report.summary.skipped).toBe(1);
      expect(report.summary.duration).toBe(300);
      expect(report.environment.baseUrl).toBe('https://api.test.com');
      expect(report.metadata.fallbackUsed).toBe(true);
    });

    it('應該處理空的結果', () => {
      const results: TestResult[] = [];

      const report = generator.generateReport('Empty Flow', results);

      expect(report.summary.total).toBe(0);
      expect(report.summary.passed).toBe(0);
      expect(report.summary.failed).toBe(0);
      expect(report.summary.duration).toBe(0);
    });
  });

  describe('generateSummary', () => {
    it('應該產生正確的摘要文字', () => {
      const report: ITestReport = {
        executionId: 'test-123',
        timestamp: '2025-09-26T08:00:00.000Z',
        flowName: 'Test Flow',
        summary: {
          total: 10,
          passed: 8,
          failed: 2,
          skipped: 0,
          duration: 5000,
        },
        steps: [],
        environment: {
          baseUrl: 'https://api.test.com',
          port: 443,
          version: '0.1.0',
        },
        metadata: {
          fallbackUsed: false,
          retryCount: 0,
        },
      };

      const summary = generator.generateSummary(report);

      expect(summary).toContain('Test Flow');
      expect(summary).toContain('test-123');
      expect(summary).toContain('總計：10');
      expect(summary).toContain('通過：8');
      expect(summary).toContain('失敗：2');
      expect(summary).toContain('成功率：80.0%');
    });
  });

  describe('generateJUnitXml', () => {
    it('應該產生有效的 JUnit XML', () => {
      const report: ITestReport = {
        executionId: 'test-123',
        timestamp: '2025-09-26T08:00:00.000Z',
        flowName: 'Test Flow',
        summary: {
          total: 2,
          passed: 1,
          failed: 1,
          skipped: 0,
          duration: 3000,
        },
        steps: [
          {
            name: 'Step 1',
            status: 'passed',
            duration: 1000,
          },
          {
            name: 'Step 2',
            status: 'failed',
            duration: 2000,
            error: 'Test failed',
          },
        ],
        environment: { version: '0.1.0' },
        metadata: { fallbackUsed: false, retryCount: 0 },
      };

      const xml = generator.generateJUnitXml(report);

      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain('<testsuite name="Test Flow" tests="2" failures="1"');
      expect(xml).toContain('<testcase name="Step 1" time="1">');
      expect(xml).toContain('<testcase name="Step 2" time="2">');
      expect(xml).toContain('<failure message="Test failed">');
    });
  });
});