# SpecPilot 當前開發計畫

**狀態**: 🚧 Phase 11 (統一驗證格式 - FlowBuilder 與 Schema 對齊) 進行中
**建立日期**: 2025-10-20
**最後更新**: 2025-10-20

> 📋 **查看歷史進度**: [專案進度總覽](./SUMMARY.md) | [Phase 1-8 總結](../archive/plans/phase-1-8-summary-2025-01-19.md)

---

## 🚧 進行中：Phase 11 - 統一驗證格式（FlowBuilder 與 Schema 對齊）

### 📌 目標

統一所有驗證格式為 `expect.customRules`，消除 `validation` 與 `customRules` 雙軌制，確保 FlowBuilder、MCP、CLI 產生的 Flow 使用相同的標準格式。

### 優先度

**P0** (短期) - 架構統一與維護性改善

### 📖 背景

在 Phase 10 完成後，發現專案中存在兩種不同的驗證格式：

**問題現況**:
1. **雙軌制驗證系統**
   - `step.validation` (舊格式) - 使用 `path`，只支援 3 個規則
   - `expect.customRules` (新格式) - 使用 `field`，支援 8 個規則 (Phase 10)

2. **實際使用情況**
   - ✅ `user-management-complete-tests.yaml` 等使用 `customRules` (6 處)
   - ⚠️ `user-management-basic-flow.yaml` 使用 `validation` (6 處)

3. **FlowBuilder 不一致**
   - FlowBuilder 產生 `step.validation` (舊格式)
   - 實際執行只使用 `expect.customRules` (新格式)
   - 導致 FlowBuilder 產生的驗證規則不會被執行

**根本問題**:
- 違反 SCHEMA-AUTHORITY.md 規範：應以 @specpilot/schemas 為唯一權威標準
- FlowBuilder、MCP、CLI 產生的 Flow 格式不一致
- 維護兩套系統增加複雜度

### 💡 解決方案

**核心策略**: 統一為 `expect.customRules`，同時保留向後相容

#### `path` vs `field` 差異分析

**結論**: 命名不同，功能完全相同

- 兩者都使用 `getValueByPath()` 方法處理
- 支援相同的路徑語法：
  - ✅ 簡單屬性: `name`
  - ✅ 巢狀屬性: `user.profile.email`
  - ✅ 陣列索引: `users[0].name`
  - ✅ JSON Path: `$.data.items[0].id`

**統一方向**: 使用語義化的 `field`，Schema 層面支援 `path` (向後相容)

---

## 📋 實作任務清單

### Phase 1: Schema 調整 (保持向後相容)

- [ ] **1.1** step-schema.ts 標記 `validation` 為 deprecated
  - 加入 JSDoc `@deprecated` 註解
  - 保留欄位但發出棄用警告

- [ ] **1.2** custom-rules.ts 支援 `path` 欄位
  ```typescript
  const CustomRuleBaseSchema = z.object({
    field: z.string().optional(),
    path: z.string().optional(),  // 向後相容
  }).refine(
    data => Boolean(data.field || data.path),
    { message: 'field 或 path 至少需提供一個' }
  );
  ```

### Phase 2: ValidationEngine 調整

- [ ] **2.1** custom-validator.ts 統一 path/field 處理
  - 自動轉換 `path` → `field`
  - 所有規則處理器使用統一的 `field`

### Phase 3: FlowParser 調整

- [ ] **3.1** loader.ts 自動轉換 validation → customRules
  - 解析 YAML 時自動轉換舊格式
  - 發出 deprecation warning
  - 轉換邏輯：`{ rule, path, value }` → `{ rule, field: path, value }`

### Phase 4: FlowBuilder 調整

- [ ] **4.1** types.ts 更新 FlowStepConfig
  ```typescript
  export interface FlowStepConfig {
    // 其他欄位...

    /** @deprecated 請改用 customRules */
    validations?: Array<{
      field: string;
      rule: string;
      value?: unknown;
    }>;

    /** 自訂驗證規則 (推薦) */
    customRules?: Array<CustomRule>;
  }
  ```

