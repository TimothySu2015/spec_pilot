/**
 * OpenAPI Schema 分析服務
 * 用於從 OpenAPI Spec 提取 Response Schema 並生成驗證建議
 */

export interface IValidationSuggestion {
  path: string;
  rule: 'notNull' | 'regex' | 'contains';
  value?: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface IResponseField {
  path: string;
  type: string;
  required: boolean;
  format?: string;
  pattern?: string;
  description?: string;
}

/**
 * 從 OpenAPI Spec 中找到對應的 API 端點定義
 */
export function findEndpointInSpec(
  openApiSpec: any,
  method: string,
  path: string
): any | null {
  if (!openApiSpec?.paths) return null;

  // 標準化 method
  const normalizedMethod = method.toLowerCase();

  // 直接匹配路徑
  if (openApiSpec.paths[path]?.[normalizedMethod]) {
    return openApiSpec.paths[path][normalizedMethod];
  }

  // 嘗試匹配路徑參數 (例如 /api/users/{id})
  for (const [specPath, pathItem] of Object.entries<any>(openApiSpec.paths)) {
    if (pathItem[normalizedMethod]) {
      // 將 OpenAPI 路徑轉換為正則表達式
      const pattern = specPath.replace(/\{[^}]+\}/g, '[^/]+');
      const regex = new RegExp(`^${pattern}$`);

      if (regex.test(path)) {
        return pathItem[normalizedMethod];
      }
    }
  }

  return null;
}

/**
 * 從端點定義中提取 Response Schema
 */
export function extractResponseSchema(
  endpoint: any,
  openApiSpec: any
): any | null {
  if (!endpoint?.responses) return null;

  // 優先查找 2xx 回應
  const successResponse =
    endpoint.responses['200'] ||
    endpoint.responses['201'] ||
    endpoint.responses['204'] ||
    Object.entries(endpoint.responses).find(([code]) => code.startsWith('2'))?.[1];

  if (!successResponse) return null;

  // 提取 content
  const content =
    successResponse.content?.['application/json'] ||
    Object.values(successResponse.content || {})[0];

  if (!content?.schema) return null;

  // 解析 $ref
  return resolveSchema(content.schema, openApiSpec);
}

/**
 * 解析 Schema 中的 $ref 引用
 */
function resolveSchema(schema: any, openApiSpec: any): any {
  if (!schema) return null;

  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/', '').split('/');
    let resolved = openApiSpec;
    for (const part of refPath) {
      resolved = resolved?.[part];
      if (!resolved) return null;
    }
    return resolveSchema(resolved, openApiSpec);
  }

  return schema;
}

/**
 * 從 Schema 提取所有欄位資訊（支援巢狀結構）
 */
export function extractFields(
  schema: any,
  openApiSpec: any,
  parentPath: string = '',
  maxDepth: number = 3,
  currentDepth: number = 0
): IResponseField[] {
  if (!schema || currentDepth >= maxDepth) return [];

  const resolvedSchema = resolveSchema(schema, openApiSpec);
  if (!resolvedSchema) return [];

  const fields: IResponseField[] = [];
  const required = resolvedSchema.required || [];

  if (resolvedSchema.type === 'object' && resolvedSchema.properties) {
    for (const [key, value] of Object.entries<any>(resolvedSchema.properties)) {
      const fieldPath = parentPath ? `${parentPath}.${key}` : key;
      const resolvedValue = resolveSchema(value, openApiSpec);

      fields.push({
        path: fieldPath,
        type: resolvedValue?.type || 'unknown',
        required: required.includes(key),
        format: resolvedValue?.format,
        pattern: resolvedValue?.pattern,
        description: resolvedValue?.description,
      });

      // 遞迴處理巢狀物件（限制深度避免無限遞迴）
      if (resolvedValue?.type === 'object' && resolvedValue.properties) {
        fields.push(
          ...extractFields(resolvedValue, openApiSpec, fieldPath, maxDepth, currentDepth + 1)
        );
      }

      // 處理陣列中的物件
      if (resolvedValue?.type === 'array' && resolvedValue.items) {
        const itemSchema = resolveSchema(resolvedValue.items, openApiSpec);
        if (itemSchema?.type === 'object' && itemSchema.properties) {
          // 為陣列第一個元素生成欄位建議
          const arrayPath = `${fieldPath}[0]`;
          fields.push(
            ...extractFields(itemSchema, openApiSpec, arrayPath, maxDepth, currentDepth + 1)
          );
        }
      }
    }
  }

  return fields;
}

/**
 * 根據 Response Schema 生成驗證建議
 */
export function generateValidationSuggestions(
  schema: any,
  openApiSpec: any
): IValidationSuggestion[] {
  const fields = extractFields(schema, openApiSpec);
  const suggestions: IValidationSuggestion[] = [];

  for (const field of fields) {
    // 必填欄位 → notNull (高優先級)
    if (field.required) {
      suggestions.push({
        path: field.path,
        rule: 'notNull',
        reason: '必填欄位',
        priority: 'high',
      });
    }

    // Email 格式 → regex (高優先級)
    if (field.format === 'email') {
      suggestions.push({
        path: field.path,
        rule: 'regex',
        value: '^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$',
        reason: 'Email 格式驗證',
        priority: 'high',
      });
    }

    // Date-time 格式 → regex (中優先級)
    if (field.format === 'date-time') {
      suggestions.push({
        path: field.path,
        rule: 'regex',
        value: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}',
        reason: 'ISO 8601 日期時間格式',
        priority: 'medium',
      });
    }

    // UUID 格式 → regex (中優先級)
    if (field.format === 'uuid') {
      suggestions.push({
        path: field.path,
        rule: 'regex',
        value: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        reason: 'UUID 格式驗證',
        priority: 'medium',
      });
    }

    // 自訂 pattern → regex (高優先級)
    if (field.pattern) {
      suggestions.push({
        path: field.path,
        rule: 'regex',
        value: field.pattern,
        reason: 'Schema 定義的格式驗證',
        priority: 'high',
      });
    }

    // 非必填但有型別約束的重要欄位 → notNull (低優先級)
    if (!field.required && ['string', 'number', 'integer', 'boolean'].includes(field.type)) {
      // 對於 ID 或重要業務欄位，建議驗證
      if (field.path.toLowerCase().includes('id') || field.path.toLowerCase().includes('name')) {
        suggestions.push({
          path: field.path,
          rule: 'notNull',
          reason: '重要業務欄位',
          priority: 'low',
        });
      }
    }
  }

  // 按優先級排序
  return suggestions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * 分析當前步驟並生成驗證建議
 */
export function analyzeStep(
  method: string,
  path: string,
  openApiSpec: any
): IValidationSuggestion[] {
  if (!openApiSpec) return [];

  const endpoint = findEndpointInSpec(openApiSpec, method, path);
  if (!endpoint) return [];

  const responseSchema = extractResponseSchema(endpoint, openApiSpec);
  if (!responseSchema) return [];

  return generateValidationSuggestions(responseSchema, openApiSpec);
}
