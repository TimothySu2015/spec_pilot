/**
 * SpecEnhancer 單元測試
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { SpecEnhancer } from '../src/spec-enhancer.js';
import { writeFileSync, unlinkSync, existsSync, readFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('SpecEnhancer', () => {
  let tempFiles: string[] = [];

  // 清理臨時檔案
  afterEach(() => {
    for (const file of tempFiles) {
      try {
        // 恢復寫入權限後再刪除
        if (existsSync(file)) {
          chmodSync(file, 0o644);
          unlinkSync(file);
        }
        // 刪除備份檔案
        if (existsSync(file + '.bak')) {
          unlinkSync(file + '.bak');
        }
      } catch {
        // 忽略刪除錯誤
      }
    }
    tempFiles = [];
  });

  describe('addOperationIds()', () => {
    test('應該補充缺少的 operationId', async () => {
      const enhancer = new SpecEnhancer();

      // 建立臨時規格檔案
      const tempFile = join(tmpdir(), `spec-test-${Date.now()}.yaml`);
      tempFiles.push(tempFile);

      const yamlContent = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    post:
      summary: 建立使用者
      responses:
        '201':
          description: Created
    get:
      summary: 列出使用者
      responses:
        '200':
          description: OK
`;

      writeFileSync(tempFile, yamlContent);

      const result = await enhancer.addOperationIds(tempFile);

      expect(result.success).toBe(true);
      expect(result.additions).toHaveLength(2);
      expect(result.additions[0]).toEqual({
        method: 'POST',
        path: '/users',
        generatedId: 'createUsers',
      });
      expect(result.additions[1]).toEqual({
        method: 'GET',
        path: '/users',
        generatedId: 'getUsers',
      });
      expect(result.totalEndpoints).toBe(2);
      expect(result.backupPath).toBeDefined();

      // 驗證檔案內容
      const modifiedContent = readFileSync(tempFile, 'utf-8');
      expect(modifiedContent).toContain('operationId: createUsers');
      expect(modifiedContent).toContain('operationId: getUsers');
    });

    test('已有 operationId 的端點不應修改', async () => {
      const enhancer = new SpecEnhancer();

      const tempFile = join(tmpdir(), `spec-test-${Date.now()}.yaml`);
      tempFiles.push(tempFile);

      const yamlContent = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    post:
      operationId: myCustomCreateUser
      summary: 建立使用者
      responses:
        '201':
          description: Created
`;

      writeFileSync(tempFile, yamlContent);

      const result = await enhancer.addOperationIds(tempFile);

      expect(result.success).toBe(true);
      expect(result.additions).toHaveLength(0);
      expect(result.totalEndpoints).toBe(1);
      expect(result.backupPath).toBeUndefined(); // 沒有修改，不建立備份

      // 驗證原 operationId 未被修改
      const modifiedContent = readFileSync(tempFile, 'utf-8');
      expect(modifiedContent).toContain('operationId: myCustomCreateUser');
      expect(modifiedContent).not.toContain('operationId: createUsers');
    });

    test('應該正確產生不同 HTTP 方法的 operationId', async () => {
      const enhancer = new SpecEnhancer();

      const tempFile = join(tmpdir(), `spec-test-${Date.now()}.yaml`);
      tempFiles.push(tempFile);

      const yamlContent = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users/{id}:
    get:
      responses:
        '200':
          description: OK
    put:
      responses:
        '200':
          description: OK
    patch:
      responses:
        '200':
          description: OK
    delete:
      responses:
        '204':
          description: No Content
`;

      writeFileSync(tempFile, yamlContent);

      const result = await enhancer.addOperationIds(tempFile);

      expect(result.success).toBe(true);
      expect(result.additions).toHaveLength(4);
      expect(result.additions.map((a) => a.generatedId)).toEqual([
        'getUsers',
        'updateUsers',
        'patchUsers',
        'deleteUsers',
      ]);
    });

    test('應該處理複雜的路徑', async () => {
      const enhancer = new SpecEnhancer();

      const tempFile = join(tmpdir(), `spec-test-${Date.now()}.yaml`);
      tempFiles.push(tempFile);

      const yamlContent = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /api/v1/users/{id}/posts/{postId}:
    get:
      responses:
        '200':
          description: OK
`;

      writeFileSync(tempFile, yamlContent);

      const result = await enhancer.addOperationIds(tempFile);

      expect(result.success).toBe(true);
      expect(result.additions).toHaveLength(1);
      expect(result.additions[0].generatedId).toBe('getApiV1UsersPosts');
    });

    test('應該忽略非 HTTP 方法', async () => {
      const enhancer = new SpecEnhancer();

      const tempFile = join(tmpdir(), `spec-test-${Date.now()}.yaml`);
      tempFiles.push(tempFile);

      const yamlContent = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      responses:
        '200':
          description: OK
    parameters:
      - name: test
        in: query
        schema:
          type: string
`;

      writeFileSync(tempFile, yamlContent);

      const result = await enhancer.addOperationIds(tempFile);

      expect(result.success).toBe(true);
      expect(result.additions).toHaveLength(1); // 只有 GET
      expect(result.totalEndpoints).toBe(1); // 不計算 parameters
    });

    test('dryRun 模式不應修改檔案', async () => {
      const enhancer = new SpecEnhancer({ dryRun: true });

      const tempFile = join(tmpdir(), `spec-test-${Date.now()}.yaml`);
      tempFiles.push(tempFile);

      const yamlContent = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    post:
      responses:
        '201':
          description: Created
`;

      writeFileSync(tempFile, yamlContent);
      const originalContent = readFileSync(tempFile, 'utf-8');

      const result = await enhancer.addOperationIds(tempFile);

      expect(result.success).toBe(true);
      expect(result.additions).toHaveLength(1);
      expect(result.backupPath).toBeUndefined();

      // 驗證檔案內容未修改
      const currentContent = readFileSync(tempFile, 'utf-8');
      expect(currentContent).toBe(originalContent);
      expect(currentContent).not.toContain('operationId');
    });

    test('應該建立備份檔案', async () => {
      const enhancer = new SpecEnhancer({ createBackup: true });

      const tempFile = join(tmpdir(), `spec-test-${Date.now()}.yaml`);
      tempFiles.push(tempFile);

      const yamlContent = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    post:
      responses:
        '201':
          description: Created
`;

      writeFileSync(tempFile, yamlContent);

      const result = await enhancer.addOperationIds(tempFile);

      expect(result.success).toBe(true);
      expect(result.backupPath).toBe(tempFile + '.bak');
      expect(existsSync(tempFile + '.bak')).toBe(true);

      // 驗證備份內容與原檔案一致
      const backupContent = readFileSync(tempFile + '.bak', 'utf-8');
      expect(backupContent).toBe(yamlContent);
    });

    test('可自訂備份後綴', async () => {
      const enhancer = new SpecEnhancer({ backupSuffix: '.backup' });

      const tempFile = join(tmpdir(), `spec-test-${Date.now()}.yaml`);
      tempFiles.push(tempFile);

      const yamlContent = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    post:
      responses:
        '201':
          description: Created
`;

      writeFileSync(tempFile, yamlContent);

      const result = await enhancer.addOperationIds(tempFile);

      expect(result.success).toBe(true);
      expect(result.backupPath).toBe(tempFile + '.backup');
      expect(existsSync(tempFile + '.backup')).toBe(true);
    });

    test('createBackup: false 不應建立備份', async () => {
      const enhancer = new SpecEnhancer({ createBackup: false });

      const tempFile = join(tmpdir(), `spec-test-${Date.now()}.yaml`);
      tempFiles.push(tempFile);

      const yamlContent = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    post:
      responses:
        '201':
          description: Created
`;

      writeFileSync(tempFile, yamlContent);

      const result = await enhancer.addOperationIds(tempFile);

      expect(result.success).toBe(true);
      expect(result.backupPath).toBeUndefined();
      expect(existsSync(tempFile + '.bak')).toBe(false);
    });

    test('檔案不存在應拋出錯誤', async () => {
      const enhancer = new SpecEnhancer();

      await expect(
        enhancer.addOperationIds('/nonexistent/path/to/spec.yaml')
      ).rejects.toThrow();
    });

    test('唯讀檔案應返回錯誤', async () => {
      const enhancer = new SpecEnhancer();

      const tempFile = join(tmpdir(), `spec-readonly-${Date.now()}.yaml`);
      tempFiles.push(tempFile);

      const yamlContent = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    post:
      responses:
        '201':
          description: Created
`;

      writeFileSync(tempFile, yamlContent);

      // 設定為唯讀（Windows 和 Unix 相容）
      chmodSync(tempFile, 0o444);

      const result = await enhancer.addOperationIds(tempFile);

      expect(result.success).toBe(false);
      expect(result.error).toContain('無寫入權限');
    });

    test('空規格檔案應正常處理', async () => {
      const enhancer = new SpecEnhancer();

      const tempFile = join(tmpdir(), `spec-empty-${Date.now()}.yaml`);
      tempFiles.push(tempFile);

      const yamlContent = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths: {}
`;

      writeFileSync(tempFile, yamlContent);

      const result = await enhancer.addOperationIds(tempFile);

      expect(result.success).toBe(true);
      expect(result.additions).toHaveLength(0);
      expect(result.totalEndpoints).toBe(0);
    });

    test('沒有 paths 的規格應正常處理', async () => {
      const enhancer = new SpecEnhancer();

      const tempFile = join(tmpdir(), `spec-no-paths-${Date.now()}.yaml`);
      tempFiles.push(tempFile);

      const yamlContent = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
`;

      writeFileSync(tempFile, yamlContent);

      const result = await enhancer.addOperationIds(tempFile);

      expect(result.success).toBe(true);
      expect(result.additions).toHaveLength(0);
      expect(result.totalEndpoints).toBe(0);
    });

    test('混合端點（部分有 operationId，部分沒有）', async () => {
      const enhancer = new SpecEnhancer();

      const tempFile = join(tmpdir(), `spec-mixed-${Date.now()}.yaml`);
      tempFiles.push(tempFile);

      const yamlContent = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    post:
      operationId: customCreateUser
      responses:
        '201':
          description: Created
    get:
      responses:
        '200':
          description: OK
  /products:
    post:
      responses:
        '201':
          description: Created
`;

      writeFileSync(tempFile, yamlContent);

      const result = await enhancer.addOperationIds(tempFile);

      expect(result.success).toBe(true);
      expect(result.additions).toHaveLength(2);
      expect(result.totalEndpoints).toBe(3);

      const modifiedContent = readFileSync(tempFile, 'utf-8');
      expect(modifiedContent).toContain('operationId: customCreateUser'); // 保留原有的
      expect(modifiedContent).toContain('operationId: getUsers'); // 新增的
      expect(modifiedContent).toContain('operationId: createProducts'); // 新增的
    });

    test('應該保留 YAML 格式和註解', async () => {
      const enhancer = new SpecEnhancer();

      const tempFile = join(tmpdir(), `spec-comments-${Date.now()}.yaml`);
      tempFiles.push(tempFile);

      const yamlContent = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    # 這是一個使用者端點
    post:
      summary: 建立使用者
      responses:
        '201':
          description: Created
`;

      writeFileSync(tempFile, yamlContent);

      const result = await enhancer.addOperationIds(tempFile);

      expect(result.success).toBe(true);

      const modifiedContent = readFileSync(tempFile, 'utf-8');
      expect(modifiedContent).toContain('# 這是一個使用者端點'); // 保留註解
      expect(modifiedContent).toContain('operationId: createUsers');
    });

    test('總端點數應正確計算', async () => {
      const enhancer = new SpecEnhancer();

      const tempFile = join(tmpdir(), `spec-count-${Date.now()}.yaml`);
      tempFiles.push(tempFile);

      const yamlContent = `openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      operationId: listUsers
      responses:
        '200':
          description: OK
    post:
      responses:
        '201':
          description: Created
  /products:
    get:
      responses:
        '200':
          description: OK
    post:
      responses:
        '201':
          description: Created
`;

      writeFileSync(tempFile, yamlContent);

      const result = await enhancer.addOperationIds(tempFile);

      expect(result.success).toBe(true);
      expect(result.totalEndpoints).toBe(4);
      expect(result.additions).toHaveLength(3); // listUsers 已存在
    });
  });
});
