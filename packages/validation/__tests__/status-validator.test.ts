import { describe, it, expect, beforeEach } from 'vitest';
import { StatusValidator } from '../src/status-validator.js';
import { createStructuredLogger } from '@specpilot/shared';
import type { ValidationContext } from '../src/types.js';

describe('StatusValidator', () => {
  let validator: StatusValidator;
  let mockLogger: any;
  let baseContext: ValidationContext;

  beforeEach(() => {
    validator = new StatusValidator();
    mockLogger = {
      debug: () => {},
      info: () => {},
      error: () => {},
    };

    baseContext = {
      step: {
        name: 'test-step',
        request: {
          method: 'GET' as any,
          path: '/test',
        },
        expectations: {},
      },
      response: {
        status: 200,
        headers: {},
        data: {},
        duration: 100,
      },
      expectations: {},
      schemas: {},
      logger: mockLogger,
      executionId: 'test-exec-id',
      runContext: {
        executionId: 'test-exec-id',
        flowId: 'test-flow',
        timestamp: new Date(),
      },
    };
  });

  describe('單一狀態碼驗證', () => {
    it('應該通過相符的狀態碼驗證', async () => {
      const context = {
        ...baseContext,
        expectations: { status: 200 },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.telemetry.details).toEqual({
        expectedStatus: 200,
        actualStatus: 200,
      });
    });

    it('應該失敗不相符的狀態碼驗證', async () => {
      const context = {
        ...baseContext,
        expectations: { status: 201 },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toEqual({
        category: 'status',
        severity: 'error',
        message: '狀態碼驗證失敗：期望 201，實際收到 200',
        expected: 201,
        actual: 200,
      });
    });
  });

  describe('狀態碼陣列驗證', () => {
    it('應該通過包含在陣列中的狀態碼', async () => {
      const context = {
        ...baseContext,
        expectations: { status: [200, 201, 202] },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該失敗不在陣列中的狀態碼', async () => {
      const context = {
        ...baseContext,
        expectations: { status: [201, 202, 204] },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
    });
  });

  describe('狀態碼範圍驗證', () => {
    it('應該通過 2xx 範圍驗證', async () => {
      const context = {
        ...baseContext,
        expectations: { status: '2xx' },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該失敗不在 2xx 範圍的狀態碼', async () => {
      baseContext.response.status = 404;
      const context = {
        ...baseContext,
        expectations: { status: '2xx' },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
    });

    it('應該支援具體範圍如 200-299', async () => {
      const context = {
        ...baseContext,
        expectations: { status: '200-299' },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該支援字串形式的數字', async () => {
      const context = {
        ...baseContext,
        expectations: { status: '200' },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('邊界情況', () => {
    it('應該在沒有期望狀態碼時通過驗證', async () => {
      const context = {
        ...baseContext,
        expectations: {},
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('應該處理無效的範圍格式', async () => {
      const context = {
        ...baseContext,
        expectations: { status: 'invalid-range' },
      };

      const result = await validator.validate(context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
    });
  });

  describe('日誌記錄', () => {
    it('應該記錄驗證開始事件', async () => {
      const logSpy = { debug: [], info: [] } as any;
      mockLogger.debug = (event: string, data: any) => logSpy.debug.push({ event, data });

      const context = {
        ...baseContext,
        expectations: { status: 200 },
        logger: mockLogger,
      };

      await validator.validate(context);

      expect(logSpy.debug).toHaveLength(1);
      expect(logSpy.debug[0].event).toBe('VALIDATION_START');
      expect(logSpy.debug[0].data).toMatchObject({
        executionId: 'test-exec-id',
        component: 'validation-engine',
        stepName: 'test-step',
        validator: 'status',
        expectedStatus: 200,
        actualStatus: 200,
      });
    });

    it('應該記錄驗證成功事件', async () => {
      const logSpy = { info: [] } as any;
      mockLogger.info = (event: string, data: any) => logSpy.info.push({ event, data });

      const context = {
        ...baseContext,
        expectations: { status: 200 },
        logger: mockLogger,
      };

      await validator.validate(context);

      expect(logSpy.info).toHaveLength(1);
      expect(logSpy.info[0].event).toBe('VALIDATION_SUCCESS');
      expect(logSpy.info[0].data.status).toBe('success');
    });

    it('應該記錄驗證失敗事件', async () => {
      const logSpy = { info: [] } as any;
      mockLogger.info = (event: string, data: any) => logSpy.info.push({ event, data });

      const context = {
        ...baseContext,
        expectations: { status: 404 },
        logger: mockLogger,
      };

      await validator.validate(context);

      expect(logSpy.info).toHaveLength(1);
      expect(logSpy.info[0].event).toBe('VALIDATION_FAILURE');
      expect(logSpy.info[0].data.status).toBe('failure');
    });
  });
});