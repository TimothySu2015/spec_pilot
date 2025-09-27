@echo off
chcp 65001 >nul

echo 🚀 SpecPilot CLI 快速測試腳本
echo ===============================

REM 建立必要目錄
if not exist "reports" mkdir reports
if not exist "logs" mkdir logs

echo 📋 1. 檢查檔案準備...
if not exist "specs\minimal.yaml" (
    echo ❌ 測試檔案不存在，請先執行: copy packages\testing\fixtures\specs\* specs\ ^&^& copy packages\testing\fixtures\flows\* flows\
    exit /b 1
)

echo ✅ 測試檔案已準備

echo 📋 2. 執行自動化測試（推薦）...
echo 執行指令: pnpm -w run test tests/e2e/cli-success-flow.e2e.spec.ts
pnpm -w run test tests/e2e/cli-success-flow.e2e.spec.ts

if %errorlevel% equ 0 (
    echo ✅ 自動化測試通過！CLI 功能正常
) else (
    echo ❌ 自動化測試失敗，請檢查錯誤訊息
)

echo.
echo 📋 3. 手動測試說明...
echo 如需手動測試，請執行：
echo   pnpm run dev -- --spec specs/minimal.yaml --flow flows/minimal_flow.yaml --baseUrl http://httpbin.org
echo.
echo 📋 4. 檢查結果...
echo   - 報表檔案: dir reports\
echo   - 日誌檔案: dir logs\
echo.
echo 🎉 測試完成！
pause