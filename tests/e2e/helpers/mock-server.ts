import nock from 'nock';

export interface MockEndpoint {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  statusCode: number;
  response?: unknown;
  headers?: Record<string, string>;
  delay?: number;
  requireAuth?: boolean;
}

export class MockServerHelper {
  private readonly baseUrl: string;
  private scope: nock.Scope | null = null;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  setup(endpoints: MockEndpoint[]): void {
    this.cleanup();

    const url = new URL(this.baseUrl);
    this.scope = nock(url.origin);

    for (const endpoint of endpoints) {
      this.addEndpoint(endpoint);
    }
  }

  private addEndpoint(endpoint: MockEndpoint): void {
    if (!this.scope) {
      throw new Error('Mock server not initialized');
    }

    let interceptor = this.scope[endpoint.method](endpoint.path);

    if (endpoint.requireAuth) {
      interceptor = interceptor.matchHeader('Authorization', /^Bearer .+$/);
    }

    if (endpoint.delay) {
      interceptor = interceptor.delay(endpoint.delay);
    }

    const headers = endpoint.headers || { 'Content-Type': 'application/json' };

    if (endpoint.response !== undefined) {
      interceptor.reply(endpoint.statusCode, endpoint.response, headers);
    } else {
      interceptor.reply(endpoint.statusCode, '', headers);
    }
  }

  setupLoginEndpoint(token: string = 'test-token-12345'): void {
    const url = new URL(this.baseUrl);
    nock(url.origin)
      .post('/auth/login')
      .reply(200, {
        token,
        expiresIn: 3600,
        tokenType: 'Bearer',
      });
  }

  setupAuthenticatedEndpoint(
    method: MockEndpoint['method'],
    path: string,
    statusCode: number,
    response?: unknown
  ): void {
    const url = new URL(this.baseUrl);
    nock(url.origin)
      [method](path)
      .matchHeader('Authorization', /^Bearer .+$/)
      .reply(statusCode, response || {});
  }

  setupTimeoutEndpoint(method: MockEndpoint['method'], path: string): void {
    const url = new URL(this.baseUrl);
    nock(url.origin)
      [method](path)
      .delayConnection(5000)
      .reply(200, {});
  }

  setupErrorEndpoint(
    method: MockEndpoint['method'],
    path: string,
    statusCode: number,
    errorMessage?: string
  ): void {
    const url = new URL(this.baseUrl);
    const response = errorMessage
      ? { error: errorMessage, statusCode }
      : { error: 'Internal Server Error', statusCode };

    nock(url.origin)[method](path).reply(statusCode, response);
  }

  cleanup(): void {
    nock.cleanAll();
    this.scope = null;
  }

  assertAllCalled(): void {
    if (this.scope && !this.scope.isDone()) {
      throw new Error('Not all mocked endpoints were called');
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}