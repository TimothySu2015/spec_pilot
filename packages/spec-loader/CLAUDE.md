# @specpilot/spec-loader - OpenAPI 規格載入器

## 模組概述

`@specpilot/spec-loader` 是 SpecPilot 的 OpenAPI 規格載入與解析模組，負責載入、驗證、解析 OpenAPI 規格檔案 (支援 JSON 與 YAML 格式)，並提供規格查詢與分析功能。

## 核心職責

1. **規格載入**: 從檔案或字串載入 OpenAPI 規格
2. **格式支援**: 支援 OpenAPI 2.0 (Swagger) 與 OpenAPI 3.x
3. **規格驗證**: 驗證規格檔案的正確性與完整性
4. **參照解析**: 處理 $ref 參照與外部檔案引用
5. **規格查詢**: 提供便利的規格資訊查詢 API
6. **Schema 提取**: 提取 Components Schemas 供驗證使用

## 技術堆疊

### 核心依賴
- `@apidevtools/swagger-parser` (^10.1.0) - OpenAPI 解析與驗證
- `yaml` (^2.4.3) - YAML 格式解析
- `@specpilot/shared` - 共用工具與錯誤類別

## 核心元件

### SpecLoader
主要載入器類別：

```typescript
import { SpecLoader } from '@specpilot/spec-loader';

const loader = new SpecLoader();

// 從檔案載入
const spec = await loader.loadFromFile('specs/petstore.yaml');

// 從 URL 載入
const spec = await loader.loadFromUrl('https://api.example.com/openapi.json');

// 從字串載入
const spec = await loader.loadFromString(yamlContent);
```

### SpecValidator
規格驗證器：

```typescript
class SpecValidator {
  // 驗證 OpenAPI 規格
  async validate(spec: any): Promise<ValidationResult>;

  // 檢查規格版本
  detectVersion(spec: any): 'swagger-2.0' | 'openapi-3.0' | 'openapi-3.1';

  // 驗證必要欄位
  validateRequiredFields(spec: any): string[];
}
```

### SpecAnalyzer
規格分析器：

```typescript
class SpecAnalyzer {
  // 列出所有端點
  listEndpoints(spec: OpenAPISpec): EndpointInfo[];

  // 取得特定端點資訊
  getEndpoint(spec: OpenAPISpec, method: string, path: string): EndpointDetail;

  // 提取 Schema
  extractSchemas(spec: OpenAPISpec): Record<string, JSONSchema>;

  // 偵測認證機制
  detectAuthSchemes(spec: OpenAPISpec): AuthScheme[];

  // 分析資源依賴
  analyzeResourceDependencies(spec: OpenAPISpec): DependencyGraph;
}
```

## 支援的格式

### OpenAPI 3.x

```yaml
openapi: 3.0.0
info:
  title: Sample API
  version: 1.0.0
servers:
  - url: http://localhost:3000
paths:
  /users:
    get:
      summary: List users
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserList'
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
```

### Swagger 2.0

```yaml
swagger: '2.0'
info:
  title: Sample API
  version: 1.0.0
host: localhost:3000
basePath: /api
schemes:
  - http
paths:
  /users:
    get:
      summary: List users
      responses:
        200:
          description: Success
          schema:
            $ref: '#/definitions/UserList'
definitions:
  User:
    type: object
    properties:
      id:
        type: integer
      name:
        type: string
```

## 使用範例

### 基本載入

```typescript
import { SpecLoader } from '@specpilot/spec-loader';

const loader = new SpecLoader();

try {
  // 載入並解析規格
  const spec = await loader.loadFromFile('specs/api.yaml');

  console.log(`API: ${spec.info.title}`);
  console.log(`版本: ${spec.info.version}`);
  console.log(`端點數量: ${Object.keys(spec.paths).length}`);
} catch (error) {
  console.error('載入失敗:', error.message);
}
```

### 端點查詢

```typescript
import { SpecAnalyzer } from '@specpilot/spec-loader';

const analyzer = new SpecAnalyzer(spec);

// 列出所有端點
const endpoints = analyzer.listEndpoints();
endpoints.forEach(endpoint => {
  console.log(`${endpoint.method} ${endpoint.path}`);
});

// 取得特定端點詳情
const userEndpoint = analyzer.getEndpoint('POST', '/users');
console.log('請求 Schema:', userEndpoint.requestSchema);
console.log('回應 Schema:', userEndpoint.responseSchema);
```

### Schema 提取

