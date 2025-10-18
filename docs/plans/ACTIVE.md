# SpecPilot 當前開發計畫

**狀態**: 進行中
**建立日期**: 2025-10-19
**預計完成**: 2025-10-26 (Week 43)

---

## 當前階段：完善核心功能與測試補強

### 📋 進行中的任務

#### Phase 1: 文件整理 (2025-10-19) - 進行中

**目標**: 建立清晰的文件架構,避免 AI 混淆「計畫」與「現狀」

- [x] 1.1 建立文件目錄結構
- [x] 1.2 歸檔 6 個歷史計畫文件到 `docs/archive/plans/`
- [x] 1.3 在歸檔文件開頭加上狀態標記
- [ ] 1.4 建立 `docs/plans/ACTIVE.md` (本文件)
- [ ] 1.5 更新根目錄 `CLAUDE.md` 加入文件使用規範
- [ ] 1.6 建立文件一致性檢查腳本
- [ ] 1.7 提交文件整理變更

**預估時間**: 1.5-2 小時
**負責人**: AI + 使用者

---

#### Phase 2: 測試補強 - test-suite-generator (待開始)

**目標**: 提升測試覆蓋率從 20% → 75%+

**當前狀態**:
- ✅ 已有測試: `spec-analyzer.test.ts`, `crud-generator.test.ts`
- ❌ 缺少測試: 6 個核心模組

**待完成任務**:
- [ ] 2.1 新增 DataSynthesizer 單元測試 (預估 3-4 小時)
- [ ] 2.2 新增 ErrorCaseGenerator 單元測試 (預估 2-3 小時)
- [ ] 2.3 新增 EdgeCaseGenerator 單元測試 (預估 2-3 小時)
- [ ] 2.4 新增 DependencyResolver 單元測試 (預估 3-4 小時)
- [ ] 2.5 新增 TestSuiteGenerator 單元測試 (預估 2-3 小時)
- [ ] 2.6 新增 FlowQualityChecker 單元測試 (預估 4-5 小時)
- [ ] 2.7 驗證覆蓋率達標 (≥ 75%)

**預估時間**: 1-2 天
**優先度**: P1
**依賴**: Phase 1 完成

---

#### Phase 3: 核心功能實作 - flow-generator (待開始)

**目標**: 完成 NLPFlowParser 核心邏輯,提升完成度從 35% → 80%+

**當前狀態**:
- ✅ 已完成: FlowBuilder, IntentRecognizer, ContextManager, SuggestionEngine
- ⚠️ 部分完成: NLPFlowParser (僅架構,核心 `parse()` 方法標記為 TODO)
- ❌ 未實作: DependencyResolver

**待完成任務**:
- [ ] 3.1 實作 NLPFlowParser.parse() 關鍵字提取邏輯 (預估 3-4 小時)
- [ ] 3.2 實作 NLPFlowParser.parse() 實體提取邏輯 (預估 4-5 小時)
- [ ] 3.3 實作 NLPFlowParser.parse() 意圖分類邏輯 (預估 3-4 小時)
- [ ] 3.4 新增 NLPFlowParser 單元測試 (預估 3-4 小時)
- [ ] 3.5 新增 IntentRecognizer 單元測試 (預估 2-3 小時)
- [ ] 3.6 新增 ContextManager 單元測試 (預估 2-3 小時)
- [ ] 3.7 新增 SuggestionEngine 單元測試 (預估 2-3 小時)

**預估時間**: 2-3 天
**優先度**: P1
**依賴**: Phase 1 完成
**檔案位置**: `packages/flow-generator/src/nlp-parser.ts:14`

---

#### Phase 4: 進階整合 (待開始)

**目標**: 完成 HTTP Runner 整合與 DependencyResolver

**待完成任務**:
- [ ] 4.1 實作 DependencyResolver (flow-generator) (預估 4-6 小時)
- [ ] 4.2 整合實際 HTTP Runner 到 core-flow (預估 3-4 小時)
- [ ] 4.3 移除 core-flow 中的 TODO 標記 (預估 1 小時)

**預估時間**: 1-2 天
**優先度**: P2
**依賴**: Phase 2, 3 完成

---

### ✅ 已完成的任務

#### 2025-10-18 及之前
- ✅ **Fail-Fast 模式實作** - Flow 執行可在遇到錯誤時立即停止
- ✅ **文件同步工作** - 新增/更新了 11 個 packages 的 CLAUDE.md
- ✅ **診斷功能** - reporting 模組的診斷上下文建構器
- ✅ **核心協調引擎** - core-flow 模組基本完成 (95%)
- ✅ **測試套件產生器** - test-suite-generator 核心功能 (75%)

---

### 🔄 暫緩的任務

以下任務優先度較低,待核心功能完成後再處理:

- 支援更多 OpenAPI 3.0 特性
- 整合 faker.js 產生更真實的測試資料
- 支援效能測試案例產生
- 支援安全測試案例產生
- 視覺化測試覆蓋圖

---

## 下一個里程碑

**目標**: Flow Generator MVP 完成 + 測試覆蓋率達標
**截止日期**: 2025-10-26 (Week 43)

**驗收標準**:
- [ ] NLPFlowParser 可正確識別基本意圖
- [ ] test-suite-generator 測試覆蓋率 ≥ 75%
- [ ] flow-generator 測試覆蓋率 ≥ 75%
- [ ] 產生的 Flow 可通過驗證並執行
- [ ] 所有 Package CLAUDE.md 與實際程式碼同步

---

## 開發指南

### 執行測試
```bash
# 執行所有測試
pnpm run test

# 執行特定 package 測試
pnpm -w run test packages/test-suite-generator/__tests__/ --run

# 查看測試覆蓋率
pnpm -w run test packages/test-suite-generator/__tests__/ --coverage
```

### 文件更新流程
1. 修改程式碼
2. 執行測試確認功能可用
3. **立即更新** `packages/*/CLAUDE.md`
4. 更新本文件 (ACTIVE.md) 的進度
5. 提交時使用 `docs:` 前綴

---

## 注意事項

1. **文件優先順序**: 程式碼 > Package CLAUDE.md > 根 CLAUDE.md > 計畫文件
2. **不要參考歷史計畫**: `docs/archive/plans/` 中的文件僅供參考,不代表當前狀態
3. **測試優先**: 每個新功能都必須有對應的單元測試
4. **增量提交**: 不要累積多個功能再一次提交

---

**最後更新**: 2025-10-19
**維護者**: 專案團隊
