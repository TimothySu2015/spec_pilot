#!/bin/bash

echo "🚀 SpecPilot CLI 快速測試腳本"
echo "==============================="

# 建立必要目錄
mkdir -p reports logs

echo "📋 1. 檢查檔案準備..."
if [ ! -f "specs/minimal.yaml" ]; then
    echo "❌ 測試檔案不存在，請先執行: cp packages/testing/fixtures/specs/* specs/ && cp packages/testing/fixtures/flows/* flows/"
    exit 1
fi

echo "✅ 測試檔案已準備"

echo "📋 2. 執行自動化測試（推薦）..."
echo "執行指令: pnpm -w run test tests/e2e/cli-success-flow.e2e.spec.ts"
pnpm -w run test tests/e2e/cli-success-flow.e2e.spec.ts

if [ $? -eq 0 ]; then
    echo "✅ 自動化測試通過！CLI 功能正常"
else
    echo "❌ 自動化測試失敗，請檢查錯誤訊息"
fi

echo ""
echo "📋 3. 手動測試說明..."
echo "如需手動測試，請執行："
echo "  pnpm run dev -- --spec specs/minimal.yaml --flow flows/minimal_flow.yaml --baseUrl http://httpbin.org"
echo ""
echo "📋 4. 檢查結果..."
echo "  - 報表檔案: ls reports/"
echo "  - 日誌檔案: ls logs/"
echo ""
echo "🎉 測試完成！"