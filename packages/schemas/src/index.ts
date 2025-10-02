/**
 * @specpilot/schemas
 *
 * SpecPilot 共用 Zod Schema 定義套件
 * 提供 Flow YAML 結構驗證與型別定義
 */

// Flow Schema
export {
  HTTPMethodSchema,
  VariablesSchema,
  FlowOptionsSchema,
  ReportingOptionsSchema,
  FlowDefinitionSchema,
  type IFlowDefinition,
  type HTTPMethod,
} from './flow-schema';

// Step Schema
export {
  HeadersSchema,
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

// 工具函式
export { exportToYaml } from './utils/export-yaml';
export { exportToJsonSchema } from './utils/export-json-schema';
export { VariableResolver } from './utils/variable-resolver';
