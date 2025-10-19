/**
 * NLP Flow Parser - 自然語言解析器
 * 解析使用者輸入，識別測試意圖
 */

import type { ParsedIntent, ConversationContext, NLPParserConfig } from './types.js';

export class NLPFlowParser {
  constructor(private config: NLPParserConfig) {}

  /**
   * 解析使用者輸入，識別測試意圖
   */
  async parse(userInput: string, context?: ConversationContext): Promise<ParsedIntent> {
    const normalizedInput = userInput.trim();

    // 1. 意圖分類
    const action = this.classifyIntent(normalizedInput, context);

    // 2. 關鍵字提取
    const keywords = this.extractKeywords(normalizedInput);

    // 3. 實體提取
    const entities: ParsedIntent['entities'] = {};

    // 提取 HTTP Method
    const method = this.identifyHttpMethod(normalizedInput);
    if (method) {
      entities.method = method;
    }

    // 提取端點資訊
    const endpoint = this.extractEndpoint(normalizedInput, keywords);
    if (endpoint) {
      entities.endpoint = endpoint;
    }

    // 提取參數
    const parameters = this.extractParameters(normalizedInput, keywords);
    if (Object.keys(parameters).length > 0) {
      entities.parameters = parameters;
    }

    // 提取驗證規則
    const validations = this.extractValidations(normalizedInput);
    if (validations.length > 0) {
      entities.validations = validations;
    }

    // 4. 計算信心度
    const confidence = this.calculateConfidence(action, entities, keywords);

    return {
      action,
      entities,
      confidence,
    };
  }

  /**
   * 意圖分類
   */
  private classifyIntent(text: string, context?: ConversationContext): ParsedIntent['action'] {
    const lowerText = text.toLowerCase();

    // 如果有上下文且已有 Flow，則傾向於是「新增步驟」
    const hasExistingFlow = context?.currentFlow?.steps && context.currentFlow.steps.length > 0;

    // 檢查是否為「新增驗證」意圖
    if (lowerText.includes('驗證') || lowerText.includes('檢查') || lowerText.includes('確認')) {
      if (lowerText.includes('新增') || lowerText.includes('加入')) {
        return 'add_validation';
      }
    }

    // 檢查是否為「修改步驟」意圖
    if (lowerText.includes('修改') || lowerText.includes('更新') || lowerText.includes('改')) {
      if (hasExistingFlow) {
        return 'modify_step';
      }
    }

    // 檢查是否為「新增步驟」意圖
    if (hasExistingFlow && (lowerText.includes('再') || lowerText.includes('然後') || lowerText.includes('接著'))) {
      return 'add_step';
    }

    // 檢查是否明確要求「建立 Flow」
    if (lowerText.includes('建立') || lowerText.includes('新的') || lowerText.includes('開始')) {
      return 'create_flow';
    }

    // 預設：如果有上下文則為新增步驟，否則建立新 Flow
    return hasExistingFlow ? 'add_step' : 'create_flow';
  }

  /**
   * 提取關鍵字
   */
  private extractKeywords(text: string): string[] {
    // 提取中文詞彙和英文單字
    const allKeywords = text.toLowerCase().match(/[\u4e00-\u9fa5a-z]+/g) || [];

    // 將複合詞拆分（例如：「建立訂單」-> [「建立」, 「訂單」, 「建立訂單」]）
    const expandedKeywords: string[] = [];
    for (const keyword of allKeywords) {
      expandedKeywords.push(keyword);

      // 對於中文詞彙，嘗試拆分成2字詞
      if (/[\u4e00-\u9fa5]/.test(keyword) && keyword.length > 2) {
        for (let i = 0; i < keyword.length - 1; i++) {
          expandedKeywords.push(keyword.slice(i, i + 2));
        }
      }
    }

    return expandedKeywords;
  }

