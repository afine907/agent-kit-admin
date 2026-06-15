/**
 * #10 配置文件损坏恢复测试
 *
 * 测试 recoverConfig 函数的文件系统行为。
 * 不 mock conf 模块，直接测试文件操作。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';


describe('#10 配置文件损坏恢复', () => {
  let testDir: string;
  let configPath: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'akit-recovery-test-'));
    configPath = join(testDir, 'config.json');
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  });

  it('应该备份损坏的配置文件并创建新配置', async () => {
    // 写入损坏的 JSON
    await writeFile(configPath, '{ invalid json content !!!', 'utf-8');

    const { recoverConfig } = await import('../src/config/manager');
    const result = await recoverConfig(configPath);

    // 验证返回了恢复信息
    expect(result.recovered).toBe(true);
    expect(result.backupPath).toBeDefined();
    expect(result.backupPath).toContain('.bak');

    // 验证备份文件存在且包含损坏内容
    const backupContent = await readFile(result.backupPath!, 'utf-8');
    expect(backupContent).toBe('{ invalid json content !!!');

    // 验证原始配置文件已被替换为有效 JSON
    const newContent = await readFile(configPath, 'utf-8');
    expect(() => JSON.parse(newContent)).not.toThrow();
    expect(JSON.parse(newContent)).toEqual({});
  });

  it('应该在已有备份时不覆盖备份文件', async () => {
    // 写入损坏的 JSON
    await writeFile(configPath, 'corrupted', 'utf-8');

    // 创建已存在的备份
    const backupPath = configPath + '.bak';
    await writeFile(backupPath, 'existing backup', 'utf-8');

    const { recoverConfig } = await import('../src/config/manager');
    const result = await recoverConfig(configPath);

    // 验证使用了带时间戳的备份名
    expect(result.recovered).toBe(true);
    expect(result.backupPath).not.toBe(backupPath);
    expect(result.backupPath).toMatch(/\.bak\.\d{8}/);

    // 验证原始备份未被覆盖
    const { readFile: readFile2 } = await import('fs/promises');
    const existingBackup = await readFile2(backupPath, 'utf-8');
    expect(existingBackup).toBe('existing backup');

    // 验证新备份存在
    const newBackup = await readFile2(result.backupPath!, 'utf-8');
    expect(newBackup).toBe('corrupted');
  });

  it('应该不修改有效的配置文件', async () => {
    // 写入有效的 JSON
    const validConfig = JSON.stringify({ registry: 'http://localhost', token: 'test-token' });
    await writeFile(configPath, validConfig, 'utf-8');

    const { recoverConfig } = await import('../src/config/manager');
    const result = await recoverConfig(configPath);

    expect(result.recovered).toBe(false);
    expect(result.backupPath).toBeUndefined();

    // 验证文件内容未被修改
    const content = await readFile(configPath, 'utf-8');
    expect(content).toBe(validConfig);
  });

  it('备份文件名应该包含日期后缀（当 .bak 已存在时）', async () => {
    await writeFile(configPath, 'bad content', 'utf-8');
    // 预先创建 .bak 文件
    await writeFile(configPath + '.bak', 'old backup', 'utf-8');

    const { recoverConfig } = await import('../src/config/manager');
    const result = await recoverConfig(configPath);

    // 验证备份文件名格式: config.json.bak.YYYYMMDD
    expect(result.backupPath).toMatch(/\.bak\.\d{8}$/);
  });

  it('文件不存在时应返回 recovered: false', async () => {
    const nonExistentPath = join(testDir, 'nonexistent.json');

    const { recoverConfig } = await import('../src/config/manager');
    const result = await recoverConfig(nonExistentPath);

    expect(result.recovered).toBe(false);
    expect(result.backupPath).toBeUndefined();
  });
});
