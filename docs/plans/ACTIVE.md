# SpecPilot 當前開發計畫

**狀態**: 🚧 Phase 9 (智慧檢測 operationId + 多種解決方式) 進行中
**建立日期**: 2025-10-20
**最後更新**: 2025-10-20

> 📋 **查看歷史進度**: [專案進度總覽](./SUMMARY.md) | [Phase 1-8 總結](../archive/plans/phase-1-8-summary-2025-01-19.md)

---

## 🚧 當前階段：Phase 9 - 智慧檢測 operationId + 多種解決方式

### 📌 目標

解決 OpenAPI 規格缺少 operationId 時的端點過濾問題，提供智慧檢測與多種靈活的解決方案。

### 優先度

**P0** (短期) - 核心功能增強

### 📖 背景

在使用 `generateFlow` 時發現，當 OpenAPI 規格未定義 operationId（這在規範中是可選的），系統會自動產生 operationId，但用戶無法預知產生的名稱，導致使用 `endpoints` 參數過濾時失敗。

**問題案例**:
```yaml
# user-management-api.yaml 沒有定義 operationId
/auth/login:
  post:
    summary: 使用者登入
    # ❌ 沒有 operationId
```

```javascript
// 用戶嘗試過濾端點
generateFlow({
  endpoints: ["login", "getUsers"]  // ❌ 找不到，實際是 "createAuthLogin"
})
// 結果：產生 0 個步驟（過濾失敗）
```

**根本原因**:
1. OpenAPI 規範中 operationId 是可選的
2. SpecAnalyzer 自動產生 operationId，但用戶無法預知命名規則
3. 端點過濾邏輯只支援 operationId，不支援 "METHOD /path" 格式
4. 第三方 API 規格通常無法修改

### 💡 解決方案

**智慧檢測 + 三種解決方式**

**方式 1: 自動修改 Spec 檔案**
- 適用場景：自己維護的規格
- 優點：永久解決，後續使用方便
- 實作：新增 `addOperationIds` MCP 工具

**方式 2: 支援 "METHOD /path" 格式**
- 適用場景：第三方規格、不可修改的規格
- 優點：不需修改原檔案
- 實作：擴展 `TestSuiteGenerator.getTargetEndpoints()` 過濾邏輯

**方式 3: 產生所有端點**
- 適用場景：快速測試、完整覆蓋
- 優點：不需指定端點
- 實作：已支援（不指定 endpoints 參數）

---

## ✅ 待完成任務

- [x] **9.1** 新增 SpecAnalyzer 智慧檢測方法 ✅
  - [x] 實作 `detectIssues()` 方法檢測缺少的 operationId
  - [x] 實作 `checkIfModifiable()` 檢查檔案可寫入性
  - [x] 返回建議的 operationId 清單
  - [x] 新增 9 個單元測試

- [x] **9.2** 新增 SpecEnhancer 模組（修改 YAML 檔案）✅
  - [x] 建立 `packages/spec-loader/src/spec-enhancer.ts`
  - [x] 實作 `addOperationIds()` 方法
  - [x] 使用 `yaml.parseDocument()` 保留格式
  - [x] 自動備份原檔案
  - [x] 新增 16 個單元測試，94.44% 覆蓋率

- [x] **9.3** 擴展端點過濾邏輯支援多種格式 ✅
  - [x] 修改 `TestSuiteGenerator.getTargetEndpoints()`
  - [x] 支援 operationId 格式（現有）
  - [x] 支援 "METHOD /path" 格式（新增）
  - [x] 支援 "/path" 格式（新增，匹配所有方法）
  - [x] 新增 26 個單元測試

- [x] **9.4** 新增 MCP 工具：checkOperationIds ✅
  - [x] 註冊新工具到 MCP Server
  - [x] 調用 SpecAnalyzer.detectIssues()
  - [x] 格式化輸出建議清單
  - [x] 根據可修改性提供不同建議

- [x] **9.5** 新增 MCP 工具：addOperationIds ✅
  - [x] 註冊新工具到 MCP Server
  - [x] 支援 dryRun 預覽模式
  - [x] 調用 SpecEnhancer.addOperationIds()
  - [x] 返回修改結果與備份路徑

