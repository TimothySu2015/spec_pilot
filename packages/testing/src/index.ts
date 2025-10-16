/**
 * 測試工具與 Fixture
 */

/**
 * 模擬 HTTP 回應
 */
export interface MockHttpResponse {
  status: number;
  headers: Record<string, string>;
  data: unknown;
}

/**
 * 建立模擬的成功回應
 */
export function createSuccessResponse<T>(data: T, status = 200): MockHttpResponse {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
    data,
  };
}

/**
 * 建立模擬的錯誤回應
 */
export function createErrorResponse(message: string, status = 400): MockHttpResponse {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      error: message,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * 測試用的延遲函式
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 產生測試用的隨機字串
 */
export function generateTestId(prefix = 'test'): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}