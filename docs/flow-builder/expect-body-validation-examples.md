# Expect Body 與 Validation 配合使用範例

本文檔提供完整的範例,說明如何正確使用 Expect Body 與 Validation 規則。

---

## 目錄

1. [基本概念](#基本概念)
2. [使用場景對照](#使用場景對照)
3. [完整範例](#完整範例)
4. [常見錯誤與最佳實踐](#常見錯誤與最佳實踐)

---

## 基本概念

### Expect Body vs Validation 的定位

| 功能 | Expect Body | Validation |
|------|-------------|-----------|
| **用途** | 簡單的欄位值驗證 | 進階的格式與邏輯驗證 |
| **適用情境** | 精確匹配、欄位存在檢查 | 模糊匹配、正則表達式、業務邏輯 |
| **複雜度** | 低 (簡單直觀) | 中高 (功能強大) |
| **YAML 語法** | `body: { field: value }` | `validation: [{ rule, path, value }]` |
| **UI 編輯模式** | Table 表單模式 (下拉選擇驗證模式) | 規則列表編輯器 |

### 設計原則

> **互補而非重複:** Expect Body 處理基本驗證,Validation 處理進階需求。

### UI 編輯模式說明

在 Flow Builder UI 中,Expect Body 採用 **Table 表單模式**:

| 欄位名稱 | 預期值 | 驗證模式 | 操作 |
|---------|--------|---------|------|
| id | (任意值) | 存在即可 ▼ | [🗑️] |
| name | 王大明 | 精確匹配 ▼ | [🗑️] |

**驗證模式對應:**
- **存在即可** → YAML: `null`
- **精確匹配** → YAML: `"具體值"`

此表單模式會自動轉換為標準 YAML 格式,無需手動編寫 YAML 語法。

---

## 使用場景對照

### 場景 1: 驗證欄位存在

**需求:** 確認 Response 包含 `id` 欄位,值不限制

**UI 操作 (Flow Builder):**

在 Expect Body Table 中新增欄位:
- 欄位名稱: `id`
- 預期值: (任意值)
- 驗證模式: 選擇「存在即可」

**生成的 YAML:**
```yaml
# ✅ 推薦: 使用 Expect Body
expect:
  body:
    id: null  # 存在即可

# ❌ 不推薦: 使用 Validation (過於複雜)
validation:
  - rule: notNull
    path: id
```

**說明:** 簡單的存在性檢查,使用 Expect Body 更直觀。UI 的 Table 模式讓這個操作更加視覺化,無需記憶 YAML 語法。

---

### 場景 2: 驗證欄位精確值

**需求:** 確認使用者名稱必須是「王大明」

**UI 操作 (Flow Builder):**

在 Expect Body Table 中新增欄位:
- 欄位名稱: `name`
- 預期值: `王大明`
- 驗證模式: 選擇「精確匹配」

**生成的 YAML:**
```yaml
# ✅ 推薦: 使用 Expect Body
expect:
  body:
    name: "王大明"  # 精確匹配

# ❌ 不推薦: 使用 Validation (功能重複)
validation:
  - rule: contains
    path: name
    value: "王大明"  # 這也能用,但不如 Expect Body 簡潔
```

**說明:** 精確匹配用 Expect Body 最簡單。Table 模式提供下拉選單,操作更直覺。

---

### 場景 3: 驗證欄位包含特定文字

**需求:** 確認名稱包含「王」字

```yaml
# ✅ 必須使用 Validation (Expect Body 無法表達)
expect:
  body:
    name: null  # 存在即可

validation:
  - rule: contains
    path: name
    value: "王"  # 包含「王」即可
```

**說明:** 模糊匹配必須用 Validation。

---

### 場景 4: 驗證欄位格式

**需求:** 確認 email 符合格式

```yaml
# ✅ 推薦: Expect Body + Validation 組合
expect:
  body:
    email: "test@example.com"  # 精確匹配基本值

validation:
  - rule: regex
    path: email
    value: ^.+@.+\..+$  # 額外確認格式正確
```

**說明:** Expect Body 驗證基本值,Validation 加強格式檢查。

---

### 場景 5: 驗證自動生成欄位

**需求:** 驗證系統自動生成的 ID 和時間戳

```yaml
# ✅ 推薦: Expect Body 存在檢查 + Validation 格式驗證
expect:
  body:
    id: null          # 存在即可 (無法預測值)
    createdAt: null   # 存在即可

validation:
  - rule: regex
    path: createdAt
    value: ^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}  # ISO 8601 格式
```

**說明:** 自動生成的值用 `null`,格式驗證用 Validation。

---

## 完整範例

### 範例 1: 建立使用者 (CRUD Create)

**UI 操作 (Flow Builder):**

**Expect Body Table 設定:**

| 欄位名稱 | 預期值 | 驗證模式 |
|---------|--------|---------|
| id | (任意值) | 存在即可 ▼ |
| createdAt | (任意值) | 存在即可 ▼ |
| updatedAt | (任意值) | 存在即可 ▼ |
| name | 王大明 | 精確匹配 ▼ |
| email | test@example.com | 精確匹配 ▼ |
| role | user | 精確匹配 ▼ |
| status | active | 精確匹配 ▼ |

**Validation 規則列表:**

| 規則類型 | Path | Value |
|---------|------|-------|
| regex ▼ | email | ^.+@.+\..+$ |
| regex ▼ | createdAt | ^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2} |
| contains ▼ | name | 王 |

**生成的 YAML:**

```yaml
name: 建立新使用者
request:
  method: POST
  path: /api/users
  headers:
    Content-Type: application/json
  body:
    name: "王大明"
    email: "test@example.com"
    role: "user"
    status: "active"

expect:
  statusCode: 201
  body:
    # 系統自動生成的欄位 (Table 模式: 存在即可)
    id: null
    createdAt: null
    updatedAt: null

    # 必須與 Request 一致的欄位 (Table 模式: 精確匹配)
    name: "王大明"
    email: "test@example.com"
    role: "user"
    status: "active"

validation:
  # 加強格式驗證
  - rule: regex
    path: email
    value: ^.+@.+\..+$

  - rule: regex
    path: createdAt
    value: ^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}

  # 業務邏輯驗證
  - rule: contains
    path: name
    value: "王"  # 名字必須包含「王」

capture:
  new_user_id: id
  new_user_email: email
```

**說明:**
- Table 模式讓欄位驗證更直觀,下拉選單避免語法錯誤
- 系統自動將「存在即可」轉換為 `null`
- 系統自動將「精確匹配」+ 預期值轉換為字串值
- Validation 規則仍使用列表編輯器,保持彈性

---

### 範例 2: 查詢使用者列表 (CRUD Read)

```yaml
name: 查詢使用者列表
request:
  method: GET
  path: /api/users

expect:
  statusCode: 200
  body:
    # 列表資料欄位存在檢查
    users: null      # 存在即可 (陣列內容不確定)
    total: null      # 存在即可
    page: null       # 存在即可
    pageSize: null   # 存在即可

validation:
  # 確認 total 是數字且大於 0
  - rule: notNull
    path: total

  # 確認至少有一個使用者
  - rule: notNull
    path: users[0]

  # 確認第一個使用者有必要欄位
  - rule: notNull
    path: users[0].id
  - rule: notNull
    path: users[0].name

capture:
  total_users: total
  first_user_id: users[0].id
```

---

### 範例 3: 更新使用者 (CRUD Update)

```yaml
name: 更新使用者狀態
request:
  method: PATCH
  path: /api/users/{{user_id}}
  body:
    status: "inactive"

expect:
  statusCode: 200
  body:
    # 更新的欄位必須精確匹配
    status: "inactive"        # 精確匹配 (已更新)

    # 其他欄位保持存在
    id: null                  # 存在即可
    name: null                # 存在即可
    email: null               # 存在即可
    updatedAt: null           # 存在即可

validation:
  # 確認 updatedAt 時間戳已更新
  - rule: regex
    path: updatedAt
    value: ^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}
```

---

### 範例 4: 錯誤回應驗證

```yaml
name: 錯誤登入測試
request:
  method: POST
  path: /auth/login
  body:
    username: "wronguser"
    password: "wrongpass"

expect:
  statusCode: 401
  body:
    # 錯誤訊息欄位
    error: "Unauthorized"     # 精確匹配
    message: null             # 存在即可 (訊息內容可能變動)

validation:
  # 確認錯誤訊息包含關鍵字
  - rule: contains
    path: message
    value: "帳號或密碼錯誤"

  # 確認沒有敏感資訊洩漏
  - rule: notNull
    path: message
```

---

## 常見錯誤與最佳實踐

### ❌ 錯誤 1: 在 Expect Body 和 Validation 重複驗證

```yaml
# ❌ 不好的寫法
expect:
  body:
    name: "王大明"  # 已經精確匹配

validation:
  - rule: contains
    path: name
    value: "王大明"  # 重複了!
```

**✅ 正確寫法:**

```yaml
expect:
  body:
    name: "王大明"  # 精確匹配就夠了

# 如果需要額外檢查,才加 Validation
validation:
  - rule: contains
    path: name
    value: "王"  # 這是額外的業務邏輯
```

---

### ❌ 錯誤 2: 自動生成欄位使用精確匹配

```yaml
# ❌ 不好的寫法 (無法預測 ID 值)
expect:
  body:
    id: 12345  # 下次執行會失敗!
```

**✅ 正確寫法:**

```yaml
expect:
  body:
    id: null  # 存在即可

capture:
  new_user_id: id  # 擷取後續使用
```

---

### ❌ 錯誤 3: 所有欄位都用 Validation

```yaml
# ❌ 不好的寫法 (過於複雜)
validation:
  - rule: notNull
    path: id
  - rule: contains
    path: name
    value: "王大明"
  - rule: contains
    path: email
    value: "test@example.com"
  - rule: contains
    path: status
    value: "active"
```

**✅ 正確寫法:**

```yaml
# 簡單驗證用 Expect Body
expect:
  body:
    id: null
    name: "王大明"
    email: "test@example.com"
    status: "active"

# 只在需要格式驗證時用 Validation
validation:
  - rule: regex
    path: email
    value: ^.+@.+\..+$
```

---

### ✅ 最佳實踐總結

1. **優先使用 Expect Body**
   - 簡單的存在性檢查 → `null`
   - 精確值匹配 → `"具體值"`

2. **需要時才用 Validation**
   - 模糊匹配 → `contains`
   - 格式驗證 → `regex`
   - 業務邏輯 → 自訂規則

3. **避免重複驗證**
   - Expect Body 已驗證的,不要在 Validation 重複

4. **自動生成欄位用 null**
   - ID、時間戳等系統生成的值

5. **格式驗證用 Validation**
   - Email、日期、正則表達式

---

## 決策流程圖

```
需要驗證欄位?
  │
  ├─ 是否為精確值匹配?
  │   ├─ 是 → 使用 Expect Body (精確匹配)
  │   └─ 否 ↓
  │
  ├─ 是否只需要欄位存在?
  │   ├─ 是 → 使用 Expect Body (null)
  │   └─ 否 ↓
  │
  ├─ 是否需要模糊匹配?
  │   ├─ 是 → 使用 Validation (contains)
  │   └─ 否 ↓
  │
  ├─ 是否需要格式驗證?
  │   ├─ 是 → 使用 Validation (regex)
  │   └─ 否 ↓
  │
  └─ 複雜業務邏輯 → 使用 Validation (自訂規則)
```

---

**文件版本:** v1.0.0
**最後更新:** 2025-01-15
**狀態:** ✅ Complete
