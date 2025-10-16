/**
 * OpenAPI 端點資訊
 */
export interface IAPIEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  requestBodySchema?: any;
  responseSchema?: any;
  parameters?: any[];
}

/**
 * 從 OpenAPI 規格中提取所有 API 端點
 */
export function extractEndpoints(openApiSpec: any): IAPIEndpoint[] {
  const endpoints: IAPIEndpoint[] = [];
  const paths = openApiSpec.paths || {};

  for (const [path, pathItem] of Object.entries<any>(paths)) {
    const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      // 提取 Request Body Schema
      const requestBodySchema =
        operation.requestBody?.content?.['application/json']?.schema;

      // 提取 Response Schema (優先取 200/201)
      const responses = operation.responses || {};
      const successResponse = responses['200'] || responses['201'] || responses['default'];
      const responseSchema =
        successResponse?.content?.['application/json']?.schema;

      endpoints.push({
        path,
        method: method.toUpperCase(),
        operationId: operation.operationId,
        summary: operation.summary,
        description: operation.description,
        tags: operation.tags,
        requestBodySchema,
        responseSchema,
        parameters: operation.parameters,
      });
    }
  }

  return endpoints;
}

/**
 * 依 Tag 分組端點
 */
export function groupEndpointsByTag(endpoints: IAPIEndpoint[]): Record<string, IAPIEndpoint[]> {
  const grouped: Record<string, IAPIEndpoint[]> = {};

  for (const endpoint of endpoints) {
    const tag = endpoint.tags?.[0] || 'default';
    if (!grouped[tag]) {
      grouped[tag] = [];
    }
    grouped[tag].push(endpoint);
  }

  return grouped;
}

/**
 * 解析 Schema 引用
 */
export function resolveSchemaRef(schema: any, openApiSpec: any): any {
  if (!schema) return null;

  // 處理 $ref
  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/', '').split('/');
    let resolved = openApiSpec;
    for (const part of refPath) {
      resolved = resolved?.[part];
    }
    return resolveSchemaRef(resolved, openApiSpec);
  }

  // 處理 allOf, oneOf, anyOf
  if (schema.allOf) {
    const merged = {};
    for (const subSchema of schema.allOf) {
      Object.assign(merged, resolveSchemaRef(subSchema, openApiSpec));
    }
    return merged;
  }

  return schema;
}
