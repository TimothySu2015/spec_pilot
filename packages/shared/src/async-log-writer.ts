import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import { createStructuredLogger } from './logger.js';
import type { StructuredLogEntry } from './structured-log-types.js';

const logger = createStructuredLogger('async-log-writer');

/**
 * 日誌寫入任務
 */
interface LogWriteTask {
  id: string;
  logEntry: StructuredLogEntry;
  filePath: string;
  timestamp: number;
}

/**
 * 批次日誌寫入配置
 */
interface BatchConfig {
  /** 批次大小（筆數） */
  batchSize: number;
  /** 批次處理間隔（毫秒） */
  flushInterval: number;
  /** 最大等待時間（毫秒） */
  maxWaitTime: number;
}

/**
 * 非同步日誌寫入器
 * 使用批次處理和背景執行緒來提升效能
 */
export class AsyncLogWriter extends EventEmitter {
  private pendingTasks: LogWriteTask[] = [];
  private worker: Worker | null = null;
  private batchConfig: BatchConfig;
  private flushTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(batchConfig: Partial<BatchConfig> = {}) {
    super();

    this.batchConfig = {
      batchSize: 100,
      flushInterval: 1000, // 1秒
      maxWaitTime: 5000,   // 5秒
      ...batchConfig
    };

    this.startFlushTimer();

    logger.info('非同步日誌寫入器初始化', {
      batchSize: this.batchConfig.batchSize,
      flushInterval: this.batchConfig.flushInterval,
      maxWaitTime: this.batchConfig.maxWaitTime
    });
  }

  /**
   * 新增日誌寫入任務
   */
  async writeLog(logEntry: StructuredLogEntry, filePath: string): Promise<void> {
    if (this.isShuttingDown) {
      throw new Error('AsyncLogWriter is shutting down');
    }

    const task: LogWriteTask = {
      id: this.generateTaskId(),
      logEntry,
      filePath,
      timestamp: Date.now()
    };

    this.pendingTasks.push(task);

    logger.debug('新增日誌寫入任務', {
      taskId: task.id,
      pendingCount: this.pendingTasks.length,
      batchSize: this.batchConfig.batchSize
    });

    // 如果達到批次大小，立即處理
    if (this.pendingTasks.length >= this.batchConfig.batchSize) {
      await this.processBatch();
    }

    // 檢查是否有超時任務
    this.checkTimeouts();
  }

  /**
   * 強制處理所有待處理的任務
   */
  async flush(): Promise<void> {
    if (this.pendingTasks.length > 0) {
      logger.info('強制處理待處理日誌', {
        pendingCount: this.pendingTasks.length
      });
      await this.processBatch();
    }
  }

