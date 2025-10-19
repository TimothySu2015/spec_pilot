/**
 * NLP Flow Parser - 自然語言解析器
 * 解析使用者輸入，識別測試意圖
 *
 * ⚠️ 使用場景說明：
 *
 * - **MCP Server 不使用此模組**：
 *   新版 MCP Server (apps/mcp-server/src/index.ts) 不需要 NLP 解析，
 *   因為 AI (Claude) 會直接提供結構化參數給 TestSuiteGenerator。
 *
 * - **為未來 CLI 介面保留**：
 *   此模組主要為未來的 CLI 介面預留功能，當使用者透過命令列輸入自然語言時，
 *   CLI 需要 NLP 解析器來理解使用者意圖並產生測試流程。
 *
 * - **Legacy MCP Handler**：
 *   apps/mcp-server/src/legacy/handlers/generate-flow.ts 中仍使用此模組，
 *   但該 handler 已被標記為 deprecated，僅作為參考實作保留。
 *
 * 如需調整此模組，請參考 packages/flow-generator/CLAUDE.md 中的
 * 「架構決策：MCP 與 NLP 的分離」章節。
 */

import type { ParsedIntent, ConversationContext, NLPParserConfig } from './types.js';
import { ChineseTokenizer, STOP_WORDS } from './utils/chinese-tokenizer.js';

export class NLPFlowParser {
  private tokenizer: ChineseTokenizer;

  constructor(private config: NLPParserConfig) {
    this.tokenizer = new ChineseTokenizer();
  }

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
   * 提取關鍵字（使用中文分詞器 + 停用詞過濾）
   */
  private extractKeywords(text: string): string[] {
    // 使用分詞器進行分詞並過濾停用詞
    const tokens = this.tokenizer.cutWithStopWords(text, STOP_WORDS);

    // 過濾長度 < 2 的單字（除了特殊英文縮寫）
    const validTokens = tokens.filter(token => {
      // 保留 2 字以上的詞
      if (token.length >= 2) return true;

      // 保留特殊單字母（如 HTTP Method 可能被提取為單字）
      if (/^[A-Z]$/.test(token)) return true;

      return false;
    });

    return validTokens;
  }

