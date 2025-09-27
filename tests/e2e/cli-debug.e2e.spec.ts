import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CliExecutor, TestFixtureManager, TestHttpServer } from './helpers';

describe('CLI 除錯測試', () => {
  let cliExecutor: CliExecutor;
  let fixtureManager: TestFixtureManager;
  let testServer: TestHttpServer;
  let serverPort: number;
  let testDir: string;

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

  it('應該顯示 CLI 執行結果', async () => {
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

    console.log('Exit Code:', result.exitCode);
    console.log('Duration:', result.duration);
    console.log('\n--- STDOUT ---');
    console.log(result.stdout);
    console.log('\n--- STDERR ---');
    console.log(result.stderr);

    expect(true).toBe(true);
  });
});