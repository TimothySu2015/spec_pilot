/**
 * Schema Validator - Flow Schema 驗證器
 * 驗證 Flow 定義是否符合 Schema 規範
 */

import { FlowDefinitionSchema } from '@specpilot/schemas';
import type { FlowDefinition } from '@specpilot/flow-parser';
import type { ValidationError, SchemaValidationOptions } from './types.js';

export class SchemaValidator {
  constructor(private options: SchemaValidationOptions = {}) {}

  /**
   * 驗證 Flow 定義符合 Schema（使用 @specpilot/schemas）
   */
  validate(flow: FlowDefinition): ValidationError[] {
    const errors: ValidationError[] = [];

    // 使用 Zod schema 驗證
    const result = FlowDefinitionSchema.safeParse(flow);

    if (!result.success) {
      result.error.errors.forEach((error) => {
        errors.push({
          type: 'schema',
          message: error.message,
          path: error.path.join('.') || '<root>',
        });
      });
    }

    return errors;
  }

  /**
   * 驗證步驟名稱唯一性（可選）
   */
  validateUniqueStepIds(flow: FlowDefinition): ValidationError[] {
    // @specpilot/schemas 不要求步驟有 id，所以這個驗證不再需要
    // 可以改為驗證步驟名稱唯一性
    const errors: ValidationError[] = [];
    const seenNames = new Set<string>();

    flow.steps.forEach((step, index) => {
      if (seenNames.has(step.name)) {
        errors.push({
          type: 'schema',
          message: `重複的步驟名稱: ${step.name}`,
          path: `steps[${index}].name`,
        });
      }
      seenNames.add(step.name);
    });

    return errors;
  }
}
