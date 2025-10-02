/**
 * 變數解析結果
 */
export interface VariableResolutionResult {
  resolved: unknown;
  warnings: {
    path: string;
    variable: string;
    message: string;
  }[];
}

/**
 * 變數插值解析器
 *
 * 負責將 Flow 資料中的 {{variable}} 語法替換為實際值
 */
export class VariableResolver {
  /**
   * 解析 Flow 資料中的所有變數插值
   *
   * @param flowData - 原始 Flow 資料
   * @param variables - 變數定義表
   * @returns 解析後的 Flow 資料
   */
  resolve(flowData: unknown, variables: Record<string, any>): unknown {
    return this.traverseAndResolve(flowData, variables, []);
  }

  /**
   * 解析並收集警告訊息
   *
   * @param flowData - 原始 Flow 資料
   * @param variables - 變數定義表
   * @returns 解析結果與警告列表
   */
  resolveWithValidation(
    flowData: unknown,
    variables: Record<string, any>
  ): VariableResolutionResult {
    const warnings: VariableResolutionResult['warnings'] = [];
    const resolved = this.traverseAndResolve(flowData, variables, [], warnings);
    return { resolved, warnings };
  }

  /**
   * 遞迴遍歷並解析變數
   */
  private traverseAndResolve(
    value: any,
    variables: Record<string, any>,
    path: string[] = [],
    warnings?: VariableResolutionResult['warnings']
  ): any {
    // 處理字串變數插值
    if (typeof value === 'string') {
      return this.resolveString(value, variables, path.join('.'), warnings);
    }

    // 遞迴處理陣列
    if (Array.isArray(value)) {
      return value.map((item, index) =>
        this.traverseAndResolve(item, variables, [...path, `[${index}]`], warnings)
      );
    }

    // 遞迴處理物件
    if (typeof value === 'object' && value !== null) {
      const resolved: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        resolved[key] = this.traverseAndResolve(val, variables, [...path, key], warnings);
      }
      return resolved;
    }

    return value;
  }

  /**
   * 解析字串中的變數插值
   *
   * 支援格式: {{variableName}}
   */
  private resolveString(
    str: string,
    variables: Record<string, any>,
    currentPath: string,
    warnings?: VariableResolutionResult['warnings']
  ): string {
    return str.replace(/{{([^}]+)}}/g, (match, varName) => {
      const trimmedName = varName.trim();

      if (trimmedName in variables) {
        return String(variables[trimmedName]);
      }

      // 未定義的變數 - 記錄警告
      if (warnings) {
        warnings.push({
          path: currentPath,
          variable: trimmedName,
          message: `變數 "${trimmedName}" 未定義`,
        });
      }

      // 保留原樣
      return match;
    });
  }
}
