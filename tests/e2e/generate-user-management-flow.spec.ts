/**
 * 從 user-management-api.yaml 產生測試流程範例
 */

import { describe, it } from 'vitest';
import { loadSpec } from '@specpilot/spec-loader';
import { SpecAnalyzer, TestSuiteGenerator } from '@specpilot/test-suite-generator';
import { stringify } from 'yaml';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

describe('產生 User Management Flow', () => {
  it('應該從 user-management-api.yaml 產生完整測試流程', async () => {
    // 1. 載入 OpenAPI 規格
    const specPath = path.join(process.cwd(), 'specs', 'user-management-api.yaml');
    console.log('載入規格:', specPath);

    const specDoc = await loadSpec({ filePath: specPath });
    console.log('規格載入成功:', specDoc.document.info?.title);

    // 2. 分析規格
    const analyzer = new SpecAnalyzer({ spec: specDoc.document });
    const endpoints = analyzer.extractEndpoints();
    console.log(`\n找到 ${endpoints.length} 個端點:`);
    endpoints.forEach(ep => {
      console.log(`  - ${ep.method.toUpperCase()} ${ep.path} (${ep.operationId || ep.summary})`);
    });

    // 3. 檢查認證流程
    const authFlow = analyzer.getAuthenticationFlow();
    if (authFlow) {
      console.log('\n認證流程:');
      console.log(`  - 端點: POST ${authFlow.path}`);
      console.log(`  - 憑證欄位: ${authFlow.credentialFields.join(', ')}`);
      console.log(`  - Token 欄位: ${authFlow.tokenField}`);
    }

    // 4. 產生完整測試套件（包含成功案例、錯誤案例、流程串接）
    console.log('\n產生測試套件...');
    const generator = new TestSuiteGenerator(analyzer);

    const testSuite = generator.generate({
      includeSuccessCases: true,
      includeErrorCases: true,
      includeEdgeCases: false,
      generateFlows: true, // 啟用流程串接
    });

    console.log(`\n產生的測試套件:`);
    console.log(`  - 名稱: ${testSuite.name}`);
    console.log(`  - 總測試數: ${testSuite.steps.length}`);
    if (testSuite.metadata?.summary) {
      console.log(`  - 成功案例: ${testSuite.metadata.summary.successTests}`);
      console.log(`  - 錯誤案例: ${testSuite.metadata.summary.errorTests}`);
      console.log(`  - 邊界案例: ${testSuite.metadata.summary.edgeTests}`);
    }

    // 5. 轉換為 YAML
    const yamlContent = stringify(testSuite);

    // 6. 儲存到檔案
    const outputPath = path.join(process.cwd(), 'flows', 'generated-user-management-flow.yaml');
    await fs.writeFile(outputPath, yamlContent, 'utf-8');

    console.log(`\n✅ 測試流程已產生並儲存至: ${outputPath}`);
    console.log(`\n所有測試步驟:`);
    testSuite.steps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step.name}`);
    });
  });
});
