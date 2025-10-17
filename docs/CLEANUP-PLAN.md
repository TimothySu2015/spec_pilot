# SpecPilot 文件整理計畫

> **目標**: 在 1-2 小時內將文件整理到可維護的狀態

---

## 🎯 整理策略

### 原則
1. ✅ **保留有價值的文件**
2. 📦 **歸檔過時的文件** (不刪除)
3. 🔄 **同步 CLAUDE.md 與程式碼**
4. 📍 **建立單一實作計畫**

---

## 📋 Phase 1: 文件分類 (15 分鐘)

### 1.1 整理 docs/ 目錄

```bash
# 建立歸檔目錄
mkdir -p docs/archive/plans
mkdir -p docs/archive/deprecated
mkdir -p docs/plans
mkdir -p docs/guides

# 移動計畫文件到歸檔
mv docs/flow-generation-implementation-plan.md docs/archive/plans/flow-generation-plan-2025-10-03.md
mv docs/ai-diagnosis-implementation-plan.md docs/archive/plans/ai-diagnosis-plan-v1.md
mv docs/ai-diagnosis-implementation-plan-updated.md docs/archive/plans/ai-diagnosis-plan-v2.md
mv docs/flow-builder/flow-builder-implementation-plan.md docs/archive/plans/flow-builder-plan.md
mv docs/schema-unification-execution-plan.md docs/archive/plans/schema-unification-plan.md

# 保留的文件
# ✅ docs/auth-guide.md → 移到 docs/guides/
# ✅ docs/installation-guide.md → 移到 docs/guides/
# ✅ docs/LOGGING-ARCHITECTURE.md → 移到 docs/architecture/
```

### 1.2 在歸檔文件開頭加上狀態標記

為每個歸檔的計畫文件加上:

```markdown
---
**狀態**: 已完成/已取消
**歸檔日期**: YYYY-MM-DD
**備註**: [簡短說明]
---
```

---

## 📋 Phase 2: 更新 Package CLAUDE.md (30-45 分鐘)

### 優先順序列表

| 順序 | Package | 原因 | 預估時間 |
|------|---------|------|---------|
| 1 | flow-generator | 問題最嚴重,差異最大 | 10 分鐘 |
| 2 | test-suite-generator | 需對應 flow-generator | 8 分鐘 |
| 3 | flow-validator | 確認實作狀態 | 5 分鐘 |
| 4 | core-flow | 核心模組,需準確 | 8 分鐘 |
| 5 | reporting | 診斷功能新增 | 5 分鐘 |
| 6 | 其他 packages | 快速檢查 | 各 2-3 分鐘 |

### 2.1 更新 flow-generator CLAUDE.md

**執行步驟**:
1. 讀取實際程式碼確認功能
2. 使用模板重寫 CLAUDE.md
3. 明確標註完成度: ~30%
4. 列出未實作功能清單

**範例開頭**:
```markdown
# @specpilot/flow-generator - 對話式 Flow 產生器 (開發中)

## ⚠️ 實作狀態

**版本**: 0.2.0
**完成度**: 30%
**最後更新**: 2025-01-17
**維護狀態**: 開發中

⚠️ **重要**: 此模組尚未完成,許多功能僅有架構或完全未實作。
實際的測試套件自動產生功能在 `@specpilot/test-suite-generator` 中。

---

## 已實作功能 ✅

- ✅ **FlowBuilder** - Flow YAML 建構器
  - 支援建立基本 Flow 結構
  - 支援新增測試步驟
  - 支援變數提取 (capture)
  - 相關檔案: `src/flow-builder.ts`
  - 測試: `__tests__/flow-builder.test.ts`

- ✅ **IntentRecognizer** - 意圖識別與端點推薦
  - 從 OpenAPI 規格提取端點資訊
  - 根據自然語言推薦相關端點
  - 計算匹配信心度
  - 相關檔案: `src/intent-recognizer.ts`

[繼續列出其他已實作功能...]

---

## 部分實作 ⚠️

- ⚠️ **NLPFlowParser** - 自然語言解析器
  - **當前狀態**: 僅有類別架構,核心 parse() 方法標記為 TODO
  - **相關檔案**: `src/nlp-parser.ts:14` (查看 TODO 註解)
  - **剩餘工作**: 實作關鍵字提取、HTTP method 識別、實體提取邏輯

---

## 未實作功能 ❌

以下功能在原設計計畫中,但**完全沒有程式碼**:

- ❌ **DependencyResolver** - 依賴解析器
  - **原因**: 優先度較低
  - **設計文件**: `docs/archive/plans/flow-generation-plan-2025-10-03.md` 第 363-377 行

- ❌ **FlowGenerator** - 統一入口類別
  - **原因**: 架構調整,功能分散到其他類別
  - **替代方案**: MCP Server 直接使用 FlowBuilder 和 IntentRecognizer

- ❌ **CRUD 自動生成** (generateCRUD 方法)
  - **原因**: 功能在 @specpilot/test-suite-generator 中實作
  - **參考**: `packages/test-suite-generator/CLAUDE.md`

[繼續列出...]
```

