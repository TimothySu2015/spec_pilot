/**
 * 簡易中文分詞器
 * 使用貪婪最長匹配算法 + 領域自訂詞典
 * 專為 API 測試流程產生優化
 */

export class ChineseTokenizer {
  private dictionary: Set<string>;

  constructor(customWords: string[] = []) {
    // 預設領域詞典
    const defaultDictionary = [
      // HTTP 動詞相關
      '登入', '註冊', '登出', '建立', '新增', '創建', '查詢', '取得', '獲取',
      '讀取', '更新', '修改', '編輯', '刪除', '移除', '上傳', '下載',

      // 資源相關
      '使用者', '用戶', '帳號', '賬號', '密碼', '訂單', '產品', '商品',
      '郵件', '信箱', '地址', '電話', '名稱', '圖片', '文件', '檔案',
      '評論', '留言', '消息', '通知', '設定', '配置', '權限', '角色',

      // API 測試相關
      '測試', '流程', '端點', '參數', '驗證', '檢查', '確認', '斷言',
      '請求', '回應', '狀態碼', '資料', '欄位', '內容',

      // 動作相關
      '呼叫', '執行', '運行', '啟動', '停止', '重置', '清空',

      // CRUD 相關
      '列表', '詳情', '搜尋', '過濾', '排序', '分頁',

      // 認證相關
      '認證', '授權', '登錄', '令牌', 'token',

      // 常見組合詞
      '使用者登入', '使用者註冊', '訂單管理', '產品列表',
    ];

    this.dictionary = new Set([...defaultDictionary, ...customWords]);
  }

  /**
   * 分詞主方法（最長匹配算法）
   */
  cut(text: string): string[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const tokens: string[] = [];
    let i = 0;

    while (i < text.length) {
      const char = text[i];

      // 跳過非中文字符（英文、數字、符號等會單獨處理）
      if (!this.isChinese(char)) {
        // 提取連續的英文/數字
        if (/[a-zA-Z0-9]/.test(char)) {
          let word = char;
          i++;
          while (i < text.length && /[a-zA-Z0-9_\-]/.test(text[i])) {
            word += text[i];
            i++;
          }
          tokens.push(word);
        } else {
          // 跳過標點符號和空白
          i++;
        }
        continue;
      }

      // 中文字符：嘗試最長匹配
      let matched = false;

      // 從最長詞開始嘗試（最多 6 字詞）
      for (let len = Math.min(6, text.length - i); len >= 2; len--) {
        const word = text.substring(i, i + len);

        // 檢查是否為純中文詞
        if (this.isAllChinese(word) && this.dictionary.has(word)) {
          tokens.push(word);
          i += len;
          matched = true;
          break;
        }
      }

      // 如果沒有匹配到詞典，保留單個中文字
      if (!matched) {
        if (this.isChinese(char)) {
          tokens.push(char);
        }
        i++;
      }
    }

    return tokens;
  }

  /**
   * 分詞 + 過濾停用詞
   */
  cutWithStopWords(text: string, stopWords: Set<string>): string[] {
    const tokens = this.cut(text);
    return tokens.filter(token => !stopWords.has(token));
  }

  /**
   * 檢查是否為中文字符
   */
  private isChinese(char: string): boolean {
    return /[\u4e00-\u9fa5]/.test(char);
  }

  /**
   * 檢查是否全為中文字符
   */
  private isAllChinese(word: string): boolean {
    return /^[\u4e00-\u9fa5]+$/.test(word);
  }

  /**
   * 新增自訂詞彙到詞典
   */
  addWord(word: string): void {
    if (word && word.length > 0) {
      this.dictionary.add(word);
    }
  }

  /**
   * 批次新增詞彙
   */
  addWords(words: string[]): void {
    words.forEach(word => this.addWord(word));
  }

  /**
   * 取得詞典大小
   */
  getDictionarySize(): number {
    return this.dictionary.size;
  }
}

/**
 * 常用停用詞表
 */
export const STOP_WORDS = new Set([
  // 虛詞
  '的', '了', '和', '是', '就', '都', '而', '及', '與', '著',
  '或', '一個', '沒有', '我們', '你們', '他們', '它們',

  // 介詞
  '在', '從', '到', '為', '以', '對', '於', '由', '把', '被',

  // 連詞
  '但', '但是', '因為', '所以', '如果', '那麼', '雖然', '然而',

  // 助詞
  '啊', '呀', '呢', '吧', '嗎', '啦',

  // 代詞
  '我', '你', '他', '她', '它', '這', '那', '哪', '誰', '什麼',
  '怎麼', '為何', '何時', '何地',

  // 數詞量詞
  '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
  '個', '些', '次', '種',

  // 其他常見詞
  '有', '會', '能', '可', '要', '想', '用', '請', '應該',
]);
