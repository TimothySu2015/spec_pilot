# SpecPilot 認證功能使用指南

SpecPilot 支援多種認證方式，讓您可以輕鬆測試需要身份驗證的 API。本指南將詳細說明如何設定和使用認證功能。

## 概覽

SpecPilot 提供兩種主要的認證類型：

1. **登入認證（Login Authentication）**：透過執行登入步驟動態取得 Token
2. **靜態認證（Static Authentication）**：使用預先設定的 Token

兩種認證類型都支援命名空間隔離，可在同一個測試流程中使用多個不同服務的認證。

## 基本設定

### 環境變數設定

在專案根目錄建立 `.env.local` 檔案：

```bash
# 基本設定
SPEC_PILOT_BASE_URL=https://api.example.com
SPEC_PILOT_AUTH_DEFAULT_EXPIRY=3600

# 服務 Token
SPEC_PILOT_TOKEN_USER_SERVICE=your_user_service_token
SPEC_PILOT_TOKEN_PAYMENT_SERVICE=your_payment_service_token
```

### 命名空間規則

Token 環境變數遵循以下命名規則：
- 格式：`SPEC_PILOT_TOKEN_<NAMESPACE>`
- `<NAMESPACE>` 部分會自動轉換為小寫並用於 Flow 中的命名空間

範例：
- `SPEC_PILOT_TOKEN_USER_SERVICE` → 命名空間：`user_service`
- `SPEC_PILOT_TOKEN_API_GATEWAY` → 命名空間：`api_gateway`

## 登入認證

登入認證適用於需要透過登入 API 取得 Token 的情境。

### 基本語法

```yaml
steps:
  - name: user_login
    method: POST
    path: /auth/login
    body:
      username: "testuser"
      password: "testpass"
    auth:
      type: login
      tokenExtraction:
        path: "data.token"        # Token 在回應中的路徑
        expiresIn: 3600          # Token 有效期（秒）
        namespace: "user_session" # 儲存的命名空間
    expect:
      status: 200
```

### Token 提取路徑

`tokenExtraction.path` 支援點記號路徑，可從複雜的 JSON 結構中提取 Token：

```yaml
# 範例回應
{
  "result": {
    "authentication": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "refresh_token_here"
    }
  }
}

# 對應的提取路徑
tokenExtraction:
  path: "result.authentication.accessToken"
```

### 完整範例

```yaml
id: "login-example"
steps:
  # 步驟 1：登入
  - name: user_login
    method: POST
    path: /auth/login
    headers:
      Content-Type: application/json
    body:
      username: "testuser"
      password: "testpass"
    auth:
      type: login
      tokenExtraction:
        path: "data.accessToken"
        expiresIn: 3600
        namespace: "user_session"
    expect:
      status: 200

  # 步驟 2：使用取得的 Token
  - name: get_profile
    method: GET
    path: /user/profile
    auth:
      type: static
      namespace: "user_session"
    expect:
      status: 200
```

## 靜態認證

靜態認證使用預先設定的 Token，適用於 API Key 或長期有效的 Token。

### 基本語法

```yaml
steps:
  - name: api_call
    method: GET
    path: /api/data
    auth:
      type: static
      namespace: "external_api"  # 對應 SPEC_PILOT_TOKEN_EXTERNAL_API
    expect:
      status: 200
```

### 全域靜態認證設定

您可以在 Flow 的全域設定中定義靜態認證：

```yaml
id: "global-auth-example"

# 全域認證設定
auth:
  static:
    - namespace: "service_a"
      token: "${SPEC_PILOT_TOKEN_SERVICE_A}"
      expiresInSeconds: 7200

    - namespace: "service_b"
      token: "hardcoded_token_value"
      expiresInSeconds: 3600

steps:
  - name: call_service_a
    method: GET
    path: /service-a/data
    auth:
      type: static
      namespace: "service_a"
    expect:
      status: 200
```

## 多服務認證

SpecPilot 支援在同一個測試流程中使用多個不同服務的認證。

### 範例：內部系統 + 外部 API + 支付服務

```yaml
id: "multi-service-example"

# 外部服務的靜態認證
auth:
  static:
    - namespace: "external_api"
      token: "${SPEC_PILOT_TOKEN_EXTERNAL}"
    - namespace: "payment_service"
      token: "${SPEC_PILOT_TOKEN_PAYMENT}"

steps:
  # 登入內部系統
  - name: internal_login
    method: POST
    path: /internal/auth/login
    body:
      apiKey: "internal-key"
    auth:
      type: login
      tokenExtraction:
        path: "token"
        namespace: "internal_system"
    expect:
      status: 200

  # 使用內部系統 Token
  - name: internal_api_call
    method: GET
    path: /internal/data
    auth:
      type: static
      namespace: "internal_system"
    expect:
      status: 200

  # 使用外部服務 Token
  - name: external_api_call
    method: GET
    path: /external/info
    auth:
      type: static
      namespace: "external_api"
    expect:
      status: 200

  # 使用支付服務 Token
  - name: create_payment
    method: POST
    path: /payment/orders
    auth:
      type: static
      namespace: "payment_service"
    body:
      amount: 1000
    expect:
      status: 201
```