### 2.2 批次更新其他 Packages

**快速檢查清單** (每個 package 2-3 分鐘):

```bash
# 對每個 package 執行:
1. 讀取 src/index.ts 看實際匯出內容
2. 檢查 __tests__/ 確認測試覆蓋
3. 更新 CLAUDE.md 的:
   - 實作狀態百分比
   - 已實作功能清單
   - 最後更新日期
```

---

## 📋 Phase 3: 建立當前實作計畫 (15 分鐘)

### 3.1 創建 docs/plans/ACTIVE.md

**內容結構**:
```markdown
# SpecPilot 當前開發計畫

**狀態**: 進行中
**建立日期**: YYYY-MM-DD
**預計完成**: Week X

---

## 當前階段：完善核心功能

### 進行中的任務

1. **完成 flow-generator 的 NLPFlowParser**
   - [ ] 實作關鍵字比對邏輯
   - [ ] 實作實體提取
   - [ ] 新增單元測試
   - 負責人: [待分配]
   - 預計完成: Week X

2. **實作 DependencyResolver**
   - [ ] 分析資源依賴關係
   - [ ] 產生變數引用
   - 負責人: [待分配]
   - 預計完成: Week X

### 已完成的任務

✅ flow-validator 核心功能
✅ test-suite-generator 基礎實作
✅ MCP Server 整合

### 暫緩的任務

- 邊界測試案例自動生成 (優先度較低)
- 效能優化 (等核心功能完成)

---

## 下一個里程碑

**目標**: Flow Generator MVP 完成
**截止日期**: YYYY-MM-DD

**驗收標準**:
- [ ] NLPFlowParser 可正確識別基本意圖
- [ ] 產生的 Flow 可通過驗證並執行
- [ ] 測試覆蓋率 ≥ 75%
```

---

## 📋 Phase 4: 更新根目錄文件 (10 分鐘)

### 4.1 更新根目錄 CLAUDE.md

**需要同步的資訊**:
1. 專案結構 → 確認所有 packages 都列出
2. MCP 工具列表 → 確認與 `apps/mcp-server/src/index.ts` 一致
3. 開發指令 → 測試所有指令可執行

### 4.2 在 CLAUDE.md 開頭加上重要提示

```markdown
# CLAUDE.md

此文件為 Claude Code 在此專案中工作時提供指導方針。

## ⚠️ 重要：文件使用規範

**給 AI 的指令**:
1. 此文件描述專案整體規範,不代表所有功能都已實作
2. 查看具體模組實作狀態,請閱讀 `packages/*/CLAUDE.md`
3. 如發現文件與程式碼不一致,**以程式碼為準**
4. 完成實作後,**必須更新** `packages/*/CLAUDE.md`
5. 不要參考 `docs/archive/` 中的歷史計畫文件

**文件管理指南**: 詳見 `docs/DOC-MANAGEMENT-GUIDE.md`

---

[原有內容...]
```

---

## 📋 Phase 5: 建立自動化檢查 (15 分鐘)

