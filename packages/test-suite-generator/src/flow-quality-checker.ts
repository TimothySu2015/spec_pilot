/**
 * Flow Quality Checker - Flow 品質檢查器
 * 檢查產生的測試套件的合理性並提供改進建議
 */

import type { FlowDefinition, FlowStep } from '@specpilot/flow-parser';
import type { OpenAPIDocument } from '@specpilot/spec-loader';

export interface QualityIssue {
  /** 問題嚴重程度 */
  severity: 'error' | 'warning' | 'info';
  /** 問題類型 */
  type:
    | 'invalid_status_code'      // 狀態碼與規格不符
    | 'poor_test_data'           // 測試資料品質差
    | 'duplicate_name'           // 步驟名稱重複
    | 'missing_auth'             // 缺少認證
    | 'invalid_path_param'       // 路徑參數未處理
    | 'wrong_capture_field'      // 錯誤的 capture 欄位
    | 'missing_required_field';  // 缺少必填欄位
  /** 問題位置 */
  location: string;
  /** 問題描述 */
  message: string;
  /** 建議修正方式 */
  suggestion: string;
  /** 相關步驟索引 */
  stepIndex?: number;
}

export interface QualityReport {
  /** 總問題數 */
  totalIssues: number;
  /** 錯誤數 */
  errors: number;
  /** 警告數 */
  warnings: number;
  /** 資訊數 */
  infos: number;
  /** 問題清單 */
  issues: QualityIssue[];
  /** 整體評分 (0-100) */
  score: number;
}

export interface FixSuggestion {
  /** 步驟索引 */
  stepIndex: number;
  /** 要修正的欄位路徑 */
  fieldPath: string;
  /** 當前值 */
  currentValue: unknown;
  /** 建議值 */
  suggestedValue: unknown;
  /** 修正原因 */
  reason: string;
}

export class FlowQualityChecker {
  constructor(
    private spec: OpenAPIDocument,
    private flow: FlowDefinition
  ) {}

  /**
   * 執行品質檢查
   */
  check(): QualityReport {
    const issues: QualityIssue[] = [];

    // 1. 檢查狀態碼
    issues.push(...this.checkStatusCodes());

    // 2. 檢查測試資料品質
    issues.push(...this.checkTestDataQuality());

    // 3. 檢查步驟名稱
    issues.push(...this.checkStepNames());

    // 4. 檢查認證流程
    issues.push(...this.checkAuthFlow());

    // 5. 檢查路徑參數
    issues.push(...this.checkPathParameters());

    // 6. 檢查 capture 設定
    issues.push(...this.checkCaptureFields());

    // 計算統計
    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    const infos = issues.filter(i => i.severity === 'info').length;

    // 計算評分 (每個 error -10分, warning -5分, info -2分)
    const score = Math.max(0, 100 - (errors * 10 + warnings * 5 + infos * 2));

    return {
      totalIssues: issues.length,
      errors,
      warnings,
      infos,
      issues,
      score,
    };
  }

  /**
   * 檢查狀態碼是否符合 OpenAPI 規格
   */
  private checkStatusCodes(): QualityIssue[] {
    const issues: QualityIssue[] = [];

    this.flow.steps.forEach((step, index) => {
      const expectedStatus = (step as any).expect?.statusCode;
      if (!expectedStatus) return;

      // 從步驟名稱或路徑推斷端點
      const method = step.request.method;
      const path = step.request.path;

      if (!path) return;

      // 查找對應的 OpenAPI 端點
      const pathItem = this.spec.paths?.[this.normalizePathForLookup(path)];
      if (!pathItem) return;

      const operation = (pathItem as any)[method.toLowerCase()];
      if (!operation?.responses) return;

      // 檢查是否為成功案例
      const isSuccessCase = step.name.includes('成功');

      if (isSuccessCase) {
        // 找到規格中定義的成功狀態碼
        const validSuccessCodes = Object.keys(operation.responses)
          .filter(code => code.startsWith('2'))
          .map(code => parseInt(code));

        if (!validSuccessCodes.includes(expectedStatus)) {
          issues.push({
            severity: 'error',
            type: 'invalid_status_code',
            location: `steps[${index}].expect.statusCode`,
            message: `預期狀態碼 ${expectedStatus} 與 OpenAPI 規格不符`,
            suggestion: `應該使用 ${validSuccessCodes.join(' 或 ')}`,
            stepIndex: index,
          });
        }
      }
    });

    return issues;
  }

