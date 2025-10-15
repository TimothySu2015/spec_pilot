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
  async parse(_userInput: string, _context?: ConversationContext): Promise<ParsedIntent> {
    // TODO: 實作自然語言解析邏輯
    // 1. 關鍵字比對
    // 2. 實體提取
    // 3. 意圖分類

    const intent: ParsedIntent = {
      action: 'create_flow',
      entities: {},
      confidence: 0.5,
    };

    return intent;
  }

  /**
   * 提取關鍵字
   */
  private extractKeywords(text: string): string[] {
    // 簡單的關鍵字提取
    const keywords = text.toLowerCase().match(/[\u4e00-\u9fa5a-z]+/g) || [];
    return keywords;
  }

  /**
   * 識別 HTTP Method
   */
  private identifyHttpMethod(text: string): string | undefined {
    const methodMap: Record<string, string> = {
      登入: 'POST',
      註冊: 'POST',
      建立: 'POST',
      新增: 'POST',
      查詢: 'GET',
      取得: 'GET',
      獲取: 'GET',
      更新: 'PUT',
      修改: 'PATCH',
      編輯: 'PATCH',
      刪除: 'DELETE',
      移除: 'DELETE',
    };

    for (const [keyword, method] of Object.entries(methodMap)) {
      if (text.includes(keyword)) {
        return method;
      }
    }

    return undefined;
  }
}
