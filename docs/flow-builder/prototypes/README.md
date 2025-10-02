# Flow Builder UI 原型

這個目錄包含 Flow Builder 的靜態 HTML 原型頁面,用於預覽 UI 設計。

## 檔案說明

- `flow-builder-ui.html` - 主要 UI 原型頁面

## 如何使用

### 方法 1: 直接開啟檔案

1. 用瀏覽器開啟 `flow-builder-ui.html`
2. 或在終端執行:

```bash
# Windows
start prototypes/flow-builder-ui.html

# macOS
open prototypes/flow-builder-ui.html

# Linux
xdg-open prototypes/flow-builder-ui.html
```

### 方法 2: 使用本地伺服器 (推薦)

```bash
# 使用 Python (Python 3)
cd prototypes
python -m http.server 8080

# 使用 Node.js (需安裝 http-server)
npx http-server prototypes -p 8080

# 使用 PHP
cd prototypes
php -S localhost:8080
```

然後開啟瀏覽器訪問: http://localhost:8080/flow-builder-ui.html

## 功能展示

### ✅ 已實現的功能

1. **完整佈局**
   - Header (Logo, 專案名稱, 操作按鈕)
   - Left Sidebar (OpenAPI 上傳狀態, 步驟列表, 範本庫)
   - Main Content (Flow 基本資訊, Step 編輯器)
   - Right Panel (YAML 預覽, 驗證結果, 說明文件)

2. **互動元件**
   - Tab 切換 (YAML 預覽 / 驗證 / 說明)
   - Modal 對話框
     - API 端點清單 Modal (點擊 Sidebar "查看清單")
     - 匯出 Flow Modal (點擊 Header "匯出")
   - 步驟列表 (顯示不同狀態圖示)

3. **視覺設計**
   - 完整的色彩系統 (Primary, Success, Warning, Error)
   - 字型系統 (Inter + JetBrains Mono)
   - 間距與圓角規範
   - 按鈕樣式 (Primary, Secondary)
   - 表單元件 (Input, Select, Textarea)
   - 程式碼編輯器樣式 (深色主題)

4. **OpenAPI 整合展示**
   - OpenAPI 已上傳狀態卡片
   - API 端點清單 (依 Tag 分組)
   - Method Badge (GET, POST, PUT, DELETE)
   - 批次生成按鈕

### 🎨 設計規格對照

所有設計均遵循 `docs/flow-builder-ui-design.md` 中的規格:

- ✅ 主版面配置 (Header 64px, Sidebar 240px, Right Panel 320px)
- ✅ 色彩系統 (Primary #3B82F6, 完整灰階)
- ✅ 字型系統 (Inter, JetBrains Mono)
- ✅ 元件樣式 (Button, Input, Card, Select)
- ✅ 互動流程 (Tab 切換, Modal 開關)

## 測試檢查清單

打開頁面後,請測試以下功能:

- [ ] Header 按鈕都能正確顯示
- [ ] 點擊 Sidebar "查看清單" 開啟 API 端點清單 Modal
- [ ] 點擊 Header "匯出" 開啟匯出 Modal
- [ ] 點擊 Modal 外部可關閉 Modal
- [ ] Right Panel 的三個 Tab (YAML 預覽/驗證/說明) 可切換
- [ ] 步驟列表顯示不同狀態圖示 (✅⚠️📝⏸️)
- [ ] 所有表單元件都能正常顯示
- [ ] JSON 程式碼有語法高亮
- [ ] 驗證警告區塊正確顯示
- [ ] OpenAPI 已上傳狀態卡片顯示完整資訊

## 已知限制

這是純靜態原型,以下功能尚未實現:

- ❌ 實際資料綁定 (使用假資料展示)
- ❌ 表單驗證邏輯
- ❌ YAML 即時生成
- ❌ 變數自動完成
- ❌ 拖拉排序步驟
- ❌ 實際 API 呼叫

## 瀏覽器支援

建議使用最新版本的現代瀏覽器:

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+

## 下一步

如果 UI 設計確認無誤,可以開始:

1. 使用 React + TypeScript 實作互動邏輯
2. 整合 Zod 進行表單驗證
3. 整合 Monaco Editor 作為 JSON 編輯器
4. 實作 OpenAPI 解析與自動生成功能

## 回饋

如有任何 UI/UX 調整需求,請記錄於此:

- [ ]
- [ ]
- [ ]