- [ ] **4.2** flow-builder.ts 支援 customRules
  - 移除或標記舊的 `step.validation` 邏輯
  - 新增 `step.expect.body.customRules` 支援

### Phase 5: YAML 遷移

- [ ] **5.1** 轉換 user-management-basic-flow.yaml
  - 將 6 處 `validation` 改為 `expect.customRules`
  - 將 `path` 改為 `field`

### Phase 6: 測試調整

- [ ] **6.1** 新增向後相容測試
  - 測試 FlowParser 自動轉換功能
  - 測試 path/field 統一處理
  - 確保舊格式 YAML 仍可正常運作

- [ ] **6.2** 更新 FlowBuilder 測試
  - 新增 customRules 使用範例測試
  - 移除或更新舊的 validations 測試

### Phase 7: 文件更新

- [ ] **7.1** 更新各模組 CLAUDE.md
  - `packages/schemas/CLAUDE.md` - 標記 ValidationRuleSchema 為 deprecated
  - `packages/flow-generator/CLAUDE.md` - 更新 FlowStepConfig API 範例
  - `packages/flow-parser/CLAUDE.md` - 說明自動轉換機制
  - `packages/validation/CLAUDE.md` - 說明統一處理邏輯

- [ ] **7.2** 更新 SCHEMA-AUTHORITY.md
  - 說明統一驗證格式的決策
  - 更新最佳實踐範例

---

## 🎯 驗收標準

- [ ] FlowBuilder 產生的 Flow 使用 `expect.customRules` 格式
- [ ] 舊的 YAML 檔案（使用 `validation`）仍可正常執行
- [ ] FlowParser 自動轉換並發出 deprecation warning
- [ ] ValidationEngine 同時支援 `path` 和 `field`
- [ ] 所有測試通過（目標覆蓋率 ≥ 85%）
- [ ] 文件更新完整

---

## 🏗️ 影響範圍

### 需修改的檔案

| 檔案 | 修改類型 | 說明 |
|------|---------|------|
| `packages/schemas/src/step-schema.ts` | 標記 deprecated | validation 欄位加註解 |
| `packages/schemas/src/custom-rules.ts` | 擴充 | 支援 path 參數 |
| `packages/validation/src/custom-validator.ts` | 邏輯調整 | 統一 path/field 處理 |
| `packages/flow-parser/src/loader.ts` | 新增轉換 | validation → customRules |
| `packages/flow-generator/src/types.ts` | 型別更新 | 新增 customRules |
| `packages/flow-generator/src/flow-builder.ts` | 邏輯調整 | 支援 customRules |
| `flows/user-management-basic-flow.yaml` | 格式遷移 | 6 處 validation → customRules |
| 各模組測試檔案 | 測試調整 | 新增向後相容測試 |

---

## 📊 架構決策

### 為什麼統一為 `field` 而非 `path`？

1. **語義化**: `field` 更清楚表達「驗證欄位」的意圖
2. **Phase 10 已採用**: 6 個 YAML 檔案已使用 `customRules.field`
3. **擴充性**: 未來可能新增非路徑的驗證方式

### 為什麼保留 `validation` 欄位？

1. **向後相容**: 不破壞現有 YAML
2. **漸進式遷移**: 給使用者時間適應
3. **下一版本移除**: 標記為 deprecated，主版本升級時刪除

---

## ✅ 已完成階段：Phase 10 - 統一驗證規則管理

### 📌 目標

建立統一的驗證規則管理系統，實作缺失的 `equals` 和 `notContains` 規則，並擴充規則庫。

### 優先度

**P0** (短期) - 核心功能修復與增強

### ✅ 完成成果

#### 1. 建立統一規則管理中心
- ✅ 新增 `packages/schemas/src/custom-rules.ts` (142 行)
- ✅ 提供 8 個驗證規則的 Zod Schema 定義
- ✅ 新增 `AVAILABLE_RULES` 常數
- ✅ 新增 `RULE_DESCRIPTIONS` 對照表
- ✅ 作為單一權威來源 (SSOT)

