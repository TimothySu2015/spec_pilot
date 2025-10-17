# SpecPilot 文件管理快速開始指南

> **已完成**: ✅ 根目錄 CLAUDE.md 已加入文件使用規範

---

## 🎯 當前狀態

### ✅ 已完成
- [x] 創建文件管理規範 (`docs/DOC-MANAGEMENT-GUIDE.md`)
- [x] 創建 Package CLAUDE.md 模板 (`docs/.templates/PACKAGE-CLAUDE-TEMPLATE.md`)
- [x] 創建文件整理計畫 (`docs/CLEANUP-PLAN.md`)
- [x] 創建自動檢查腳本 (`scripts/check-docs.sh`)
- [x] 更新根目錄 CLAUDE.md 加入文件使用規範

### ⚠️ 待處理 (39 個警告)
- [ ] 13 個 Package 的 CLAUDE.md 缺少「實作狀態」區塊
- [ ] 尚未建立 `docs/plans/` 和 `docs/archive/` 目錄結構

---

## 🚀 接下來可以做的事

### 選項 1: 立即改善 AI 體驗 (5 分鐘) ✅ 推薦

**已完成！** 現在 AI 會在讀取 CLAUDE.md 時看到明確的指令：
- ✅ 不要把計畫當成已實作功能
- ✅ 以程式碼為準
- ✅ 完成實作後必須更新文件
- ✅ 不要參考歷史文件

**效果**: AI 從現在開始就不會再混淆「計畫」與「實作」了！

### 選項 2: 完整整理文件 (1.5-2 小時)

**執行步驟**:
```bash
# 1. 閱讀整理計畫
cat docs/CLEANUP-PLAN.md

# 2. 建立目錄結構
mkdir -p docs/archive/plans
mkdir -p docs/archive/deprecated
mkdir -p docs/plans

# 3. 歸檔歷史計畫文件
# (按照 CLEANUP-PLAN.md Phase 1 執行)

# 4. 更新 Package CLAUDE.md
# (參考 docs/.templates/PACKAGE-CLAUDE-TEMPLATE.md)
# 優先更新: flow-generator, test-suite-generator

# 5. 再次檢查
bash scripts/check-docs.sh
```

**預期結果**:
- 警告數從 39 降到 0
- 所有文件反映真實程式碼狀態

### 選項 3: 漸進式改善 (隨時進行)

**每次實作功能時**:
1. 寫程式碼
2. 執行測試
3. 更新 `packages/*/CLAUDE.md` (立即！)
4. git commit

**每週執行一次**:
```bash
bash scripts/check-docs.sh
```

---

## 📋 常用指令

### 檢查文件狀態
```bash
bash scripts/check-docs.sh
```

### 查看文件管理規範
```bash
cat docs/DOC-MANAGEMENT-GUIDE.md
```

### 查看 Package CLAUDE.md 模板
```bash
cat docs/.templates/PACKAGE-CLAUDE-TEMPLATE.md
```

### 查看完整整理計畫
```bash
cat docs/CLEANUP-PLAN.md
```

---

## 💡 核心原則 (牢記這三點)

### 1. 文件優先順序
```
程式碼 > packages/*/CLAUDE.md > 根目錄 CLAUDE.md > 其他文件
```
**當發現衝突時**，永遠以左邊為準。

### 2. Package CLAUDE.md 必須誠實
```markdown
## ⚠️ 實作狀態
**完成度**: XX% ← 必須誠實評估

## 已實作功能 ✅
- [只列已完成且測試過的功能]

## 未實作功能 ❌
- [明確標註未實作的功能]
```

### 3. 同時只有一個實作計畫
```
docs/plans/ACTIVE.md  ← 當前唯一的實作計畫
```
完成後立即歸檔到 `docs/archive/plans/[name]-[date].md`

---

## 🎯 給 AI 的工作流程

### 開始新任務時:
```
1. 讀取 /CLAUDE.md 了解整體規範
2. 讀取 packages/[target]/CLAUDE.md 了解模組實作狀態
3. 如發現文件與程式碼不一致，以程式碼為準並提醒使用者
```

### 完成實作後:
```
1. 執行測試驗證功能可用
2. 更新 packages/[target]/CLAUDE.md:
   - 「已實作功能 ✅」加入新功能
   - 更新「完成度」百分比
   - 更新「最後更新」日期
3. 如是重大功能，提醒使用者更新根目錄 CLAUDE.md
```

---

## 🔍 常見問題

### Q: 為什麼要這麼麻煩地管理文件？
**A**: 因為 AI 會「相信」文件說的話。如果文件說某功能已實作，AI 就會假設可以使用它，導致產生錯誤的程式碼。

### Q: Package CLAUDE.md 一定要更新嗎？
**A**: 是的！這是讓 AI 知道「實際可用功能」的唯一方式。不更新文件 = AI 會猜測 = 產生不一致的程式碼。

### Q: 我可以跳過「實作狀態」區塊嗎？
**A**: 強烈不建議。沒有「實作狀態」區塊，AI 無法判斷功能是否已完成，會導致混淆。

### Q: 歷史計畫文件要刪除嗎？
**A**: 不要刪除！移到 `docs/archive/plans/` 保留歷史記錄，但告訴 AI 不要參考它們。

---

## 📊 衡量改善效果

### 檢查指標

**執行**: `bash scripts/check-docs.sh`

| 指標 | 目標 | 當前 |
|------|------|------|
| 錯誤數 | 0 | 0 ✅ |
| 警告數 | 0 | 39 ⚠️ |
| 根目錄 CLAUDE.md 有規範 | ✅ | ✅ |
| Package CLAUDE.md 完整性 | 100% | 0% |

### AI 行為改善指標

觀察 AI 是否：
- ✅ 實作前先檢查 Package CLAUDE.md
- ✅ 發現功能未實作時明確告知
- ✅ 完成後提醒更新文件
- ❌ 不再參考計畫文件來判斷實作狀態

---

## 🎉 恭喜！

你已經完成了第一步改善：

✅ **根目錄 CLAUDE.md 現在有明確的文件使用規範**

這意味著從現在開始，AI 會：
1. 明白此文件只是整體規範
2. 知道要檢查 Package CLAUDE.md 了解實作狀態
3. 以程式碼為準來判斷功能是否存在
4. 完成實作後會提醒你更新文件

---

## 📚 延伸閱讀

- 📖 完整規範: `docs/DOC-MANAGEMENT-GUIDE.md`
- 📝 模板參考: `docs/.templates/PACKAGE-CLAUDE-TEMPLATE.md`
- 🔧 整理計畫: `docs/CLEANUP-PLAN.md`

---

**下次與 AI 對話時**，它會看到新的規範並據此工作。文件混亂的問題已經開始改善了！🎯
