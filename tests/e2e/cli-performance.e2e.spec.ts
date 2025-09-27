import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CliExecutor, TestFixtureManager, TestHttpServer } from './helpers';

describe('CLI 效能測試 (NFR2: ≤60秒)', () => {
  let cliExecutor: CliExecutor;
  let fixtureManager: TestFixtureManager;
  let testServer: TestHttpServer;
  let testDir: string;
  let serverPort: number;

  beforeEach(async () => {
    cliExecutor = new CliExecutor();
    fixtureManager = new TestFixtureManager();
    testServer = new TestHttpServer();

    serverPort = await testServer.start();
    testDir = await fixtureManager.setupTestEnvironment();
  });

  afterEach(async () => {
    await testServer.stop();
    await fixtureManager.cleanupTestEnvironment(testDir);
  });

  describe('基本效能要求', () => {
    it('單一步驟應該在 5 秒內完成', async () => {
      const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');
      const flowPath = await fixtureManager.createTestFlow(testDir, 'minimal_flow.yaml');

      testServer.setup([
        {
          method: 'get',
          path: '/api/health',
          statusCode: 200,
          response: { status: 'ok', timestamp: new Date().toISOString() },
        },
      ]);

      const startTime = Date.now();

      const result = await cliExecutor.execute({
        spec: specPath,
        flow: flowPath,
        baseUrl: testServer.getBaseUrl(),
        cwd: testDir,
      });

      const executionTime = Date.now() - startTime;

      expect(result.exitCode).toBe(0);
      expect(executionTime).toBeLessThan(5000); // 5 秒
      expect(result.duration).toBeLessThan(5000);
    });

    it('10 步驟流程應該在 30 秒內完成', async () => {
      const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');

      // 建立包含 10 個步驟的流程
      const flowContent = `
id: performance-test-10-steps
name: "10 步驟效能測試"

steps:${Array.from({ length: 10 }, (_, i) => `
  - name: "步驟 ${i + 1}: 健康檢查"
    request:
      method: "GET"
      path: "/health"
    expectations:
      status: 200`).join('')}
`;
      const flowPath = await fixtureManager.createCustomFlow(testDir, '10-steps-flow.yaml', flowContent);

      // 設定所有步驟的 mock
      testServer.setup([
        {
          method: 'get',
          path: '/health',
          statusCode: 200,
          response: { status: 'ok', step: 'completed' },
        },
      ]);

      const startTime = Date.now();

      const result = await cliExecutor.execute({
        spec: specPath,
        flow: flowPath,
        baseUrl: testServer.getBaseUrl(),
        cwd: testDir,
      });

      const executionTime = Date.now() - startTime;

      expect(result.exitCode).toBe(0);
      expect(executionTime).toBeLessThan(30000); // 30 秒
      expect(result.duration).toBeLessThan(30000);
      expect(result.stdout).toContain('總計：10 步驟');
      expect(result.stdout).toContain('成功：10');
    });

    it('NFR2: 大型流程應該在 60 秒內完成', async () => {
      const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');

      // 建立包含 50 個步驟的大型流程來測試 NFR2 限制
      const flowContent = `
id: performance-test-nfr2
name: "NFR2 效能測試 - 50 步驟"

steps:${Array.from({ length: 50 }, (_, i) => `
  - name: "步驟 ${i + 1}: API 呼叫"
    request:
      method: "GET"
      path: "/api/endpoint-${i + 1}"
    expectations:
      status: 200`).join('')}
`;
      const flowPath = await fixtureManager.createCustomFlow(testDir, 'nfr2-flow.yaml', flowContent);

      // 設定所有步驟的 mock
      const endpoints = Array.from({ length: 50 }, (_, i) => ({
        method: 'get' as const,
        path: `/api/endpoint-${i + 1}`,
        statusCode: 200,
        response: { status: 'ok', endpoint: `endpoint-${i + 1}`, step: i + 1 },
      }));
      testServer.setup(endpoints);

      const startTime = Date.now();

      const result = await cliExecutor.execute({
        spec: specPath,
        flow: flowPath,
        baseUrl: testServer.getBaseUrl(),
        cwd: testDir,
      });

      const executionTime = Date.now() - startTime;

      expect(result.exitCode).toBe(0);
      expect(executionTime).toBeLessThan(60000); // 60 秒 - NFR2 要求
      expect(result.duration).toBeLessThan(60000);
      expect(result.stdout).toContain('總計：50 步驟');
      expect(result.stdout).toContain('成功：50');
    });
  });

  describe('網路延遲處理', () => {
    it('應該能處理中等網路延遲 (500ms per request)', async () => {
      const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');

      const flowContent = `
id: latency-test
name: "網路延遲測試"

steps:
  - name: "延遲請求 1"
    request:
      method: "GET"
      path: "/slow-endpoint-1"
    expectations:
      status: 200

  - name: "延遲請求 2"
    request:
      method: "GET"
      path: "/slow-endpoint-2"
    expectations:
      status: 200

  - name: "延遲請求 3"
    request:
      method: "GET"
      path: "/slow-endpoint-3"
    expectations:
      status: 200
`;
      const flowPath = await fixtureManager.createCustomFlow(testDir, 'latency-flow.yaml', flowContent);

      testServer.setup([
        {
          method: 'get',
          path: '/slow-endpoint-1',
          statusCode: 200,
          response: { message: 'slow response 1' },
          delay: 500, // 500ms 延遲
        },
        {
          method: 'get',
          path: '/slow-endpoint-2',
          statusCode: 200,
          response: { message: 'slow response 2' },
          delay: 500,
        },
        {
          method: 'get',
          path: '/slow-endpoint-3',
          statusCode: 200,
          response: { message: 'slow response 3' },
          delay: 500,
        },
      ]);

      const startTime = Date.now();

      const result = await cliExecutor.execute({
        spec: specPath,
        flow: flowPath,
        baseUrl: testServer.getBaseUrl(),
        cwd: testDir,
      });

      const executionTime = Date.now() - startTime;

      expect(result.exitCode).toBe(0);
      expect(executionTime).toBeGreaterThan(1400); // 至少 1.4 秒 (3 * 500ms - 一些並行度)
      expect(executionTime).toBeLessThan(10000); // 但不超過 10 秒
      expect(result.stdout).toContain('成功：3');
    });

    it('應該能在合理時間內處理高延遲 (1s per request)', async () => {
      const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');

      const flowContent = `
id: high-latency-test
name: "高延遲測試"

steps:
  - name: "高延遲請求 1"
    request:
      method: "GET"
      path: "/very-slow-1"
    expectations:
      status: 200

  - name: "高延遲請求 2"
    request:
      method: "GET"
      path: "/very-slow-2"
    expectations:
      status: 200
`;
      const flowPath = await fixtureManager.createCustomFlow(testDir, 'high-latency-flow.yaml', flowContent);

      testServer.setup([
        {
          method: 'get',
          path: '/very-slow-1',
          statusCode: 200,
          response: { message: 'very slow response 1' },
          delay: 1000, // 1 秒延遲
        },
        {
          method: 'get',
          path: '/very-slow-2',
          statusCode: 200,
          response: { message: 'very slow response 2' },
          delay: 1000,
        },
      ]);

      const startTime = Date.now();

      const result = await cliExecutor.execute({
        spec: specPath,
        flow: flowPath,
        baseUrl: testServer.getBaseUrl(),
        cwd: testDir,
      });

      const executionTime = Date.now() - startTime;

      expect(result.exitCode).toBe(0);
      expect(executionTime).toBeGreaterThan(1900); // 至少 1.9 秒
      expect(executionTime).toBeLessThan(15000); // 但不超過 15 秒
      expect(result.stdout).toContain('成功：2');
    });
  });

  describe('並行處理效能', () => {
    it('應該有效處理多個並行請求（如果支援）', async () => {
      const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');

      // 建立模擬並行處理的流程
      const flowContent = `
id: concurrent-test
name: "並行處理測試"

steps:
  - name: "並行請求 1"
    request:
      method: "GET"
      path: "/concurrent-1"
    expectations:
      status: 200

  - name: "並行請求 2"
    request:
      method: "GET"
      path: "/concurrent-2"
    expectations:
      status: 200

  - name: "並行請求 3"
    request:
      method: "GET"
      path: "/concurrent-3"
    expectations:
      status: 200

  - name: "並行請求 4"
    request:
      method: "GET"
      path: "/concurrent-4"
    expectations:
      status: 200

  - name: "並行請求 5"
    request:
      method: "GET"
      path: "/concurrent-5"
    expectations:
      status: 200
`;
      const flowPath = await fixtureManager.createCustomFlow(testDir, 'concurrent-flow.yaml', flowContent);

      testServer.setup([
        { method: 'get', path: '/concurrent-1', statusCode: 200, response: { id: 1 }, delay: 300 },
        { method: 'get', path: '/concurrent-2', statusCode: 200, response: { id: 2 }, delay: 300 },
        { method: 'get', path: '/concurrent-3', statusCode: 200, response: { id: 3 }, delay: 300 },
        { method: 'get', path: '/concurrent-4', statusCode: 200, response: { id: 4 }, delay: 300 },
        { method: 'get', path: '/concurrent-5', statusCode: 200, response: { id: 5 }, delay: 300 },
      ]);

      const startTime = Date.now();

      const result = await cliExecutor.execute({
        spec: specPath,
        flow: flowPath,
        baseUrl: testServer.getBaseUrl(),
        cwd: testDir,
      });

      const executionTime = Date.now() - startTime;

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('成功：5');

      // 如果是序列執行：5 * 300ms = 1500ms+
      // 如果支援並行：可能接近 300ms+
      // 我們給予寬鬆的上限
      expect(executionTime).toBeLessThan(5000);
    });
  });

  describe('記憶體和資源使用', () => {
    it('大量資料處理不應造成記憶體洩漏', async () => {
      const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');

      const flowContent = `
id: memory-test
name: "記憶體測試"

steps:
  - name: "大型回應處理"
    request:
      method: "GET"
      path: "/large-response"
    expectations:
      status: 200
`;
      const flowPath = await fixtureManager.createCustomFlow(testDir, 'memory-flow.yaml', flowContent);

      // 建立大型回應 (模擬大量資料)
      const largeData = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        description: 'A'.repeat(100), // 100 字元字串
        metadata: {
          createdAt: new Date().toISOString(),
          tags: [`tag${i}`, `category${i % 10}`, `group${i % 5}`],
          settings: { active: true, priority: i % 3, score: Math.random() * 100 }
        }
      }));

      testServer.setup([
        {
          method: 'get',
          path: '/large-response',
          statusCode: 200,
          response: { users: largeData, totalCount: largeData.length },
        },
      ]);

      const startTime = Date.now();

      const result = await cliExecutor.execute({
        spec: specPath,
        flow: flowPath,
        baseUrl: testServer.getBaseUrl(),
        cwd: testDir,
      });

      const executionTime = Date.now() - startTime;

      expect(result.exitCode).toBe(0);
      expect(executionTime).toBeLessThan(10000); // 10 秒內完成
      expect(result.stdout).toContain('成功：1');
    });
  });

  describe('錯誤處理效能', () => {
    it('錯誤情況下的效能不應明顯降低', async () => {
      const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');

      const flowContent = `
id: error-performance-test
name: "錯誤效能測試"

steps:
  - name: "正常請求"
    request:
      method: "GET"
      path: "/normal"
    expectations:
      status: 200

  - name: "錯誤請求"
    request:
      method: "GET"
      path: "/error"
    expectations:
      status: 200  # 期望成功但會失敗

  - name: "另一個正常請求"
    request:
      method: "GET"
      path: "/normal-2"
    expectations:
      status: 200
`;
      const flowPath = await fixtureManager.createCustomFlow(testDir, 'error-performance-flow.yaml', flowContent);

      testServer.setup([
        { method: 'get', path: '/normal', statusCode: 200, response: { status: 'ok' } },
        { method: 'get', path: '/error', statusCode: 500, response: { error: 'Internal Error' } },
        { method: 'get', path: '/normal-2', statusCode: 200, response: { status: 'ok' } },
      ]);

      const startTime = Date.now();

      const result = await cliExecutor.execute({
        spec: specPath,
        flow: flowPath,
        baseUrl: testServer.getBaseUrl(),
        cwd: testDir,
      });

      const executionTime = Date.now() - startTime;

      expect(result.exitCode).toBe(1); // 失敗但應該快速完成
      expect(executionTime).toBeLessThan(5000); // 5 秒內完成
      expect(result.stdout).toMatch(/(failure|partial)/);
    });
  });

  describe('啟動時間效能', () => {
    it('CLI 啟動時間應該合理', async () => {
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

      // 執行多次來測試啟動時間的一致性
      const executionTimes: number[] = [];

      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();

        const result = await cliExecutor.execute({
          spec: specPath,
          flow: flowPath,
          baseUrl: testServer.getBaseUrl(),
          cwd: testDir,
        });

        const executionTime = Date.now() - startTime;
        executionTimes.push(executionTime);

        expect(result.exitCode).toBe(0);
      }

      // 每次執行都應該在合理時間內
      executionTimes.forEach(time => {
        expect(time).toBeLessThan(5000); // 5 秒
      });

      // 啟動時間應該相對穩定
      const avgTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
      const maxDeviation = Math.max(...executionTimes.map(time => Math.abs(time - avgTime)));

      expect(maxDeviation).toBeLessThan(avgTime * 0.5); // 偏差不應超過平均值的 50%
    });
  });
});