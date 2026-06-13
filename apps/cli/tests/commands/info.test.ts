/**
 * info 命令测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock API client
vi.mock('../../src/api/client', () => ({
  apiClient: {
    getPackage: vi.fn(),
    getVersions: vi.fn(),
  },
}));

describe('info command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
