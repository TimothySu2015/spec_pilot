/**
 * 認證流程整合測試
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FlowOrchestrator, AuthHandler } from '@specpilot/core-flow';
import { AuthParser } from '@specpilot/flow-parser';
import { AuthConfigManager } from '@specpilot/config';
import type { FlowDefinition, FlowStep } from '@specpilot/flow-parser';
import type { TestResult } from '@specpilot/core-flow';

describe('認證流程整合測試', () => {
  let flowOrchestrator: FlowOrchestrator;
  let authHandler: AuthHandler;
  let authConfigManager: AuthConfigManager;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // 備份環境變數
    originalEnv = { ...process.env };

    // 建立測試實例
    authConfigManager = new AuthConfigManager();
    authHandler = new AuthHandler();
    flowOrchestrator = new FlowOrchestrator(authHandler);

    vi.clearAllMocks();
  });

  afterEach(() => {
    // 還原環境變數
    process.env = originalEnv;
    // 清除所有 Token
    authHandler.clearAllTokens();
  });

  describe('登入流程與 Token 提取', () => {
    it('應該成功執行登入步驟並提取 Token', async () => {
      const flowDefinition: FlowDefinition = {
        id: 'auth-test-flow',
        rawContent: '',
        steps: [
          {
            name: 'user_login',
            request: {
              method: 'POST',
              path: '/auth/login',
              headers: { 'Content-Type': 'application/json' },
              body: { username: 'testuser', password: 'testpass' }
            },
            expectations: { status: 200 },
            auth: {
              type: 'login',
              tokenExtraction: {
                path: 'data.token',
                expiresIn: 3600,
                namespace: 'api_v1'
              }
            }
          }
        ]
      };

      const results = await flowOrchestrator.executeFlowDefinition(flowDefinition);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('passed');
      expect(results[0].authStatus?.hasAuth).toBe(true);
      expect(results[0].authStatus?.authSuccess).toBe(true);
      expect(results[0].authStatus?.namespace).toBe('api_v1');

      // 驗證 Token 已被儲存
      const tokenStatus = authHandler.getTokenStatus('api_v1');
      expect(tokenStatus?.hasToken).toBe(true);
      expect(tokenStatus?.isExpired).toBe(false);
    });

    it('應該處理 Token 提取失敗的情況', async () => {
      // Mock TokenManager 的 extractTokenFromResponse 方法返回 null
      const tokenManager = authHandler.getTokenManager();
      vi.spyOn(tokenManager, 'extractTokenFromResponse').mockReturnValue(null);

      const flowDefinition: FlowDefinition = {
        id: 'auth-fail-flow',
        rawContent: '',
        steps: [
          {
            name: 'failed_login',
            request: {
              method: 'POST',
              path: '/auth/login'
            },
            expectations: { status: 200 },
            auth: {
              type: 'login',
              tokenExtraction: {
                path: 'data.token',
                namespace: 'api_v1'
              }
            }
          }
        ]
      };

      const results = await flowOrchestrator.executeFlowDefinition(flowDefinition);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('passed'); // HTTP 請求成功
      expect(results[0].authStatus?.hasAuth).toBe(true);
      expect(results[0].authStatus?.authSuccess).toBe(false);
      expect(results[0].authStatus?.authError).toContain('無法從回應中提取 Token');
    });

    it('應該支援自訂 Token 提取路徑', async () => {
      const flowDefinition: FlowDefinition = {
        id: 'custom-path-flow',
        rawContent: '',
        steps: [
          {
            name: 'oauth_login',
            request: {
              method: 'POST',
              path: '/oauth/token'
            },
            expectations: { status: 200 },
            auth: {
              type: 'login',
              tokenExtraction: {
                path: 'result.access_token',
                expiresIn: 7200,
                namespace: 'oauth'
              }
            }
          }
        ]
      };

      const results = await flowOrchestrator.executeFlowDefinition(flowDefinition);

      expect(results[0].status).toBe('passed');
      expect(results[0].authStatus?.namespace).toBe('oauth');
    });
  });

  describe('靜態 Token 認證', () => {
    it('應該成功使用靜態 Token', async () => {
      // 設定靜態 Token
      authHandler.getTokenManager().loadStaticToken('static_token_value', 'external_api', 3600);

      const flowDefinition: FlowDefinition = {
        id: 'static-auth-flow',
        rawContent: '',
        steps: [
          {
            name: 'api_call',
            request: {
              method: 'GET',
              path: '/api/users'
            },
            expectations: { status: 200 },
            auth: {
              type: 'static',
              namespace: 'external_api'
            }
          }
        ]
      };

      const results = await flowOrchestrator.executeFlowDefinition(flowDefinition);

      expect(results[0].status).toBe('passed');
      expect(results[0].authStatus?.hasAuth).toBe(true);
      expect(results[0].authStatus?.authSuccess).toBe(true);
      expect(results[0].authStatus?.namespace).toBe('external_api');
    });

    it('應該處理 Token 缺失的情況', async () => {
      const flowDefinition: FlowDefinition = {
        id: 'missing-token-flow',
        rawContent: '',
        steps: [
          {
            name: 'api_call',
            request: {
              method: 'GET',
              path: '/api/users'
            },
            expectations: { status: 200 },
            auth: {
              type: 'static',
              namespace: 'missing_namespace'
            }
          }
        ]
      };

      const results = await flowOrchestrator.executeFlowDefinition(flowDefinition);

      expect(results[0].status).toBe('passed'); // HTTP 請求本身成功（模擬）
      expect(results[0].authStatus?.hasAuth).toBe(true);
      expect(results[0].authStatus?.authSuccess).toBe(false);
      expect(results[0].authStatus?.authError).toContain('Token 不存在或已過期');
    });
  });

  describe('全域靜態認證載入', () => {
    it('應該從環境變數載入靜態 Token', async () => {
      // 設定環境變數
      process.env.SPEC_PILOT_TOKEN_API_V1 = 'env_token_value';

      const flowDefinition: FlowDefinition = {
        id: 'env-auth-flow',
        rawContent: '',
        steps: [
          {
            name: 'api_call',
            request: {
              method: 'GET',
              path: '/api/data'
            },
            expectations: { status: 200 },
            auth: {
              type: 'static',
              namespace: 'api_v1'
            }
          }
        ],
        globals: {
          auth: {
            static: [
              {
                namespace: 'api_v1',
                token: '${SPEC_PILOT_TOKEN_API_V1}',
                expiresInSeconds: 3600
              }
            ]
          }
        }
      };

      const results = await flowOrchestrator.executeFlowDefinition(flowDefinition);

      expect(results[0].status).toBe('passed');
      expect(results[0].authStatus?.authSuccess).toBe(true);

      // 驗證 Token 狀態
      const tokenStatus = authHandler.getTokenStatus('api_v1');
      expect(tokenStatus?.hasToken).toBe(true);
    });

    it('應該處理環境變數缺失的情況', async () => {
      const flowDefinition: FlowDefinition = {
        id: 'missing-env-flow',
        rawContent: '',
        steps: [
          {
            name: 'api_call',
            request: {
              method: 'GET',
              path: '/api/data'
            },
            expectations: { status: 200 },
            auth: {
              type: 'static',
              namespace: 'api_v1'
            }
          }
        ],
        globals: {
          auth: {
            static: [
              {
                namespace: 'api_v1',
                token: '${MISSING_ENV_VAR}'
              }
            ]
          }
        }
      };

      const results = await flowOrchestrator.executeFlowDefinition(flowDefinition);

      // 全域認證載入失敗不會阻止步驟執行，但 Token 不會可用
      expect(results[0].authStatus?.authSuccess).toBe(false);
    });
  });

  describe('認證設定解析', () => {
    it('應該正確解析登入認證設定', () => {
      const authConfig = {
        type: 'login',
        tokenExtraction: {
          path: 'data.access_token',
          expiresIn: 7200,
          namespace: 'oauth_service'
        }
      };

      const parsedAuth = AuthParser.parseStepAuth(authConfig, 'oauth_step');

      expect(parsedAuth?.type).toBe('login');
      expect(parsedAuth?.tokenExtraction?.path).toBe('data.access_token');
      expect(parsedAuth?.tokenExtraction?.expiresIn).toBe(7200);
      expect(parsedAuth?.tokenExtraction?.namespace).toBe('oauth_service');
    });

    it('應該正確解析靜態認證設定', () => {
      const authConfig = {
        type: 'static',
        namespace: 'external_service'
      };

      const parsedAuth = AuthParser.parseStepAuth(authConfig, 'api_step');

      expect(parsedAuth?.type).toBe('static');
      expect(parsedAuth?.namespace).toBe('external_service');
    });

    it('應該正確解析全域靜態認證設定', () => {
      const staticConfig = [
        {
          namespace: 'service_a',
          token: 'token_a',
          expiresInSeconds: 3600
        },
        {
          namespace: 'service_b',
          token: '${SERVICE_B_TOKEN}'
        }
      ];

      const parsedStatic = AuthParser.parseGlobalStaticAuth(staticConfig);

      expect(parsedStatic).toHaveLength(2);
      expect(parsedStatic[0].namespace).toBe('service_a');
      expect(parsedStatic[0].token).toBe('token_a');
      expect(parsedStatic[0].expiresInSeconds).toBe(3600);
      expect(parsedStatic[1].namespace).toBe('service_b');
      expect(parsedStatic[1].token).toBe('${SERVICE_B_TOKEN}');
    });
  });

  describe('完整認證流程', () => {
    it('應該完整執行登入到 API 呼叫的流程', async () => {
      const flowDefinition: FlowDefinition = {
        id: 'complete-auth-flow',
        rawContent: '',
        steps: [
          // 步驟 1：登入並取得 Token
          {
            name: 'user_login',
            request: {
              method: 'POST',
              path: '/auth/login',
              body: { username: 'testuser', password: 'testpass' }
            },
            expectations: { status: 200 },
            auth: {
              type: 'login',
              tokenExtraction: {
                path: 'data.token',
                expiresIn: 3600,
                namespace: 'user_session'
              }
            }
          },
          // 步驟 2：使用 Token 呼叫受保護的 API
          {
            name: 'get_user_profile',
            request: {
              method: 'GET',
              path: '/user/profile'
            },
            expectations: { status: 200 },
            auth: {
              type: 'static',
              namespace: 'user_session'
            }
          },
          // 步驟 3：更新使用者資料
          {
            name: 'update_user_profile',
            request: {
              method: 'PUT',
              path: '/user/profile',
              body: { name: 'Updated Name' }
            },
            expectations: { status: 200 },
            auth: {
              type: 'static',
              namespace: 'user_session'
            }
          }
        ]
      };

      const results = await flowOrchestrator.executeFlowDefinition(flowDefinition);

      expect(results).toHaveLength(3);

      // 驗證登入步驟
      expect(results[0].status).toBe('passed');
      expect(results[0].authStatus?.authSuccess).toBe(true);

      // 驗證 API 呼叫步驟
      expect(results[1].status).toBe('passed');
      expect(results[1].authStatus?.authSuccess).toBe(true);

      expect(results[2].status).toBe('passed');
      expect(results[2].authStatus?.authSuccess).toBe(true);

      // 驗證 Token 狀態
      const tokenStatus = authHandler.getTokenStatus('user_session');
      expect(tokenStatus?.hasToken).toBe(true);
      expect(tokenStatus?.isExpired).toBe(false);
    });

    it('應該處理多命名空間的認證需求', async () => {
      // 預先載入外部服務 Token
      authHandler.getTokenManager().loadStaticToken('external_token', 'external_service', 7200);

      const flowDefinition: FlowDefinition = {
        id: 'multi-namespace-flow',
        rawContent: '',
        steps: [
          // 登入內部系統
          {
            name: 'internal_login',
            request: {
              method: 'POST',
              path: '/auth/login'
            },
            expectations: { status: 200 },
            auth: {
              type: 'login',
              tokenExtraction: {
                path: 'data.token',
                namespace: 'internal_system'
              }
            }
          },
          // 呼叫內部 API
          {
            name: 'internal_api_call',
            request: {
              method: 'GET',
              path: '/internal/data'
            },
            expectations: { status: 200 },
            auth: {
              type: 'static',
              namespace: 'internal_system'
            }
          },
          // 呼叫外部 API
          {
            name: 'external_api_call',
            request: {
              method: 'GET',
              path: '/external/data'
            },
            expectations: { status: 200 },
            auth: {
              type: 'static',
              namespace: 'external_service'
            }
          }
        ]
      };

      const results = await flowOrchestrator.executeFlowDefinition(flowDefinition);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.status === 'passed')).toBe(true);
      expect(results.every(r => r.authStatus?.authSuccess === true)).toBe(true);

      // 驗證多個命名空間的 Token 都存在
      const allTokens = authHandler.getAllTokensStatus();
      expect(allTokens).toHaveLength(2);
      expect(allTokens.some(t => t.namespace === 'internal_system')).toBe(true);
      expect(allTokens.some(t => t.namespace === 'external_service')).toBe(true);
    });
  });
});