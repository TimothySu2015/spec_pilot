# SpecPilot 當前開發計畫

**狀態**: 🚧 Phase 12 (FlowBuilder customRules 完整支援) 進行中
**建立日期**: 2025-10-20
**最後更新**: 2025-10-20

> 📋 **查看歷史進度**: [專案進度總覽](./SUMMARY.md) | [Phase 11 總結](../archive/plans/phase-11-unified-validation-format-2025-10-20.md)

---

## 🚧 進行中：Phase 12 - FlowBuilder customRules 完整支援

### 📌 目標

完善 FlowBuilder 對 customRules 的支援，確保測試覆蓋完整，並移除對舊格式的依賴。

### 優先度

**P1** (短期) - 功能完善與測試覆蓋

### 📖 背景

在 Phase 11 完成後，FlowBuilder 已經支援 `customRules` 格式，但存在以下問題：

**當前狀況**:
1. **測試覆蓋不足**
   - 僅有 4 個基本測試
   - 缺少 `customRules` 的專門測試
   - 缺少舊格式 `validations` 向後相容測試

2. **程式碼問題**
   - flow-builder.ts:81-88 仍產生舊格式 `step.validation`
   - 應該直接產生 `expect.body.customRules` 格式
   - 或完全移除對 `validations` 參數的支援

3. **API 設計**
   - `FlowStepConfig.validations` 已標記 @deprecated
   - 但 FlowBuilder 仍接受並處理此參數
   - 使用者可能誤用舊 API

**根本問題**:
- 測試覆蓋不足，無法確保 customRules 功能正確運作
- FlowBuilder 內部仍產生舊格式，與 Phase 11 目標不一致
- 缺少範例程式碼展示 customRules 正確用法

### 💡 解決方案

**核心策略**: 完善測試、簡化實作、提供範例

#### 方案 A：保留向後相容（推薦）

**優點**:
- 不破壞現有使用者程式碼
- 平滑遷移路徑

**實作**:
```typescript
// flow-builder.ts
if (stepConfig.customRules && stepConfig.customRules.length > 0) {
  // 使用新格式
  if (!step.expect.body) step.expect.body = {};
  step.expect.body.customRules = stepConfig.customRules;
} else if (stepConfig.validations && stepConfig.validations.length > 0) {
  // 自動轉換為新格式
  if (!step.expect.body) step.expect.body = {};
  step.expect.body.customRules = stepConfig.validations.map(v => ({
    field: v.field,
    rule: v.rule as any,
    value: v.value
  }));
}
```

#### 方案 B：完全移除舊格式支援

**優點**:
- 程式碼更簡潔
- 強制使用新格式

**缺點**:
- 破壞性變更
- 需要主版本號升級

**不推薦理由**: Phase 11 強調向後相容

---

## 📋 任務清單

### Phase 1: 完善測試覆蓋 ✅

**目標**: 確保 FlowBuilder 的 customRules 功能有完整測試

#### Task 1.1: 新增 customRules 測試
- [ ] 測試使用 `customRules` 參數建立步驟
- [ ] 驗證產生的格式為 `expect.body.customRules`
- [ ] 測試所有 8 種驗證規則
- [ ] 測試多個規則組合

**預期測試**:
```typescript
test('應該支援 customRules 驗證規則', () => {
  const flow = builder.addStep({
    name: '建立使用者',
    method: 'POST',
    path: '/users',
    expectedStatusCode: 201,
    customRules: [
      { field: 'id', rule: 'notNull' },
      { field: 'email', rule: 'regex', value: '^[^@]+@[^@]+$' }
    ]
  }).build();

  expect(flow.steps[0].expect.body).toBeDefined();
  expect(flow.steps[0].expect.body.customRules).toHaveLength(2);
  expect(flow.steps[0].expect.body.customRules[0]).toEqual({
    field: 'id',
    rule: 'notNull'
  });
});
```

#### Task 1.2: 新增向後相容測試
- [ ] 測試使用 `validations` 參數（舊格式）
- [ ] 驗證自動轉換為 `expect.body.customRules`
- [ ] 測試同時提供兩種參數時的優先順序

**預期測試**:
```typescript
test('應該支援舊格式 validations 並自動轉換', () => {
  const flow = builder.addStep({
    name: '查詢使用者',
    method: 'GET',
    path: '/users/1',
    expectedStatusCode: 200,
    validations: [
      { field: 'name', rule: 'notNull' }
    ]
  }).build();

  // 應該轉換為新格式
  expect(flow.steps[0].expect.body).toBeDefined();
  expect(flow.steps[0].expect.body.customRules).toHaveLength(1);
  expect(flow.steps[0].validation).toBeUndefined(); // 不應產生舊格式
});

test('customRules 應優先於 validations', () => {
  const flow = builder.addStep({
    name: '測試優先順序',
    method: 'GET',
    path: '/test',
    customRules: [{ field: 'a', rule: 'notNull' }],
    validations: [{ field: 'b', rule: 'notNull' }]
  }).build();

  expect(flow.steps[0].expect.body.customRules).toHaveLength(1);
  expect(flow.steps[0].expect.body.customRules[0].field).toBe('a');
});
```

#### Task 1.3: 新增所有 8 個驗證規則的測試
- [ ] `notNull` 測試
- [ ] `regex` 測試
- [ ] `contains` 測試
- [ ] `equals` 測試
- [ ] `notContains` 測試
- [ ] `greaterThan` 測試
- [ ] `lessThan` 測試
- [ ] `length` 測試

**檔案**: `packages/flow-generator/__tests__/flow-builder.test.ts`

---

### Phase 2: 修正 FlowBuilder 實作 ✅

**目標**: 確保 FlowBuilder 產生正確的新格式

