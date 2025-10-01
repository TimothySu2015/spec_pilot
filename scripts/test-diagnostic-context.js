/**
 * 測試腳本：讀取報表並產生診斷上下文
 *
 * 使用方式：
 *   node scripts/test-diagnostic-context.js
 *   node scripts/test-diagnostic-context.js reports/custom-report.json
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { DiagnosticContextBuilder } from '@specpilot/reporting';

// 取得報表路徑（從命令列參數或使用預設值）
const reportPath = process.argv[2] || 'reports/result.json';
const fullPath = resolve(process.cwd(), reportPath);

console.log('='.repeat(80));
console.log('📊 診斷上下文測試工具');
console.log('='.repeat(80));
console.log(`\n📁 讀取報表: ${fullPath}\n`);

try {
  // 讀取報表檔案
  const reportContent = readFileSync(fullPath, 'utf-8');
  const report = JSON.parse(reportContent);

  console.log('✅ 報表載入成功');
  console.log(`   執行 ID: ${report.executionId}`);
  console.log(`   狀態: ${report.status}`);
  console.log(`   總步驟: ${report.summary.totalSteps}`);
  console.log(`   失敗步驟: ${report.summary.failedSteps}\n`);

  // 建立診斷上下文
  console.log('🔍 建立診斷上下文...\n');
  const diagnosticBuilder = new DiagnosticContextBuilder();
  const diagnosticContext = diagnosticBuilder.build(report);

  if (!diagnosticContext) {
    console.log('⚠️  無診斷上下文（可能是測試全部成功）\n');
    process.exit(0);
  }

  console.log('='.repeat(80));
  console.log('📋 診斷上下文完整結構');
  console.log('='.repeat(80));
  console.log('\n' + JSON.stringify(diagnosticContext, null, 2) + '\n');

  console.log('='.repeat(80));
  console.log('📊 診斷上下文摘要（格式化顯示）');
  console.log('='.repeat(80));

  // 1. 基本資訊
  console.log('\n【基本資訊】');
  console.log(`  是否有失敗: ${diagnosticContext.hasFailed ? '✅ 是' : '❌ 否'}`);
  console.log(`  失敗數量: ${diagnosticContext.failureCount}`);

  // 2. 失敗步驟詳情
  console.log('\n【失敗步驟詳情】');
  diagnosticContext.failedSteps.forEach((step, index) => {
    console.log(`\n  步驟 ${index + 1}: ${step.stepName}`);
    console.log(`    索引: ${step.stepIndex}`);
    console.log(`    HTTP 狀態碼: ${step.statusCode}`);
    console.log(`    錯誤分類:`);
    console.log(`      主要類型: ${step.classification.primaryType}`);
    console.log(`      信心度: ${step.classification.confidence}%`);
    console.log(`      判斷依據: ${step.classification.indicators.join(', ')}`);
    if (step.classification.secondaryType) {
      console.log(`      次要類型: ${step.classification.secondaryType}`);
    }
    if (step.errorMessage) {
      console.log(`    錯誤訊息: ${step.errorMessage}`);
    }
    if (step.responseTime) {
      console.log(`    回應時間: ${step.responseTime}ms`);
    }
  });

  // 3. 環境資訊
  console.log('\n【環境資訊】');
  console.log(`  基礎 URL: ${diagnosticContext.environment.baseUrl}`);
  console.log(`  使用備援: ${diagnosticContext.environment.fallbackUsed ? '是' : '否'}`);
  console.log(`  認證命名空間: ${diagnosticContext.environment.authNamespaces.join(', ') || '無'}`);

  // 4. 錯誤模式
  console.log('\n【偵測到的錯誤模式】');
  if (diagnosticContext.errorPatterns.length === 0) {
    console.log('  無特定錯誤模式');
  } else {
    diagnosticContext.errorPatterns.forEach((pattern, index) => {
      console.log(`\n  模式 ${index + 1}:`);
      console.log(`    類型: ${pattern.pattern}`);
      console.log(`    描述: ${pattern.description}`);
      console.log(`    可能性: ${pattern.likelihood}`);
      console.log(`    影響步驟: ${pattern.affectedSteps.join(', ')}`);
    });
  }

  // 5. 診斷提示
  console.log('\n【診斷提示】');
  console.log(`\n  📊 快速診斷:`);
  console.log(`     ${diagnosticContext.diagnosticHints.quickDiagnosis}`);

  console.log(`\n  💡 可能原因:`);
  diagnosticContext.diagnosticHints.likelyCauses.forEach((cause, index) => {
    console.log(`     ${index + 1}. ${cause}`);
  });

  console.log(`\n  🔧 建議動作:`);
  diagnosticContext.diagnosticHints.suggestedActions.forEach((action, index) => {
    console.log(`     ${index + 1}. ${action}`);
  });

  if (diagnosticContext.diagnosticHints.suggestedQuestions) {
    console.log(`\n  ❓ 建議詢問的問題:`);
    diagnosticContext.diagnosticHints.suggestedQuestions.forEach((question, index) => {
      console.log(`     ${index + 1}. ${question}`);
    });
  }

  // 6. 相關步驟
  if (diagnosticContext.relatedSteps && diagnosticContext.relatedSteps.length > 0) {
    console.log('\n【相關步驟資訊】');
    diagnosticContext.relatedSteps.forEach((related, index) => {
      console.log(`\n  相關步驟 ${index + 1}:`);
      console.log(`    步驟索引: ${related.stepIndex}`);
      console.log(`    步驟名稱: ${related.stepName}`);
      console.log(`    關聯類型: ${related.relationship}`);
      console.log(`    關聯描述: ${related.description}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ 測試完成！');
  console.log('='.repeat(80) + '\n');

} catch (error) {
  console.error('\n❌ 錯誤:', error.message);
  console.error('\n完整錯誤資訊:');
  console.error(error);
  console.log('\n' + '='.repeat(80) + '\n');
  process.exit(1);
}
