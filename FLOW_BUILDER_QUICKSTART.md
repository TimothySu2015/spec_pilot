# Flow Builder 快速啟動指南

## ✅ 問題已修復!

原本的錯誤是因為 `@specpilot/schemas` 套件需要先建置。現在已經在啟動腳本中自動處理。

## 🚀 啟動方式

### 方式 1: 使用根目錄指令 (推薦)

```bash
# 從專案根目錄執行
pnpm run dev:builder
```

這個指令會:
1. 自動建置 `@specpilot/schemas` 套件
2. 啟動 Flow Builder 開發伺服器

### 方式 2: 手動啟動

```bash
# 1. 先建置 schemas 套件
cd packages/schemas
pnpm run build
cd ../..

# 2. 啟動 Flow Builder
cd apps/flow-builder
pnpm run dev
```

## 📍 存取位置

伺服器啟動後,在瀏覽器開啟:
- **http://localhost:5173** (預設)
- 如果 5173 被佔用,會自動切換到 5174

## 🎯 功能測試

### 1. 建立 Flow 基本資訊
- 填寫 Flow 名稱: `使用者管理測試`
- 填寫 Base URL: `http://localhost:3000`
- 新增變數: `username` = `admin`

### 2. 新增測試步驟
- 點擊左側 「+ 新增步驟」
- 填寫步驟名稱: `登入測試`
- 選擇 HTTP Method: `POST`
- 填寫 Path: `/auth/login`
- 填寫 Request Body:
  ```json
  {
    "username": "{{username}}",
    "password": "123456"
  }
  ```

### 3. 設定預期回應
- 預期狀態碼: `200`
- 點擊 「+ 新增欄位」
- 欄位名稱: `token`
- 驗證模式: `存在即可`

### 4. 即時預覽與匯出
- 右側會即時顯示 YAML 預覽
- 點擊 Header 「📤 匯出」可下載檔案

## 🛠️ 開發指令

```bash
# 建置 schemas 套件
pnpm run build:schemas

# 建置 Flow Builder (生產版本)
pnpm run build:builder

# 執行測試
pnpm run test
```

## 📁 專案結構

```
packages/schemas/           ← 共用 Schema 套件 (需先建置)
└── dist/                   ← 建置輸出 (Vite 會讀取這裡)

apps/flow-builder/          ← React UI 應用程式
├── src/
│   ├── components/
│   ├── contexts/
│   └── utils/
└── README.md
```

## ❓ 常見問題

### Q: 為什麼會出現 "Failed to resolve entry" 錯誤?
**A:** schemas 套件需要先建置。執行 `pnpm run build:schemas` 或直接使用 `pnpm run dev:builder`。

### Q: 如何修改 schemas 套件?
**A:** 修改 `packages/schemas/src/` 下的檔案後,需要重新執行 `pnpm run build:schemas`。

### Q: 匯出的 YAML 檔案在哪裡?
**A:** 預設會下載到瀏覽器的下載資料夾 (通常是 `~/Downloads/`)。

## 🎨 已實作功能

✅ Flow 基本資訊編輯 (名稱、URL、描述、版本)
✅ 變數管理 (支援 `{{variable}}` 語法)
✅ Step 列表管理 (新增/刪除/排序)
✅ Request 編輯器 (Method、Path、Body)
✅ **Expect Body Table** (表格模式定義預期回應)
✅ 即時 YAML 預覽 (Monaco Editor)
✅ 匯出 YAML + JSON Schema

## 📝 下一步

如需進一步擴充:
- Phase 6: SpecPilot CLI 整合
- Phase 7: OpenAPI 整合與智能建議
- Phase 8: Validation/Capture 編輯器

---

**享受 Flow Builder! 🎉**
