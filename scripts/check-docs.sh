#!/bin/bash

# SpecPilot 文件一致性檢查腳本

echo "📋 SpecPilot 文件一致性檢查"
echo "================================"

ERROR_COUNT=0
WARNING_COUNT=0

# 1. 檢查所有 package 都有 CLAUDE.md
echo ""
echo "1️⃣ 檢查 Package CLAUDE.md 存在性..."
echo "-----------------------------------"

for dir in packages/*/; do
  if [ -d "$dir" ]; then
    package_name=$(basename "$dir")
    if [ ! -f "${dir}CLAUDE.md" ]; then
      echo "❌ 缺少: packages/${package_name}/CLAUDE.md"
      ((ERROR_COUNT++))
    else
      echo "✅ packages/${package_name}/CLAUDE.md"
    fi
  fi
done

# 2. 檢查 CLAUDE.md 是否有必要的區塊
echo ""
echo "2️⃣ 檢查 CLAUDE.md 必要區塊..."
echo "-----------------------------------"

for file in packages/*/CLAUDE.md; do
  package_name=$(basename $(dirname "$file"))

  # 檢查是否有「實作狀態」區塊
  if ! grep -q "實作狀態" "$file"; then
    echo "⚠️  packages/${package_name}/CLAUDE.md 缺少「實作狀態」區塊"
    ((WARNING_COUNT++))
  fi

  # 檢查是否有「已實作功能」區塊
  if ! grep -q "已實作功能" "$file"; then
    echo "⚠️  packages/${package_name}/CLAUDE.md 缺少「已實作功能」區塊"
    ((WARNING_COUNT++))
  fi

  # 檢查是否有「最後更新」日期
  if ! grep -q "最後更新" "$file"; then
    echo "⚠️  packages/${package_name}/CLAUDE.md 缺少「最後更新」日期"
    ((WARNING_COUNT++))
  fi
done

# 3. 檢查 docs/plans/ 目錄
echo ""
echo "3️⃣ 檢查實作計畫狀態..."
echo "-----------------------------------"

if [ -d "docs/plans" ]; then
  active_plans=$(find docs/plans -name "*.md" -type f 2>/dev/null | wc -l)

  if [ "$active_plans" -gt 1 ]; then
    echo "⚠️  發現 $active_plans 個進行中的計畫檔案"
    echo "   建議: 應該只有一個 ACTIVE.md"
    find docs/plans -name "*.md" -type f
    ((WARNING_COUNT++))
  elif [ "$active_plans" -eq 0 ]; then
    echo "ℹ️  沒有進行中的實作計畫 (docs/plans/ 為空)"
  else
    echo "✅ 有唯一的實作計畫檔案"
    find docs/plans -name "*.md" -type f
  fi
else
  echo "ℹ️  docs/plans/ 目錄不存在"
fi

# 4. 檢查根目錄 CLAUDE.md
echo ""
echo "4️⃣ 檢查根目錄 CLAUDE.md..."
echo "-----------------------------------"

if [ -f "CLAUDE.md" ]; then
  echo "✅ CLAUDE.md 存在"

  # 檢查是否有文件使用規範
  if ! grep -q "文件使用規範" "CLAUDE.md"; then
    echo "⚠️  根目錄 CLAUDE.md 缺少「文件使用規範」區塊"
    echo "   建議: 加入給 AI 的明確指令"
    ((WARNING_COUNT++))
  fi
else
  echo "❌ 根目錄缺少 CLAUDE.md"
  ((ERROR_COUNT++))
fi

# 5. 檢查 docs/archive 是否存在
echo ""
echo "5️⃣ 檢查文件歸檔結構..."
echo "-----------------------------------"

if [ -d "docs/archive/plans" ]; then
  archived_plans=$(find docs/archive/plans -name "*.md" -type f 2>/dev/null | wc -l)
  echo "✅ docs/archive/plans/ 存在 (已歸檔 $archived_plans 個計畫)"
else
  echo "ℹ️  docs/archive/plans/ 目錄不存在"
fi

if [ -d "docs/archive/deprecated" ]; then
  echo "✅ docs/archive/deprecated/ 存在"
else
  echo "ℹ️  docs/archive/deprecated/ 目錄不存在"
fi

# 6. 總結
echo ""
echo "================================"
echo "📊 檢查總結"
echo "================================"
echo "❌ 錯誤: $ERROR_COUNT"
echo "⚠️  警告: $WARNING_COUNT"

if [ $ERROR_COUNT -eq 0 ] && [ $WARNING_COUNT -eq 0 ]; then
  echo ""
  echo "🎉 所有檢查通過！文件狀態良好。"
  exit 0
elif [ $ERROR_COUNT -eq 0 ]; then
  echo ""
  echo "✅ 沒有嚴重錯誤，但有 $WARNING_COUNT 個警告需要注意。"
  exit 0
else
  echo ""
  echo "⚠️  發現 $ERROR_COUNT 個錯誤，請修正後再提交。"
  exit 1
fi