  /**
   * 識別 HTTP Method（支援英文 + 中文動詞）
   */
  private identifyHttpMethod(text: string): ParsedIntent['entities']['method'] | undefined {
    // 1. 優先匹配英文 HTTP Method（不區分大小寫）
    const httpMethodPattern = /\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/i;
    const httpMatch = text.match(httpMethodPattern);
    if (httpMatch) {
      return httpMatch[1].toUpperCase() as ParsedIntent['entities']['method'];
    }

    // 2. 匹配中文動詞
    const methodMap: Record<string, ParsedIntent['entities']['method']> = {
      登入: 'POST',
      登出: 'POST',
      註冊: 'POST',
      建立: 'POST',
      新增: 'POST',
      創建: 'POST',
      上傳: 'POST',
      查詢: 'GET',
      取得: 'GET',
      獲取: 'GET',
      讀取: 'GET',
      下載: 'GET',
      更新: 'PUT',
      修改: 'PATCH',
      編輯: 'PATCH',
      刪除: 'DELETE',
      移除: 'DELETE',
    };

    // 優先匹配較長的詞彙，避免部分匹配
    const keywords = Object.keys(methodMap).sort((a, b) => b.length - a.length);

    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return methodMap[keyword];
      }
    }

    return undefined;
  }

  /**
   * 提取端點資訊（支援 URL 路徑 + 資源名稱）
   */
  private extractEndpoint(text: string, keywords: string[]): string | undefined {
    // 1. 優先識別 URL 路徑（如 /users/{id}, /api/v1/products）
    // 先檢查是否有完整 URL（http://example.com/api/users）
    const fullUrlMatch = text.match(/https?:\/\/[^\/\s]+(\/.+?)(?:\s|$|[，。！？])/);
    if (fullUrlMatch && fullUrlMatch[1]) {
      return fullUrlMatch[1].trim();
    }

    // 檢查路徑（/users, /api/v1/users, /users/{id}）
    const pathMatch = text.match(/\/[\w\-\/{}]+/);
    if (pathMatch) {
      return pathMatch[0];
    }

    // 2. 識別資源名稱（從模式中提取）
    const resourcePatterns = [
      /測試\s*([^\s，。]+)/,              // "測試 XXX"
      /([^\s，。]+)\s+API/i,               // "XXX API"
      /([^\s，。]+)\s*端點/,               // "XXX 端點"
      /([^\s，。]+)\s*功能/,               // "XXX 功能"
      /呼叫\s*([^\s，。]+)/,               // "呼叫 XXX"
      /([^\s，。]+)\s*介面/,               // "XXX 介面"
      /([^\s，。]+)\s*服務/,               // "XXX 服務"
      /([^\s，。]+)\s*資源/,               // "XXX 資源"
      /操作\s*([^\s，。]+)/,               // "操作 XXX"
      /管理\s*([^\s，。]+)/,               // "管理 XXX"
    ];

    for (const pattern of resourcePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const matched = match[1].trim();
        // 移除可能的動詞前綴
        const cleanedMatch = matched.replace(/^(呼叫|建立|新增|查詢|取得|更新|修改|刪除|上傳|下載)\s*/, '');
        if (cleanedMatch) {
          return cleanedMatch;
        }
      }
    }

    // 3. 從關鍵字中找出可能的資源名稱
    // 排除動詞和常見詞彙
    const excludeWords = new Set([
      '測試', '建立', '新增', '查詢', '取得', '更新', '修改', '刪除',
      '上傳', '下載', 'api', '端點', '功能', '驗證', '檢查', '呼叫',
      '流程', '步驟', '執行', '運行', '登入', '註冊', '登出',
    ]);

    for (const keyword of keywords) {
      if (!excludeWords.has(keyword.toLowerCase()) && keyword.length >= 2) {
        return keyword;
      }
    }

    return undefined;
  }

  /**
   * 提取參數（支援多種型別：字串、數字、布林、null、陣列）
   */
  private extractParameters(text: string, _keywords: string[]): Record<string, unknown> {
    const parameters: Record<string, unknown> = {};

    // 尋找 key-value 模式（支援引號字串、陣列）
    const kvPatterns = [
      /(\w+)\s*[:：]\s*("(?:[^"]|\\")*"|'(?:[^']|\\')*'|\[[^\]]*\]|[^\s，。,]+)/g,  // "key: value" 或 "key: [array]" 或 "key: \"string\""
      /(\w+)\s*[是为]\s*("(?:[^"]|\\")*"|'(?:[^']|\\')*'|\[[^\]]*\]|[^\s，。,]+)/g,  // "key 是 value"
      /(\w+)\s*=\s*("(?:[^"]|\\")*"|'(?:[^']|\\')*'|\[[^\]]*\]|[^\s，。,]+)/g,        // "key = value"
    ];

    for (const pattern of kvPatterns) {
      let match;
      // 重置 lastIndex 以避免正則狀態問題
      pattern.lastIndex = 0;

      while ((match = pattern.exec(text)) !== null) {
        const [, key, rawValue] = match;
        if (key && rawValue) {
          const value = this.parseParameterValue(rawValue.trim());
          parameters[key] = value;
        }
      }
    }

    return parameters;
  }

  /**
   * 解析參數值（支援多種型別）
   */
  private parseParameterValue(rawValue: string): unknown {
    // 移除尾部的標點符號
    let value = rawValue.replace(/[,，。、]$/, '');

    // 1. 布林值
    if (value.toLowerCase() === 'true' || value === '真' || value === '是') {
      return true;
    }
    if (value.toLowerCase() === 'false' || value === '假' || value === '否') {
      return false;
    }

    // 2. null / undefined
    if (value.toLowerCase() === 'null' || value === '空' || value === '無') {
      return null;
    }

    // 3. 陣列 [1, 2, 3] 或 ["a", "b"]
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        const arrayContent = value.slice(1, -1); // 移除 []
        const items = arrayContent.split(',').map(item => {
          const trimmed = item.trim();
          // 移除引號
          if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
              (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
            return trimmed.slice(1, -1);
          }
          // 嘗試解析數字
          const num = parseFloat(trimmed);
          return isNaN(num) ? trimmed : num;
        });
        return items;
      } catch {
        // 解析失敗，當成字串
        return value;
      }
    }

    // 4. 引號字串 "hello" 或 'hello'
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    // 5. 數字（整數或浮點數）
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && value.match(/^-?\d+(\.\d+)?$/)) {
      return numValue;
    }

    // 6. 預設：字串
    return value;
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
