import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FlowOrchestrator, type FlowDefinition } from '../src/index.js';
import type { FlowDefinition as FlowParserDefinition } from '@specpilot/flow-parser';

describe('FlowOrchestrator', () => {
  let orchestrator: FlowOrchestrator;

  beforeEach(() => {
    orchestrator = new FlowOrchestrator();
  });

  describe('validateFlow', () => {
    it('應該驗證有效的流程定義', () => {
      const validFlow: FlowDefinition = {
        name: 'Test Flow',
        description: 'Test description',
        steps: [
          {
            name: 'Step 1',
            method: 'GET',
            url: '/api/test',
          },
        ],
      };

      expect(orchestrator.validateFlow(validFlow)).toBe(true);
    });

    it('應該拒絕無效的流程定義', () => {
      const invalidFlow = {
        name: '',
        steps: [],
      } as FlowDefinition;

      expect(orchestrator.validateFlow(invalidFlow)).toBe(false);
    });

    it('應該拒絕缺少步驟的流程', () => {
      const flowWithInvalidStep: FlowDefinition = {
        name: 'Test Flow',
        steps: [
          {
            name: '',
            method: 'GET',
            url: '',
          },
        ],
      };

      expect(orchestrator.validateFlow(flowWithInvalidStep)).toBe(false);
    });
  });

  describe('executeFlow', () => {
    it('應該執行有效的流程', async () => {
      const flow: FlowDefinition = {
        name: 'Test Flow',
        steps: [
          {
            name: 'Get Test',
            method: 'GET',
            url: '/api/test',
          },
        ],
      };

      const results = await orchestrator.executeFlow(flow);

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('pending');
      expect(results[0].duration).toBeGreaterThan(0);
    });

    it('應該處理多個步驟', async () => {
      const flow: FlowDefinition = {
        name: 'Multi Step Flow',
        steps: [
          { name: 'Step 1', method: 'GET', url: '/api/step1' },
          { name: 'Step 2', method: 'POST', url: '/api/step2' },
        ],
      };

      const results = await orchestrator.executeFlow(flow);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.duration > 0)).toBe(true);
    });
  });

  describe('executeFlowDefinition with Fail-Fast', () => {
    it('應該在 Fail-Fast 模式下，第一個步驟失敗後停止執行', async () => {
      const flowDefinition: FlowParserDefinition = {
        id: 'test-flow-failfast',
        rawContent: 'test',
        steps: [
          {
            name: 'Step 1 - Will Fail',
            description: '這個步驟會失敗',
            request: {
              method: 'GET',
              path: '/api/step1',
            },
            expectations: {
              status: 200,
            },
          },
          {
            name: 'Step 2 - Should be Skipped',
            description: '這個步驟應該被跳過',
            request: {
              method: 'GET',
              path: '/api/step2',
            },
            expectations: {
              status: 200,
            },
          },
          {
            name: 'Step 3 - Should be Skipped',
            description: '這個步驟也應該被跳過',
            request: {
              method: 'GET',
              path: '/api/step3',
            },
            expectations: {
              status: 200,
            },
          },
        ],
        options: {
          failFast: true, // 啟用 Fail-Fast 模式
        },
      };

      // 模擬第一個步驟失敗
      const executeStepSpy = vi.spyOn(orchestrator as any, 'executeStep');
      executeStepSpy.mockResolvedValueOnce({
        status: 'failed',
        duration: 10,
        error: '模擬步驟失敗',
      });

      const results = await orchestrator.executeFlowDefinition(flowDefinition);

      // 驗證只執行了第一個步驟
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('failed');
      expect(executeStepSpy).toHaveBeenCalledTimes(1);

      executeStepSpy.mockRestore();
    });

    it('應該在 Continue-On-Error 模式下（預設），繼續執行所有步驟', async () => {
      const flowDefinition: FlowParserDefinition = {
        id: 'test-flow-continue',
        rawContent: 'test',
        steps: [
          {
            name: 'Step 1 - Will Fail',
            request: {
              method: 'GET',
              path: '/api/step1',
            },
            expectations: {
              status: 200,
            },
          },
          {
            name: 'Step 2 - Will Execute',
            request: {
              method: 'GET',
              path: '/api/step2',
            },
            expectations: {
              status: 200,
            },
          },
          {
            name: 'Step 3 - Will Execute',
            request: {
              method: 'GET',
              path: '/api/step3',
            },
            expectations: {
              status: 200,
            },
          },
        ],
        // 不設定 options.failFast，預設為 false
      };

      // 模擬第一個步驟失敗，其他成功
      const executeStepSpy = vi.spyOn(orchestrator as any, 'executeStep');
      executeStepSpy
        .mockResolvedValueOnce({
          status: 'failed',
          duration: 10,
          error: '模擬步驟失敗',
        })
        .mockResolvedValueOnce({
          status: 'passed',
          duration: 10,
        })
        .mockResolvedValueOnce({
          status: 'passed',
          duration: 10,
        });

      const results = await orchestrator.executeFlowDefinition(flowDefinition);

      // 驗證執行了所有三個步驟
      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('failed');
      expect(results[1].status).toBe('passed');
      expect(results[2].status).toBe('passed');
      expect(executeStepSpy).toHaveBeenCalledTimes(3);

      executeStepSpy.mockRestore();
    });

    it('應該在 Fail-Fast 模式下，只有當步驟失敗時才停止（成功則繼續）', async () => {
      const flowDefinition: FlowParserDefinition = {
        id: 'test-flow-failfast-success',
        rawContent: 'test',
        steps: [
          {
            name: 'Step 1 - Will Pass',
            request: {
              method: 'GET',
              path: '/api/step1',
            },
            expectations: {
              status: 200,
            },
          },
          {
            name: 'Step 2 - Will Pass',
            request: {
              method: 'GET',
              path: '/api/step2',
            },
            expectations: {
              status: 200,
            },
          },
        ],
        options: {
          failFast: true,
        },
      };

      // 模擬所有步驟成功
      const executeStepSpy = vi.spyOn(orchestrator as any, 'executeStep');
      executeStepSpy
        .mockResolvedValueOnce({
          status: 'passed',
          duration: 10,
        })
        .mockResolvedValueOnce({
          status: 'passed',
          duration: 10,
        });

      const results = await orchestrator.executeFlowDefinition(flowDefinition);

      // 驗證執行了所有步驟（因為都成功）
      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('passed');
      expect(results[1].status).toBe('passed');
      expect(executeStepSpy).toHaveBeenCalledTimes(2);

      executeStepSpy.mockRestore();
    });
  });
});