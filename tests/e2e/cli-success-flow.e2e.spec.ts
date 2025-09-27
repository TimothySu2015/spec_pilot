import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CliExecutor, TestFixtureManager, TestHttpServer } from './helpers';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

describe('CLI 成功流程端對端測試', () => {
  let cliExecutor: CliExecutor;
  let fixtureManager: TestFixtureManager;
  let testServer: TestHttpServer;
  let testDir: string;
  let serverPort: number;

  beforeEach(async () => {
    cliExecutor = new CliExecutor();
    fixtureManager = new TestFixtureManager();
    testServer = new TestHttpServer();

    // 啟動測試伺服器，使用隨機 port
    serverPort = await testServer.start();
    testDir = await fixtureManager.setupTestEnvironment();
  });

  afterEach(async () => {
    await testServer.stop();
    await fixtureManager.cleanupTestEnvironment(testDir);
  });

  describe('完整 CLI 執行流程', () => {
    it('應該成功執行最小化測試流程', async () => {
      const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');
      const flowPath = await fixtureManager.createTestFlow(testDir, 'minimal_flow.yaml');

      testServer.setup([
        {
          method: 'get',
          path: '/api/health',
          statusCode: 200,
          response: {
            status: 'ok',
            timestamp: new Date().toISOString(),
          },
        },
      ]);

      const result = await cliExecutor.execute({
        spec: specPath,
        flow: flowPath,
        baseUrl: testServer.getBaseUrl(),
        cwd: testDir,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('success');
      expect(result.duration).toBeLessThan(10000);
    });

    it('應該正確載入並解析 OpenAPI 規格', async () => {
      const specPath = await fixtureManager.createTestSpec(testDir, 'simple.json');
      const flowContent = `
id: spec-validation-test
name: "規格驗證測試"

steps:
  - name: "測試健康檢查"
    request:
      method: "GET"
      path: "/health"
    expectations:
      status: 200
`;
      const flowPath = await fixtureManager.createCustomFlow(testDir, 'test-flow.yaml', flowContent);

      testServer.setup([
        {
          method: 'get',
          path: '/health',
          statusCode: 200,
          response: { status: 'healthy' },
        },
      ]);

      const result = await cliExecutor.execute({
        spec: specPath,
        flow: flowPath,
        baseUrl: testServer.getBaseUrl(),
        cwd: testDir,
      });

      expect(result.exitCode).toBe(0);
    });

    it('應該正確解析並執行 Flow YAML', async () => {
      const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');
      const flowContent = `
id: multi-step-test
name: "多步驟測試流程"

steps:
  - name: "步驟 1: 健康檢查"
    request:
      method: "GET"
      path: "/health"
    expectations:
      status: 200

  - name: "步驟 2: 取得使用者列表"
    request:
      method: "GET"
      path: "/users"
    expectations:
      status: 200
`;
      const flowPath = await fixtureManager.createCustomFlow(testDir, 'multi-step-flow.yaml', flowContent);

      testServer.setup([
        {
          method: 'get',
          path: '/health',
          statusCode: 200,
          response: { status: 'ok', timestamp: new Date().toISOString() },
        },
        {
          method: 'get',
          path: '/users',
          statusCode: 200,
          response: [
            { id: 1, name: '張三', email: 'zhang@example.com', createdAt: '2024-01-01T00:00:00Z' },
          ],
        },
      ]);

      const result = await cliExecutor.execute({
        spec: specPath,
        flow: flowPath,
        baseUrl: testServer.getBaseUrl(),
        cwd: testDir,
      });

      expect(result.exitCode).toBe(0);
    });
  });

  describe('HTTP 呼叫執行', () => {
    it('應該成功執行 GET 請求', async () => {
      const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');
      const flowContent = `
id: get-request-test
name: "GET 請求測試"

steps:
  - name: "GET 請求"
    request:
      method: "GET"
      path: "/users"
      query:
        limit: "10"
    expectations:
      status: 200
`;
      const flowPath = await fixtureManager.createCustomFlow(testDir, 'get-test-flow.yaml', flowContent);

      testServer.setup([
        {
          method: 'get',
          path: '/users',
          statusCode: 200,
          response: [
            { id: 1, name: '張三', email: 'zhang@example.com', createdAt: '2024-01-01T00:00:00Z' },
          ],
        },
      ]);

      const result = await cliExecutor.execute({
        spec: specPath,
        flow: flowPath,
        baseUrl: testServer.getBaseUrl(),
        cwd: testDir,
      });

      expect(result.exitCode).toBe(0);
    });

    it('應該成功執行 POST 請求', async () => {
      const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');
      const flowContent = `
id: post-request-test
name: "POST 請求測試"

steps:
  - name: "建立使用者"
    request:
      method: "POST"
      path: "/users"
      body:
        name: "李四"
        email: "li@example.com"
    expectations:
      status: 201
`;
      const flowPath = await fixtureManager.createCustomFlow(testDir, 'post-test-flow.yaml', flowContent);

      testServer.setup([
        {
          method: 'post',
          path: '/users',
          statusCode: 201,
          response: {
            id: 2,
            name: '李四',
            email: 'li@example.com',
            createdAt: new Date().toISOString(),
          },
        },
      ]);

      const result = await cliExecutor.execute({
        spec: specPath,
        flow: flowPath,
        baseUrl: testServer.getBaseUrl(),
        cwd: testDir,
      });

      expect(result.exitCode).toBe(0);
    });
  });

  describe('回應驗證', () => {
    it('應該成功驗證 HTTP 狀態碼', async () => {
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

      const result = await cliExecutor.execute({
        spec: specPath,
        flow: flowPath,
        baseUrl: testServer.getBaseUrl(),
        cwd: testDir,
      });

      expect(result.exitCode).toBe(0);
    });

    it('應該成功驗證 JSON Schema', async () => {
      const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');
      const flowContent = `
id: schema-validation-test
name: "Schema 驗證測試"

steps:
  - name: "驗證使用者回應 Schema"
    request:
      method: "GET"
      path: "/users"
    expectations:
      status: 200
`;
      const flowPath = await fixtureManager.createCustomFlow(testDir, 'schema-test-flow.yaml', flowContent);

      testServer.setup([
        {
          method: 'get',
          path: '/users',
          statusCode: 200,
          response: [
            {
              id: 1,
              name: '張三',
              email: 'zhang@example.com',
              createdAt: '2024-01-01T00:00:00Z',
            },
          ],
        },
      ]);

      const result = await cliExecutor.execute({
        spec: specPath,
        flow: flowPath,
        baseUrl: testServer.getBaseUrl(),
        cwd: testDir,
      });

      if (result.exitCode !== 0) {
        console.log('Schema validation test - Exit Code:', result.exitCode);
        console.log('Schema validation test - STDOUT:', result.stdout);
        console.log('Schema validation test - STDERR:', result.stderr);
      }
      expect(result.exitCode).toBe(0);
    });
  });

  describe('報表產生', () => {
    it('應該在正確位置產生報表檔案', async () => {
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

      await cliExecutor.execute({
        spec: specPath,
        flow: flowPath,
        baseUrl: testServer.getBaseUrl(),
        cwd: testDir,
      });

      const reportPath = await fixtureManager.findGeneratedReportPath(testDir);
      expect(reportPath).not.toBeNull();

      const reportExists = await cliExecutor.fileExists(reportPath!);
      expect(reportExists).toBe(true);
    });

    it('應該產生有效的 JSON 報表格式', async () => {
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

      await cliExecutor.execute({
        spec: specPath,
        flow: flowPath,
        baseUrl: testServer.getBaseUrl(),
        cwd: testDir,
      });

      const reportPath = await fixtureManager.findGeneratedReportPath(testDir);
      expect(reportPath).not.toBeNull();

      const report = await cliExecutor.readJsonFile<any>(reportPath!);

      expect(report).toHaveProperty('executionId');
      expect(report).toHaveProperty('flowId');
      expect(report).toHaveProperty('status');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('steps');
      expect(Array.isArray(report.steps)).toBe(true);
    });
  });

  describe('CLI 退出碼', () => {
    it('成功執行時應該返回退出碼 0', async () => {
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

      const result = await cliExecutor.execute({
        spec: specPath,
        flow: flowPath,
        baseUrl: testServer.getBaseUrl(),
        cwd: testDir,
      });

      expect(result.exitCode).toBe(0);
    });
  });

  describe('主控台輸出', () => {
    it('應該輸出報表位置與成功摘要', async () => {
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

      const result = await cliExecutor.execute({
        spec: specPath,
        flow: flowPath,
        baseUrl: testServer.getBaseUrl(),
        cwd: testDir,
      });

      expect(result.stdout.toLowerCase()).toMatch(/report|報表/);
      expect(result.stdout.toLowerCase()).toMatch(/success|成功|complete|完成/);
    });
  });
});