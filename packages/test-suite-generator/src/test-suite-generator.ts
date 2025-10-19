/**
 * Test Suite Generator - 測試套件產生器
 * 整合各種產生器，產生完整的測試套件
 */

import type { FlowDefinition } from '@specpilot/flow-parser';
import type { GenerationOptions, TestSuiteSummary, EndpointInfo } from './types.js';
import { SpecAnalyzer } from './spec-analyzer.js';
import { CRUDGenerator } from './crud-generator.js';
import { ErrorCaseGenerator } from './error-case-generator.js';
import { EdgeCaseGenerator } from './edge-case-generator.js';
import { DependencyResolver } from './dependency-resolver.js';

export class TestSuiteGenerator {
  private specAnalyzer: SpecAnalyzer;
  private crudGenerator: CRUDGenerator;
  private errorGenerator: ErrorCaseGenerator;
  private edgeGenerator: EdgeCaseGenerator;
  private dependencyResolver: DependencyResolver;

  constructor(
    specAnalyzer: SpecAnalyzer,
    options: GenerationOptions = {}
  ) {
    this.specAnalyzer = specAnalyzer;
    this.crudGenerator = new CRUDGenerator({ useExamples: true });
    this.errorGenerator = new ErrorCaseGenerator({
      includeMissingFields: options.includeErrorCases ?? true,
      includeInvalidFormats: options.includeErrorCases ?? true,
      includeAuthErrors: options.includeAuthTests ?? true,
    });
    this.edgeGenerator = new EdgeCaseGenerator();
    this.dependencyResolver = new DependencyResolver();
  }

  /**
   * 產生測試套件
   */
  generate(options: GenerationOptions = {}): FlowDefinition {
    const endpoints = this.getTargetEndpoints(options);
    const flow: FlowDefinition = {
      name: '自動產生的測試套件',
      description: `包含 ${endpoints.length} 個端點的測試案例`,
      version: '1.0.0',
      baseUrl: this.extractBaseUrl(),
      steps: [],
    };

    let successCount = 0;
    let errorCount = 0;
    let edgeCount = 0;

    for (const endpoint of endpoints) {
      // 1. 產生成功案例
      if (options.includeSuccessCases !== false) {
        const successSteps = this.crudGenerator.generateSuccessCases(endpoint);
        flow.steps.push(...successSteps);
        successCount += successSteps.length;
      }

      // 2. 產生錯誤案例
      if (options.includeErrorCases) {
        const missingFieldSteps = this.errorGenerator.generateMissingFieldCases(endpoint);
        const invalidFormatSteps = this.errorGenerator.generateFormatValidationCases(endpoint);
        const authErrorSteps = this.errorGenerator.generateAuthErrorCases(endpoint);

        flow.steps.push(...missingFieldSteps, ...invalidFormatSteps, ...authErrorSteps);
        errorCount += missingFieldSteps.length + invalidFormatSteps.length + authErrorSteps.length;
      }

      // 3. 產生邊界測試
      if (options.includeEdgeCases) {
        const edgeSteps = this.edgeGenerator.generateEdgeCases(endpoint);
        flow.steps.push(...edgeSteps);
        edgeCount += edgeSteps.length;
      }
    }

    // 4. 產生流程串接測試
    if (options.generateFlows) {
      const flowSteps = this.dependencyResolver.resolveExecutionOrder(endpoints);
      flow.steps.push(...flowSteps);
    }

    // 儲存摘要資訊
    (flow as { metadata?: { summary?: TestSuiteSummary } }).metadata = {
      summary: {
        totalTests: flow.steps.length,
        successTests: successCount,
        errorTests: errorCount,
        edgeTests: edgeCount,
        endpoints: endpoints.map((ep) => ep.operationId),
      },
    };

    return flow;
  }

  /**
   * 取得目標端點
   *
   * 支援三種過濾格式：
   * 1. operationId 格式：['createUser', 'getUser']
   * 2. "METHOD /path" 格式：['POST /users', 'GET /users/{id}']
   * 3. "/path" 格式：['/users', '/auth/login']（匹配所有 HTTP 方法）
   */
  private getTargetEndpoints(options: GenerationOptions): EndpointInfo[] {
    const allEndpoints = this.specAnalyzer.extractEndpoints();

    // 如果未指定 endpoints，返回所有端點
    if (!options.endpoints || options.endpoints.length === 0) {
      return allEndpoints;
    }

    // 使用過濾邏輯匹配端點
    return allEndpoints.filter((ep) => {
      return options.endpoints!.some((filter) => {
        // 格式 1: operationId 精確匹配
        if (filter === ep.operationId) {
          return true;
        }

        // 格式 2: "METHOD /path" 格式
        if (filter.includes(' ')) {
          const parts = filter.split(' ');
          if (parts.length === 2) {
            const [method, path] = parts;
            return (
              ep.method.toUpperCase() === method.toUpperCase() &&
              ep.path === path
            );
          }
        }

        // 格式 3: "/path" 格式（匹配所有方法）
        if (filter.startsWith('/')) {
          return ep.path === filter;
        }

        return false;
      });
    });
  }

  /**
   * 從 OpenAPI 規格提取 baseUrl
   */
  private extractBaseUrl(): string {
    const spec = this.specAnalyzer['config'].spec;

    // 1. 優先使用 servers[0].url
    if (spec.servers && spec.servers.length > 0) {
      const serverUrl = spec.servers[0].url;
      if (serverUrl) {
        return serverUrl;
      }
    }

    // 2. 如果沒有 servers，使用預設值
    return 'http://localhost:3000';
  }

  /**
   * 產生測試套件摘要
   */
  getSummary(flow: FlowDefinition): TestSuiteSummary {
    const metadata = (flow as { metadata?: { summary?: TestSuiteSummary } }).metadata;
    return (
      metadata?.summary || {
        totalTests: flow.steps.length,
        successTests: 0,
        errorTests: 0,
        edgeTests: 0,
        endpoints: [],
      }
    );
  }
}
