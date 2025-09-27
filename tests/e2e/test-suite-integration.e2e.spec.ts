import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CliExecutor, TestFixtureManager, TestHttpServer } from './helpers';

describe('E2E 測試套件整合與資料同步', () => {
  let globalTestServer: TestHttpServer;
  let globalPort: number;

  beforeAll(async () => {
    // 建立全域測試伺服器供整合測試使用
    globalTestServer = new TestHttpServer();
    globalPort = await globalTestServer.start();
    console.log(`Global test server started on port ${globalPort}`);
  });

  afterAll(async () => {
    await globalTestServer.stop();
    console.log('Global test server stopped');
  });

  describe('測試資料一致性', () => {
    it('所有測試應該使用一致的測試資料格式', async () => {
      const cliExecutor = new CliExecutor();
      const fixtureManager = new TestFixtureManager();
      const testDir = await fixtureManager.setupTestEnvironment();

      try {
        // 驗證測試規格檔案存在且格式正確
        const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');
        const specContent = await cliExecutor.readFile(specPath);

        expect(specContent).toContain('openapi: 3.0.3');
        expect(specContent).toContain('title: Minimal API');
        expect(specContent).toContain('/health');
        expect(specContent).toContain('components:');
        expect(specContent).toContain('schemas:');

        // 驗證測試流程檔案存在且格式正確
        const flowPath = await fixtureManager.createTestFlow(testDir, 'minimal_flow.yaml');
        const flowContent = await cliExecutor.readFile(flowPath);

        expect(flowContent).toContain('id: minimal-test');
        expect(flowContent).toContain('steps:');
        expect(flowContent).toContain('expectations:');

      } finally {
        await fixtureManager.cleanupTestEnvironment(testDir);
      }
    });

    it('測試報表結構應該保持一致', async () => {
      const cliExecutor = new CliExecutor();
      const fixtureManager = new TestFixtureManager();
      const testDir = await fixtureManager.setupTestEnvironment();

      try {
        const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');
        const flowPath = await fixtureManager.createTestFlow(testDir, 'minimal_flow.yaml');

        globalTestServer.setup([
          {
            method: 'get',
            path: '/api/health',
            statusCode: 200,
            response: { status: 'ok', timestamp: new Date().toISOString() },
          },
        ]);

        const result = await cliExecutor.execute({
          spec: specPath,
          flow: flowPath,
          baseUrl: globalTestServer.getBaseUrl(),
          cwd: testDir,
        });

        expect(result.exitCode).toBe(0);

        // 驗證報表結構
        const reportPath = await fixtureManager.findGeneratedReportPath(testDir);
        expect(reportPath).not.toBeNull();

        const report = await cliExecutor.readJsonFile<any>(reportPath!);

        // 檢查必要的報表欄位
        expect(report).toHaveProperty('executionId');
        expect(report).toHaveProperty('flowId');
        expect(report).toHaveProperty('startTime');
        expect(report).toHaveProperty('endTime');
        expect(report).toHaveProperty('duration');
        expect(report).toHaveProperty('status');
        expect(report).toHaveProperty('summary');
        expect(report).toHaveProperty('steps');
        expect(report).toHaveProperty('config');

        // 檢查 summary 結構
        expect(report.summary).toHaveProperty('totalSteps');
        expect(report.summary).toHaveProperty('successfulSteps');
        expect(report.summary).toHaveProperty('failedSteps');
        expect(report.summary).toHaveProperty('skippedSteps');

        // 檢查 config 結構
        expect(report.config).toHaveProperty('baseUrl');
        expect(report.config).toHaveProperty('fallbackUsed');
        expect(report.config).toHaveProperty('authNamespaces');

      } finally {
        await fixtureManager.cleanupTestEnvironment(testDir);
      }
    });
  });

  describe('並行測試支援', () => {
    it('多個測試可以並行執行而不互相干擾', async () => {
      const createTest = async (testId: string) => {
        const cliExecutor = new CliExecutor();
        const fixtureManager = new TestFixtureManager();
        const testServer = new TestHttpServer();
        const port = await testServer.start();
        const testDir = await fixtureManager.setupTestEnvironment();

        try {
          const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');
          const flowContent = `
id: parallel-test-${testId}
name: "並行測試 ${testId}"

steps:
  - name: "測試步驟 ${testId}"
    request:
      method: "GET"
      path: "/test-${testId}"
    expectations:
      status: 200
`;
          const flowPath = await fixtureManager.createCustomFlow(testDir, `parallel-${testId}.yaml`, flowContent);

          testServer.setup([
            {
              method: 'get',
              path: `/test-${testId}`,
              statusCode: 200,
              response: { testId, message: `Response for test ${testId}` },
            },
          ]);

          const result = await cliExecutor.execute({
            spec: specPath,
            flow: flowPath,
            baseUrl: testServer.getBaseUrl(),
            cwd: testDir,
          });

          return { testId, result, testServer, fixtureManager, testDir };
        } catch (error) {
          await testServer.stop();
          await fixtureManager.cleanupTestEnvironment(testDir);
          throw error;
        }
      };

      // 並行執行多個測試
      const tests = await Promise.all([
        createTest('A'),
        createTest('B'),
        createTest('C'),
      ]);

      try {
        // 驗證所有測試都成功
        tests.forEach(({ testId, result }) => {
          expect(result.exitCode).toBe(0);
          expect(result.stdout).toContain('success');
        });

        // 驗證測試 ID 正確性
        expect(tests.map(t => t.testId).sort()).toEqual(['A', 'B', 'C']);

      } finally {
        // 清理所有測試資源
        await Promise.all(tests.map(async ({ testServer, fixtureManager, testDir }) => {
          await testServer.stop();
          await fixtureManager.cleanupTestEnvironment(testDir);
        }));
      }
    });
  });

  describe('資源清理驗證', () => {
    it('測試完成後應該正確清理所有資源', async () => {
      const cliExecutor = new CliExecutor();
      const fixtureManager = new TestFixtureManager();
      const testServer = new TestHttpServer();
      let testDir: string;
      let port: number;

      try {
        port = await testServer.start();
        testDir = await fixtureManager.setupTestEnvironment();

        const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');
        const flowPath = await fixtureManager.createTestFlow(testDir, 'minimal_flow.yaml');

        testServer.setup([
          {
            method: 'get',
            path: '/api/health',
            statusCode: 200,
            response: { status: 'ok' },
          },
        ]);

        const result = await cliExecutor.execute({
          spec: specPath,
          flow: flowPath,
          baseUrl: testServer.getBaseUrl(),
          cwd: testDir,
        });

        expect(result.exitCode).toBe(0);

        // 驗證報表和日誌檔案已產生
        const reportPath = await fixtureManager.findGeneratedReportPath(testDir);
        expect(reportPath).not.toBeNull();
        expect(await cliExecutor.fileExists(reportPath!)).toBe(true);

      } finally {
        // 清理資源
        await testServer.stop();
        if (testDir!) {
          await fixtureManager.cleanupTestEnvironment(testDir);

          // 驗證清理成功
          expect(await cliExecutor.fileExists(testDir)).toBe(false);
        }
      }
    });
  });

  describe('錯誤恢復機制', () => {
    it('測試失敗後應該能正確恢復', async () => {
      const cliExecutor = new CliExecutor();
      const fixtureManager = new TestFixtureManager();
      const testServer = new TestHttpServer();

      const port = await testServer.start();
      const testDir1 = await fixtureManager.setupTestEnvironment();
      const testDir2 = await fixtureManager.setupTestEnvironment();

      try {
        // 第一個測試：故意失敗
        const specPath1 = await fixtureManager.createTestSpec(testDir1, 'minimal.yaml');
        const flowPath1 = await fixtureManager.createTestFlow(testDir1, 'minimal_flow.yaml');

        testServer.setup([
          {
            method: 'get',
            path: '/api/health',
            statusCode: 500, // 故意失敗
            response: { error: 'Server Error' },
          },
        ]);

        const result1 = await cliExecutor.execute({
          spec: specPath1,
          flow: flowPath1,
          baseUrl: testServer.getBaseUrl(),
          cwd: testDir1,
        });

        expect(result1.exitCode).toBe(1); // 失敗

        // 第二個測試：應該成功（驗證恢復能力）
        const specPath2 = await fixtureManager.createTestSpec(testDir2, 'minimal.yaml');
        const flowPath2 = await fixtureManager.createTestFlow(testDir2, 'minimal_flow.yaml');

        testServer.setup([
          {
            method: 'get',
            path: '/api/health',
            statusCode: 200, // 正常回應
            response: { status: 'ok' },
          },
        ]);

        const result2 = await cliExecutor.execute({
          spec: specPath2,
          flow: flowPath2,
          baseUrl: testServer.getBaseUrl(),
          cwd: testDir2,
        });

        expect(result2.exitCode).toBe(0); // 成功

      } finally {
        await testServer.stop();
        await fixtureManager.cleanupTestEnvironment(testDir1);
        await fixtureManager.cleanupTestEnvironment(testDir2);
      }
    });
  });

  describe('測試套件協調', () => {
    it('應該能夠執行所有主要測試類型', async () => {
      const cliExecutor = new CliExecutor();
      const fixtureManager = new TestFixtureManager();
      const testServer = new TestHttpServer();

      const port = await testServer.start();
      const testDir = await fixtureManager.setupTestEnvironment();

      try {
        const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');

        // 測試類型 1: 成功流程
        const successFlowContent = `
id: success-integration-test
name: "成功流程整合測試"

steps:
  - name: "成功步驟"
    request:
      method: "GET"
      path: "/success"
    expectations:
      status: 200
`;
        const successFlowPath = await fixtureManager.createCustomFlow(testDir, 'success-integration.yaml', successFlowContent);

        // 測試類型 2: 失敗流程
        const failureFlowContent = `
id: failure-integration-test
name: "失敗流程整合測試"

steps:
  - name: "失敗步驟"
    request:
      method: "GET"
      path: "/failure"
    expectations:
      status: 200
`;
        const failureFlowPath = await fixtureManager.createCustomFlow(testDir, 'failure-integration.yaml', failureFlowContent);

        // 測試類型 3: 認證流程
        const authFlowContent = `
id: auth-integration-test
name: "認證流程整合測試"

auth:
  token: "test-token"

steps:
  - name: "認證步驟"
    request:
      method: "GET"
      path: "/protected"
    expectations:
      status: 200
`;
        const authFlowPath = await fixtureManager.createCustomFlow(testDir, 'auth-integration.yaml', authFlowContent);

        // 設定所有 endpoints
        testServer.setup([
          { method: 'get', path: '/success', statusCode: 200, response: { status: 'success' } },
          { method: 'get', path: '/failure', statusCode: 500, response: { error: 'failure' } },
          { method: 'get', path: '/protected', statusCode: 200, response: { protected: 'data' } },
        ]);

        // 執行成功測試
        const successResult = await cliExecutor.execute({
          spec: specPath,
          flow: successFlowPath,
          baseUrl: testServer.getBaseUrl(),
          cwd: testDir,
        });

        // 執行失敗測試
        const failureResult = await cliExecutor.execute({
          spec: specPath,
          flow: failureFlowPath,
          baseUrl: testServer.getBaseUrl(),
          cwd: testDir,
        });

        // 執行認證測試
        const authResult = await cliExecutor.execute({
          spec: specPath,
          flow: authFlowPath,
          baseUrl: testServer.getBaseUrl(),
          cwd: testDir,
        });

        // 驗證結果
        expect(successResult.exitCode).toBe(0);
        expect(failureResult.exitCode).toBe(1);
        expect(authResult.exitCode).toBe(0);

        expect(successResult.stdout).toContain('success');
        expect(failureResult.stdout).toMatch(/(failure|partial)/);
        expect(authResult.stdout).toContain('success');

      } finally {
        await testServer.stop();
        await fixtureManager.cleanupTestEnvironment(testDir);
      }
    });
  });

  describe('效能基準驗證', () => {
    it('整合測試套件應該在合理時間內完成', async () => {
      const startTime = Date.now();

      const cliExecutor = new CliExecutor();
      const fixtureManager = new TestFixtureManager();
      const testServer = new TestHttpServer();

      const port = await testServer.start();
      const testDir = await fixtureManager.setupTestEnvironment();

      try {
        const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');
        const flowPath = await fixtureManager.createTestFlow(testDir, 'minimal_flow.yaml');

        testServer.setup([
          {
            method: 'get',
            path: '/api/health',
            statusCode: 200,
            response: { status: 'ok' },
          },
        ]);

        const result = await cliExecutor.execute({
          spec: specPath,
          flow: flowPath,
          baseUrl: testServer.getBaseUrl(),
          cwd: testDir,
        });

        const executionTime = Date.now() - startTime;

        expect(result.exitCode).toBe(0);
        expect(executionTime).toBeLessThan(10000); // 10 秒內完成

      } finally {
        await testServer.stop();
        await fixtureManager.cleanupTestEnvironment(testDir);
      }
    });
  });
});