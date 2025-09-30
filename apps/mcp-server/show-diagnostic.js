#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const reportPath = path.join(__dirname, 'reports', 'result.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║           診斷上下文 (Diagnostic Context)                 ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

if (!report.diagnosticContext) {
  console.log('❌ 報表中沒有診斷上下文');
  process.exit(1);
}

const dc = report.diagnosticContext;

console.log('📊 基本資訊');
console.log('─────────────────────────────────────────────────────────');
console.log(`  失敗步驟數: ${dc.failureCount} / ${report.summary.totalSteps}`);
console.log(`  成功率: ${((report.summary.successfulSteps / report.summary.totalSteps) * 100).toFixed(1)}%`);
console.log('');

console.log('🔍 快速診斷');
console.log('─────────────────────────────────────────────────────────');
console.log(`  ${dc.diagnosticHints.quickDiagnosis}`);
console.log('');

console.log('📋 錯誤分類統計');
console.log('─────────────────────────────────────────────────────────');
const errorTypeCount = {};
dc.failedSteps.forEach(step => {
  const type = step.classification.primaryType;
  errorTypeCount[type] = (errorTypeCount[type] || 0) + 1;
});
Object.entries(errorTypeCount).forEach(([type, count]) => {
  const typeNames = {
    auth: '認證錯誤',
    network: '網路錯誤',
    validation: '驗證錯誤',
    server: '伺服器錯誤',
    unknown: '未知錯誤'
  };
  console.log(`  ${typeNames[type] || type}: ${count} 次`);
});
console.log('');

console.log('🎯 錯誤模式');
console.log('─────────────────────────────────────────────────────────');
dc.errorPatterns.forEach((pattern, i) => {
  console.log(`  ${i + 1}. ${pattern.description}`);
  console.log(`     可能性: ${pattern.likelihood}`);
  console.log(`     影響步驟: ${pattern.affectedSteps.length} 個`);
});
console.log('');

console.log('💡 可能原因');
console.log('─────────────────────────────────────────────────────────');
dc.diagnosticHints.likelyCauses.forEach((cause, i) => {
  console.log(`  ${i + 1}. ${cause}`);
});
console.log('');

console.log('🔧 建議動作');
console.log('─────────────────────────────────────────────────────────');
dc.diagnosticHints.suggestedActions.forEach((action, i) => {
  console.log(`  ${i + 1}. ${action}`);
});
console.log('');

console.log('❓ 建議問題（供進一步調查）');
console.log('─────────────────────────────────────────────────────────');
dc.diagnosticHints.suggestedQuestions.forEach((question, i) => {
  console.log(`  ${i + 1}. ${question}`);
});
console.log('');

console.log('📝 失敗步驟詳情（前 5 個）');
console.log('─────────────────────────────────────────────────────────');
dc.failedSteps.slice(0, 5).forEach((step, i) => {
  console.log(`  ${i + 1}. ${step.stepName} (步驟 #${step.stepIndex})`);
  console.log(`     狀態碼: ${step.statusCode}`);
  console.log(`     錯誤類型: ${step.classification.primaryType} (信心度: ${step.classification.confidence}%)`);
  console.log(`     回應時間: ${step.responseTime}ms`);
  if (step.errorMessage) {
    console.log(`     錯誤訊息: ${step.errorMessage}`);
  }
  console.log('');
});

if (dc.failedSteps.length > 5) {
  console.log(`  ... 還有 ${dc.failedSteps.length - 5} 個失敗步驟\n`);
}

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  完整診斷上下文已保存在報表的 diagnosticContext 欄位中    ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');
