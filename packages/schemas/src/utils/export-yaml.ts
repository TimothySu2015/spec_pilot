import YAML from 'yaml';
import { FlowDefinition } from '../flow-schema';

/**
 * 將 Flow 資料匯出為 YAML 格式
 *
 * @param flowData - Flow 定義資料
 * @returns YAML 字串
 */
export function exportToYaml(flowData: FlowDefinition): string {
  return YAML.stringify(flowData, {
    indent: 2,                      // 固定 2 空格縮排
    lineWidth: 0,                   // 不自動換行
    minContentWidth: 0,
    singleQuote: true,              // 統一使用單引號
    defaultStringType: 'QUOTE_SINGLE',
    defaultKeyType: 'PLAIN',
    nullStr: 'null',
    trueStr: 'true',
    falseStr: 'false',
  });
}
