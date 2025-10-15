/**
 * Flow Validator - 整合驗證器
 * 整合 Schema 驗證與語意驗證
 */

import type { FlowDefinition } from '@specpilot/flow-parser';
import type { FlowValidatorConfig, ValidationResult } from './types.js';
import { SchemaValidator } from './schema-validator.js';
import { SemanticValidator } from './semantic-validator.js';

export class FlowValidator {
  private schemaValidator: SchemaValidator;
  private semanticValidator: SemanticValidator;

  constructor(private config: FlowValidatorConfig) {
    this.schemaValidator = new SchemaValidator(config.schemaOptions);
    this.semanticValidator = new SemanticValidator(config.spec, config.semanticOptions);
  }

  /**
   * 執行完整驗證
   */
  validate(flow: FlowDefinition): ValidationResult {
    const errors = [];
    const warnings = [];

    // 1. Schema 驗證
    const schemaErrors = this.schemaValidator.validate(flow);
    errors.push(...schemaErrors);

    // 2. 步驟 ID 唯一性驗證
    const uniqueIdErrors = this.schemaValidator.validateUniqueStepIds(flow);
    errors.push(...uniqueIdErrors);

    // 3. 語意驗證（只在 Schema 驗證通過時執行）
    if (errors.length === 0) {
      const semanticResult = this.semanticValidator.validate(flow);
      errors.push(...semanticResult.errors);
      warnings.push(...semanticResult.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 快速驗證（僅 Schema）
   */
  quickValidate(flow: FlowDefinition): ValidationResult {
    const errors = this.schemaValidator.validate(flow);

    return {
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }
}
