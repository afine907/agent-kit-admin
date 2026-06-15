/**
 * 文件锁测试 - TDD RED phase
 *
 * 测试场景:
 * - 获取锁成功
 * - 锁超时失败
 * - 死锁自动释放（stale lock）
 * - 并发写入保护
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { FileLock } from '../../src/utils/lock';

describe('FileLock', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'akit-lock-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should acquire lock successfully', async () => {
    const filePath = path.join(tempDir, 'test.json');
    await fs.writeFile(filePath, '{}');

    const lock = new FileLock(filePath);
    const release = await lock.acquire();

    expect(typeof release).toBe('function');

    // 清理
    await release();
  });

  it('should release lock successfully', async () => {
    const filePath = path.join(tempDir, 'test.json');
    await fs.writeFile(filePath, '{}');

    const lock = new FileLock(filePath);
    const release = await lock.acquire();

    // 释放后应该能再次获取
    await release();

    const lock2 = new FileLock(filePath);
    const release2 = await lock2.acquire();
    await release2();
  });

  it('should fail on lock timeout', async () => {
    const filePath = path.join(tempDir, 'test.json');
    await fs.writeFile(filePath, '{}');

    const lock1 = new FileLock(filePath);
    const release1 = await lock1.acquire();

    // 第二个锁应该超时
    const lock2 = new FileLock(filePath);
    await expect(lock2.acquire({ timeout: 500 })).rejects.toThrow(/timeout|lock/i);

    await release1();
  });

  it('should handle stale lock automatically', async () => {
    const filePath = path.join(tempDir, 'test.json');
    await fs.writeFile(filePath, '{}');

    // 创建一个 stale lock 文件（模拟进程崩溃）
    const lockPath = `${filePath}.lock`;
    const staleTime = Date.now() - 30000; // 30 秒前
    await fs.writeFile(
      lockPath,
      JSON.stringify({ pid: 99999, timestamp: staleTime })
    );

    // 应该能获取锁（stale lock 被自动释放）
    const lock = new FileLock(filePath);
    const release = await lock.acquire({ stale: 10000 }); // 10 秒视为 stale

    expect(typeof release).toBe('function');
    await release();
  });

  it('should protect concurrent writes', async () => {
    const filePath = path.join(tempDir, 'counter.json');
    await fs.writeFile(filePath, JSON.stringify({ count: 0 }));

    const lock = new FileLock(filePath);

    // 模拟并发写入
    const results: number[] = [];
    const concurrentOps = 5;

    const operations = Array.from({ length: concurrentOps }, async (_) => {
      const release = await lock.acquire();
      try {
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        const newCount = data.count + 1;
        await fs.writeFile(filePath, JSON.stringify({ count: newCount }));
        results.push(newCount);
      } finally {
        await release();
      }
    });

    await Promise.all(operations);

    // 所有操作应该顺序执行（无竞态条件）
    const finalData = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    expect(finalData.count).toBe(concurrentOps);

    // 结果应该是连续的 1, 2, 3, 4, 5
    results.sort((a, b) => a - b);
    expect(results).toEqual([1, 2, 3, 4, 5]);
  });

  it('should throw error for non-existent file', async () => {
    const filePath = path.join(tempDir, 'nonexistent.json');

    const lock = new FileLock(filePath);
    await expect(lock.acquire()).rejects.toThrow();
  });

  it('should use custom lock options', async () => {
    const filePath = path.join(tempDir, 'test.json');
    await fs.writeFile(filePath, '{}');

    const lock = new FileLock(filePath);
    const release = await lock.acquire({
      timeout: 5000,
      stale: 15000,
      retries: 3,
    });

    expect(typeof release).toBe('function');
    await release();
  });
});
