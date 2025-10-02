import { IFlowDefinition, exportToYaml, exportToJsonSchema, FlowDefinitionSchema } from '@specpilot/schemas';

/**
 * 匯出 Flow YAML 檔案
 */
export function exportFlowYaml(flowData: IFlowDefinition) {
  const yaml = exportToYaml(flowData);
  const blob = new Blob([yaml], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${flowData.name || 'flow'}.yaml`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 匯出 JSON Schema 檔案
 */
export function exportJsonSchema(flowData: IFlowDefinition) {
  const schema = exportToJsonSchema(FlowDefinitionSchema, {
    name: 'FlowDefinition',
  });
  const json = JSON.stringify(schema, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${flowData.name || 'flow'}.schema.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 匯出兩個檔案 (YAML + JSON Schema)
 */
export function exportBoth(flowData: IFlowDefinition) {
  exportFlowYaml(flowData);
  setTimeout(() => {
    exportJsonSchema(flowData);
  }, 500);
}
