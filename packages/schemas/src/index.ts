/**
 * @specpilot/schemas
 *
 * SpecPilot 統一 Zod Schema 定義與工具
 * 提供 Flow YAML 建模與驗證能力
 */

// Auth Schema
export {
  TokenExtractionSchema,
  LoginAuthSchema,
  BearerAuthSchema,
  StaticAuthItemSchema,
  StepAuthSchema,
  GlobalAuthSchema,
  type TokenExtraction,
  type StepAuth,
  type GlobalAuth,
  type StaticAuthItem,
} from './auth-schema';

// Globals Schema
export {
  HeadersSchema,
  RetryPolicySchema,
  GlobalsSchema,
  type RetryPolicy,
  type Globals,
} from './globals-schema';

// Flow Schema
export {
  VariablesSchema,
  FlowOptionsSchema,
  ReportingOptionsSchema,
  FlowDefinitionSchema,
  HTTPMethodSchema,
  type FlowDefinition,
  type HTTPMethod,
} from './flow-schema';

// Step Schema
export {
  RequestBodySchema,
  FlowRequestSchema,
  ExpectBodyFieldSchema,
  ExpectBodySchema,
  FlowExpectSchema,
  CaptureSchema,
  FlowStepSchema,
  type FlowStep,
  type FlowRequest,
  type FlowExpect,
  type ExpectBodyField,
  type Capture,
  type CaptureVariable,
} from './step-schema';

// Validation Schema
export {
  NotNullRuleSchema,
  RegexRuleSchema,
  ContainsRuleSchema,
  ValidationRuleSchema,
  type ValidationRule,
  type NotNullRule,
  type RegexRule,
  type ContainsRule,
} from './validation-schema';

// Custom Rules Schema (NEW - Phase 10)
export {
  CustomRuleSchema,
  NotNullRuleSchema as CustomNotNullRuleSchema,
  RegexRuleSchema as CustomRegexRuleSchema,
  ContainsRuleSchema as CustomContainsRuleSchema,
  EqualsRuleSchema,
  NotContainsRuleSchema,
  GreaterThanRuleSchema,
  LessThanRuleSchema,
  LengthRuleSchema,
  AVAILABLE_RULES,
  RULE_DESCRIPTIONS,
  type CustomRule,
  type NotNullRule as CustomNotNullRule,
  type RegexRule as CustomRegexRule,
  type ContainsRule as CustomContainsRule,
  type EqualsRule,
  type NotContainsRule,
  type GreaterThanRule,
  type LessThanRule,
  type LengthRule,
  type RuleName,
} from './custom-rules';

// 實用函式
export { exportToYaml } from './utils/export-yaml';
export { exportToJsonSchema } from './utils/export-json-schema';
export { VariableResolver } from './utils/variable-resolver';