```typescript
// 提取所有 Component Schemas
const schemas = analyzer.extractSchemas();

// 取得特定 Schema
const userSchema = schemas['User'];
console.log('User Schema:', userSchema);

// 供驗證模組使用
import { ValidationEngine } from '@specpilot/validation';
const validator = new ValidationEngine(schemas);
```

### 認證資訊偵測

```typescript
// 偵測 API 使用的認證機制
const authSchemes = analyzer.detectAuthSchemes();

authSchemes.forEach(scheme => {
  console.log(`認證類型: ${scheme.type}`);  // bearer, apiKey, oauth2 等
  console.log(`位置: ${scheme.in}`);        // header, query, cookie
  console.log(`參數名稱: ${scheme.name}`);
});
```

### 資源依賴分析

```typescript
// 分析資源間的依賴關係
const dependencies = analyzer.analyzeResourceDependencies();

// 範例輸出
// {
//   'Order': ['User', 'Product'],  // Order 依賴 User 和 Product
//   'Review': ['User', 'Product']
// }
```

## 參照解析

### 內部參照

```yaml
# 自動解析 $ref
components:
  schemas:
    User:
      type: object
      properties:
        id: { type: integer }
        name: { type: string }

    UserList:
      type: array
      items:
        $ref: '#/components/schemas/User'  # 自動解析
```

### 外部檔案參照

```yaml
# 支援外部檔案引用
components:
  schemas:
    User:
      $ref: './schemas/user.yaml#/User'
```

### 遠端參照

```yaml
# 支援遠端 URL 參照
components:
  schemas:
    Pet:
      $ref: 'https://example.com/schemas/pet.json'
```

## 錯誤處理

### 規格錯誤

```typescript
try {
  const spec = await loader.loadFromFile('invalid.yaml');
} catch (error) {
  if (error.code === '1502') {
    console.error('OpenAPI 規格無效:', error.message);
    console.error('錯誤詳情:', error.details);
  }
}
```

### 常見錯誤類型

- `SPEC_NOT_FOUND` - 規格檔案不存在
- `SPEC_PARSE_ERROR` - YAML/JSON 解析失敗
- `SPEC_INVALID` - 規格不符合 OpenAPI 標準
- `REF_RESOLUTION_ERROR` - $ref 參照解析失敗
- `SCHEMA_ERROR` - Schema 定義錯誤

## 開發指令

```bash
# 編譯模組
pnpm run build

# 開發模式 (watch)
pnpm run dev

# 執行測試
pnpm run test

# 清理編譯產物
pnpm run clean
```

## 架構設計原則

1. **容錯性**: 提供友善的錯誤訊息
2. **完整性**: 完整解析所有參照與外部檔案
3. **快取機制**: 相同規格不重複載入
4. **效能優化**: 大型規格檔案的高效處理
5. **版本相容**: 支援多種 OpenAPI 版本

## 依賴關係

### 被依賴於
- `@specpilot/validation` - 提供 Schema 進行驗證
- `@specpilot/flow-generator` - 分析規格產生流程
- `@specpilot/test-suite-generator` - 產生測試套件
- `@specpilot/flow-validator` - 驗證端點存在性
- `apps/cli` - 載入規格檔案
- `apps/mcp-server` - MCP 工具載入規格

### 依賴於
- `@specpilot/shared` - 共用工具

## 進階功能

### 規格合併

```typescript
// 合併多個規格檔案
const mergedSpec = await loader.merge([
  'specs/users.yaml',
  'specs/products.yaml',
  'specs/orders.yaml'
]);
```

### 規格轉換

```typescript
// Swagger 2.0 轉 OpenAPI 3.0
const openapi3 = await loader.convertToOpenAPI3(swagger2Spec);
```

### 規格驗證報告

```typescript
const report = await loader.validate('specs/api.yaml', {
  strict: true,
  lint: true
});

console.log(`✅ 通過: ${report.passed.length}`);
console.log(`❌ 錯誤: ${report.errors.length}`);
console.log(`⚠️  警告: ${report.warnings.length}`);
```

## 快取機制

```typescript
// 啟用快取 (預設啟用)
const loader = new SpecLoader({
  cache: true,
  cacheDir: '.specpilot/cache'
});

// 清除快取
await loader.clearCache();
```

## 未來擴充方向

1. 支援 AsyncAPI 規格
2. 支援 GraphQL Schema
3. 支援 gRPC Proto 檔案
4. 規格差異比較工具
5. 規格視覺化產生
6. 規格文件自動產生
7. 規格品質評分
8. 破壞性變更偵測
9. 規格版本管理
10. OpenAPI 擴充欄位支援
