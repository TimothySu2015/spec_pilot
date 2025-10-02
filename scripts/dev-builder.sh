#!/bin/bash

# SpecPilot Flow Builder 開發伺服器啟動腳本

echo "🚀 啟動 SpecPilot Flow Builder..."
echo ""

# 檢查並建置 schemas 套件
if [ ! -d "packages/schemas/dist" ]; then
  echo "📦 首次建置 @specpilot/schemas 套件..."
  cd packages/schemas
  pnpm run build
  cd ../..
  echo "✅ schemas 套件建置完成"
  echo ""
fi

# 啟動 Flow Builder
echo "🎨 啟動 Flow Builder UI..."
cd apps/flow-builder
pnpm run dev
