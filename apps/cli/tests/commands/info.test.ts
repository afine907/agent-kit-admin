/**
 * info 命令测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock API client
const mockGetPackage = vi.fn();
const mockGetVersions = vi.fn();
vi.mock('../../src/api/client', () => ({
  apiClient: {
    getPackage: mockGetPackage,
    getVersions: mockGetVersions,
  },
}));

// Mock console - 在 beforeEach 中创建，afterEach 中恢复
let mockConsoleLog: ReturnType<typeof vi.spyOn>;
let mockConsoleError: ReturnType<typeof vi.spyOn>;

describe('info command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  it('should have correct command definition', async () => {
    const { infoCommand } = await import('../../src/commands/info');
    expect(infoCommand.name()).toBe('info');
    expect(infoCommand.description()).toContain('包详情');
  });

  it('should parse package name correctly', async () => {
    const { parsePackageName } = await import('../../src/utils/package-name');

    expect(parsePackageName('@team/web-search')).toEqual({
      scope: '@team',
      name: 'web-search',
    });

    expect(parsePackageName('web-search')).toEqual({
      scope: '@unknown',
      name: 'web-search',
    });
  });

  it('should display package info', async () => {
    mockGetPackage.mockResolvedValue({
      name: 'pg-mcp',
      scope: '@team',
      full_name: '@team/pg-mcp',
      type: 'mcp',
      description: 'PostgreSQL MCP tool',
      license: 'MIT',
      latest_version: '1.2.0',
      downloads_count: 234,
      visibility: 'public',
      repository: 'https://github.com/team/pg-mcp',
    });

    mockGetVersions.mockResolvedValue({
      items: [
        {
          version: '1.2.0',
          tag: 'latest',
          published_at: '2024-01-15T10:30:00Z',
          deprecated: false,
          yanked: false,
        },
        {
          version: '1.1.0',
          tag: null,
          published_at: '2024-01-10T08:00:00Z',
          deprecated: false,
          yanked: false,
        },
      ],
    });

    const { infoCommand } = await import('../../src/commands/info');
    await infoCommand.parseAsync(['node', 'test', '@team/pg-mcp']);

    expect(mockGetPackage).toHaveBeenCalledWith('@team', 'pg-mcp');
    expect(mockGetVersions).toHaveBeenCalledWith('@team', 'pg-mcp');

    // 验证输出包含关键信息
    const logCalls = mockConsoleLog.mock.calls.flat().join('\n');
    expect(logCalls).toContain('@team/pg-mcp');
    expect(logCalls).toContain('MCP');
    expect(logCalls).toContain('MIT');
    expect(logCalls).toContain('1.2.0');
  });

  it('should display install command', async () => {
    mockGetPackage.mockResolvedValue({
      name: 'pg-mcp',
      scope: '@team',
      full_name: '@team/pg-mcp',
      type: 'mcp',
      description: 'PostgreSQL MCP tool',
    });

    mockGetVersions.mockResolvedValue({ items: [] });

    const { infoCommand } = await import('../../src/commands/info');
    await infoCommand.parseAsync(['node', 'test', '@team/pg-mcp']);

    const logCalls = mockConsoleLog.mock.calls.flat().join('\n');
    expect(logCalls).toContain('akit install @team/pg-mcp');
  });

  it('should handle package not found', async () => {
    mockGetPackage.mockRejectedValue(new Error('Package not found'));

    const { infoCommand } = await import('../../src/commands/info');

    // infoCommand 内部会调用 process.exit(1)，这里验证错误被正确处理
    await expect(
      infoCommand.parseAsync(['node', 'test', '@nonexist/nope'])
    ).rejects.toThrow();

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('Package not found')
    );
  });

  it('should handle versions fetch failure gracefully', async () => {
    mockGetPackage.mockResolvedValue({
      name: 'pg-mcp',
      scope: '@team',
      full_name: '@team/pg-mcp',
      type: 'mcp',
      description: 'PostgreSQL MCP tool',
    });

    mockGetVersions.mockRejectedValue(new Error('Failed to fetch versions'));

    const { infoCommand } = await import('../../src/commands/info');
    await infoCommand.parseAsync(['node', 'test', '@team/pg-mcp']);

    // 应该仍然显示包信息，只是版本列表获取失败
    expect(mockGetPackage).toHaveBeenCalled();
  });

  it('should display multiple versions', async () => {
    mockGetPackage.mockResolvedValue({
      name: 'pg-mcp',
      scope: '@team',
      full_name: '@team/pg-mcp',
      type: 'mcp',
      description: 'PostgreSQL MCP tool',
      latest_version: '1.3.0',
      downloads_count: 500,
    });

    mockGetVersions.mockResolvedValue({
      items: [
        { version: '1.3.0', tag: 'latest', published_at: '2024-01-20T10:00:00Z', deprecated: false, yanked: false },
        { version: '1.2.0', tag: null, published_at: '2024-01-15T10:00:00Z', deprecated: false, yanked: false },
        { version: '1.1.0', tag: null, published_at: '2024-01-10T10:00:00Z', deprecated: true, yanked: false },
        { version: '1.0.0', tag: null, published_at: '2024-01-01T10:00:00Z', deprecated: false, yanked: true },
      ],
    });

    const { infoCommand } = await import('../../src/commands/info');
    await infoCommand.parseAsync(['node', 'test', '@team/pg-mcp']);

    const logCalls = mockConsoleLog.mock.calls.flat().join('\n');
    expect(logCalls).toContain('1.3.0');
    expect(logCalls).toContain('1.2.0');
    expect(logCalls).toContain('[deprecated]');
    expect(logCalls).toContain('[yanked]');
  });

  it('should show summary warning when latest version is yanked', async () => {
    mockGetPackage.mockResolvedValue({
      name: 'pg-mcp',
      scope: '@team',
      full_name: '@team/pg-mcp',
      type: 'mcp',
      description: 'PostgreSQL MCP tool',
    });

    mockGetVersions.mockResolvedValue({
      items: [
        { version: '2.0.0', tag: 'latest', published_at: '2024-02-01T10:00:00Z', deprecated: false, yanked: true },
        { version: '1.0.0', tag: null, published_at: '2024-01-01T10:00:00Z', deprecated: false, yanked: false },
      ],
    });

    const { infoCommand } = await import('../../src/commands/info');
    await infoCommand.parseAsync(['node', 'test', '@team/pg-mcp']);

    const logCalls = mockConsoleLog.mock.calls.flat().join('\n');
    expect(logCalls).toContain('已撤回');
    expect(logCalls).toContain('2.0.0');
  });

  it('should show summary warning when latest version is deprecated', async () => {
    mockGetPackage.mockResolvedValue({
      name: 'pg-mcp',
      scope: '@team',
      full_name: '@team/pg-mcp',
      type: 'mcp',
      description: 'PostgreSQL MCP tool',
    });

    mockGetVersions.mockResolvedValue({
      items: [
        { version: '2.0.0', tag: 'latest', published_at: '2024-02-01T10:00:00Z', deprecated: true, yanked: false },
        { version: '1.0.0', tag: null, published_at: '2024-01-01T10:00:00Z', deprecated: false, yanked: false },
      ],
    });

    const { infoCommand } = await import('../../src/commands/info');
    await infoCommand.parseAsync(['node', 'test', '@team/pg-mcp']);

    const logCalls = mockConsoleLog.mock.calls.flat().join('\n');
    expect(logCalls).toContain('已废弃');
    expect(logCalls).toContain('2.0.0');
  });
});
