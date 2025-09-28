import http from 'http';
import { AddressInfo } from 'net';

export interface MockEndpoint {
  method: string;
  path: string;
  statusCode: number;
  response?: unknown;
  headers?: Record<string, string>;
  delay?: number;
}

export class TestHttpServer {
  private server: http.Server | null = null;
  private endpoints: Map<string, MockEndpoint> = new Map();
  private port: number = 0;

  constructor() {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const method = req.method?.toLowerCase() || 'get';
    const url = req.url || '/';

    // 分離 path 和 query string
    const [pathname, queryString] = url.split('?');
    const fullKey = `${method}:${url}`;
    const pathOnlyKey = `${method}:${pathname}`;

    console.log(`Test Server: ${method.toUpperCase()} ${url}`);

    // 先嘗試完整匹配（包含 query string），再嘗試只匹配 path
    let endpoint = this.endpoints.get(fullKey) || this.endpoints.get(pathOnlyKey);

    if (!endpoint) {
      console.log(`Test Server: No mock configured for ${fullKey} or ${pathOnlyKey}`);
      console.log(`Test Server: Available endpoints:`, Array.from(this.endpoints.keys()));
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found', path: url, availableEndpoints: Array.from(this.endpoints.keys()) }));
      return;
    }

    // Apply delay if configured
    const delay = endpoint.delay || 0;
    setTimeout(() => {
      const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Headers': '*',
        ...endpoint.headers,
      };

      res.writeHead(endpoint.statusCode, headers);

      if (endpoint.response !== undefined) {
        const responseBody = typeof endpoint.response === 'string'
          ? endpoint.response
          : JSON.stringify(endpoint.response);
        res.end(responseBody);
      } else {
        res.end();
      }

      console.log(`Test Server: Responded ${endpoint.statusCode} for ${url}`);
    }, delay);
  }

  async start(port: number = 0): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        reject(new Error('Server not initialized'));
        return;
      }

      this.server.listen(port, () => {
        const address = this.server?.address() as AddressInfo;
        this.port = address.port;
        console.log(`Test Server: Started on port ${this.port}`);
        resolve(this.port);
      });

      this.server.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Test Server: Stopped');
          resolve();
        }
      });
    });
  }

  addEndpoint(endpoint: MockEndpoint): void {
    const key = `${endpoint.method.toLowerCase()}:${endpoint.path}`;
    this.endpoints.set(key, endpoint);
    console.log(`Test Server: Added mock for ${key} -> ${endpoint.statusCode}`);
  }

  setup(endpoints: MockEndpoint[]): void {
    this.endpoints.clear();
    endpoints.forEach(endpoint => this.addEndpoint(endpoint));
  }

  getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }

  getPort(): number {
    return this.port;
  }
}

// 獨立執行 Mock Server
async function startMockServer() {
  const server = new TestHttpServer();

  // 預設的 Mock 端點
  server.setup([
    {
      method: 'get',
      path: '/api/health',
      statusCode: 200,
      response: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      }
    },
    {
      method: 'post',
      path: '/auth/login',
      statusCode: 200,
      response: {
        token: 'test-token-12345',
        expiresIn: 3600,
        tokenType: 'Bearer'
      }
    },
    {
      method: 'get',
      path: '/api/users',
      statusCode: 200,
      response: {
        users: [
          { id: 1, name: 'Test User 1', email: 'test1@example.com' },
          { id: 2, name: 'Test User 2', email: 'test2@example.com' }
        ]
      }
    },
    {
      method: 'post',
      path: '/api/users',
      statusCode: 201,
      response: {
        id: 3,
        name: 'New User',
        email: 'newuser@example.com',
        created: new Date().toISOString()
      }
    }
  ]);

  const port = await server.start(3000);
  console.log(`\n🚀 Mock Server 已啟動在 http://localhost:${port}`);
  console.log('可用的 API 端點：');
  console.log('  GET  /api/health  - 健康檢查');
  console.log('  POST /auth/login  - 登入認證');
  console.log('  GET  /api/users   - 取得使用者列表');
  console.log('  POST /api/users   - 建立新使用者');
  console.log('\n按 Ctrl+C 停止伺服器\n');

  // 處理 Ctrl+C 優雅關閉
  process.on('SIGINT', async () => {
    console.log('\n正在關閉 Mock Server...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n正在關閉 Mock Server...');
    await server.stop();
    process.exit(0);
  });
}

// 如果直接執行此檔案，啟動 Mock Server
if (process.argv[1] && process.argv[1].endsWith('test-server.ts')) {
  startMockServer().catch(console.error);
}