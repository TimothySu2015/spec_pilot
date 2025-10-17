# @specpilot/[package-name] - [一句話描述]

## ⚠️ 實作狀態

**版本**: 0.x.x
**完成度**: XX% (請誠實評估)
**最後更新**: YYYY-MM-DD
**維護狀態**: [穩定|開發中|實驗性|已棄用]

---

## 已實作功能 ✅

> 這裡只列出**已完成且經過測試**的功能

### 核心功能

- ✅ **功能 A** - 簡短描述
  - 相關檔案: `src/xxx.ts:行數`
  - 測試覆蓋: `__tests__/xxx.test.ts`

- ✅ **功能 B** - 簡短描述
  - 相關檔案: `src/yyy.ts:行數`
  - 測試覆蓋: `__tests__/yyy.test.ts`

### 支援功能

- ✅ 型別定義完整
- ✅ 錯誤處理機制
- ✅ 單元測試覆蓋率 ≥ 80%

---

## 部分實作 ⚠️

> 已有程式碼但功能不完整或未測試

- ⚠️ **功能 C** - 簡短描述
  - **當前狀態**: 核心邏輯已實作,但缺少錯誤處理
  - **剩餘工作**: [具體待辦事項]
  - **預計完成**: Week X

- ⚠️ **功能 D** - 簡短描述
  - **當前狀態**: 僅有架構,核心邏輯標記為 TODO
  - **相關檔案**: `src/zzz.ts:行數` (查看 TODO 註解)

---

## 未實作功能 ❌

> 計畫中但完全沒有程式碼

- ❌ **功能 E** - 簡短描述
  - **原因**: 優先度較低
  - **是否計畫實作**: [是|否|待評估]

- ❌ **功能 F** - 簡短描述
  - **原因**: 依賴其他模組尚未完成
  - **前置條件**: `@specpilot/xxx` 需先完成

---

## 模組概述

### 核心職責

[用 2-3 句話說明此模組的主要責任]

### 技術堆疊

**核心依賴**:
- `dependency-a` (^x.x.x) - 用途說明
- `dependency-b` (^x.x.x) - 用途說明

**開發依賴**:
- `vitest` (^1.6.0) - 測試框架
- `tsup` (^8.0.1) - 打包工具

---

## 核心元件

### 元件 A - [簡短描述]

**檔案位置**: `src/component-a.ts`

```typescript
// 實際可執行的範例 (不要寫偽代碼)
import { ComponentA } from '@specpilot/package-name';

const instance = new ComponentA(config);
const result = await instance.method();
```

**主要方法**:
- `method1(params): ReturnType` - 方法說明
- `method2(params): ReturnType` - 方法說明

**相關測試**: `__tests__/component-a.test.ts`

### 元件 B - [簡短描述]

**檔案位置**: `src/component-b.ts`

[同上格式]

---

## 使用範例

### 基本使用

```typescript
// 最簡單的使用方式 (必須可執行)
import { MainClass } from '@specpilot/package-name';

const instance = new MainClass();
const result = await instance.execute();
console.log(result);
```

### 進階使用

```typescript
// 展示主要功能的完整範例
import { MainClass, Config } from '@specpilot/package-name';

const config: Config = {
  option1: 'value1',
  option2: true
};

const instance = new MainClass(config);

try {
  const result = await instance.execute();
  // 處理結果
} catch (error) {
  // 錯誤處理
}
```

---

## 開發指令

```bash
# 編譯模組
pnpm run build

# 開發模式 (watch)
pnpm run dev

# 執行測試
pnpm run test

# 測試覆蓋率
pnpm run test:coverage
```

---

## 架構設計

### 設計原則

1. **原則 A** - 說明
2. **原則 B** - 說明

### 目錄結構

```
packages/package-name/
├── src/
│   ├── index.ts           # 主要匯出
│   ├── component-a.ts     # 核心元件 A
│   ├── component-b.ts     # 核心元件 B
│   └── types.ts           # 型別定義
├── __tests__/
│   ├── component-a.test.ts
│   └── component-b.test.ts
├── package.json
└── tsconfig.json
```

---

## 依賴關係

### 被依賴於

- `@specpilot/module-x` - 用途說明
- `@specpilot/module-y` - 用途說明

### 依賴於

- `@specpilot/shared` - 共用工具
- `@specpilot/schemas` - 型別定義

---

## 測試策略

### 單元測試

**覆蓋率目標**: ≥ 80%
**當前覆蓋率**: XX% (執行 `pnpm test:coverage` 查看)

**測試重點**:
- ✅ 核心功能的正常路徑
- ✅ 錯誤處理與邊界條件
- ✅ 與其他模組的整合

### 執行測試

```bash
# 執行此模組的測試
pnpm -w run test packages/package-name/__tests__/ --run

# 監視模式
pnpm -w run test packages/package-name/__tests__/
```

---

## 已知問題與限制

### 已知問題

- [ ] **Issue #1** - 問題描述
  - **影響**: 說明
  - **暫行方案**: 說明

### 限制

- **限制 A** - 說明為何有此限制
- **限制 B** - 說明為何有此限制

---

## 變更歷史

| 版本 | 日期 | 主要變更 |
|------|------|---------|
| 0.2.0 | YYYY-MM-DD | 新增功能 X |
| 0.1.0 | YYYY-MM-DD | 初始版本 |

---

## 參考資料

- [相關設計文件](../../docs/xxx.md)
- [API 規格](./API.md) (如果有)
- [原始需求](../../docs/plans/xxx.md)

---

**維護指南**:
- 每次修改程式碼後**立即更新**此文件
- 新增功能時,先更新「未實作」→「部分實作」→「已實作」
- 刪除功能時,記得從「已實作」清單移除
- 定期更新「最後更新」日期
