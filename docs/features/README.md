# SpecPilot 新增功能文件索引

## 文件結構

本目錄包含 SpecPilot v0.2.0 新增功能的詳細文件。

---

## 📚 文件列表

### 1. [總覽 (Overview)](./overview.md)
**推薦首先閱讀**

提供所有新增功能的總覽,包含:
- 三大核心模組介紹
- MCP Server 新增工具
- 整體架構圖
- 使用流程範例
- 開發狀態與規劃

### 2. [Flow Generator（對話式流程產生器）](./flow-generator.md)
**模組路徑**: `packages/flow-generator/`

詳細介紹對話式測試流程產生引擎,包含:
- NLPFlowParser - 自然語言解析
- IntentRecognizer - 意圖識別與端點推薦
- ContextManager - 對話上下文管理
- FlowBuilder - Flow 建構器
- SuggestionEngine - 智能建議引擎
- 完整使用範例與 API 文件

### 3. [Test Suite Generator（測試套件自動產生器）](./test-suite-generator.md)
**模組路徑**: `packages/test-suite-generator/`

詳細介紹自動化測試套件產生引擎,包含:
- SpecAnalyzer - OpenAPI 規格分析
- CRUDGenerator - CRUD 測試產生
- ErrorCaseGenerator - 錯誤案例產生
- EdgeCaseGenerator - 邊界測試產生
- DependencyResolver - 資源依賴解析
- DataSynthesizer - 測試資料合成
- FlowQualityChecker - Flow 品質檢查
- 完整使用範例與產生策略

### 4. [Flow Validator（流程驗證器）](./flow-validator.md)
**模組路徑**: `packages/flow-validator/`

詳細介紹 Flow 驗證引擎,包含:
- SchemaValidator - JSON Schema 格式驗證
- SemanticValidator - 語意正確性檢查
- FlowValidator - 整合驗證器
- 驗證項目與錯誤處理
- CI/CD 整合範例

### 5. [MCP Server 增強功能](./mcp-server-enhancements.md)
**應用路徑**: `apps/mcp-server/`

詳細介紹 MCP Server 新增的工具方法,包含:
- `generateFlow` - 自動產生測試流程
- `validateFlow` - 驗證 Flow 格式與語意
- `checkFlowQuality` - 檢查 Flow 品質
- `saveFlow` - 儲存 Flow 至專案
- 完整工作流程範例
- Claude Desktop 整合指南

---

## 🚀 快速開始

### 1. 想快速了解新功能？
→ 閱讀 [總覽 (Overview)](./overview.md)

### 2. 想使用對話方式產生測試？
→ 閱讀 [Flow Generator](./flow-generator.md)

### 3. 想批次產生完整測試套件？
→ 閱讀 [Test Suite Generator](./test-suite-generator.md)

### 4. 想驗證 Flow 的正確性？
→ 閱讀 [Flow Validator](./flow-validator.md)

### 5. 想透過 AI Agent 使用這些功能？
→ 閱讀 [MCP Server 增強功能](./mcp-server-enhancements.md)

---

## 📊 功能對照表

| 需求 | 推薦工具/模組 | 文件連結 |
|-----|-------------|---------|
| 快速建立單一端點測試 | Flow Generator | [文件](./flow-generator.md) |
| 批次產生完整測試套件 | Test Suite Generator | [文件](./test-suite-generator.md) |
| 產生 CRUD 測試 | Test Suite Generator | [文件](./test-suite-generator.md#2-crudgenerator) |
| 產生錯誤案例測試 | Test Suite Generator | [文件](./test-suite-generator.md#3-errorcasegenerator) |
| 產生邊界值測試 | Test Suite Generator | [文件](./test-suite-generator.md#4-edgecasegenerator) |
| 驗證 Flow 格式 | Flow Validator | [文件](./flow-validator.md) |
| 檢查 Flow 品質 | FlowQualityChecker | [文件](./test-suite-generator.md#7-flowqualitychecker) |
| AI Agent 整合 | MCP Server | [文件](./mcp-server-enhancements.md) |

---

## 🔗 相關資源

### 核心文件
- [總覽](./overview.md)
- [安裝指南](../installation-guide.md)
- [MCP 介面文件](../mcp-interface.md)
- [Claude Desktop 整合](../claude-desktop-integration.md)

### 架構文件
- [架構總覽](../architecture/)
- [PRD 文件](../prd/)

### 使用指南
- [使用者指南](../guides/)
- [範例集](../examples/)

### 品質保證
- [測試策略](../qa/)

---

## 📝 更新日誌

### v0.2.0 (2025-01-16)
**新增功能**:
- ✅ Flow Generator 模組
- ✅ Test Suite Generator 模組
- ✅ Flow Validator 模組
- ✅ MCP Server 新增 6 個工具方法
- ✅ 完整的端對端測試

**改進**:
- ✨ 增強的錯誤處理與診斷
- ✨ 更完整的型別定義
- ✨ 提升測試覆蓋率

---

## 🤝 貢獻

如需對這些功能進行貢獻,請參考:
- [開發指南](../guides/development-guide.md)
- [貢獻規範](../../CONTRIBUTING.md)

---

## 📧 聯絡方式

- **GitHub Issues**: [報告問題](https://github.com/your-org/specpilot/issues)
- **討論區**: [功能討論](https://github.com/your-org/specpilot/discussions)

---

**最後更新**: 2025-01-16
**版本**: v0.2.0
