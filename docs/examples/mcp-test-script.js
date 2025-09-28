#!/usr/bin/env node

/**
 * SpecPilot MCP 測試腳本
 *
 * 此腳本展示如何與 SpecPilot MCP 伺服器進行 JSON-RPC 2.0 通訊
 * 使用方式：node docs/examples/mcp-test-script.js
 *
 * 注意：在執行此腳本前，請先在另一個終端啟動 MCP 伺服器：
 * pnpm run start:mcp
 */

const { spawn } = require('child_process');
const readline = require('readline');

class McpClient {
  constructor() {
    this.requestId = 1;
    this.mcpProcess = null;
    this.responses = new Map();
  }

  /**
   * 啟動 MCP 伺服器子程序
   */
  async startMcpServer() {
    console.log('正在啟動 MCP 伺服器...');

    this.mcpProcess = spawn('pnpm', ['run', 'start:mcp'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    // 設置 stdout 讀取器處理回應
    const rl = readline.createInterface({
      input: this.mcpProcess.stdout,
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      try {
        const response = JSON.parse(line.trim());
        if (response.id && this.responses.has(response.id)) {
          const { resolve } = this.responses.get(response.id);
          resolve(response);
          this.responses.delete(response.id);
        }
      } catch (error) {
        console.error('解析回應失敗:', error.message);
        console.error('原始回應:', line);
      }
    });

    // 錯誤處理
    this.mcpProcess.stderr.on('data', (data) => {
      console.error('MCP 伺服器錯誤:', data.toString());
    });

    this.mcpProcess.on('exit', (code) => {
      console.log(`MCP 伺服器結束，退出碼: ${code}`);
    });

    // 等待伺服器啟動
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('MCP 伺服器已啟動');
  }

  /**
   * 發送 JSON-RPC 請求
   */
  async sendRequest(method, params = null) {
    const requestId = `req-${this.requestId++}`;
    const request = {
      jsonrpc: '2.0',
      method,
      id: requestId
    };

    if (params !== null) {
      request.params = params;
    }

    return new Promise((resolve, reject) => {
      this.responses.set(requestId, { resolve, reject });

      // 設置超時
      setTimeout(() => {
        if (this.responses.has(requestId)) {
          this.responses.delete(requestId);
          reject(new Error(`請求超時: ${method}`));
        }
      }, 10000);

      // 發送請求
      const requestLine = JSON.stringify(request) + '\n';
      this.mcpProcess.stdin.write(requestLine);

      console.log(`發送請求: ${method}`);
      console.log(`請求內容: ${JSON.stringify(request, null, 2)}`);
    });
  }

  /**
   * 關閉 MCP 伺服器
   */
  async close() {
    if (this.mcpProcess) {
      this.mcpProcess.stdin.end();
      this.mcpProcess.kill();
    }
  }

  /**
   * 測試 listSpecs 方法
   */
  async testListSpecs() {
    console.log('\n=== 測試 listSpecs 方法 ===');
    try {
      const response = await this.sendRequest('listSpecs');

      if (response.error) {
        console.error('錯誤回應:', response.error);
        return false;
      }

      console.log('成功回應:');
      console.log(JSON.stringify(response.result, null, 2));

      // 驗證回應格式
      if (Array.isArray(response.result)) {
        console.log(`找到 ${response.result.length} 個規格檔案`);
        return true;
      } else {
        console.error('回應格式錯誤：期望陣列格式');
        return false;
      }
    } catch (error) {
      console.error('測試失敗:', error.message);
      return false;
    }
  }

  /**
   * 測試 listFlows 方法
   */
  async testListFlows() {
    console.log('\n=== 測試 listFlows 方法 ===');
    try {
      const response = await this.sendRequest('listFlows', {
        directory: 'flows/'
      });

      if (response.error) {
        console.error('錯誤回應:', response.error);
        return false;
      }

      console.log('成功回應:');
      console.log(JSON.stringify(response.result, null, 2));

      // 驗證回應格式
      if (Array.isArray(response.result)) {
        console.log(`找到 ${response.result.length} 個流程檔案`);
        return true;
      } else {
        console.error('回應格式錯誤：期望陣列格式');
        return false;
      }
    } catch (error) {
      console.error('測試失敗:', error.message);
      return false;
    }
  }

  /**
   * 測試 runFlow 方法（檔案模式）
   */
  async testRunFlow() {
    console.log('\n=== 測試 runFlow 方法（檔案模式）===');
    try {
      const response = await this.sendRequest('runFlow', {
        spec: 'specs/openapi.yaml',
        flow: 'flows/user_crud.yaml',
        baseUrl: 'http://localhost:3000'
      });

      if (response.error) {
        console.error('錯誤回應:', response.error);
        return false;
      }

      console.log('成功回應:');
      console.log(JSON.stringify(response.result, null, 2));

      // 驗證回應格式
      if (response.result && response.result.executionId) {
        console.log(`執行 ID: ${response.result.executionId}`);
        console.log(`狀態: ${response.result.status}`);
        return true;
      } else {
        console.error('回應格式錯誤：缺少執行 ID');
        return false;
      }
    } catch (error) {
      console.error('測試失敗:', error.message);
      return false;
    }
  }

  /**
   * 測試 getReport 方法
   */
  async testGetReport() {
    console.log('\n=== 測試 getReport 方法 ===');
    try {
      const response = await this.sendRequest('getReport');

      if (response.error) {
        console.error('錯誤回應:', response.error);
        return false;
      }

      console.log('成功回應:');
      console.log(JSON.stringify(response.result, null, 2));

      // 驗證回應格式
      if (response.result && response.result.reportPath) {
        console.log(`報表路徑: ${response.result.reportPath}`);
        return true;
      } else {
        console.error('回應格式錯誤：缺少報表路徑');
        return false;
      }
    } catch (error) {
      console.error('測試失敗:', error.message);
      return false;
    }
  }

  /**
   * 執行所有測試
   */
  async runAllTests() {
    console.log('SpecPilot MCP 測試腳本');
    console.log('========================');

    try {
      await this.startMcpServer();

      const results = {
        listSpecs: await this.testListSpecs(),
        listFlows: await this.testListFlows(),
        runFlow: await this.testRunFlow(),
        getReport: await this.testGetReport()
      };

      console.log('\n=== 測試結果摘要 ===');
      let passed = 0;
      let total = 0;

      for (const [method, success] of Object.entries(results)) {
        const status = success ? '✓ 通過' : '✗ 失敗';
        console.log(`${method}: ${status}`);
        if (success) passed++;
        total++;
      }

      console.log(`\n總計: ${passed}/${total} 個測試通過`);

      if (passed === total) {
        console.log('🎉 所有測試都通過了！');
      } else {
        console.log('❌ 部分測試失敗，請檢查錯誤訊息');
      }

    } catch (error) {
      console.error('測試執行失敗:', error.message);
    } finally {
      await this.close();
    }
  }
}

// 主程序
async function main() {
  const client = new McpClient();
  await client.runAllTests();
}

// 錯誤處理
process.on('unhandledRejection', (reason, promise) => {
  console.error('未處理的 Promise 拒絕:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('未捕獲的例外:', error);
  process.exit(1);
});

// 執行測試
if (require.main === module) {
  main();
}

module.exports = McpClient;