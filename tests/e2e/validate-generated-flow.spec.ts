/**
 * 驗證產生的 Flow 檔案
 */

import { describe, it } from 'vitest';
import { loadFlow } from '@specpilot/flow-parser';
import { FlowValidator } from '@specpilot/flow-validator';
import { loadSpec } from '@specpilot/spec-loader';
import * as path from 'node:path';

describe('驗證產生的 Flow', () => {
  it('應該驗證 generated-user-management-flow.yaml', async () => {
    // 1. 讀取原始 YAML 內容
    const flowPath = path.join(process.cwd(), 'flows', 'generated-user-management-flow.yaml');
    console.log('載入 Flow:', flowPath);

    try {
      const fs = await import('node:fs/promises');
      const yaml = await import('yaml');

      // 直接解析 YAML,不經過 flow-parser 轉換
      const yamlContent = await fs.readFile(flowPath, 'utf-8');
      const flowData = yaml.parse(yamlContent);

      console.log('Flow 載入成功');
      console.log('Flow 名稱:', flowData.name);
      console.log('步驟數量:', flowData.steps?.length || 0);

      // 2. 載入 OpenAPI 規格
      const specPath = path.join(process.cwd(), 'specs', 'user-management-api.yaml');
      const specDoc = await loadSpec({ filePath: specPath });
      console.log('規格載入成功');

      // 3. 驗證 Flow (使用原始 YAML 數據)
      const validator = new FlowValidator({
        spec: specDoc.document,
        schemaOptions: { strict: false },
        semanticOptions: {
          checkOperationIds: false, // 關閉 operationId 檢查
          checkVariableReferences: true,
          checkAuthFlow: false,
        },
      });

      const result = validator.validate(flowData as any);

      console.log('\n驗證結果:');
      console.log('有效:', result.valid);
      console.log('錯誤數量:', result.errors.length);
      console.log('警告數量:', result.warnings.length);

      if (result.errors.length > 0) {
        console.log('\n錯誤詳情:');
        result.errors.forEach((error, i) => {
          console.log(`\n錯誤 ${i + 1}:`);
          console.log('  類型:', error.type);
          console.log('  路徑:', error.path);
          console.log('  訊息:', error.message);
          if (error.details) {
            console.log('  詳情:', JSON.stringify(error.details, null, 2));
          }
        });
      }

      if (result.warnings.length > 0) {
        console.log('\n警告詳情:');
        result.warnings.forEach((warning, i) => {
          console.log(`\n警告 ${i + 1}:`);
          console.log('  類型:', warning.type);
          console.log('  訊息:', warning.message);
        });
      }
    } catch (error) {
      console.error('\n載入或驗證失敗:');
      console.error(error);
      throw error;
    }
  });
});
