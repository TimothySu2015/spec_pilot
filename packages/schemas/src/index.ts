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
  type ITokenExtraction,
  type IStepAuth,
  type IGlobalAuth,
  type IStaticAuthItem,
} from './auth-schema';

// Globals Schema
export {
  HeadersSchema,
  RetryPolicySchema,
  GlobalsSchema,
  type IRetryPolicy,
  type IGlobals,
} from './globals-schema';

// Flow Schema
export {
  VariablesSchema,
  FlowOptionsSchema,
  ReportingOptionsSchema,
  FlowDefinitionSchema,
  HTTPMethodSchema,
  type IFlowDefinition,
  type HTTPMethod,
} from './flow-schema';

// Step Schema
export {
  RequestBodySchema,
  FlowRequestSchema,
  ExpectBodyFieldSchema,
  FlowExpectSchema,
  CaptureSchema,
  FlowStepSchema,
  type IFlowStep,
  type IFlowRequest,
  type IFlowExpect,
  type IExpectBodyField,
  type ICapture,
  type ICaptureVariable,
} from './step-schema';

// Validation Schema
export {
  NotNullRuleSchema,
  RegexRuleSchema,
  ContainsRuleSchema,
  ValidationRuleSchema,
  type IValidationRule,
  type INotNullRule,
  type IRegexRule,
  type IContainsRule,
} from './validation-schema';

// 實用函式
export { exportToYaml } from './utils/export-yaml';
export { exportToJsonSchema } from './utils/export-json-schema';
export { VariableResolver } from './utils/variable-resolver';