#### 2. 實作 5 個新驗證規則
- ✅ **equals** - 精確值比對 (用於驗證特定 ID)
- ✅ **notContains** - 陣列不包含驗證 (支援物件屬性比對)
- ✅ **greaterThan** - 數值大於驗證
- ✅ **lessThan** - 數值小於驗證
- ✅ **length** - 字串/陣列長度驗證 (支援 min/max)

#### 3. Schema 更新
- ✅ 更新 `step-schema.ts` 新增 `ExpectBodySchema`
- ✅ 支援 `expect.body.customRules` 欄位結構
- ✅ 匯出所有新規則的 TypeScript 型別

#### 4. 測試覆蓋
- ✅ 新增 20 個單元測試
- ✅ 總計 37 個測試全部通過
- ✅ 測試覆蓋率: 85.8% (custom-validator.ts)

#### 5. 文件更新
- ✅ 更新 `packages/schemas/CLAUDE.md` (新增規則說明、使用範例、版本歷史)
- ✅ 更新 `packages/validation/CLAUDE.md` (新增 5 個規則範例)

### 📊 測試結果

```
Test Files: 5 passed (5)
Tests: 89 passed (89)
Coverage: 85.8% (custom-validator.ts)
```

### 🎯 解決的問題

✅ **統一規則管理**: 所有規則定義集中在 `custom-rules.ts`
✅ **修復 Flow 檔案**: `equals` 和 `notContains` 規則現在可正常使用
✅ **擴充規則庫**: 新增 5 個常用驗證規則
✅ **型別安全**: 完整的 TypeScript 型別定義與 Zod 驗證

### 📝 Git Commit

- **Commit**: `fd930d4`
- **訊息**: `feat: Phase 10 - 統一驗證規則管理系統`
- **變更檔案**: 7 個檔案，新增 1024 行，修改 14 行

---

## 🚧 Phase 9 歷史記錄：智慧檢測 operationId + 多種解決方式

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

### Phase 11
- **開始日期**: 2025-10-20
- **預計完成日期**: 2025-10-21
- **工作量估計**: 1-2 天

### Phase 9 (已完成)
- **開始日期**: 2025-10-20
- **完成日期**: 2025-10-23
- **實際工作量**: 3 天

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

- [x] **統一驗證規則管理** ✅ 2025-10-20 (Phase 10 完成)
  - **問題**: 驗證規則定義與實作不一致，缺少統一管理
  - **發現**:
    - Schema 定義 3 個規則：`notNull`, `regex`, `contains`
    - Flow 檔案使用 2 個**未定義**規則：`equals`, `notContains`
    - 影響 4 個 Flow 檔案無法正常驗證
  - **解決方案**: 建立統一規則管理系統
  - **相關文件**: `docs/VALIDATION-RULES-ANALYSIS.md`
  - **影響模組**:
    - `packages/schemas/src/` - ✅ 新增 custom-rules.ts
    - `packages/validation/src/custom-validator.ts` - ✅ 實作新規則
  - **完成任務**:
    - [x] Phase 10.1: 建立 `packages/schemas/src/custom-rules.ts` (統一規則定義) ✅
    - [x] Phase 10.2: 實作 `equals` 和 `notContains` 規則 ✅
    - [x] Phase 10.3: 新增單元測試 (覆蓋率 85.8% ✅)
    - [x] Phase 10.4: 擴充規則庫 (`greaterThan`, `lessThan`, `length`) ✅
    - [x] Phase 10.5: 更新文件與最佳實踐 ✅
  - **測試結果**: ✅ 89 個測試全部通過
  - **Commit**: `fd930d4`

- [ ] **統一驗證格式** 🚧 2025-10-20 (Phase 11 進行中)
  - **問題**: 存在 `validation` 與 `customRules` 雙軌制
  - **影響**: FlowBuilder 產生的驗證規則不會被執行
  - **解決方案**: 統一為 `expect.customRules` 格式，保留向後相容
  - **預計完成**: 2025-10-21

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
**狀態**: 🚧 Phase 11 進行中（統一驗證格式）
