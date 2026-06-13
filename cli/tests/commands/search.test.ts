/**
 * search 命令测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock API client
vi.mock('../../src/api/client', () => ({
  apiClient: {
    listPackages: vi.fn(),
  },
}));

describe('search command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct command definition', async () => {
    const { searchCommand } = await import('../../src/commands/search');
    expect(searchCommand.name()).toBe('search');
    expect(searchCommand.description()).toContain('搜索');
  });
});
