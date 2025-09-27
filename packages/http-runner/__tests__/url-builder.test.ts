import { describe, it, expect } from 'vitest';
import { UrlBuilder } from '../src/url-builder.js';

describe('UrlBuilder', () => {
  describe('基本 URL 建構', () => {
    it('應該建構基本 URL', () => {
      const url = UrlBuilder.build({
        baseUrl: 'https://api.example.com',
        path: '/users',
      });

      expect(url).toBe('https://api.example.com/users');
    });

    it('應該處理 baseUrl 尾隨斜線', () => {
      const url = UrlBuilder.build({
        baseUrl: 'https://api.example.com/',
        path: '/users',
      });

      expect(url).toBe('https://api.example.com/users');
    });

    it('應該處理 path 沒有前導斜線', () => {
      const url = UrlBuilder.build({
        baseUrl: 'https://api.example.com',
        path: 'users',
      });

      expect(url).toBe('https://api.example.com/users');
    });
  });

  describe('路徑參數替換', () => {
    it('應該替換 {key} 格式的參數', () => {
      const url = UrlBuilder.build({
        baseUrl: 'https://api.example.com',
        path: '/users/{id}/posts/{postId}',
        pathParams: {
          id: '123',
          postId: '456',
        },
      });

      expect(url).toBe('https://api.example.com/users/123/posts/456');
    });

    it('應該替換 :key 格式的參數', () => {
      const url = UrlBuilder.build({
        baseUrl: 'https://api.example.com',
        path: '/users/:id/posts/:postId',
        pathParams: {
          id: '123',
          postId: '456',
        },
      });

      expect(url).toBe('https://api.example.com/users/123/posts/456');
    });

    it('應該正確編碼特殊字元', () => {
      const url = UrlBuilder.build({
        baseUrl: 'https://api.example.com',
        path: '/users/{name}',
        pathParams: {
          name: 'john doe',
        },
      });

      expect(url).toBe('https://api.example.com/users/john%20doe');
    });

    it('應該處理混合參數格式', () => {
      const url = UrlBuilder.build({
        baseUrl: 'https://api.example.com',
        path: '/users/{id}/posts/:postId',
        pathParams: {
          id: '123',
          postId: '456',
        },
      });

      expect(url).toBe('https://api.example.com/users/123/posts/456');
    });
  });

  describe('查詢參數', () => {
    it('應該添加查詢參數', () => {
      const url = UrlBuilder.build({
        baseUrl: 'https://api.example.com',
        path: '/users',
        queryParams: {
          page: '1',
          limit: '10',
          sort: 'name',
        },
      });

      expect(url).toBe('https://api.example.com/users?page=1&limit=10&sort=name');
    });

    it('應該處理空查詢參數', () => {
      const url = UrlBuilder.build({
        baseUrl: 'https://api.example.com',
        path: '/users',
        queryParams: {},
      });

      expect(url).toBe('https://api.example.com/users');
    });

    it('應該過濾 undefined 和 null 值', () => {
      const url = UrlBuilder.build({
        baseUrl: 'https://api.example.com',
        path: '/users',
        queryParams: {
          page: '1',
          search: undefined as any,
          filter: null as any,
          sort: 'name',
        },
      });

      expect(url).toBe('https://api.example.com/users?page=1&sort=name');
    });

    it('應該正確編碼查詢參數', () => {
      const url = UrlBuilder.build({
        baseUrl: 'https://api.example.com',
        path: '/search',
        queryParams: {
          q: 'hello world',
          category: 'tech & science',
        },
      });

      expect(url).toContain('q=hello+world');
      expect(url).toContain('category=tech+%26+science');
    });
  });

  describe('URL 解析', () => {
    it('應該解析完整 URL', () => {
      const parsed = UrlBuilder.parse('https://api.example.com:8080/users?page=1&limit=10#section');

      expect(parsed.protocol).toBe('https:');
      expect(parsed.hostname).toBe('api.example.com');
      expect(parsed.port).toBe('8080');
      expect(parsed.pathname).toBe('/users');
      expect(parsed.search).toBe('?page=1&limit=10');
      expect(parsed.hash).toBe('#section');
      expect(parsed.searchParams).toEqual({
        page: '1',
        limit: '10',
      });
    });

    it('應該處理沒有埠號的 URL', () => {
      const parsed = UrlBuilder.parse('https://api.example.com/users');

      expect(parsed.port).toBeNull();
      expect(parsed.hostname).toBe('api.example.com');
    });

    it('應該拋出無效 URL 錯誤', () => {
      expect(() => UrlBuilder.parse('invalid-url')).toThrow('無效的 URL');
    });
  });

  describe('URL 驗證', () => {
    it('應該驗證有效 URL', () => {
      expect(UrlBuilder.validate('https://api.example.com')).toBe(true);
      expect(UrlBuilder.validate('http://localhost:3000')).toBe(true);
      expect(UrlBuilder.validate('https://api.example.com/path?query=value')).toBe(true);
    });

    it('應該拒絕無效 URL', () => {
      expect(UrlBuilder.validate('invalid-url')).toBe(false);
      expect(UrlBuilder.validate('ftp://example.com')).toBe(true); // ftp 實際上是有效的 URL
      expect(UrlBuilder.validate('')).toBe(false);
      expect(UrlBuilder.validate('just-a-string')).toBe(false);
    });
  });

  describe('URL 標準化', () => {
    it('應該移除重複斜線', () => {
      const normalized = UrlBuilder.normalize('https://api.example.com//users///posts//');
      expect(normalized).toBe('https://api.example.com/users/posts');
    });

    it('應該保留根路徑的斜線', () => {
      const normalized = UrlBuilder.normalize('https://api.example.com/');
      expect(normalized).toBe('https://api.example.com/');
    });

    it('應該移除非根路徑的尾隨斜線', () => {
      const normalized = UrlBuilder.normalize('https://api.example.com/users/');
      expect(normalized).toBe('https://api.example.com/users');
    });

    it('應該拋出無效 URL 錯誤', () => {
      expect(() => UrlBuilder.normalize('invalid-url')).toThrow('URL 標準化失敗');
    });
  });

  describe('特殊字元編碼', () => {
    it('應該編碼特殊字元', () => {
      const encoded = UrlBuilder.encodeSpecialCharacters('hello world & universe');
      expect(encoded).toBe('hello%20world%20%26%20universe');
    });

    it('應該保留常見 URL 字元', () => {
      const encoded = UrlBuilder.encodeSpecialCharacters('path/to/resource?query=value');
      expect(encoded).toBe('path/to/resource?query=value');
    });

    it('應該處理 Unicode 字元', () => {
      const encoded = UrlBuilder.encodeSpecialCharacters('用戶資料');
      expect(encoded).toContain('%E7'); // UTF-8 編碼
    });
  });

  describe('錯誤處理', () => {
    it('應該處理缺失的必要參數', () => {
      expect(() =>
        UrlBuilder.build({
          baseUrl: '',
          path: '/users',
        })
      ).toThrow();
    });

    it('應該記錄未解析的路徑參數', () => {
      // 這個測試主要確保不會拋出錯誤，但會記錄警告
      const url = UrlBuilder.build({
        baseUrl: 'https://api.example.com',
        path: '/users/{id}/posts/{postId}',
        pathParams: {
          id: '123',
          // 缺少 postId
        },
      });

      expect(url).toBe('https://api.example.com/users/123/posts/{postId}');
    });
  });

  describe('複雜情境', () => {
    it('應該處理包含路徑參數和查詢參數的複雜 URL', () => {
      const url = UrlBuilder.build({
        baseUrl: 'https://api.example.com',
        path: '/users/{id}/posts/{postId}',
        pathParams: {
          id: '123',
          postId: '456',
        },
        queryParams: {
          include: 'comments',
          sort: 'created_at',
          order: 'desc',
        },
      });

      expect(url).toBe(
        'https://api.example.com/users/123/posts/456?include=comments&sort=created_at&order=desc'
      );
    });

    it('應該處理中文和特殊字元混合的情況', () => {
      const url = UrlBuilder.build({
        baseUrl: 'https://api.example.com',
        path: '/search/{category}',
        pathParams: {
          category: '技術&科學',
        },
        queryParams: {
          q: '人工智慧 & 機器學習',
          lang: 'zh-TW',
        },
      });

      expect(url).toContain('/%E6%8A%80%E8%A1%93%26%E7%A7%91%E5%AD%B8');
      expect(url).toContain('q=%E4%BA%BA%E5%B7%A5%E6%99%BA%E6%85%A7+%26+%E6%A9%9F%E5%99%A8%E5%AD%B8%E7%BF%92');
    });
  });
});