  /**
   * 檢查測試資料品質
   */
  private checkTestDataQuality(): QualityIssue[] {
    const issues: QualityIssue[] = [];

    this.flow.steps.forEach((step, index) => {
      const body = step.request.body as Record<string, unknown>;
      if (!body || typeof body !== 'object') return;

      for (const [key, value] of Object.entries(body)) {
        // 檢查是否為過於簡單的測試資料
        if (typeof value === 'string' && value.length === 1) {
          issues.push({
            severity: 'warning',
            type: 'poor_test_data',
            location: `steps[${index}].request.body.${key}`,
            message: `測試資料 "${value}" 過於簡單`,
            suggestion: `建議使用更真實的測試資料,例如 "testUser", "test@example.com" 等`,
            stepIndex: index,
          });
        }

        // 檢查 email 格式
        if (key.toLowerCase().includes('email') && typeof value === 'string') {
          if (value === 'invalid-email') {
            // 這是故意的無效測試,跳過
            continue;
          }
          if (!value.includes('@') || value.length < 5) {
            issues.push({
              severity: 'warning',
              type: 'poor_test_data',
              location: `steps[${index}].request.body.${key}`,
              message: `Email 格式可能不正確: "${value}"`,
              suggestion: `建議使用 "user@example.com" 格式`,
              stepIndex: index,
            });
          }
        }

        // 檢查 username/password
        if ((key === 'username' || key === 'password') && typeof value === 'string' && value.length < 3) {
          issues.push({
            severity: 'warning',
            type: 'poor_test_data',
            location: `steps[${index}].request.body.${key}`,
            message: `${key} "${value}" 過短`,
            suggestion: key === 'username' ? `建議使用 "testuser" 或 "admin"` : `建議使用 "password123" 或 "test1234"`,
            stepIndex: index,
          });
        }
      }
    });

    return issues;
  }

  /**
   * 檢查步驟名稱
   */
  private checkStepNames(): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const seenNames = new Set<string>();

    this.flow.steps.forEach((step, index) => {
      // 檢查重複名稱
      if (seenNames.has(step.name)) {
        issues.push({
          severity: 'warning',
          type: 'duplicate_name',
          location: `steps[${index}].name`,
          message: `步驟名稱重複: "${step.name}"`,
          suggestion: `每個步驟應該有唯一的名稱`,
          stepIndex: index,
        });
      }
      seenNames.add(step.name);

      // 檢查名稱中的重複文字 (例如: "建立建立新使用者")
      const words = step.name.split(/[\s-]/);
      const duplicates = words.filter((word, i) => i > 0 && word === words[i - 1]);

      if (duplicates.length > 0) {
        issues.push({
          severity: 'warning',
          type: 'duplicate_name',
          location: `steps[${index}].name`,
          message: `步驟名稱包含重複文字: "${step.name}"`,
          suggestion: `移除重複的 "${duplicates[0]}"`,
          stepIndex: index,
        });
      }
    });

