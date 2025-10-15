/**
 * Intent Recognizer - 意圖識別與端點推薦
 * 根據自然語言推薦最相關的 API 端點
 */

import type { ParsedIntent, EndpointMatch, EndpointInfo, IntentRecognizerConfig } from './types.js';

export class IntentRecognizer {
  constructor(private config: IntentRecognizerConfig) {}

  /**
   * 根據自然語言推薦最相關的 API 端點
   */
  recommendEndpoints(intent: ParsedIntent): EndpointMatch[] {
    const endpoints = this.extractEndpoints();
    const matches: EndpointMatch[] = [];

    for (const endpoint of endpoints) {
      const score = this.calculateScore(intent, endpoint);

      if (score >= (this.config.minConfidence || 0.3)) {
        matches.push({
          endpoint,
          operationId: endpoint.operationId,
          confidence: score,
          reason: this.generateReason(intent, endpoint, score),
        });
      }
    }

    // 排序並限制結果數量
    const maxResults = this.config.maxResults || 5;
    return matches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxResults);
  }

  /**
   * 從 OpenAPI 規格提取端點資訊
   */
  private extractEndpoints(): EndpointInfo[] {
    const endpoints: EndpointInfo[] = [];
    const paths = this.config.spec.paths || {};

    for (const [path, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      for (const [method, operation] of Object.entries(pathItem)) {
        if (typeof operation !== 'object' || !operation) continue;

        const op = operation as {
          operationId?: string;
          summary?: string;
          description?: string;
          parameters?: unknown[];
          requestBody?: unknown;
          responses?: Record<string, unknown>;
          security?: Array<Record<string, string[]>>;
        };

        if (op.operationId) {
          endpoints.push({
            path,
            method: method.toUpperCase(),
            operationId: op.operationId,
            summary: op.summary,
            description: op.description,
            parameters: op.parameters as EndpointInfo['parameters'],
            requestBody: op.requestBody as EndpointInfo['requestBody'],
            responses: op.responses,
            security: op.security,
          });
        }
      }
    }

    return endpoints;
  }

  /**
   * 計算端點匹配分數
   */
  private calculateScore(intent: ParsedIntent, endpoint: EndpointInfo): number {
    let score = 0;

    // HTTP method 匹配 (30%)
    if (intent.entities.method && endpoint.method === intent.entities.method) {
      score += 0.3;
    }

    // Summary/Description 關鍵字匹配 (40%)
    if (intent.entities.endpoint) {
      const keyword = intent.entities.endpoint.toLowerCase();
      const summary = (endpoint.summary || '').toLowerCase();
      const description = (endpoint.description || '').toLowerCase();

      if (summary.includes(keyword) || description.includes(keyword)) {
        score += 0.4;
      }
    }

    // OperationId 匹配 (30%)
    if (intent.entities.endpoint) {
      const keyword = intent.entities.endpoint.toLowerCase();
      const operationId = endpoint.operationId.toLowerCase();

      if (operationId.includes(keyword)) {
        score += 0.3;
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * 產生推薦原因說明
   */
  private generateReason(intent: ParsedIntent, endpoint: EndpointInfo, score: number): string {
    const reasons: string[] = [];

    if (intent.entities.method && endpoint.method === intent.entities.method) {
      reasons.push(`HTTP 方法匹配 (${endpoint.method})`);
    }

    if (endpoint.summary) {
      reasons.push(`Summary: ${endpoint.summary}`);
    }

    return reasons.join(', ') || `信心度: ${(score * 100).toFixed(0)}%`;
  }
}
