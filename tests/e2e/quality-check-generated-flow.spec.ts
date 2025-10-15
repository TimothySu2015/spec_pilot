/**
 * 測試套件品質檢查
 */

import { describe, it, expect } from 'vitest';
import { loadSpec } from '@specpilot/spec-loader';
import { FlowQualityChecker } from '@specpilot/test-suite-generator';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { parse as yamlParse } from 'yaml';

describe('Flow 品質檢查', () => {
  it('應該檢查 generated-user-management-flow.yaml 的品質', async () => {
    // 1. 載入 OpenAPI 規格
    const specPath = path.join(process.cwd(), 'specs', 'user-management-api.yaml');
    const specDoc = await loadSpec({ filePath: specPath });

    // 2. 載入產生的 Flow
    const flowPath = path.join(process.cwd(), 'flows', 'generated-user-management-flow.yaml');
    const flowContent = await fs.readFile(flowPath, 'utf-8');
    const flow = yamlParse(flowContent);

    // 3. 執行品質檢查
    const checker = new FlowQualityChecker(specDoc.document, flow);
    const report = checker.check();

    console.log('\n=== Flow 品質檢查報告 ===');
    console.log(`總評分: ${report.score}/100`);
    console.log(`總問題數: ${report.totalIssues}`);
    console.log(`  - 錯誤: ${report.errors}`);
    console.log(`  - 警告: ${report.warnings}`);
    console.log(`  - 資訊: ${report.infos}`);

    if (report.issues.length > 0) {
      console.log('\n問題清單:');
      report.issues.forEach((issue, i) => {
        console.log(`\n${i + 1}. [${issue.severity.toUpperCase()}] ${issue.type}`);
        console.log(`   位置: ${issue.location}`);
        console.log(`   問題: ${issue.message}`);
        console.log(`   建議: ${issue.suggestion}`);
        if (issue.stepIndex !== undefined) {
          const step = flow.steps[issue.stepIndex];
          console.log(`   步驟: ${step.name}`);
        }
      });

      // 產生修正建議
      const suggestions = checker.generateFixSuggestions(report);
      if (suggestions.length > 0) {
        console.log('\n=== 自動修正建議 ===');
        suggestions.forEach((suggestion, i) => {
          console.log(`\n${i + 1}. 步驟 ${suggestion.stepIndex}: ${flow.steps[suggestion.stepIndex].name}`);
          console.log(`   欄位: ${suggestion.fieldPath}`);
          console.log(`   當前值: ${JSON.stringify(suggestion.currentValue)}`);
          console.log(`   建議值: ${JSON.stringify(suggestion.suggestedValue)}`);
          console.log(`   原因: ${suggestion.reason}`);
        });
      }
    } else {
      console.log('\n✅ 未發現任何問題!');
    }

    // 驗證報告結構
    expect(report).toHaveProperty('totalIssues');
    expect(report).toHaveProperty('score');
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });
});
