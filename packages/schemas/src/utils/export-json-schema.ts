import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';

/**
 * 將 Zod Schema 轉換為 JSON Schema
 *
 * @param schema - Zod Schema 物件
 * @param options - 轉換選項
 * @returns JSON Schema 物件
 */
export function exportToJsonSchema(
  schema: z.ZodType<any>,
  options?: {
    name?: string;
    $refStrategy?: 'root' | 'relative' | 'none';
  }
): object {
  return zodToJsonSchema(schema, {
    name: options?.name,
    $refStrategy: options?.$refStrategy ?? 'none',
    target: 'jsonSchema7',
  });
}
