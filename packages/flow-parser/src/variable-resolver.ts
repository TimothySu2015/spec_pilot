/**
 * 變數解析器 - 處理 {{variable}} 語法
 *
 * 支援功能：
 * 1. 從 Flow YAML 的 variables 區塊載入全域變數
 * 2. 從步驟 capture 註冊執行時變數
 * 3. 解析字串、物件、陣列中的 {{variable}} 引用
 * 4. 支援巢狀物件路徑（如 user.name, data[0].id）
 */

import { createStructuredLogger, type IStructuredLogger } from '@specpilot/shared';

/**
 * 變數解析器類別
 */
export class VariableResolver {
  private variables: Map<string, unknown> = new Map();
  private logger: IStructuredLogger;

  constructor(logger?: IStructuredLogger) {
    this.logger = logger || createStructuredLogger('variable-resolver');
  }

  /**
   * 載入全域變數
   */
  loadVariables(vars: Record<string, unknown>, executionId?: string): void {
    if (!vars || typeof vars !== 'object') {
      return;
    }

    Object.entries(vars).forEach(([key, value]) => {
      this.variables.set(key, value);
    });

    this.logger.debug('載入全域變數', {
      executionId,
      component: 'variable-resolver',
      variableCount: this.variables.size,
      variableNames: Array.from(this.variables.keys())
    });
  }

  /**
   * 註冊從步驟 capture 的變數
   */
  captureVariable(name: string, value: unknown, executionId?: string): void {
    this.variables.set(name, value);

    this.logger.debug('註冊 capture 變數', {
      executionId,
      component: 'variable-resolver',
      variableName: name,
      valueType: typeof value
    });
  }

  /**
   * 解析輸入中的變數引用
   * 支援字串、物件、陣列的遞迴解析
   */
  resolve(input: unknown, executionId?: string): unknown {
    if (typeof input === 'string') {
      return this.resolveString(input, executionId);
    } else if (Array.isArray(input)) {
      return input.map(item => this.resolve(item, executionId));
    } else if (input && typeof input === 'object') {
      const resolved: Record<string, unknown> = {};
      Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
        resolved[key] = this.resolve(value, executionId);
      });
      return resolved;
    }
    return input;
  }

  /**
   * 解析字串中的 {{variable}} 語法
   */
  private resolveString(str: string, executionId?: string): string | unknown {
    const pattern = /\{\{([^}]+)\}\}/g;

    // 檢查是否整個字串就是一個變數引用（如 "{{token}}"）
    const singleVarMatch = /^\{\{([^}]+)\}\}$/.exec(str);
    if (singleVarMatch) {
      const varName = singleVarMatch[1].trim();
      const value = this.variables.get(varName);

      if (value !== undefined) {
        this.logger.debug('解析單一變數', {
          executionId,
          component: 'variable-resolver',
          variableName: varName,
          valueType: typeof value
        });
        return value;
      } else {
        this.logger.warn('變數未定義', {
          executionId,
          component: 'variable-resolver',
          variableName: varName,
          availableVariables: Array.from(this.variables.keys())
        });
        return str; // 保持原樣
      }
    }

    // 替換字串中的多個變數（如 "User: {{username}}, Role: {{role}}"）
    let hasReplacement = false;
    const result = str.replace(pattern, (match, varName) => {
      const value = this.variables.get(varName.trim());
      if (value !== undefined) {
        hasReplacement = true;
        return String(value);
      }
      return match; // 保持原樣
    });

    if (hasReplacement) {
      this.logger.debug('解析字串中的變數', {
        executionId,
        component: 'variable-resolver',
        original: str,
        resolved: result
      });
    }

    return result;
  }

  /**
   * 從物件中根據路徑提取值
   * 支援點號分隔的路徑（如 "user.name", "data.users[0].id"）
   */
  extractValueByPath(data: unknown, path: string): unknown {
    if (!data || typeof path !== 'string' || path.trim() === '') {
      return undefined;
    }

    // 移除開頭的 $. 或 $.
    let normalizedPath = path.trim();
    if (normalizedPath.startsWith('$.')) {
      normalizedPath = normalizedPath.substring(2);
    } else if (normalizedPath.startsWith('$')) {
      normalizedPath = normalizedPath.substring(1);
    }

    // 分割路徑
    const parts = normalizedPath.split('.');
    let current: unknown = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // 處理陣列索引（如 users[0]）
      const arrayMatch = /^(\w+)\[(\d+)\]$/.exec(part);
      if (arrayMatch) {
        const [, key, indexStr] = arrayMatch;
        const index = parseInt(indexStr, 10);

        if (typeof current === 'object' && key in (current as Record<string, unknown>)) {
          const arrayValue = (current as Record<string, unknown>)[key];
          if (Array.isArray(arrayValue) && index >= 0 && index < arrayValue.length) {
            current = arrayValue[index];
          } else {
            return undefined;
          }
        } else {
          return undefined;
        }
      } else {
        // 普通屬性存取
        if (typeof current === 'object' && part in (current as Record<string, unknown>)) {
          current = (current as Record<string, unknown>)[part];
        } else {
          return undefined;
        }
      }
    }

    return current;
  }

  /**
   * 取得所有已註冊的變數名稱
   */
  getVariableNames(): string[] {
    return Array.from(this.variables.keys());
  }

  /**
   * 取得特定變數的值
   */
  getVariable(name: string): unknown {
    return this.variables.get(name);
  }

  /**
   * 清除所有變數
   */
  clear(): void {
    this.variables.clear();
    this.logger.debug('清除所有變數', {
      component: 'variable-resolver'
    });
  }

  /**
   * 取得變數數量
   */
  get size(): number {
    return this.variables.size;
  }
}