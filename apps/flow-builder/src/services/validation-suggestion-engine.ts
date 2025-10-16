import { IValidationRule } from '@specpilot/schemas';
import { resolveSchemaRef } from './openapi-parser';

/**
 * 驗證建議項目
 */
export interface IValidationSuggestion {
  path: string;
  rule: 'notNull' | 'regex' | 'contains';
  value?: string;
  reason: string;
  source: 'OpenAPI';
}

/**
 * 從 OpenAPI Response Schema 生成驗證建議
 */
export function generateValidationSuggestions(
  responseSchema: any,
  openApiSpec: any
): IValidationSuggestion[] {
  const suggestions: IValidationSuggestion[] = [];
  const schema = resolveSchemaRef(responseSchema, openApiSpec);

  if (!schema || schema.type !== 'object') {
    return suggestions;
  }

  const properties = schema.properties || {};
  const required = schema.required || [];

  for (const [fieldName, fieldSchema] of Object.entries<any>(properties)) {
    const resolvedFieldSchema = resolveSchemaRef(fieldSchema, openApiSpec);

    // 1. Required 欄位 → notNull
    if (required.includes(fieldName)) {
      suggestions.push({
        path: fieldName,
        rule: 'notNull',
        reason: 'OpenAPI 定義為必填欄位',
        source: 'OpenAPI',
      });
    }

    // 2. format: email → regex
    if (resolvedFieldSchema.format === 'email') {
      suggestions.push({
        path: fieldName,
        rule: 'regex',
        value: '^.+@.+\\..+$',
        reason: 'OpenAPI 定義為 email 格式',
        source: 'OpenAPI',
      });
    }

    // 3. format: date-time → regex
    if (resolvedFieldSchema.format === 'date-time') {
      suggestions.push({
        path: fieldName,
        rule: 'regex',
        value: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}',
        reason: 'OpenAPI 定義為 date-time 格式',
        source: 'OpenAPI',
      });
    }

    // 4. format: uuid → regex
    if (resolvedFieldSchema.format === 'uuid') {
      suggestions.push({
        path: fieldName,
        rule: 'regex',
        value: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
        reason: 'OpenAPI 定義為 UUID 格式',
        source: 'OpenAPI',
      });
    }

    // 5. pattern → regex
    if (resolvedFieldSchema.pattern) {
      suggestions.push({
        path: fieldName,
        rule: 'regex',
        value: resolvedFieldSchema.pattern,
        reason: 'OpenAPI 定義的 pattern 規則',
        source: 'OpenAPI',
      });
    }

    // 6. enum → contains (可選)
    if (resolvedFieldSchema.enum && resolvedFieldSchema.enum.length > 0) {
      suggestions.push({
        path: fieldName,
        rule: 'contains',
        value: String(resolvedFieldSchema.enum[0]),
        reason: `OpenAPI 定義的列舉值 (${resolvedFieldSchema.enum.join(', ')})`,
        source: 'OpenAPI',
      });
    }
  }

  return suggestions;
}

/**
 * 將建議轉換為實際的 Validation Rule
 */
export function suggestionToValidationRule(suggestion: IValidationSuggestion): IValidationRule {
  switch (suggestion.rule) {
    case 'notNull':
      return {
        rule: 'notNull',
        path: suggestion.path,
      };
    case 'regex':
      return {
        rule: 'regex',
        path: suggestion.path,
        value: suggestion.value || '',
      };
    case 'contains':
      return {
        rule: 'contains',
        path: suggestion.path,
        value: suggestion.value || '',
      };
  }
}
