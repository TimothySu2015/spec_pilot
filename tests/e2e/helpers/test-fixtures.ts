import * as path from 'node:path';
import * as fs from 'node:fs/promises';

export interface TestFixture {
  specPath: string;
  flowPath: string;
  name: string;
}

export class TestFixtureManager {
  private readonly fixturesRoot: string;
  private readonly testDataRoot: string;

  constructor(projectRoot?: string) {
    const root = projectRoot || path.resolve(__dirname, '../../../');
    this.fixturesRoot = path.join(root, 'packages/testing/fixtures');
    this.testDataRoot = path.join(root, 'test-integration');
  }

  async setupTestEnvironment(): Promise<string> {
    await fs.mkdir(this.testDataRoot, { recursive: true });

    const testRunId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const testDir = path.join(this.testDataRoot, testRunId);

    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, 'specs'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'flows'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'reports'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'logs'), { recursive: true });

    return testDir;
  }

  async cleanupTestEnvironment(testDir: string): Promise<void> {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理錯誤
    }
  }

  async copyFixture(
    fixtureName: string,
    destPath: string,
    type: 'specs' | 'flows'
  ): Promise<void> {
    const sourcePath = path.join(this.fixturesRoot, type, fixtureName);
    await fs.copyFile(sourcePath, destPath);
  }

  async createTestSpec(testDir: string, specName: string): Promise<string> {
    const destPath = path.join(testDir, 'specs', specName);
    await this.copyFixture(specName, destPath, 'specs');
    return destPath;
  }

  async createTestFlow(testDir: string, flowName: string): Promise<string> {
    const destPath = path.join(testDir, 'flows', flowName);
    await this.copyFixture(flowName, destPath, 'flows');
    return destPath;
  }

  async createCustomSpec(testDir: string, specName: string, content: string): Promise<string> {
    const destPath = path.join(testDir, 'specs', specName);
    await fs.writeFile(destPath, content, 'utf-8');
    return destPath;
  }

  async createCustomFlow(testDir: string, flowName: string, content: string): Promise<string> {
    const destPath = path.join(testDir, 'flows', flowName);
    await fs.writeFile(destPath, content, 'utf-8');
    return destPath;
  }

  async createCustomSpec(testDir: string, specName: string, content: string): Promise<string> {
    const destPath = path.join(testDir, 'specs', specName);
    await fs.writeFile(destPath, content, 'utf-8');
    return destPath;
  }

  getFixture(specName: string, flowName: string, name: string): TestFixture {
    return {
      specPath: path.join(this.fixturesRoot, 'specs', specName),
      flowPath: path.join(this.fixturesRoot, 'flows', flowName),
      name,
    };
  }

  getReportPath(testDir: string, reportName: string = 'result.json'): string {
    return path.join(testDir, 'reports', reportName);
  }

  async findGeneratedReportPath(testDir: string): Promise<string | null> {
    const reportsDir = path.join(testDir, 'reports');
    try {
      const files = await fs.readdir(reportsDir);
      const reportFile = files.find(file => file.startsWith('result-') && file.endsWith('.json'));
      return reportFile ? path.join(reportsDir, reportFile) : null;
    } catch (error) {
      return null;
    }
  }

  getLogPath(testDir: string, logName: string = 'execution.log'): string {
    return path.join(testDir, 'logs', logName);
  }
}