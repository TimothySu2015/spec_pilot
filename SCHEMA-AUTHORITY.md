# Schema 權威標準規範

## 📋 架構決策記錄 (ADR)

**日期**: 2025-10-19
**狀態**: ✅ 已採納並實施
**決策者**: 專案維護團隊

---

## 🎯 決策內容

**@specpilot/schemas 是 SpecPilot 專案中所有 YAML 格式定義的唯一權威標準。**

### 核心原則

1. **單一真相來源**
   所有 YAML 檔案格式（Flow、Config 等）必須遵循 `@specpilot/schemas` 的定義

2. **禁止其他模組自行定義格式**
   其他套件不可自行定義或修改 YAML 格式，必須使用 schemas 提供的型別

3. **修改流程**
   如需調整格式：
   - ✅ **第一步**：修改 `@specpilot/schemas` 中的 Schema 定義
   - ✅ **第二步**：同步更新相關模組以符合新 Schema
   - ❌ **禁止**：在其他模組中自行定義不同的格式

---

## 📦 當前標準格式

### Flow YAML 格式

根據 `packages/schemas/src/step-schema.ts` 定義：

```yaml
name: 測試流程名稱
description: 流程描述（選填）
version: 1.0.0

steps:
  - name: 步驟名稱
    description: 步驟描述（選填）
    request:
      method: GET
      path: /api/endpoint
    expect:            # ← 欄位名稱：expect（不是 expectations）
      statusCode: 200  # ← 狀態碼欄位：statusCode（不是 status）
      body:
        # 預期的回應內容
```

**關鍵欄位**：
- ✅ `expect` - 回應驗證設定
- ✅ `statusCode` - HTTP 狀態碼
- ❌ ~~`expectations`~~ - 已棄用
- ❌ ~~`status`~~ - 已棄用

---

## 🏗️ 架構說明

### 資料流程

```
YAML 檔案 (外部)
    ↓
@specpilot/schemas (Schema 驗證)
    ↓
@specpilot/flow-parser (解析載入)
    ↓
內部型別 (FlowDefinition)
    ↓
執行引擎處理
```

### 模組職責

| 模組 | 職責 | Schema 相關 |
|------|------|------------|
| `@specpilot/schemas` | 定義 YAML 格式與驗證規則 | ✅ **權威定義** |
| `@specpilot/flow-parser` | 解析 YAML 並驗證格式 | 使用 schemas 驗證 |
| `@specpilot/flow-generator` | 產生符合規範的 YAML | 使用 schemas 型別 |
| `@specpilot/test-suite-generator` | 自動產生測試 Flow | 使用 schemas 型別 |
| 其他模組 | 使用解析後的資料 | 不直接處理 YAML |

---

## ✅ 實施檢查清單

以下修改已於 2025-10-19 完成：

- [x] 統一 `@specpilot/flow-parser/src/types.ts` 與 Schema 定義
- [x] 移除 `loader.ts` 中的欄位名稱轉換邏輯
- [x] 修正 `flow-builder.ts` 產生的格式
- [x] 批量修正所有 YAML 檔案（11 個檔案）
- [x] 更新相關測試檔案
- [x] 驗證測試執行正確
- [x] 建立此規範文件

---

## 🚫 違規範例

### ❌ 錯誤做法

```typescript
// ❌ 在 flow-parser 中自行定義不同的欄位名稱
export interface FlowStep {
  expectations: {    // ← 與 Schema 不一致
    status: number   // ← 與 Schema 不一致
  }
}
```

```yaml
# ❌ YAML 使用非標準格式
steps:
  - name: 測試
    expectations:  # ← 錯誤！應使用 expect
      status: 200  # ← 錯誤！應使用 statusCode
```

### ✅ 正確做法

```typescript
// ✅ 直接使用 Schema 定義的型別
import { FlowStepSchema } from '@specpilot/schemas';

export interface FlowStep {
  expect: {         // ← 與 Schema 一致
    statusCode: number  // ← 與 Schema 一致
  }
}
```

```yaml
# ✅ YAML 使用標準格式
steps:
  - name: 測試
    expect:        # ← 正確！
      statusCode: 200  # ← 正確！
```

---

## 📝 維護指南

### 新增欄位時

1. 在 `@specpilot/schemas` 中新增 Schema 定義
2. 更新相關型別檔案以符合新 Schema
3. 更新文件說明新欄位用途
4. 確保向後相容性（選填欄位）

### 修改現有欄位時

1. **評估影響範圍** - 檢查有多少檔案使用該欄位
2. **更新 Schema** - 在 `@specpilot/schemas` 中修改
3. **同步更新** - 更新所有相關模組
4. **批量修正** - 修正現有 YAML 檔案
5. **測試驗證** - 確保所有測試通過
6. **更新文件** - 記錄變更原因與影響

### 審查檢查點

在 Code Review 時檢查：
- [ ] 是否修改了 YAML 格式？
- [ ] 是否先修改了 `@specpilot/schemas`？
- [ ] 其他模組是否使用了 schemas 定義的型別？
- [ ] 是否有自行定義不同的格式？
- [ ] 測試是否涵蓋新格式？

---

## 🔗 相關文件

- [Schema 模組說明](packages/schemas/CLAUDE.md)
- [Flow Parser 模組說明](packages/flow-parser/CLAUDE.md)
- [專案架構文件](CLAUDE.md)

---

## 📅 變更歷史

| 日期 | 版本 | 變更內容 |
|------|------|---------|
| 2025-10-19 | 1.0.0 | 初版發布 - 確立 @specpilot/schemas 為權威標準 |
| 2025-10-19 | 1.0.1 | 統一格式：expect + statusCode |

---

**重要提醒**：此規範為強制性架構決策，所有貢獻者必須遵守。違反此規範的 Pull Request 將不予合併。
