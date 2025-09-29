import http from 'http';
import { AddressInfo } from 'net';
import { URL } from 'url';

export interface MockEndpoint {
  method: string;
  path: string;
  statusCode: number;
  response?: unknown;
  headers?: Record<string, string>;
  delay?: number;
}

// 使用者資料介面
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

// 登入請求介面
export interface LoginRequest {
  username: string;
  password: string;
}

// 認證回應介面
export interface AuthResponse {
  token: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: Omit<User, 'id'>;
}

export class TestHttpServer {
  private server: http.Server | null = null;
  private endpoints: Map<string, MockEndpoint> = new Map();
  private port: number = 0;
  private users: Map<number, User> = new Map();
  private sessions: Map<string, { userId: number; expiresAt: number }> = new Map();
  private nextUserId: number = 1;

  // 管理者帳號
  private readonly ADMIN_USERNAME = 'admin';
  private readonly ADMIN_PASSWORD = '123456';

  constructor() {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res);
    });
    this.initializeData();
  }

  // 初始化資料
  private initializeData(): void {
    // 初始化一些測試使用者
    this.users.set(1, {
      id: 1,
      name: '測試使用者一',
      email: 'test1@example.com',
      role: 'user',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    this.users.set(2, {
      id: 2,
      name: '測試使用者二',
      email: 'test2@example.com',
      role: 'user',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    this.nextUserId = 3;
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const method = req.method?.toLowerCase() || 'get';
    const url = req.url || '/';

    // 設置 CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Content-Type', 'application/json');

    // 處理 OPTIONS 請求
    if (method === 'options') {
      res.writeHead(200);
      res.end();
      return;
    }

    // 分離 path 和 query string
    const [pathname, queryString] = url.split('?');
    console.log(`Test Server: ${method.toUpperCase()} ${url}`);

    try {
      // 動態路由處理
      if (await this.handleDynamicRoutes(method, pathname, req, res)) {
        return;
      }

      // 靜態端點處理
      const fullKey = `${method}:${url}`;
      const pathOnlyKey = `${method}:${pathname}`;
      const endpoint = this.endpoints.get(fullKey) || this.endpoints.get(pathOnlyKey);

      if (!endpoint) {
        console.log(`Test Server: No handler for ${fullKey} or ${pathOnlyKey}`);
        res.writeHead(404);
        res.end(JSON.stringify({
          error: 'Not Found',
          path: url,
          message: '找不到對應的 API 端點'
        }));
        return;
      }

      // 套用延遲
      const delay = endpoint.delay || 0;
      setTimeout(() => {
        const headers = {
          'Content-Type': 'application/json',
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
    } catch (error) {
      console.error('Test Server Error:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
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

  // 動態路由處理
  private async handleDynamicRoutes(
    method: string,
    pathname: string,
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<boolean> {
    // 讀取請求 body
    const body = await this.readRequestBody(req);

    // 登入端點
    if (method === 'post' && pathname === '/auth/login') {
      return this.handleLogin(body, res);
    }

    // 使用者管理端點（需要認證）
    if (pathname.startsWith('/api/users')) {
      const authHeader = req.headers.authorization;
      if (!this.validateAuth(authHeader)) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized', message: '需要有效的認證 token' }));
        return true;
      }

      // 使用者列表
      if (method === 'get' && pathname === '/api/users') {
        return this.handleGetUsers(res);
      }

      // 新增使用者
      if (method === 'post' && pathname === '/api/users') {
        return this.handleCreateUser(body, res);
      }

      // 使用者詳情、更新、刪除
      const userIdMatch = pathname.match(/^\/api\/users\/(\d+)$/);
      if (userIdMatch) {
        const userId = parseInt(userIdMatch[1], 10);

        if (method === 'get') {
          return this.handleGetUser(userId, res);
        }
        if (method === 'put') {
          return this.handleUpdateUser(userId, body, res, true); // 完整更新
        }
        if (method === 'patch') {
          return this.handleUpdateUser(userId, body, res, false); // 部分更新
        }
        if (method === 'delete') {
          return this.handleDeleteUser(userId, res);
        }
      }
    }

    return false;
  }

  // 讀取請求 body
  private async readRequestBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch {
          resolve({});
        }
      });
    });
  }

  // 登入處理
  private handleLogin(body: any, res: http.ServerResponse): boolean {
    const { username, password }: LoginRequest = body;

    if (username === this.ADMIN_USERNAME && password === this.ADMIN_PASSWORD) {
      // 產生 token
      const token = `admin-token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = Date.now() + (3600 * 1000); // 1小時後過期

      // 儲存 session
      this.sessions.set(token, { userId: 0, expiresAt }); // admin 使用 userId 0

      const authResponse: AuthResponse = {
        token,
        expiresIn: 3600,
        tokenType: 'Bearer',
        user: {
          name: '系統管理員',
          email: 'admin@specpilot.local',
          role: 'admin',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };

      res.writeHead(200);
      res.end(JSON.stringify(authResponse));
      console.log(`Test Server: Admin login successful, token: ${token}`);
      return true;
    }

    res.writeHead(401);
    res.end(JSON.stringify({
      error: 'Unauthorized',
      message: '帳號或密碼錯誤'
    }));
    return true;
  }

  // 驗證認證
  private validateAuth(authHeader?: string): boolean {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.substring(7);
    const session = this.sessions.get(token);

    if (!session || session.expiresAt < Date.now()) {
      if (session && session.expiresAt < Date.now()) {
        this.sessions.delete(token);
      }
      return false;
    }

    return true;
  }

  // 取得使用者列表
  private handleGetUsers(res: http.ServerResponse): boolean {
    const users = Array.from(this.users.values());
    res.writeHead(200);
    res.end(JSON.stringify({
      users,
      total: users.length
    }));
    return true;
  }

  // 建立新使用者
  private handleCreateUser(body: any, res: http.ServerResponse): boolean {
    const { name, email, role = 'user', status = 'active' } = body;

    if (!name || !email) {
      res.writeHead(400);
      res.end(JSON.stringify({
        error: 'Bad Request',
        message: '姓名和信箱為必填欄位'
      }));
      return true;
    }

    // 檢查 email 是否重複
    const existingUser = Array.from(this.users.values()).find(u => u.email === email);
    if (existingUser) {
      res.writeHead(409);
      res.end(JSON.stringify({
        error: 'Conflict',
        message: '該信箱已被使用'
      }));
      return true;
    }

    const newUser: User = {
      id: this.nextUserId++,
      name,
      email,
      role: role === 'admin' ? 'admin' : 'user',
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.users.set(newUser.id, newUser);

    res.writeHead(201);
    res.end(JSON.stringify(newUser));
    console.log(`Test Server: Created user ${newUser.id}: ${newUser.name}`);
    return true;
  }

  // 取得單一使用者
  private handleGetUser(userId: number, res: http.ServerResponse): boolean {
    const user = this.users.get(userId);

    if (!user) {
      res.writeHead(404);
      res.end(JSON.stringify({
        error: 'Not Found',
        message: '找不到該使用者'
      }));
      return true;
    }

    res.writeHead(200);
    res.end(JSON.stringify(user));
    return true;
  }

  // 更新使用者
  private handleUpdateUser(
    userId: number,
    body: any,
    res: http.ServerResponse,
    fullUpdate: boolean
  ): boolean {
    const user = this.users.get(userId);

    if (!user) {
      res.writeHead(404);
      res.end(JSON.stringify({
        error: 'Not Found',
        message: '找不到該使用者'
      }));
      return true;
    }

    // 檢查 email 重複（排除自己）
    if (body.email && body.email !== user.email) {
      const existingUser = Array.from(this.users.values())
        .find(u => u.email === body.email && u.id !== userId);
      if (existingUser) {
        res.writeHead(409);
        res.end(JSON.stringify({
          error: 'Conflict',
          message: '該信箱已被使用'
        }));
        return true;
      }
    }

    const updatedUser: User = fullUpdate ? {
      id: user.id,
      name: body.name || user.name,
      email: body.email || user.email,
      role: body.role === 'admin' ? 'admin' : 'user',
      status: body.status || 'active',
      createdAt: user.createdAt,
      updatedAt: new Date().toISOString()
    } : {
      ...user,
      ...body,
      id: user.id, // 確保 ID 不能被修改
      createdAt: user.createdAt, // 確保建立時間不能被修改
      updatedAt: new Date().toISOString()
    };

    this.users.set(userId, updatedUser);

    res.writeHead(200);
    res.end(JSON.stringify(updatedUser));
    console.log(`Test Server: Updated user ${userId}`);
    return true;
  }

  // 刪除使用者
  private handleDeleteUser(userId: number, res: http.ServerResponse): boolean {
    const user = this.users.get(userId);

    if (!user) {
      res.writeHead(404);
      res.end(JSON.stringify({
        error: 'Not Found',
        message: '找不到該使用者'
      }));
      return true;
    }

    this.users.delete(userId);

    res.writeHead(200);
    res.end(JSON.stringify({
      message: '使用者已成功刪除',
      deletedUser: user
    }));
    console.log(`Test Server: Deleted user ${userId}: ${user.name}`);
    return true;
  }
}

// 獨立執行 Mock Server
async function startMockServer() {
  const server = new TestHttpServer();

  // 預設的健康檢查端點（其他端點由動態路由處理）
  server.setup([
    {
      method: 'get',
      path: '/api/health',
      statusCode: 200,
      response: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        features: {
          auth: true,
          userManagement: true,
          adminAccount: {
            username: 'admin',
            note: '預設管理者帳號'
          }
        }
      }
    }
  ]);

  const port = await server.start(3000);
  console.log(`\n🚀 SpecPilot Mock Server 已啟動在 http://localhost:${port}`);
  console.log('\n=== 管理者帳號 ===');
  console.log('  帳號: admin');
  console.log('  密碼: 123456');
  console.log('\n=== 可用的 API 端點 ===');
  console.log('  GET  /api/health        - 健康檢查');
  console.log('  POST /auth/login        - 登入認證 (管理者帳號)');
  console.log('  GET  /api/users         - 取得使用者列表 (需認證)');
  console.log('  POST /api/users         - 建立新使用者 (需認證)');
  console.log('  GET  /api/users/:id     - 取得使用者詳情 (需認證)');
  console.log('  PUT  /api/users/:id     - 完整更新使用者 (需認證)');
  console.log('  PATCH /api/users/:id    - 部分更新使用者 (需認證)');
  console.log('  DELETE /api/users/:id   - 刪除使用者 (需認證)');
  console.log('\n=== 測試流程建議 ===');
  console.log('  1. POST /auth/login 取得 token');
  console.log('  2. 在後續請求 Header 中加入: Authorization: Bearer <token>');
  console.log('  3. 執行使用者 CRUD 操作');
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