- [x] **9.6** 修改 generateFlow 工具整合智慧檢測 ✅
  - [x] 新增 `autoCheck` 選項（預設 true）
  - [x] 檢測到問題時返回建議訊息
  - [x] 清楚說明三種解決方式
  - [x] 更新工具描述與範例

- [x] **9.7** 新增 E2E 測試場景 ✅
  - [x] 場景 A：自己規格（可修改） - 驗證 4 種解決方案
  - [x] 場景 B：第三方規格（不可修改） - 驗證 3 種解決方案
  - [x] 場景 C：快速測試（產生全部） - 驗證不觸發檢測
  - [x] 驗證三種方式都能正常運作 (12 tests all passed)

- [x] **9.8** 更新文件 ✅
  - [x] 更新 `packages/spec-loader/CLAUDE.md`（v0.2.0, 新增 SpecEnhancer）
  - [x] 更新 `packages/test-suite-generator/CLAUDE.md`（v0.6.0）
  - [x] 更新 `MCP-SETUP.md` 新增工具說明
  - [x] 更新 `ACTIVE.md` 標記完成

---

## 🎯 驗收標準

- [x] ✅ checkOperationIds 工具可正確檢測缺少的 operationId
- [x] ✅ addOperationIds 工具可自動修改 spec 檔案並備份
- [x] ✅ generateFlow 支援 "METHOD /path" 格式過濾端點
- [x] ✅ generateFlow 可智慧檢測並提供三種解決建議
- [x] ✅ 所有新增功能有完整測試（目標覆蓋率 ≥ 85%）
- [x] ✅ 測試覆蓋率維持在整體目標水準
- [x] ✅ 更新相關文件反映新功能

---

## 🏗️ 實作架構

```
apps/mcp-server/src/index.ts
  ├─ checkOperationIds (新增工具)
  ├─ addOperationIds (新增工具)
  └─ generateFlow (修改，整合智慧檢測)
        ↓
packages/test-suite-generator/src/
  ├─ spec-analyzer.ts (新增檢測方法)
  └─ test-suite-generator.ts (擴展過濾邏輯)
        ↓
packages/spec-loader/src/
  └─ spec-enhancer.ts (新增模組)
```

### 影響的模組

- `packages/spec-loader` - 新增 SpecEnhancer 模組
- `packages/test-suite-generator` - SpecAnalyzer 新增檢測、TestSuiteGenerator 擴展過濾
- `apps/mcp-server` - 新增兩個工具、修改 generateFlow

---

## 📅 時間軸

- **開始日期**: 2025-10-20
- **預計完成日期**: 2025-10-23
- **工作量估計**: 3-4 天

---

## 🔄 後續建議任務

### 短期 (P0)
- [x] **修正 TestSuiteGenerator 產生錯誤的 Flow 格式** ✅ 2025-10-20
  - **問題**: TestSuiteGenerator 產生的 Flow 使用錯誤的欄位名稱 (`expectations.status` 而非 `expect.statusCode`)
  - **影響**: 所有自動產生的 Flow 無法通過 validateFlow 驗證，這是功能性 bug
  - **根本原因**: 2025-10-19 的 SCHEMA-AUTHORITY.md 統一格式時，遺漏了 test-suite-generator 模組
  - **解決方案**: 統一使用 `expect.statusCode` 符合 @specpilot/schemas 定義
  - **修正檔案**:
    - `packages/test-suite-generator/src/crud-generator.ts`
    - `packages/test-suite-generator/src/error-case-generator.ts`
    - `packages/test-suite-generator/src/edge-case-generator.ts`
    - `packages/test-suite-generator/src/dependency-resolver.ts`
    - 對應的 4 個測試檔案
  - **測試結果**: ✅ 295 個測試全部通過 (100% pass rate)
  - **Commit**: 待提交

