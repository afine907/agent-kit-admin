/**
 * 文件锁工具 - 保护配置文件的并发写入
 *
 * 使用 Node.js 原生 fs 实现基于文件系统的锁机制
 * 主要用于 install/uninstall 命令写入 mcp.json 时的并发保护
 *
 * 改进点：
 * - 使用 UUID 标识锁持有者，防止 stale 锁竞态条件
 * - 删除 stale 锁前验证标识未变化
 * - 删除 stale 锁后继续循环而非立即尝试创建
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';

export interface FileLockOptions {
  /** 锁超时时间（毫秒），默认 10000 */
  timeout?: number;
  /** stale 锁判定时间（毫秒），默认 10000 */
  stale?: number;
  /** 重试间隔（毫秒），默认 500 */
  retryInterval?: number;
}

interface LockData {
  /** 锁持有者的唯一标识 */
  lockId: string;
  /** 进程 ID */
  pid: number;
  /** 创建时间戳 */
  timestamp: number;
}

export class FileLock {
  private filePath: string;
  private lockPath: string;
  private lockId: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.lockPath = `${filePath}.lock`;
    this.lockId = randomUUID();
  }

  /**
   * 获取文件锁
   * @param options 锁选项
   * @returns release 函数，调用后释放锁
   */
  async acquire(options?: FileLockOptions): Promise<() => Promise<void>> {
    // 检查目标文件是否存在
    if (!existsSync(this.filePath)) {
      throw new Error(`File does not exist: ${this.filePath}`);
    }

    const timeout = options?.timeout ?? 10000;
    const stale = options?.stale ?? 10000;
    const retryInterval = options?.retryInterval ?? 500;
    const startTime = Date.now();

    while (true) {
      try {
        // 检查是否存在 stale lock
        const staleRemoved = await this._tryRemoveStaleLock(stale);
        if (staleRemoved) {
          // 删除了 stale lock，继续循环让下一轮重试
          // 这样其他进程也有机会竞争
          continue;
        }

        // 尝试创建锁文件（使用 wx 标志确保原子性）
        const lockData: LockData = {
          lockId: this.lockId,
          pid: process.pid,
          timestamp: Date.now(),
        };
        await fs.writeFile(this.lockPath, JSON.stringify(lockData), { flag: 'wx' });

        // 锁获取成功，返回 release 函数
        return async () => {
          try {
            // 只删除自己创建的锁
            const currentLock = await this._readLockData();
            if (currentLock?.lockId === this.lockId) {
              await fs.unlink(this.lockPath);
            }
          } catch {
            // 锁文件可能已被删除
          }
        };
      } catch (error: unknown) {
        if (this._isEEXISTError(error)) {
          // 锁文件已存在，等待重试
          if (Date.now() - startTime >= timeout) {
            throw new Error(`Failed to acquire lock for ${this.lockPath}: timeout after ${timeout}ms`);
          }
          await new Promise((resolve) => setTimeout(resolve, retryInterval));
        } else {
          // 其他错误
          throw new Error(
            `Failed to acquire lock for ${this.lockPath}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }
  }

  /**
   * 尝试移除 stale lock
   * @param staleThreshold stale 判定时间阈值
   * @returns 是否成功移除了 stale lock
   */
  private async _tryRemoveStaleLock(staleThreshold: number): Promise<boolean> {
    if (!existsSync(this.lockPath)) {
      return false;
    }

    try {
      const lockData = await this._readLockData();
      if (!lockData) {
        // 锁文件内容无效，尝试删除
        await fs.unlink(this.lockPath).catch(() => {});
        return true;
      }

      // 检查是否是 stale lock
      if (Date.now() - lockData.timestamp > staleThreshold) {
        // 再次读取确认锁标识未变化（防止竞态条件）
        const verifyData = await this._readLockData();
        if (verifyData?.lockId === lockData.lockId) {
          // 锁标识未变化，安全删除
          await fs.unlink(this.lockPath).catch(() => {});
          return true;
        }
        // 锁标识已变化，说明其他进程已获取锁
        return false;
      }

      // 不是 stale lock
      return false;
    } catch {
      // 读取失败，尝试删除
      await fs.unlink(this.lockPath).catch(() => {});
      return true;
    }
  }

  /**
   * 读取锁文件数据
   */
  private async _readLockData(): Promise<LockData | null> {
    try {
      const content = await fs.readFile(this.lockPath, 'utf-8');
      return JSON.parse(content) as LockData;
    } catch {
      return null;
    }
  }

  /**
   * 判断是否是 EEXIST 错误
   */
  private _isEEXISTError(error: unknown): boolean {
    return (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'EEXIST'
    );
  }
}
