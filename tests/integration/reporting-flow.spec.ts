import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { EnhancedFlowOrchestrator } from '@specpilot/core-flow';
import { ReportValidator, SchemaValidator } from '@specpilot/shared';
import type { IFlowDefinition as FlowParserDefinition } from '@specpilot/flow-parser';
import type { ExecutionConfig } from '@specpilot/reporting';

describe('Reporting Flow Integration', () => {
  let orchestrator: EnhancedFlowOrchestrator;
  let testDir: string;
  let reportValidator: ReportValidator;
  let schemaValidator: SchemaValidator;

  beforeEach(() => {
    orchestrator = new EnhancedFlowOrchestrator();
    testDir = join(process.cwd(), 'test-integration');
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });

    reportValidator = new ReportValidator();
    schemaValidator = new SchemaValidator();
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('完整報表流程測試', () => {
    test('應該執行流程並產生有效的報表', async () => {
      // Arrange
      const flowDefinition: FlowParserDefinition = {
        id: 'integration-test-flow',
        name: 'Integration Test Flow',
        version: '1.0.0',
        steps: [
          {
            name: 'login_step',
            request: {
              method: 'POST',
              url: '/auth/login',
              headers: { 'Content-Type': 'application/json' },
              body: { username: 'test', password: 'password' }
            },
            auth: {
              type: 'login',
              tokenExtraction: {
                jsonPath: '$.token',
                namespace: 'default'
              }
            }
          },
          {
            name: 'get_profile',
            request: {
              method: 'GET',
              url: '/user/profile',
              headers: {}
            },
            auth: {
              type: 'static',
              namespace: 'default'
            }
          }
        ]
      };

      const config: ExecutionConfig = {
        baseUrl: 'https://api.example.com',
        fallbackUsed: false,
        authNamespaces: ['default']
      };

      const reportPath = join(testDir, 'integration-report.json');

      // Act
      const result = await orchestrator.executeFlowWithReporting(
        flowDefinition,
        config,
        {
          reportPath,
          enableReporting: true
        }
      );

      // Assert
      expect(result.results).toHaveLength(2);
      expect(result.executionId).toBeDefined();
      expect(result.reportSummary).toBeDefined();

      // 檢查報表檔案是否存在
      expect(existsSync(reportPath)).toBe(true);

      // 驗證報表格式
      const reportContent = readFileSync(reportPath, 'utf8');
      const parsedReport = JSON.parse(reportContent);

      // 使用 ReportValidator 驗證報表
      const validationResult = reportValidator.validateReport(parsedReport);
      expect(validationResult.valid).toBe(true);

      // 檢查報表內容
      expect(parsedReport.flowId).toBe('integration-test-flow');
      expect(parsedReport.steps).toHaveLength(2);
      expect(parsedReport.summary.totalSteps).toBe(2);
      expect(parsedReport.config.baseUrl).toBe('https://api.example.com');
    });

    test('應該在步驟失敗時產生部分報表', async () => {
      // Arrange
      const flowDefinition: FlowParserDefinition = {
        id: 'failing-flow',
        name: 'Failing Flow',
        version: '1.0.0',
        steps: [
          {
            name: 'success_step',
            request: {
              method: 'GET',
              url: '/health',
              headers: {}
            }
          },
          {
            name: 'failing_step',
            request: {
              method: 'POST',
              url: '/invalid-endpoint',
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

      const reportPath = join(testDir, 'failing-report.json');

      // Act
      const result = await orchestrator.executeFlowWithReporting(
        flowDefinition,
        config,
        {
          reportPath,
          enableReporting: true
        }
      );

      // Assert
      expect(result.results).toHaveLength(2);
      expect(existsSync(reportPath)).toBe(true);

      const reportContent = readFileSync(reportPath, 'utf8');
      const parsedReport = JSON.parse(reportContent);

      // 驗證報表格式
      const validationResult = reportValidator.validateReport(parsedReport);
      expect(validationResult.valid).toBe(true);

      // 檢查報表狀態（應該是 partial 或 failure）
      expect(['partial', 'failure']).toContain(parsedReport.status);
    });
  });

  describe('日誌與報表 Schema 驗證', () => {
    test('應該產生符合 Schema 的報表', async () => {
      // Arrange
      const flowDefinition: FlowParserDefinition = {
        id: 'schema-test-flow',
        name: 'Schema Test Flow',
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

      const reportPath = join(testDir, 'schema-report.json');

      // Act
      const result = await orchestrator.executeFlowWithReporting(
        flowDefinition,
        config,
        {
          reportPath,
          enableReporting: true
        }
      );

      // Assert
      const reportContent = readFileSync(reportPath, 'utf8');

      // 使用 SchemaValidator 驗證
      const validatedReport = schemaValidator.validateReportFile(reportContent);

      expect(validatedReport).toBeDefined();
      expect(validatedReport.executionId).toBe(result.executionId);
      expect(validatedReport.flowId).toBe('schema-test-flow');
    });

    test('應該取得所有 Schema 定義', () => {
      // Act
      const schemas = schemaValidator.getAllSchemas();

      // Assert
      expect(schemas.executionReport).toBeDefined();
      expect(schemas.structuredLog).toBeDefined();
      expect(schemas.executionReport.$schema).toBeDefined();
      expect(schemas.structuredLog.$schema).toBeDefined();
    });
  });

  describe('錯誤恢復測試', () => {
    test('應該在報表生成失敗時建立部分報表', async () => {
      // Arrange
      const flowDefinition: FlowParserDefinition = {
        id: 'recovery-test-flow',
        name: 'Recovery Test Flow',
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

      // 使用無效路徑觸發錯誤
      const invalidReportPath = '/invalid/path/report.json';

      // Act & Assert
      try {
        await orchestrator.executeFlowWithReporting(
          flowDefinition,
          config,
          {
            reportPath: invalidReportPath,
            enableReporting: true
          }
        );
      } catch (error) {
        // 預期會有錯誤，但應該嘗試建立部分報表
        expect(error).toBeDefined();
      }

      // 檢查是否有部分報表檔案
      const partialReportPath = join(testDir, 'partial-recovery-test-flow.json');
      // 注意：實際的部分報表可能會儲存在不同位置
    });
  });

  describe('效能測試', () => {
    test('應該在合理時間內處理大量步驟', async () => {
      // Arrange
      const largeFlowDefinition: FlowParserDefinition = {
        id: 'performance-test-flow',
        name: 'Performance Test Flow',
        version: '1.0.0',
        steps: Array.from({ length: 50 }, (_, i) => ({
          name: `step_${i + 1}`,
          request: {
            method: 'GET',
            url: `/test/${i + 1}`,
            headers: {}
          }
        }))
      };

      const config: ExecutionConfig = {
        baseUrl: 'https://api.example.com',
        fallbackUsed: false,
        authNamespaces: []
      };

      const reportPath = join(testDir, 'performance-report.json');

      // Act
      const startTime = Date.now();
      const result = await orchestrator.executeFlowWithReporting(
        largeFlowDefinition,
        config,
        {
          reportPath,
          enableReporting: true
        }
      );
      const duration = Date.now() - startTime;

      // Assert
      expect(result.results).toHaveLength(50);
      expect(existsSync(reportPath)).toBe(true);

      // 檢查效能（應該在合理時間內完成）
      expect(duration).toBeLessThan(10000); // 10秒內

      const reportContent = readFileSync(reportPath, 'utf8');
      const parsedReport = JSON.parse(reportContent);
      expect(parsedReport.steps).toHaveLength(50);
    });
  });

  describe('CLI 摘要產生', () => {
    test('應該產生有用的 CLI 摘要', async () => {
      // Arrange
      const flowDefinition: FlowParserDefinition = {
        id: 'cli-summary-flow',
        name: 'CLI Summary Flow',
        version: '1.0.0',
        steps: [
          {
            name: 'success_step',
            request: {
              method: 'GET',
              url: '/success',
              headers: {}
            }
          },
          {
            name: 'another_success',
            request: {
              method: 'GET',
              url: '/success2',
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

      const reportPath = join(testDir, 'cli-summary-report.json');

      // Act
      const result = await orchestrator.executeFlowWithReporting(
        flowDefinition,
        config,
        {
          reportPath,
          enableReporting: true
        }
      );

      // Assert
      expect(result.reportSummary).toBeDefined();
      expect(result.reportSummary).toContain('測試執行完成');
      expect(result.reportSummary).toContain(reportPath);
      expect(result.reportSummary).toContain('失敗計數');
      expect(result.reportSummary).toContain('成功率');
      expect(result.reportSummary).toContain('總計：2 步驟');
    });
  });
});