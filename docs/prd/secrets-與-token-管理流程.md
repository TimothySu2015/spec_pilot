# Secrets 與 Token 管理流程
- **區分環境檔案**：本地開發使用 `.env.local`，CI 使用 `.env.ci`，所有檔案均應列入 `.gitignore`。
- **設定載入流程**：Config Service 負責讀取環境變數並提供統一介面，CLI 與 MCP 皆透過該服務取得 Token/baseUrl/port。
- **敏感資訊來源**：
  - 本地：開發者可在 `.env.local` 中設定 `SPEC_PILOT_TOKEN` 或登入用的使用者密碼；必要時可補充 `specpilot secrets set` 等腳本輔助輸入。
  - Staging/Production：建議透過雲端 Secrets Manager（AWS Secrets Manager、GCP Secret Manager 等）動態注入環境變數，禁止寫入映像檔或程式碼庫。
- **Token 取得流程**：Flow 可包含登入步驟，將取得的 Token 儲存在 Run Context；若專案提供長期 Token，需透過設定檔宣告並在流程執行前注入。
- **輪替與失效機制**：Token 必須設定到期日並於輪替時更新 Secrets Manager；系統在檢測到 HTTP 401/403 時需記錄告警並提示重新登入或更新 Token。
- **稽核與遮罩**：所有日誌／報表均以 `***` 遮蔽 Token 與密碼欄位，並保留輪替紀錄以便追蹤。
