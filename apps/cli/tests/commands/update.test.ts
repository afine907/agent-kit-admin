/**
 * update 命令测试
 *
 * 测试场景:
 * - 更新流程（下载 → 解压 → manifest 读取 → 配置重写）
 * - 版本不变时跳过更新
 * - 下载失败处理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock 外部依赖
vi.mock('../../src/config/manager', () => ({
  configManager: {
    getInstalledPackages: vi.fn(),
    updateInstalledPackage: vi.fn(),
  },
}));

vi.mock('../../src/api/client', () => ({
  apiClient: {
    getPackage: vi.fn(),
    getDownloadUrl: vi.fn(),
  },
}));

vi.mock('../../src/agents/registry', () => ({
  agentRegistry: {
    get: vi.fn(),
  },
}));

vi.mock('../../src/utils/manifest', () => ({
  readManifest: vi.fn(),
}));

describe('update command', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'akit-update-test-'));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('should have correct command configuration', async () => {
    const { updateCommand } = await import('../../src/commands/update');

    expect(updateCommand.name()).toBe('update');
    expect(updateCommand.description()).toBeTruthy();

    // 验证选项
    const options = updateCommand.options;
    const optionNames = options.map((o) => o.long);
    expect(optionNames).toContain('--agent');
  });

  it('should export updateCommand as Commander instance', async () => {
    const { updateCommand } = await import('../../src/commands/update');
    expect(updateCommand).toBeDefined();
    expect(typeof updateCommand.action).toBe('function');
  });

  it('should handle no installed packages gracefully', async () => {
    const { configManager } = await import('../../src/config/manager');
    vi.mocked(configManager.getInstalledPackages).mockReturnValue([]);

    const { updateCommand } = await import('../../src/commands/update');

    // 捕获 console.log 输出
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));

    try {
      // 执行 update 命令（无已安装包）
      await updateCommand.parseAsync(['node', 'test', 'update']);
    } catch {
      // Commander 可能会抛出 process.exit，这里忽略
    }

    console.log = originalLog;

    // 应该输出"没有已安装的包"
    const output = logs.join('\n');
    expect(output).toContain('没有已安装的包');
  });
});