    return issues;
  }

  /**
   * 檢查認證流程
   */
  private checkAuthFlow(): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // 檢查是否有需要認證的端點
    const hasSecureEndpoints = this.flow.steps.some(step => {
      const path = step.request.path;
      if (!path) return false;

      const pathItem = this.spec.paths?.[this.normalizePathForLookup(path)];
      if (!pathItem) return false;

      const operation = (pathItem as any)[step.request.method.toLowerCase()];
      return operation?.security && operation.security.length > 0;
    });

    // 檢查是否有登入步驟
    const hasLoginStep = this.flow.steps.some(step =>
      step.request.path?.includes('/login') ||
      step.request.path?.includes('/auth')
    );

    if (hasSecureEndpoints && !hasLoginStep && !this.flow.globals?.auth) {
      issues.push({
        severity: 'error',
        type: 'missing_auth',
        location: 'flow',
        message: `Flow 包含需要認證的端點,但缺少登入步驟或全域認證設定`,
        suggestion: `建議在測試開始前加入登入步驟,並使用 capture 提取 token`,
      });
    }

    return issues;
  }

  /**
   * 檢查路徑參數
   */
  private checkPathParameters(): QualityIssue[] {
    const issues: QualityIssue[] = [];

    this.flow.steps.forEach((step, index) => {
      const path = step.request.path;
      if (!path) return;

      // 檢查是否包含未替換的路徑參數 {id}
      const hasUnresolvedParams = path.includes('{') && !path.includes('{{');

      if (hasUnresolvedParams) {
        // 檢查前面是否有 capture 步驟
        const hasPreviousCapture = this.flow.steps
          .slice(0, index)
          .some(s => (s as any).capture);

        if (!hasPreviousCapture) {
          issues.push({
            severity: 'error',
            type: 'invalid_path_param',
            location: `steps[${index}].request.path`,
            message: `路徑包含未處理的參數: "${path}"`,
            suggestion: `應該使用具體值 (如 /api/users/1) 或變數 (如 /api/users/{{userId}})`,
            stepIndex: index,
          });
        }
      }
    });

    return issues;
  }

  /**
   * 檢查 capture 欄位設定
   */
  private checkCaptureFields(): QualityIssue[] {
    const issues: QualityIssue[] = [];

    this.flow.steps.forEach((step, index) => {
      const captures = (step as any).capture as Array<{ variableName: string; path: string }>;
      if (!captures || captures.length === 0) return;

      const path = step.request.path;

      // 檢查登入端點
      if (path?.includes('/login') || path?.includes('/auth')) {
        const hasTokenCapture = captures.some(c =>
          c.variableName.toLowerCase().includes('token') ||
          c.path.toLowerCase().includes('token')
        );

        if (!hasTokenCapture) {
          issues.push({
            severity: 'warning',
            type: 'wrong_capture_field',
            location: `steps[${index}].capture`,
            message: `登入端點應該 capture token,而不是 ${captures.map(c => c.variableName).join(', ')}`,
            suggestion: `建議使用 { variableName: "authToken", path: "token" }`,
            stepIndex: index,
          });
        }
      }

      // 檢查資源建立端點
      if (step.request.method === 'POST' && !path?.includes('/login')) {
        const hasIdCapture = captures.some(c =>
          c.path === 'id' || c.path.endsWith('.id')
        );

        if (!hasIdCapture) {
          issues.push({
            severity: 'info',
            type: 'wrong_capture_field',
            location: `steps[${index}].capture`,
            message: `建立資源的端點通常應該 capture id`,
            suggestion: `建議確認 capture 的欄位 "${captures[0].path}" 是否正確`,
            stepIndex: index,
          });
        }
      }
    });

    return issues;
  }

  /**
   * 產生修正建議
   */
  generateFixSuggestions(report: QualityReport): FixSuggestion[] {
    const suggestions: FixSuggestion[] = [];

    for (const issue of report.issues) {
      if (issue.stepIndex === undefined) continue;

      const step = this.flow.steps[issue.stepIndex];

      switch (issue.type) {
        case 'invalid_status_code': {
          const match = issue.suggestion.match(/應該使用 (\d+)/);
          if (match) {
            suggestions.push({
              stepIndex: issue.stepIndex,
              fieldPath: 'expect.statusCode',
              currentValue: (step as any).expect?.statusCode,
              suggestedValue: parseInt(match[1]),
              reason: issue.message,
            });
          }
          break;
        }

        case 'poor_test_data': {
          const fieldMatch = issue.location.match(/\.body\.(\w+)$/);
          if (fieldMatch) {
            const field = fieldMatch[1];
            const body = step.request.body as Record<string, unknown>;

            let suggestedValue: unknown;
            if (field === 'username') suggestedValue = 'testuser';
            else if (field === 'password') suggestedValue = 'password123';
            else if (field === 'name') suggestedValue = '測試使用者';
            else if (field.toLowerCase().includes('email')) suggestedValue = 'test@example.com';

            if (suggestedValue) {
              suggestions.push({
                stepIndex: issue.stepIndex,
                fieldPath: `request.body.${field}`,
                currentValue: body[field],
                suggestedValue,
                reason: issue.message,
              });
            }
          }
          break;
        }

        case 'duplicate_name': {
          if (issue.message.includes('重複文字')) {
            // 移除重複文字
            const cleanName = step.name.replace(/(\S+)\s+\1/, '$1');
            suggestions.push({
              stepIndex: issue.stepIndex,
              fieldPath: 'name',
              currentValue: step.name,
              suggestedValue: cleanName,
              reason: issue.message,
            });
          }
          break;
        }
      }
    }

    return suggestions;
  }

  /**
   * 正規化路徑用於查找 (移除變數部分)
   */
  private normalizePathForLookup(path: string): string {
    // /api/users/{{userId}} -> /api/users/{id}
    // /api/users/1 -> /api/users/{id}
    return path.replace(/\/\{\{[^}]+\}\}/g, '/{id}')
               .replace(/\/\d+/g, '/{id}');
  }
}