  /**
   * 優雅關閉寫入器
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    logger.info('開始關閉非同步日誌寫入器', {
      pendingTasks: this.pendingTasks.length
    });

    // 清除定時器
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // 處理剩餘任務
    await this.flush();

    // 關閉 Worker
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }

    logger.info('非同步日誌寫入器已關閉');
  }

  /**
   * 處理批次任務
   */
  private async processBatch(): Promise<void> {
    if (this.pendingTasks.length === 0) {
      return;
    }

    const tasksToProcess = this.pendingTasks.splice(0, this.batchConfig.batchSize);
    const startTime = Date.now();

    try {
      // 按檔案路徑分組任務
      const tasksByFile = this.groupTasksByFile(tasksToProcess);

      // 並行處理每個檔案的日誌
      const writePromises = Object.entries(tasksByFile).map(([filePath, tasks]) =>
        this.writeLogBatch(filePath, tasks)
      );

      await Promise.all(writePromises);

      const duration = Date.now() - startTime;

      logger.debug('批次日誌寫入完成', {
        processedTasks: tasksToProcess.length,
        filesWritten: Object.keys(tasksByFile).length,
        duration,
        remainingTasks: this.pendingTasks.length
      });

      this.emit('batchProcessed', {
        processedCount: tasksToProcess.length,
        duration,
        remainingCount: this.pendingTasks.length
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';

      logger.error('批次日誌寫入失敗', {
        error: errorMessage,
        tasksCount: tasksToProcess.length
      });

      // 將失敗的任務重新加回佇列（最多重試3次）
      const retriableTasks = tasksToProcess.filter(task =>
        (task as any).retryCount < 3
      ).map(task => ({
        ...task,
        retryCount: ((task as any).retryCount || 0) + 1
      }));

      this.pendingTasks.unshift(...retriableTasks);

      this.emit('batchError', {
        error: errorMessage,
        failedCount: tasksToProcess.length,
        retriedCount: retriableTasks.length
      });
    }
  }

  /**
   * 按檔案路徑分組任務
   */
  private groupTasksByFile(tasks: LogWriteTask[]): Record<string, LogWriteTask[]> {
    return tasks.reduce((groups, task) => {
      if (!groups[task.filePath]) {
        groups[task.filePath] = [];
      }
      groups[task.filePath].push(task);
      return groups;
    }, {} as Record<string, LogWriteTask[]>);
  }

  /**
   * 寫入單個檔案的日誌批次
   */
  private async writeLogBatch(filePath: string, tasks: LogWriteTask[]): Promise<void> {
    const { appendFile } = await import('fs/promises');

    // 將日誌項目轉換為 JSON Lines 格式
    const logLines = tasks.map(task =>
      JSON.stringify(task.logEntry)
    ).join('\n') + '\n';

    try {
      await appendFile(filePath, logLines, 'utf8');

      logger.debug('檔案日誌批次寫入成功', {
        filePath,
        taskCount: tasks.length,
        dataSize: logLines.length
      });

    } catch (error) {
      logger.error('檔案日誌批次寫入失敗', {
        filePath,
        taskCount: tasks.length,
        error: error instanceof Error ? error.message : '未知錯誤'
      });
      throw error;
    }
  }

  /**
   * 檢查超時任務
   */
  private checkTimeouts(): void {
    const now = Date.now();
    const timedOutTasks = this.pendingTasks.filter(
      task => now - task.timestamp > this.batchConfig.maxWaitTime
    );

    if (timedOutTasks.length > 0) {
      logger.warn('發現超時日誌任務，觸發批次處理', {
        timedOutCount: timedOutTasks.length,
        oldestTaskAge: now - Math.min(...timedOutTasks.map(t => t.timestamp))
      });

      // 非同步處理，不阻塞當前操作
      this.processBatch().catch(error => {
        logger.error('超時任務批次處理失敗', {
          error: error instanceof Error ? error.message : '未知錯誤'
        });
      });
    }
  }

  /**
   * 啟動定期清理定時器
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.pendingTasks.length > 0) {
        this.processBatch().catch(error => {
          logger.error('定期批次處理失敗', {
            error: error instanceof Error ? error.message : '未知錯誤'
          });
        });
      }
    }, this.batchConfig.flushInterval);
  }

  /**
   * 產生任務 ID
   */
  private generateTaskId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 取得統計資訊
   */
  getStats(): {
    pendingTasks: number;
    batchConfig: BatchConfig;
    isShuttingDown: boolean;
  } {
    return {
      pendingTasks: this.pendingTasks.length,
      batchConfig: { ...this.batchConfig },
      isShuttingDown: this.isShuttingDown
    };
  }
}

/**
 * 建立全域非同步日誌寫入器實例
 */
let globalAsyncWriter: AsyncLogWriter | null = null;

export function getGlobalAsyncLogWriter(config?: Partial<BatchConfig>): AsyncLogWriter {
  if (!globalAsyncWriter) {
    globalAsyncWriter = new AsyncLogWriter(config);

    // 程序退出時優雅關閉
    process.on('SIGINT', () => globalAsyncWriter?.shutdown());
    process.on('SIGTERM', () => globalAsyncWriter?.shutdown());
    process.on('beforeExit', () => globalAsyncWriter?.shutdown());
  }

  return globalAsyncWriter;
}

/**
 * 關閉全域寫入器
 */
export async function shutdownGlobalAsyncLogWriter(): Promise<void> {
  if (globalAsyncWriter) {
    await globalAsyncWriter.shutdown();
    globalAsyncWriter = null;
  }
}