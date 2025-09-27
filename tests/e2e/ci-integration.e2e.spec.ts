import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CliExecutor, TestFixtureManager, TestHttpServer } from './helpers';

describe('CI 環境整合測試', () => {
  let globalTestServer: TestHttpServer;

  beforeAll(async () => {
    // CI 環境準備
    globalTestServer = new TestHttpServer();
    await globalTestServer.start();
    console.log('CI Test Server started');
  });

  afterAll(async () => {
    await globalTestServer.stop();
    console.log('CI Test Server stopped');
  });

  describe('CI 環境驗證', () => {
    it('應該在 CI 環境中正確運行基本測試', async () => {
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
            response: { status: 'ok', ci: true, timestamp: new Date().toISOString() },
          },
        ]);

        const result = await cliExecutor.execute({
          spec: specPath,
          flow: flowPath,
          baseUrl: globalTestServer.getBaseUrl(),
          cwd: testDir,
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('success');

        // CI 特定檢查
        expect(result.duration).toBeLessThan(30000); // CI 環境中應該在 30 秒內完成

        // 驗證報表產生
        const reportPath = await fixtureManager.findGeneratedReportPath(testDir);
        expect(reportPath).not.toBeNull();

      } finally {
        await fixtureManager.cleanupTestEnvironment(testDir);
      }
    });

    it('CI 環境應該支援所有主要測試類型', async () => {
      const testResults = [];
      const cliExecutor = new CliExecutor();
      const fixtureManager = new TestFixtureManager();

      // 成功流程測試
      const successTestDir = await fixtureManager.setupTestEnvironment();
      try {
        const specPath = await fixtureManager.createTestSpec(successTestDir, 'minimal.yaml');
        const flowPath = await fixtureManager.createTestFlow(successTestDir, 'minimal_flow.yaml');

        globalTestServer.setup([
          {
            method: 'get',
            path: '/api/health',
            statusCode: 200,
            response: { status: 'ok', test: 'success' },
          },
        ]);

        const successResult = await cliExecutor.execute({
          spec: specPath,
          flow: flowPath,
          baseUrl: globalTestServer.getBaseUrl(),
          cwd: successTestDir,
        });

        testResults.push({ type: 'success', exitCode: successResult.exitCode });

      } finally {
        await fixtureManager.cleanupTestEnvironment(successTestDir);
      }

      // 失敗流程測試
      const failureTestDir = await fixtureManager.setupTestEnvironment();
      try {
        const specPath = await fixtureManager.createTestSpec(failureTestDir, 'minimal.yaml');
        const flowContent = `
id: ci-failure-test
name: "CI 失敗測試"

steps:
  - name: "故意失敗的步驟"
    request:
      method: "GET"
      path: "/fail"
    expectations:
      status: 200
`;
        const flowPath = await fixtureManager.createCustomFlow(failureTestDir, 'ci-failure.yaml', flowContent);

        globalTestServer.setup([
          {
            method: 'get',
            path: '/fail',
            statusCode: 500,
            response: { error: 'CI Test Failure' },
          },
        ]);

        const failureResult = await cliExecutor.execute({
          spec: specPath,
          flow: flowPath,
          baseUrl: globalTestServer.getBaseUrl(),
          cwd: failureTestDir,
        });

        testResults.push({ type: 'failure', exitCode: failureResult.exitCode });

      } finally {
        await fixtureManager.cleanupTestEnvironment(failureTestDir);
      }

      // 驗證測試結果
      expect(testResults).toHaveLength(2);
      expect(testResults.find(r => r.type === 'success')?.exitCode).toBe(0);
      expect(testResults.find(r => r.type === 'failure')?.exitCode).toBe(1);
    });

    it('CI 環境應該正確處理並行測試', async () => {
      const parallelTests = async (testId: string) => {
        const cliExecutor = new CliExecutor();
        const fixtureManager = new TestFixtureManager();
        const testServer = new TestHttpServer();
        const port = await testServer.start();
        const testDir = await fixtureManager.setupTestEnvironment();

        try {
          const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');
          const flowContent = `
id: ci-parallel-test-${testId}
name: "CI 並行測試 ${testId}"

steps:
  - name: "並行步驟 ${testId}"
    request:
      method: "GET"
      path: "/parallel/${testId}"
    expectations:
      status: 200
`;
          const flowPath = await fixtureManager.createCustomFlow(testDir, `ci-parallel-${testId}.yaml`, flowContent);

          testServer.setup([
            {
              method: 'get',
              path: `/parallel/${testId}`,
              statusCode: 200,
              response: { testId, parallel: true, ci: true },
            },
          ]);

          const result = await cliExecutor.execute({
            spec: specPath,
            flow: flowPath,
            baseUrl: testServer.getBaseUrl(),
            cwd: testDir,
          });

          return { testId, result };

        } finally {
          await testServer.stop();
          await fixtureManager.cleanupTestEnvironment(testDir);
        }
      };

      // 執行並行測試
      const results = await Promise.all([
        parallelTests('1'),
        parallelTests('2'),
        parallelTests('3'),
      ]);

      // 驗證所有並行測試都成功
      results.forEach(({ testId, result }) => {
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('success');
      });

      // 驗證測試 ID 正確性
      expect(results.map(r => r.testId).sort()).toEqual(['1', '2', '3']);
    });
  });

  describe('CI 效能要求', () => {
    it('CI 環境中的測試應該符合效能要求', async () => {
      const cliExecutor = new CliExecutor();
      const fixtureManager = new TestFixtureManager();
      const testDir = await fixtureManager.setupTestEnvironment();

      try {
        const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');

        // 建立包含 20 個步驟的中型測試
        const flowContent = `
id: ci-performance-test
name: "CI 效能測試"

steps:${Array.from({ length: 20 }, (_, i) => `
  - name: "CI 步驟 ${i + 1}"
    request:
      method: "GET"
      path: "/ci-perf/${i + 1}"
    expectations:
      status: 200`).join('')}
`;
        const flowPath = await fixtureManager.createCustomFlow(testDir, 'ci-performance.yaml', flowContent);

        // 設定所有步驟的 mock
        const endpoints = Array.from({ length: 20 }, (_, i) => ({
          method: 'get' as const,
          path: `/ci-perf/${i + 1}`,
          statusCode: 200,
          response: { step: i + 1, ci: true },
        }));
        globalTestServer.setup(endpoints);

        const startTime = Date.now();

        const result = await cliExecutor.execute({
          spec: specPath,
          flow: flowPath,
          baseUrl: globalTestServer.getBaseUrl(),
          cwd: testDir,
        });

        const executionTime = Date.now() - startTime;

        expect(result.exitCode).toBe(0);
        expect(executionTime).toBeLessThan(30000); // CI 環境中 20 步驟應在 30 秒內完成
        expect(result.stdout).toContain('總計：20 步驟');
        expect(result.stdout).toContain('成功：20');

      } finally {
        await fixtureManager.cleanupTestEnvironment(testDir);
      }
    });

    it('CI 環境應該能處理資源限制下的測試', async () => {
      const cliExecutor = new CliExecutor();
      const fixtureManager = new TestFixtureManager();
      const testDir = await fixtureManager.setupTestEnvironment();

      try {
        const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');

        // 建立包含延遲的測試（模擬資源限制）
        const flowContent = `
id: ci-resource-test
name: "CI 資源限制測試"

steps:
  - name: "延遲步驟 1"
    request:
      method: "GET"
      path: "/slow-1"
    expectations:
      status: 200

  - name: "延遲步驟 2"
    request:
      method: "GET"
      path: "/slow-2"
    expectations:
      status: 200
`;
        const flowPath = await fixtureManager.createCustomFlow(testDir, 'ci-resource.yaml', flowContent);

        globalTestServer.setup([
          {
            method: 'get',
            path: '/slow-1',
            statusCode: 200,
            response: { message: 'slow response 1', ci: true },
            delay: 200, // 200ms 延遲
          },
          {
            method: 'get',
            path: '/slow-2',
            statusCode: 200,
            response: { message: 'slow response 2', ci: true },
            delay: 200,
          },
        ]);

        const startTime = Date.now();

        const result = await cliExecutor.execute({
          spec: specPath,
          flow: flowPath,
          baseUrl: globalTestServer.getBaseUrl(),
          cwd: testDir,
        });

        const executionTime = Date.now() - startTime;

        expect(result.exitCode).toBe(0);
        expect(executionTime).toBeGreaterThan(300); // 至少 300ms（考慮並行度）
        expect(executionTime).toBeLessThan(5000); // 但不超過 5 秒
        expect(result.stdout).toContain('成功：2');

      } finally {
        await fixtureManager.cleanupTestEnvironment(testDir);
      }
    });
  });

  describe('CI 報表與日誌', () => {
    it('CI 環境應該產生完整的測試報表', async () => {
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
            response: { status: 'ok', ci: true },
          },
        ]);

        const result = await cliExecutor.execute({
          spec: specPath,
          flow: flowPath,
          baseUrl: globalTestServer.getBaseUrl(),
          cwd: testDir,
        });

        expect(result.exitCode).toBe(0);

        // 驗證 CI 報表產生
        const reportPath = await fixtureManager.findGeneratedReportPath(testDir);
        expect(reportPath).not.toBeNull();

        const report = await cliExecutor.readJsonFile<any>(reportPath!);

        // CI 特定的報表驗證
        expect(report).toHaveProperty('executionId');
        expect(report).toHaveProperty('startTime');
        expect(report).toHaveProperty('endTime');
        expect(report).toHaveProperty('duration');
        expect(report.status).toBe('success');
        expect(report.summary.totalSteps).toBe(1);
        expect(report.summary.successfulSteps).toBe(1);
        expect(report.summary.failedSteps).toBe(0);

        // 檢查 CI 環境配置
        expect(report.config).toHaveProperty('baseUrl');
        expect(report.config.baseUrl).toContain('localhost');

      } finally {
        await fixtureManager.cleanupTestEnvironment(testDir);
      }
    });
  });

  describe('CI 環境特殊情況', () => {
    it('CI 環境應該正確處理環境變數', async () => {
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
            response: { status: 'ok', ci: true },
          },
        ]);

        // 使用環境變數 token（模擬 CI 環境）
        const result = await cliExecutor.execute({
          spec: specPath,
          flow: flowPath,
          baseUrl: globalTestServer.getBaseUrl(),
          cwd: testDir,
          token: 'ci-environment-token',
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('success');

      } finally {
        await fixtureManager.cleanupTestEnvironment(testDir);
      }
    });

    it('CI 環境應該優雅處理清理失敗', async () => {
      const cliExecutor = new CliExecutor();
      const fixtureManager = new TestFixtureManager();
      const testDir = await fixtureManager.setupTestEnvironment();

      // 執行測試
      const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');
      const flowPath = await fixtureManager.createTestFlow(testDir, 'minimal_flow.yaml');

      globalTestServer.setup([
        {
          method: 'get',
          path: '/api/health',
          statusCode: 200,
          response: { status: 'ok', ci: true },
        },
      ]);

      const result = await cliExecutor.execute({
        spec: specPath,
        flow: flowPath,
        baseUrl: globalTestServer.getBaseUrl(),
        cwd: testDir,
      });

      expect(result.exitCode).toBe(0);

      // 嘗試清理（即使失敗也應該優雅處理）
      try {
        await fixtureManager.cleanupTestEnvironment(testDir);
      } catch (error) {
        // CI 環境中清理失敗應該被優雅處理
        console.log('Cleanup warning (expected in CI):', error);
      }

      // 測試應該已經成功，不管清理是否成功
      expect(result.stdout).toContain('success');
    });
  });
});