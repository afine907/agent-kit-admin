/**
 * search 命令测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock API client
const mockListPackages = vi.fn();
vi.mock('../../src/api/client', () => ({
  apiClient: {
    listPackages: mockListPackages,
  },
}));

// Mock console - 在 beforeEach 中创建，afterEach 中恢复
let mockConsoleLog: ReturnType<typeof vi.spyOn>;
let mockConsoleError: ReturnType<typeof vi.spyOn>;

describe('search command', () => {
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
    const { searchCommand } = await import('../../src/commands/search');
    expect(searchCommand.name()).toBe('search');
    expect(searchCommand.description()).toContain('搜索');
  });

  it('should display search results', async () => {
    mockListPackages.mockResolvedValue({
      items: [
        {
          scope: '@team',
          name: 'pg-mcp',
          type: 'mcp',
          description: 'PostgreSQL MCP tool',
          latest_version: '1.2.0',
          downloads_count: 234,
        },
        {
          scope: '@team',
          name: 'redis-mcp',
          type: 'mcp',
          description: 'Redis MCP tool',
          latest_version: '1.0.0',
          downloads_count: 156,
        },
      ],
      total: 2,
      page: 1,
      per_page: 20,
    });

    const { searchCommand } = await import('../../src/commands/search');
    await searchCommand.parseAsync(['node', 'test', 'database']);

    expect(mockListPackages).toHaveBeenCalledWith({
      search: 'database',
      type: undefined,
      page: 1,
      per_page: 20,
    });

    expect(mockConsoleLog).toHaveBeenCalled();
  });

  it('should display empty message when no results', async () => {
    mockListPackages.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      per_page: 20,
    });

    const { searchCommand } = await import('../../src/commands/search');
    await searchCommand.parseAsync(['node', 'test', 'nonexistent']);

    expect(mockConsoleLog).toHaveBeenCalledWith(
      expect.stringContaining('未找到匹配的包')
    );
  });

  it('should filter by type', async () => {
    mockListPackages.mockResolvedValue({
      items: [
        {
          scope: '@team',
          name: 'pg-mcp',
          type: 'mcp',
          description: 'PostgreSQL MCP tool',
          latest_version: '1.2.0',
          downloads_count: 234,
        },
      ],
      total: 1,
      page: 1,
      per_page: 20,
    });

    const { searchCommand } = await import('../../src/commands/search');
    await searchCommand.parseAsync(['node', 'test', 'database', '--type', 'mcp']);

    expect(mockListPackages).toHaveBeenCalledWith({
      search: 'database',
      type: 'mcp',
      page: 1,
      per_page: 20,
    });
  });

  it('should handle pagination', async () => {
    mockListPackages.mockResolvedValue({
      items: [],
      total: 50,
      page: 2,
      per_page: 10,
    });

    const { searchCommand } = await import('../../src/commands/search');
    await searchCommand.parseAsync(['node', 'test', 'test', '--page', '2', '--limit', '10']);

    expect(mockListPackages).toHaveBeenCalledWith({
      search: 'test',
      type: undefined,
      page: 2,
      per_page: 10,
    });
  });

  it('should handle API errors', async () => {
    mockListPackages.mockRejectedValue(new Error('Network error'));

    const { searchCommand } = await import('../../src/commands/search');

    // searchCommand 内部会调用 process.exit(1)，这里验证错误被正确处理
    // 使用 rejects.toThrow 验证抛出的异常
    await expect(
      searchCommand.parseAsync(['node', 'test', 'test'])
    ).rejects.toThrow();

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining('搜索失败')
    );
  });
});