#### Task 2.1: 修正舊格式轉換邏輯
- [ ] 修改 flow-builder.ts:81-88
- [ ] 將 `validations` 自動轉換為 `expect.body.customRules`
- [ ] 移除產生 `step.validation` 的程式碼

**修改位置**: `packages/flow-generator/src/flow-builder.ts:81-88`

**修改前**:
```typescript
} else if (stepConfig.validations && stepConfig.validations.length > 0) {
  step.validation = stepConfig.validations.map((v) => ({
    field: v.field,
    rule: v.rule,
    value: v.value,
  }));
}
```

**修改後**:
```typescript
} else if (stepConfig.validations && stepConfig.validations.length > 0) {
  // 向後相容：自動轉換為新格式
  if (!step.expect.body) {
    step.expect.body = {};
  }
  if (typeof step.expect.body === 'object' && !Array.isArray(step.expect.body)) {
    step.expect.body.customRules = stepConfig.validations.map((v) => ({
      field: v.field,
      rule: v.rule as any,
      value: v.value,
    }));
  }
}
```

#### Task 2.2: 加強型別安全
- [ ] 確保 `step.expect.body` 型別正確
- [ ] 加入必要的型別斷言或檢查
- [ ] 更新 JSDoc 註解

**檔案**: `packages/flow-generator/src/flow-builder.ts`

---

### Phase 3: 文件與範例 ✅

**目標**: 提供清楚的使用範例

#### Task 3.1: 更新 flow-generator CLAUDE.md
- [ ] 新增 customRules 使用範例
- [ ] 說明向後相容策略
- [ ] 標註舊格式已不推薦

**範例程式碼**:
```typescript
// ✅ 推薦：使用 customRules
const flow = builder.addStep({
  name: '建立使用者',
  method: 'POST',
  path: '/users',
  customRules: [
    { field: 'id', rule: 'notNull' },
    { field: 'email', rule: 'regex', value: '^[^@]+@[^@]+$' },
    { field: 'age', rule: 'greaterThan', value: 0 }
  ]
}).build();

// ⚠️ 舊格式（仍支援但不推薦）
const flow = builder.addStep({
  name: '查詢使用者',
  method: 'GET',
  path: '/users/1',
  validations: [
    { field: 'name', rule: 'notNull' }
  ]
}).build();
```

#### Task 3.2: 建立範例檔案
- [ ] 建立 `packages/flow-generator/examples/custom-rules-example.ts`
- [ ] 展示所有 8 種驗證規則用法
- [ ] 展示複雜驗證場景

**檔案**: `packages/flow-generator/examples/custom-rules-example.ts` (新建)

---

### Phase 4: 執行測試 ✅

**目標**: 確保所有變更通過測試

#### Task 4.1: 執行 FlowBuilder 測試
```bash
pnpm -w run test packages/flow-generator/__tests__/flow-builder.test.ts --run
```

**預期結果**: 所有測試通過（預計 15+ tests）

#### Task 4.2: 執行完整測試套件
```bash
pnpm -w run test packages/flow-generator/__tests__/ --run
```

**預期結果**: 所有測試通過（預計 160+ tests）

---

### Phase 5: 文件更新 ✅

**目標**: 同步所有相關文件

#### Task 5.1: 更新 packages/flow-generator/CLAUDE.md
- [ ] 新增 v0.6.0 版本記錄
- [ ] 說明 customRules 測試覆蓋完整
- [ ] 說明向後相容實作細節

#### Task 5.2: 更新 ACTIVE.md
- [ ] 標記 Phase 12 完成
- [ ] 記錄測試數量變化
- [ ] 記錄程式碼變更摘要

---

## 🎯 完成標準

- [ ] FlowBuilder 有 15+ 個測試（當前只有 4 個）
- [ ] 所有 8 種驗證規則都有專門測試
- [ ] 向後相容測試涵蓋舊格式轉換
- [ ] FlowBuilder 不再產生 `step.validation` 格式
- [ ] 所有測試通過（預計 160+ tests）
- [ ] 文件完整更新（CLAUDE.md + 範例）
- [ ] 無破壞性變更

---

## 📊 預期影響

### 測試數量
- **Before**: 4 tests (flow-builder.test.ts)
- **After**: 15+ tests

### 程式碼變更
- 修改檔案: 1 個 (flow-builder.ts)
- 新增測試: 11+ 個
- 新增範例: 1 個

### 文件更新
- packages/flow-generator/CLAUDE.md
- packages/flow-generator/examples/ (新增)
- docs/plans/ACTIVE.md

---

## ⚠️ 風險評估

### 低風險
- ✅ 向後相容，不破壞現有功能
- ✅ 僅調整內部實作，API 不變

### 需注意
- ⚠️ 確保測試覆蓋所有邊界情況
- ⚠️ 驗證轉換邏輯不會遺失資料

---

## 🔗 相關文件

- [Phase 11 總結](../archive/plans/phase-11-unified-validation-format-2025-10-20.md)
- [SCHEMA-AUTHORITY.md](../../SCHEMA-AUTHORITY.md)
- [flow-generator CLAUDE.md](../../packages/flow-generator/CLAUDE.md)

---

## 開發指令

### 測試指令
```bash
# 執行 FlowBuilder 測試
pnpm -w run test packages/flow-generator/__tests__/flow-builder.test.ts --run

# 執行完整測試套件
pnpm -w run test packages/flow-generator/__tests__/ --run

# 測試覆蓋率
pnpm -w run test packages/flow-generator/__tests__/ --coverage
```

### 開發指令
```bash
# 開發模式
cd packages/flow-generator
pnpm run dev

# 編譯
pnpm run build
```

---

**最後更新**: 2025-10-20
**維護者**: 專案團隊
**狀態**: 🚧 Phase 12 進行中