## OAuth 2.0 認證

OAuth 2.0 認證是登入認證的一種特殊情況：

```yaml
id: "oauth-example"
steps:
  - name: oauth_token
    method: POST
    path: /oauth/token
    headers:
      Content-Type: application/x-www-form-urlencoded
      Authorization: "Basic ${OAUTH_CLIENT_CREDENTIALS}"
    body:
      grant_type: "client_credentials"
      scope: "read write"
    auth:
      type: login
      tokenExtraction:
        path: "access_token"
        expiresIn: 7200
        namespace: "oauth_client"
    expect:
      status: 200

  - name: protected_resource
    method: GET
    path: /api/protected/data
    auth:
      type: static
      namespace: "oauth_client"
    expect:
      status: 200
```

## 進階設定

### 認證重試設定

透過環境變數設定認證失敗時的自動重試：

```bash
# 對 api_gateway 和 payment_service 命名空間啟用重試
SPEC_PILOT_AUTH_RETRY_ON_FAILURE=api_gateway,payment_service
```

### 預設 Token 過期時間

設定預設的 Token 過期時間：

```bash
SPEC_PILOT_AUTH_DEFAULT_EXPIRY=7200  # 2 小時
```

### 命名空間配置

在程式碼中可進一步設定命名空間的行為：

```typescript
import { getAuthConfigManager } from '@specpilot/config';

const authConfig = getAuthConfigManager();

// 設定命名空間描述和重試行為
authConfig.setNamespaceConfig('payment_service', {
  description: 'Payment Gateway API',
  retryOnAuthFailure: true
});
```

## 錯誤處理

### 常見錯誤

1. **Token 缺失錯誤 (1501)**
   ```
   命名空間 "api_v1" 的 Token 不存在
   ```
   - 檢查環境變數是否正確設定
   - 確認命名空間名稱是否正確

2. **Token 過期錯誤 (1502)**
   ```
   命名空間 "api_v1" 的 Token 已於 2025-01-01T00:00:00.000Z 過期
   ```
   - 重新執行登入步驟
   - 檢查 Token 有效期設定

3. **Token 提取失敗錯誤 (1504)**
   ```
   步驟 "login" 無法從回應中提取 Token（路徑：data.token）
   ```
   - 檢查 API 回應格式
   - 確認提取路徑是否正確

4. **環境變數缺失錯誤 (1505)**
   ```
   環境變數 "SPEC_PILOT_TOKEN_API_V1" 未設定
   ```
   - 在 .env.local 中添加對應的環境變數

### 除錯技巧

1. **檢查 Token 狀態**
   ```bash
   # 執行流程時觀察日誌中的 Token 事件
   pnpm run start -- --spec spec.yaml --flow flow.yaml
   ```

2. **驗證環境變數**
   ```bash
   # 檢查環境變數是否正確載入
   echo $SPEC_PILOT_TOKEN_USER_SERVICE
   ```

3. **使用詳細日誌**
   ```bash
   # 啟用詳細日誌以查看認證過程
   DEBUG=specpilot:* pnpm run start -- --spec spec.yaml --flow flow.yaml
   ```

## 最佳實踐

### 1. 安全性

- **永遠不要**將實際 Token 直接寫在 Flow YAML 檔案中
- 使用環境變數儲存敏感資訊
- 定期輪替 API Token
- 在 Git 中排除 `.env.local` 檔案

### 2. 命名規範

- 使用有意義的命名空間名稱
- 保持命名空間名稱簡潔且一致
- 為不同環境使用不同的命名空間

### 3. Token 管理

- 設定適當的 Token 過期時間
- 對短期 Token 使用登入認證
- 對長期 API Key 使用靜態認證
- 在測試中使用專用的測試 Token

### 4. 錯誤處理

- 為關鍵服務啟用認證重試
- 在測試中驗證認證相關的錯誤情況
- 記錄並監控認證失敗事件

## 範例檔案

專案中提供了完整的認證範例：

- `examples/auth-flows/login-flow.yaml` - 基本登入流程
- `examples/auth-flows/multi-service-flow.yaml` - 多服務認證
- `examples/auth-flows/oauth-flow.yaml` - OAuth 2.0 認證
- `examples/auth-flows/.env.example` - 環境變數範例

## 相關文件

- [API 參考文件](./api-reference.md)
- [設定指南](./configuration.md)
- [錯誤代碼參考](./error-codes.md)