  /**
   * 識別 HTTP Method
   */
  private identifyHttpMethod(text: string): ParsedIntent['entities']['method'] | undefined {
    const methodMap: Record<string, ParsedIntent['entities']['method']> = {
      登入: 'POST',
      註冊: 'POST',
      建立: 'POST',
      新增: 'POST',
      創建: 'POST',
      查詢: 'GET',
      取得: 'GET',
      獲取: 'GET',
      讀取: 'GET',
      更新: 'PUT',
      修改: 'PATCH',
      編輯: 'PATCH',
      刪除: 'DELETE',
      移除: 'DELETE',
    };

    // 優先匹配完整詞彙，避免部分匹配
    const keywords = Object.keys(methodMap).sort((a, b) => b.length - a.length);

    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return methodMap[keyword];
      }
    }

    return undefined;
  }

  /**
   * 提取端點資訊
   */
  private extractEndpoint(text: string, keywords: string[]): string | undefined {
    // 尋找可能的資源名稱
    const resourcePatterns = [
      /測試\s*([^\s，。]+)/,        // "測試 XXX"
      /([^\s，。]+)\s+API/,          // "XXX API" (注意：非貪婪匹配)
      /([^\s，。]+)\s*端點/,         // "XXX 端點"
      /([^\s，。]+)\s*功能/,         // "XXX 功能"
    ];

    for (const pattern of resourcePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const matched = match[1].trim();
        // 移除可能的動詞前綴
        const cleanedMatch = matched.replace(/^(呼叫|建立|新增|查詢|取得|更新|修改|刪除)\s*/, '');
        if (cleanedMatch) {
          return cleanedMatch;
        }
      }
    }

    // 從關鍵字中找出可能的資源名稱
    // 排除動詞和常見詞彙
    const excludeWords = new Set(['測試', '建立', '新增', '查詢', '取得', '更新', '修改', '刪除', 'api', '端點', '功能', '驗證', '檢查', '呼叫']);

    for (const keyword of keywords) {
      if (!excludeWords.has(keyword) && keyword.length >= 2) {
        return keyword;
      }
    }

    return undefined;
  }

  /**
   * 提取參數
   */
  private extractParameters(text: string, _keywords: string[]): Record<string, unknown> {
    const parameters: Record<string, unknown> = {};

    // 尋找 key-value 模式
    // 例如: "username 是 testuser", "email: test@example.com"
    const kvPatterns = [
      /(\w+)\s*[:：]\s*([^\s，。,:]+)/g,        // "key: value" (修正：排除逗號)
      /(\w+)\s*[是为]\s*([^\s，。,:]+)/g,      // "key 是 value"
      /(\w+)\s*=\s*([^\s，。,:]+)/g,           // "key = value"
    ];

    for (const pattern of kvPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const [, key, value] = match;
        if (key && value) {
          // 清理 value (移除可能的標點符號)
          const cleanValue = value.trim().replace(/[,，。]$/, '');
          // 嘗試轉換數字
          const numValue = parseFloat(cleanValue);
          parameters[key] = isNaN(numValue) ? cleanValue : numValue;
        }
      }
    }

    return parameters;
  }

  /**
   * 提取驗證規則
   */
  private extractValidations(text: string): Array<{ field: string; rule: string; value?: unknown }> {
    const validations: Array<{ field: string; rule: string; value?: unknown }> = [];

    // 驗證規則模式
    const validationPatterns = [
      { pattern: /(\w+)\s*不能[為为]?\s*空/, rule: 'notNull' },
      { pattern: /(\w+)\s*必須/, rule: 'notNull' },
      { pattern: /驗證\s*(\w+)/, rule: 'notNull' },
      { pattern: /(\w+)\s*格式/, rule: 'regex' },
      { pattern: /(\w+)\s*應該\s*包含\s*([^\s，。]+)/, rule: 'contains' },
    ];

    for (const { pattern, rule } of validationPatterns) {
      const match = text.match(pattern);
      if (match) {
        const field = match[1];
        const value = match[2]; // 可能存在
        validations.push({
          field,
          rule,
          value: value || undefined,
        });
      }
    }

    return validations;
  }

  /**
   * 計算信心度
   */
  private calculateConfidence(
    action: ParsedIntent['action'],
    entities: ParsedIntent['entities'],
    keywords: string[]
  ): number {
    let confidence = 0.5; // 基礎信心度

    // 有明確的 HTTP method -> +0.2
    if (entities.method) {
      confidence += 0.2;
    }

    // 有端點資訊 -> +0.2
    if (entities.endpoint) {
      confidence += 0.2;
    }

    // 有參數 -> +0.1
    if (entities.parameters && Object.keys(entities.parameters).length > 0) {
      confidence += 0.1;
    }

    // 有驗證規則 -> +0.1
    if (entities.validations && entities.validations.length > 0) {
      confidence += 0.1;
    }

    // 關鍵字數量適中 -> +0.1
    if (keywords.length >= 3 && keywords.length <= 10) {
      confidence += 0.1;
    }

    // 如果是 create_flow 但缺少基本資訊 -> -0.2
    if (action === 'create_flow' && !entities.endpoint && !entities.method) {
      confidence -= 0.2;
    }

    // 確保在 0-1 範圍內
    return Math.max(0, Math.min(1, confidence));
  }
}
