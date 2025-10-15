# SpecPilot 新增功能總覽

## 版本資訊
- **版本**: v0.2.0
- **更新日期**: 2025-01-16
- **狀態**: 開發中

---

## 概述

本次更新為 SpecPilot 新增了三大核心模組,大幅提升測試流程產生與管理的自動化能力。這些模組專為 AI 驅動開發流程設計,透過 MCP (Model Context Protocol) 介面與 AI Agent 深度整合。

---

## 新增核心模組

### 1. Flow Generator（對話式流程產生器）
**模組路徑**: `packages/flow-generator/`

透過自然語言描述自動產生 API 測試流程，支援多輪對話逐步完善測試細節。

**核心能力**:
- 自然語言意圖識別
- 智能端點推薦
- 對話上下文管理
- 參數建議與補全
- 動態 Flow 建構

**適用場景**:
- 快速建立單一端點測試
- 探索性測試開發
- 與 AI Agent 對話式協作

**詳細文件**: [Flow Generator](./flow-generator.md)

---

### 2. Test Suite Generator（測試套件自動產生器）
**模組路徑**: `packages/test-suite-generator/`

根據 OpenAPI 規格自動產生完整測試套件，涵蓋成功案例、錯誤處理、邊界測試及資源依賴串接。

**核心能力**:
- OpenAPI 規格智能分析
- CRUD 操作測試產生
- 錯誤案例自動推導
- 邊界值測試產生
- 資源依賴關係解析
- 測試資料合成
- Flow 品質檢查

**適用場景**:
- 批次產生完整測試套件
- 回歸測試開發
- API 契約測試
- CI/CD 整合測試

**詳細文件**: [Test Suite Generator](./test-suite-generator.md)

---

### 3. Flow Validator（流程驗證器）
**模組路徑**: `packages/flow-validator/`

驗證產生的測試 Flow 是否符合規範與語意正確性。

**核心能力**:
- JSON Schema 格式驗證
- 語意正確性檢查
- OperationId 存在性驗證
- 變數引用檢查
- 認證流程驗證

**適用場景**:
- Flow 產生後自動驗證
- 手動編輯 Flow 的正確性檢查
- CI/CD Pipeline 驗證階段

**詳細文件**: [Flow Validator](./flow-validator.md)

---

## MCP Server 新增功能

SpecPilot MCP Server 新增 6 個工具方法，完整支援測試 Flow 的產生、驗證、品質檢查與儲存。

### 新增工具列表

| 工具名稱 | 功能描述 | 狀態 |
|---------|---------|------|
| `generateFlow` | 根據 OpenAPI 規格自動產生測試流程 | ✅ 已實作 |
| `validateFlow` | 驗證 Flow 定義的格式與語意正確性 | ✅ 已實作 |
| `checkFlowQuality` | 檢查 Flow 品質並提供改進建議 | ✅ 已實作 |
| `saveFlow` | 將 Flow YAML 儲存至專案目錄 | ✅ 已實作 |

**詳細文件**: [MCP Server 增強功能](./mcp-server-enhancements.md)

---

## 整體架構

```
┌─────────────────────────────────────────────────────────┐
│  AI Agent (Claude)                                       │
│  透過 MCP 協議呼叫 SpecPilot Server                       │
└──────────────────┬──────────────────────────────────────┘
                   │ MCP Protocol
                   ↓
┌─────────────────────────────────────────────────────────┐
│  SpecPilot MCP Server                                    │
│  ┌────────────────────────────────────────────────────┐ │
│  │  新增 MCP 工具                                      │ │
│  │  • generateFlow                                    │ │
│  │  • validateFlow                                    │ │
│  │  • checkFlowQuality                                │ │
│  │  • saveFlow                                        │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    ↓              ↓              ↓
┌─────────┐  ┌──────────┐  ┌─────────────┐
│ Flow    │  │ Test     │  │ Flow        │
│ Generator│  │ Suite    │  │ Validator   │
│         │  │ Generator│  │             │
└─────────┘  └──────────┘  └─────────────┘
```

---

## 使用流程範例

### 場景 1: 快速產生測試套件

```bash
# 1. 列出可用的規格檔案
listSpecs

# 2. 自動產生完整測試套件
generateFlow {
  specPath: "specs/user-api.yaml",
  options: {
    includeSuccessCases: true,
    includeErrorCases: true,
    includeEdgeCases: false
  }
}

# 3. 驗證產生的 Flow
validateFlow {
  flowContent: "...",
  specPath: "specs/user-api.yaml"
}

# 4. 檢查 Flow 品質
checkFlowQuality {
  flowContent: "...",
  specPath: "specs/user-api.yaml"
}

# 5. 儲存到專案
saveFlow {
  flowContent: "...",
  fileName: "user-crud-tests"
}

# 6. 執行測試
runFlow {
  spec: "specs/user-api.yaml",
  flow: "flows/user-crud-tests.yaml",
  baseUrl: "http://localhost:3000"
}
```