### 5.1 創建文件一致性檢查腳本

```bash
# 創建 scripts/check-docs.sh
```

內容:
```bash
#!/bin/bash

echo "📋 檢查文件一致性..."

# 1. 檢查所有 package 都有 CLAUDE.md
echo "\n1️⃣ 檢查 Package CLAUDE.md..."
for dir in packages/*/; do
  package_name=$(basename "$dir")
  if [ ! -f "${dir}CLAUDE.md" ]; then
    echo "❌ 缺少: packages/${package_name}/CLAUDE.md"
  else
    echo "✅ packages/${package_name}/CLAUDE.md"
  fi
done

# 2. 檢查 CLAUDE.md 是否有「實作狀態」區塊
echo "\n2️⃣ 檢查實作狀態標記..."
for file in packages/*/CLAUDE.md; do
  if ! grep -q "## ⚠️ 實作狀態" "$file"; then
    echo "⚠️  $file 缺少實作狀態區塊"
  fi
done

# 3. 檢查是否有多個 ACTIVE 計畫
echo "\n3️⃣ 檢查實作計畫..."
active_plans=$(find docs/plans -name "*.md" -type f | wc -l)
if [ "$active_plans" -gt 1 ]; then
  echo "⚠️  發現 $active_plans 個進行中的計畫,應該只有一個 ACTIVE.md"
  find docs/plans -name "*.md" -type f
elif [ "$active_plans" -eq 0 ]; then
  echo "ℹ️  沒有進行中的實作計畫"
else
  echo "✅ 有唯一的實作計畫"
fi

echo "\n✅ 檢查完成"
```

### 5.2 加入 package.json scripts

```json
{
  "scripts": {
    "check:docs": "bash scripts/check-docs.sh"
  }
}
```

---

## 📋 Phase 6: 提交變更 (5 分鐘)

```bash
# 1. 檢查變更
git status

# 2. 分階段提交
git add docs/DOC-MANAGEMENT-GUIDE.md
git commit -m "docs: 新增文件管理指南"

git add docs/archive/
git commit -m "docs: 歸檔歷史計畫文件"

git add packages/*/CLAUDE.md
git commit -m "docs: 同步 Package CLAUDE.md 與實際程式碼狀態"

git add CLAUDE.md
git commit -m "docs: 更新根目錄 CLAUDE.md 加入文件使用規範"

git add docs/plans/ACTIVE.md
git commit -m "docs: 建立當前開發計畫"

git add scripts/check-docs.sh package.json
git commit -m "chore: 新增文件一致性檢查腳本"
```

---

## ✅ 整理完成檢查清單

完成後執行:

```bash
pnpm run check:docs
```

**預期結果**:
- ✅ 所有 Package 都有 CLAUDE.md
- ✅ 所有 CLAUDE.md 都有實作狀態區塊
- ✅ 只有一個 docs/plans/ACTIVE.md
- ✅ 歷史計畫已歸檔到 docs/archive/plans/
- ✅ 根目錄 CLAUDE.md 有明確的文件使用規範

---

## 🎉 整理後的好處

1. **AI 不會再混淆「計畫」與「現狀」**
2. **每個模組的實作狀態一目了然**
3. **有明確的文件更新流程**
4. **可自動檢查文件一致性**
5. **歷史文件保留但不影響開發**

---

## 💡 後續維護

### 每次實作新功能時:

1. 修改程式碼
2. 執行測試 → 確認功能可用
3. **立即更新** `packages/*/CLAUDE.md`
4. 提交時 commit message 加上 `docs:` 前綴

### 每週檢查:

```bash
pnpm run check:docs
```

### 功能完成時:

1. 更新 `docs/plans/ACTIVE.md` 打勾 ✅
2. 如果所有任務完成,歸檔計畫文件
3. 建立新的 ACTIVE.md (如果有新計畫)

---

**預計總耗時**: 1.5 - 2 小時
**優先度**: 🔥 高 (建議立即執行)
**影響**: 大幅改善 AI 輔助開發的準確性
