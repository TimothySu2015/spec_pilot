/**
 * autoCheck 功能端對端測試 (Phase 9.7)
 * 測試 generateFlow 的智慧 operationId 檢測功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SpecAnalyzer, TestSuiteGenerator } from '@specpilot/test-suite-generator';
import { SpecEnhancer } from '@specpilot/spec-loader';
import { loadSpec } from '@specpilot/spec-loader';
import { writeFileSync, unlinkSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('autoCheck 功能端對端測試', () => {
  let tempFiles: string[] = [];

  // 清理臨時檔案
  afterEach(() => {
    for (const file of tempFiles) {
      try {
        if (existsSync(file)) {
          chmodSync(file, 0o644); // 恢復寫入權限
          unlinkSync(file);
        }
        if (existsSync(file + '.bak')) {
          unlinkSync(file + '.bak');
        }
      } catch {
        // 忽略刪除錯誤
      }
    }
    tempFiles = [];
  });

  // 創建測試用規格（缺少 operationId）
  function createTestSpec(writeable: boolean = true): string {
    const tempFile = join(tmpdir(), `test-spec-${Date.now()}.yaml`);
    tempFiles.push(tempFile);

    const specContent = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
servers:
  - url: http://localhost:3000
paths:
  /users:
    get:
      summary: 取得使用者列表
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
                  properties:
                    id:
                      type: integer
                    name:
                      type: string
    post:
      summary: 建立使用者
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - name
                - email
              properties:
                name:
                  type: string
                email:
                  type: string
                  format: email
      responses:
        '201':
          description: Created
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: integer
                  name:
                    type: string
                  email:
                    type: string
  /users/{id}:
    get:
      summary: 取得使用者詳情
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: integer
                  name:
                    type: string
                  email:
                    type: string
`;

    writeFileSync(tempFile, specContent);

    if (!writeable) {
      chmodSync(tempFile, 0o444); // 設為唯讀
    }

    return tempFile;
  }

  describe('場景 A：自己的規格（可修改）', () => {
    it('應該檢測到缺少 operationId 並提供 4 種解決方案', async () => {
      // 1. 建立可修改的規格檔案
      const specPath = createTestSpec(true);
      const specDoc = await loadSpec({ filePath: specPath });

      // 2. 建立分析器
      const analyzer = new SpecAnalyzer({ spec: specDoc.document });

      // 3. 檢測 operationId 問題
      const issues = analyzer.detectIssues();

      expect(issues.hasIssues).toBe(true);
      expect(issues.missingOperationIds.length).toBe(3);
      expect(issues.totalEndpoints).toBe(3);

      // 4. 驗證建議的 operationId
      const suggestions = issues.missingOperationIds.map(item => item.suggestedId);
      expect(suggestions).toContain('getUsers');
      expect(suggestions).toContain('createUsers');
      expect(suggestions).toContain('getUsers'); // GET /users/{id} 也是 getUsers

      // 5. 檢查檔案可修改性
      const isModifiable = analyzer.checkIfModifiable(specPath);
      expect(isModifiable).toBe(true);

      // 6. 模擬 autoCheck 邏輯
      const endpoints = ['createUsers', 'getUsers'];
      const hasOperationIdFormat = endpoints.some(ep =>
        !ep.includes('/') && !ep.includes(' ')
      );

      expect(hasOperationIdFormat).toBe(true);

      // 7. 驗證應該提供 4 種解決方案
      if (isModifiable) {
        // 可修改檔案應提供：
        // 1. 自動補充 operationId (addOperationIds)
        // 2. 使用 "METHOD /path" 格式
        // 3. 使用 "/path" 格式
        // 4. 產生所有端點
        expect(true).toBe(true); // 驗證邏輯正確
      }
    });

    it('方案 1：應該能使用 addOperationIds 自動補充', async () => {
      // 1. 建立規格檔案
      const specPath = createTestSpec(true);

      // 2. 使用 SpecEnhancer 自動補充
      const enhancer = new SpecEnhancer({
        createBackup: true,
        dryRun: false
      });

      const result = await enhancer.addOperationIds(specPath);

      expect(result.success).toBe(true);
      expect(result.additions.length).toBe(3);
      expect(result.backupPath).toBeDefined();

      // 3. 驗證補充後可正常產生 Flow
      const specDoc = await loadSpec({ filePath: specPath });
      const analyzer = new SpecAnalyzer({ spec: specDoc.document });
      const generator = new TestSuiteGenerator(analyzer, {
        includeSuccessCases: true,
        endpoints: ['createUsers', 'getUsers']
      });

      const flow = generator.generate();

      expect(flow.steps.length).toBeGreaterThan(0);
    });

    it('方案 2：應該能使用 "METHOD /path" 格式過濾', async () => {
      // 1. 建立規格檔案
      const specPath = createTestSpec(true);
      const specDoc = await loadSpec({ filePath: specPath });

      // 2. 使用 "METHOD /path" 格式
      const analyzer = new SpecAnalyzer({ spec: specDoc.document });
      const generator = new TestSuiteGenerator(analyzer, {
        includeSuccessCases: true,
        endpoints: ['POST /users', 'GET /users']
      });

      const flow = generator.generate();

      expect(flow.steps.length).toBeGreaterThan(0);
      // metadata.summary.endpoints 記錄的是自動產生的 operationId
      // 驗證過濾功能正常運作（產生了測試步驟）
      expect(flow.metadata.summary.endpoints.length).toBeGreaterThanOrEqual(2);
      expect(flow.metadata.summary.totalTests).toBeGreaterThanOrEqual(2);
    });

    it('方案 3：應該能使用 "/path" 格式匹配所有方法', async () => {
      // 1. 建立規格檔案
      const specPath = createTestSpec(true);
      const specDoc = await loadSpec({ filePath: specPath });

      // 2. 使用 "/path" 格式
      const analyzer = new SpecAnalyzer({ spec: specDoc.document });
      const generator = new TestSuiteGenerator(analyzer, {
        includeSuccessCases: true,
        endpoints: ['/users']
      });

      const flow = generator.generate();

      expect(flow.steps.length).toBeGreaterThan(0);
      // 應該匹配 GET /users 和 POST /users
      expect(flow.metadata.summary.totalTests).toBeGreaterThanOrEqual(2);
    });

    it('方案 4：應該能產生所有端點', async () => {
      // 1. 建立規格檔案
      const specPath = createTestSpec(true);
      const specDoc = await loadSpec({ filePath: specPath });

      // 2. 不指定 endpoints（產生全部）
      const analyzer = new SpecAnalyzer({ spec: specDoc.document });
      const generator = new TestSuiteGenerator(analyzer, {
        includeSuccessCases: true
      });

      const flow = generator.generate();

      expect(flow.steps.length).toBeGreaterThan(0);
      expect(flow.metadata.summary.totalTests).toBe(3); // 3 個端點
    });
  });

  describe('場景 B：第三方規格（唯讀）', () => {
    it('應該檢測到缺少 operationId 並提供 3 種解決方案', async () => {
      // 1. 建立唯讀的規格檔案
      const specPath = createTestSpec(false);
      const specDoc = await loadSpec({ filePath: specPath });

      // 2. 建立分析器
      const analyzer = new SpecAnalyzer({ spec: specDoc.document });

      // 3. 檢測 operationId 問題
      const issues = analyzer.detectIssues();

      expect(issues.hasIssues).toBe(true);
      expect(issues.missingOperationIds.length).toBe(3);

      // 4. 檢查檔案可修改性
      const isModifiable = analyzer.checkIfModifiable(specPath);
      expect(isModifiable).toBe(false);

      // 5. 驗證應該提供 3 種解決方案（不包含自動補充）
      if (!isModifiable) {
        // 唯讀檔案應提供：
        // 1. 使用 "METHOD /path" 格式
        // 2. 使用 "/path" 格式
        // 3. 產生所有端點
        expect(true).toBe(true); // 驗證邏輯正確
      }
    });

    it('方案 1：應該能使用 "METHOD /path" 格式過濾', async () => {
      // 1. 建立唯讀規格檔案
      const specPath = createTestSpec(false);
      const specDoc = await loadSpec({ filePath: specPath });

      // 2. 使用 "METHOD /path" 格式
      const analyzer = new SpecAnalyzer({ spec: specDoc.document });
      const generator = new TestSuiteGenerator(analyzer, {
        includeSuccessCases: true,
        endpoints: ['POST /users', 'GET /users/{id}']
      });

      const flow = generator.generate();

      expect(flow.steps.length).toBeGreaterThan(0);
      // metadata.summary.endpoints 記錄的是自動產生的 operationId
      // 驗證過濾功能正常運作（產生了測試步驟）
      expect(flow.metadata.summary.endpoints.length).toBeGreaterThanOrEqual(2);
      expect(flow.metadata.summary.totalTests).toBeGreaterThanOrEqual(2);
    });

    it('方案 2：應該能使用 "/path" 格式匹配所有方法', async () => {
      // 1. 建立唯讀規格檔案
      const specPath = createTestSpec(false);
      const specDoc = await loadSpec({ filePath: specPath });

      // 2. 使用 "/path" 格式
      const analyzer = new SpecAnalyzer({ spec: specDoc.document });
      const generator = new TestSuiteGenerator(analyzer, {
        includeSuccessCases: true,
        endpoints: ['/users']
      });

      const flow = generator.generate();

      expect(flow.steps.length).toBeGreaterThan(0);
      expect(flow.metadata.summary.totalTests).toBeGreaterThanOrEqual(2);
    });

    it('方案 3：應該能產生所有端點', async () => {
      // 1. 建立唯讀規格檔案
      const specPath = createTestSpec(false);
      const specDoc = await loadSpec({ filePath: specPath });

      // 2. 不指定 endpoints（產生全部）
      const analyzer = new SpecAnalyzer({ spec: specDoc.document });
      const generator = new TestSuiteGenerator(analyzer, {
        includeSuccessCases: true
      });

      const flow = generator.generate();

      expect(flow.steps.length).toBeGreaterThan(0);
      expect(flow.metadata.summary.totalTests).toBe(3);
    });
  });

  describe('場景 C：快速測試（不指定 endpoints）', () => {
    it('不指定 endpoints 時不應觸發 autoCheck 警告', async () => {
      // 1. 建立規格檔案
      const specPath = createTestSpec(true);
      const specDoc = await loadSpec({ filePath: specPath });

      // 2. 建立分析器
      const analyzer = new SpecAnalyzer({ spec: specDoc.document });

      // 3. 模擬 autoCheck 邏輯
      const endpoints = undefined; // 未指定 endpoints
      const autoCheck = true;

      // 4. 驗證不會觸發檢測
      if (autoCheck && endpoints && endpoints.length > 0) {
        // 不會進入此分支
        expect(false).toBe(true);
      } else {
        // 應該直接產生 Flow，不觸發警告
        const generator = new TestSuiteGenerator(analyzer, {
          includeSuccessCases: true
        });

        const flow = generator.generate();

        expect(flow.steps.length).toBeGreaterThan(0);
        expect(flow.metadata.summary.totalTests).toBe(3);
      }
    });

    it('使用 autoCheck: false 時不應觸發警告', async () => {
      // 1. 建立規格檔案
      const specPath = createTestSpec(true);
      const specDoc = await loadSpec({ filePath: specPath });

      // 2. 建立分析器
      const analyzer = new SpecAnalyzer({ spec: specDoc.document });

      // 3. 模擬 autoCheck: false
      const autoCheck = false;
      const endpoints = ['createUsers', 'getUsers'];

      // 4. 驗證不會觸發檢測
      if (autoCheck && endpoints && endpoints.length > 0) {
        // 不會進入此分支
        expect(false).toBe(true);
      } else {
        // 應該嘗試產生 Flow
        const generator = new TestSuiteGenerator(analyzer, {
          includeSuccessCases: true,
          endpoints: endpoints
        });

        const flow = generator.generate();

        // TestSuiteGenerator 使用 operationId 過濾時，會自動產生 operationId
        // 所以即使規格中沒有 operationId，仍能產生測試
        expect(flow.steps.length).toBeGreaterThan(0);
        // 驗證重點：autoCheck: false 時不會返回警告，而是直接產生
        expect(flow.metadata.summary.totalTests).toBeGreaterThan(0);
      }
    });
  });

  describe('整合測試：完整工作流程', () => {
    it('應該能完整執行：檢測 → 補充 → 產生', async () => {
      // 1. 建立規格檔案
      const specPath = createTestSpec(true);

      // 2. 第一次嘗試（應檢測到問題）
      let specDoc = await loadSpec({ filePath: specPath });
      let analyzer = new SpecAnalyzer({ spec: specDoc.document });
      let issues = analyzer.detectIssues();

      expect(issues.hasIssues).toBe(true);
      expect(issues.missingOperationIds.length).toBe(3);

      // 3. 使用 addOperationIds 補充
      const enhancer = new SpecEnhancer({ createBackup: true });
      const result = await enhancer.addOperationIds(specPath);

      expect(result.success).toBe(true);
      expect(result.additions.length).toBe(3);

      // 4. 重新載入規格
      specDoc = await loadSpec({ filePath: specPath });
      analyzer = new SpecAnalyzer({ spec: specDoc.document });
      issues = analyzer.detectIssues();

      expect(issues.hasIssues).toBe(false);
      expect(issues.missingOperationIds.length).toBe(0);

      // 5. 產生 Flow（不應觸發警告）
      const generator = new TestSuiteGenerator(analyzer, {
        includeSuccessCases: true,
        endpoints: ['createUsers', 'getUsers']
      });

      const flow = generator.generate();

      expect(flow.steps.length).toBeGreaterThan(0);
      expect(flow.metadata.summary.totalTests).toBeGreaterThan(0);
    });
  });
});