### 場景 2: AI 對話式產生（規劃中）

```bash
# 使用對話方式逐步建立測試
generateFlowConversational {
  description: "我想測試使用者註冊功能",
  spec: "specs/user-api.yaml"
}

# AI 回應：
# 找到端點: POST /api/users
# 需要參數: name, email, password
# 是否需要測試錯誤案例？(y/n)
```

---

## 技術特點

### 1. 模組化設計
- 每個核心模組獨立打包 (`@specpilot/*`)
- 清晰的職責劃分
- 易於單元測試與維護

### 2. AI 優先設計
- 所有功能透過 MCP 介面暴露
- 結構化的錯誤訊息與建議
- 支援多輪對話與上下文管理

### 3. 型別安全
- 完整的 TypeScript 型別定義
- 嚴格模式啟用
- 匯出的型別介面供外部使用

### 4. 可擴充性
- 支援自訂驗證規則
- 可擴充的產生器策略
- Plugin 架構（規劃中）

---

## 檔案結構

```
packages/
├── flow-generator/              # 對話式流程產生器
│   ├── src/
│   │   ├── nlp-parser.ts       # 自然語言解析
│   │   ├── intent-recognizer.ts # 意圖識別
│   │   ├── context-manager.ts  # 上下文管理
│   │   ├── flow-builder.ts     # Flow 建構器
│   │   └── suggestion-engine.ts # 建議引擎
│   └── __tests__/
│
├── test-suite-generator/        # 測試套件產生器
│   ├── src/
│   │   ├── spec-analyzer.ts    # 規格分析
│   │   ├── crud-generator.ts   # CRUD 測試產生
│   │   ├── error-case-generator.ts # 錯誤案例產生
│   │   ├── edge-case-generator.ts # 邊界測試產生
│   │   ├── dependency-resolver.ts # 依賴解析
│   │   ├── data-synthesizer.ts # 資料合成
│   │   └── flow-quality-checker.ts # 品質檢查
│   └── __tests__/
│
└── flow-validator/              # 流程驗證器
    ├── src/
    │   ├── schema-validator.ts # Schema 驗證
    │   ├── semantic-validator.ts # 語意驗證
    │   └── flow-validator.ts   # 整合驗證器
    └── __tests__/

apps/
└── mcp-server/
    ├── src/
    │   ├── handlers/
    │   │   ├── generate-flow.ts        # 新增
    │   │   └── generate-test-suite.ts  # 新增
    │   └── index.ts                    # 更新
    └── __tests__/
```

---

## 開發狀態

### 已完成 ✅
- [x] Flow Generator 核心模組
- [x] Test Suite Generator 核心模組
- [x] Flow Validator 核心模組
- [x] MCP Server 工具整合
- [x] 基礎單元測試
- [x] 端對端測試

### 進行中 🚧
- [ ] 對話式 Flow 產生 (NLP 整合)
- [ ] Flow 品質檢查增強
- [ ] 更多邊界測試案例
- [ ] 效能優化

### 規劃中 📋
- [ ] Flow Builder UI 整合
- [ ] 視覺化 Flow 編輯器
- [ ] 測試資料管理系統
- [ ] Plugin 擴充機制

---

## 效能指標

### 產生速度
- 單一端點測試產生: < 100ms
- 完整測試套件產生（10 端點）: < 500ms
- Flow 驗證: < 50ms

### 測試覆蓋率
- Flow Generator: 85%
- Test Suite Generator: 82%
- Flow Validator: 88%
- MCP Handler: 78%

---

## 相關文件

- [Flow Generator 詳細文件](./flow-generator.md)
- [Test Suite Generator 詳細文件](./test-suite-generator.md)
- [Flow Validator 詳細文件](./flow-validator.md)
- [MCP Server 增強功能](./mcp-server-enhancements.md)
- [使用範例](../examples/)

---

## 貢獻指南

如需對這些新功能進行貢獻或提出建議,請參考:
- [開發指南](../guides/development-guide.md)
- [架構文件](../architecture/)
- [測試策略](../qa/)

---

**最後更新**: 2025-01-16
**維護者**: SpecPilot Team