- [x] **改善 MCP 工具的使用者體驗 - 在工具回傳中加入 Schema 格式提示** ✅ 2025-10-20
  - **背景**: 使用者透過 MCP 使用 generateFlow 時，AI 可能會猜測錯誤的欄位名稱
  - **原因**: MCP 使用者看不到專案的 CLAUDE.md，不知道要先查看 Schema 定義
  - **解決方案**: 在 generateFlow 的回傳訊息中加入格式提示
  - **實作位置**: `apps/mcp-server/src/index.ts` (handleGenerateFlow 函數)
  - **新增內容**:
    ```
    💡 Flow 標準格式提示：
       ⚠️ 重要欄位名稱（請勿使用錯誤的命名）：
       ✅ expect (不是 expectations)
       ✅ statusCode (不是 status)
       ✅ capture 用於擷取變數
       ✅ 變數使用 ${variableName} 格式
    ```
  - **注意**: 需重啟 Claude Desktop 以載入新版 MCP Server
  - **參考**: 2025-10-20 討論記錄

- [ ] **統一驗證規則管理** ⚠️ P0 緊急
  - **問題**: 驗證規則定義與實作不一致，缺少統一管理
  - **發現**:
    - Schema 定義 3 個規則：`notNull`, `regex`, `contains`
    - Flow 檔案使用 2 個**未定義**規則：`equals`, `notContains`
    - 影響 4 個 Flow 檔案無法正常驗證
  - **解決方案**: 建立統一規則管理系統
  - **相關文件**: `docs/VALIDATION-RULES-ANALYSIS.md`
  - **影響模組**:
    - `packages/schemas/src/` - 新增 custom-rules.ts
    - `packages/validation/src/custom-validator.ts` - 實作新規則
    - `packages/test-suite-generator/src/` - 調整自動產生邏輯
    - `packages/flow-generator/src/` - 調整對話式產生邏輯
  - **待完成任務**:
    - [ ] Phase 10.1: 建立 `packages/schemas/src/custom-rules.ts` (統一規則定義)
    - [ ] Phase 10.2: 實作 `equals` 和 `notContains` 規則
    - [ ] Phase 10.3: 新增單元測試 (目標覆蓋率 ≥ 90%)
    - [ ] Phase 10.4: 擴充規則庫 (`greaterThan`, `lessThan`, `length`)
    - [ ] Phase 10.5: 調整 test-suite-generator 產生規則邏輯
    - [ ] Phase 10.6: 調整 flow-generator 產生規則邏輯
    - [ ] Phase 10.7: 更新文件與最佳實踐

- [ ] 修正 Legacy MCP Server 測試失敗 (可選，如需保留)
- [ ] 修正 CLI 整合測試退出碼問題 (可選)

### 短期 (P1) - ✅ 已全部完成
- ✅ 新增端對端整合測試（flow-generator）
- ✅ 補充 config 和 shared 模組的單元測試
- ✅ 修正 DependencyResolver 步驟名稱重複問題

### 中期 (P2) - ✅ 已全部完成
- ✅ 支援更多 OpenAPI 3.0 特性
- ✅ 整合 faker.js 產生更真實的測試資料
- ✅ 優化 NLP 解析的複雜語句支援（階段 1）

### 長期 (P3)
- [ ] 支援效能測試案例產生
- [ ] 支援安全測試案例產生
- [ ] 視覺化測試覆蓋圖

---

## 🛠️ 開發指南

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
5. 提交時使用適當的 commit 前綴（`feat:`, `fix:`, `test:`, `docs:` 等）

---

## ⚠️ 注意事項

1. **文件優先順序**: 程式碼 > Package CLAUDE.md > 根 CLAUDE.md > 計畫文件
2. **不要參考歷史計畫**: `docs/archive/plans/` 中的文件僅供參考，不代表當前狀態
3. **測試優先**: 每個新功能都必須有對應的單元測試
4. **增量提交**: 不要累積多個功能再一次提交
5. **同時只有一個 ACTIVE.md**: 完成後立即歸檔，開始新計畫

---

**最後更新**: 2025-10-20
**維護者**: 專案團隊
**狀態**: 🚧 Phase 9 進行中（所有任務已完成，等待歸檔）
