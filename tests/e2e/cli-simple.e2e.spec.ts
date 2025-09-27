import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CliExecutor, TestFixtureManager, TestHttpServer } from './helpers';
import * as path from 'node:path';

describe('CLI 簡單測試', () => {
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

  it('應該能夠載入規格和流程檔案', async () => {
    const specPath = await fixtureManager.createTestSpec(testDir, 'minimal.yaml');
    const flowPath = await fixtureManager.createTestFlow(testDir, 'minimal_flow.yaml');

    // 設定測試伺服器來回應 /api/health 請求
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

    console.log('Exit Code:', result.exitCode);
    console.log('Duration:', result.duration);
    console.log('\n--- STDOUT ---');
    console.log(result.stdout);
    console.log('\n--- STDERR ---');
    console.log(result.stderr);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('規格載入成功');
    expect(result.stdout).toContain('流程載入成功');
  });
});