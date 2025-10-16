import { describe, it, expect, beforeEach } from 'vitest';
import { FlowOrchestrator, type FlowDefinition } from '../src/index.js';

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
});