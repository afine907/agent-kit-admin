/**
 * #13 版本号自动递增建议测试
 *
 * 测试场景：
 * - 有历史版本时建议 patch +1
 * - 无历史版本时建议 0.0.1
 * - 预发布版本不参与建议
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// 使用 vi.hoisted 定义 mock 变量，避免 hoisting 问题
const { mockGetVersions } = vi.hoisted(() => ({
  mockGetVersions: vi.fn(),
}));

// Mock configManager
vi.mock('../src/config/manager', () => ({
  configManager: {
    getToken: vi.fn().mockReturnValue('test-token'),
    getRegistry: vi.fn().mockReturnValue('http://localhost:3000'),
  },
}));

// Mock API client
vi.mock('../src/api/client', () => ({
  apiClient: {
    getVersions: mockGetVersions,
  },
}));

import { suggestNextVersion } from '../src/utils/version-suggest';

describe('#13 版本号自动递增建议', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该建议 0.0.1 当没有历史版本时', async () => {
    mockGetVersions.mockResolvedValue({ items: [] });

    const result = await suggestNextVersion('@team', 'my-package');
    expect(result).toBe('0.0.1');
  });

  it('应该建议 1.0.1 当最新版本是 1.0.0 时', async () => {
    mockGetVersions.mockResolvedValue({
      items: [{ version: '1.0.0' }],
    });

    const result = await suggestNextVersion('@team', 'my-package');
    expect(result).toBe('1.0.1');
  });

  it('应该建议 2.3.4 当最新版本是 2.3.3 时', async () => {
    mockGetVersions.mockResolvedValue({
      items: [{ version: '2.3.3' }],
    });

    const result = await suggestNextVersion('@team', 'my-package');
    expect(result).toBe('2.3.4');
  });

  it('应该忽略预发布版本', async () => {
    mockGetVersions.mockResolvedValue({
      items: [
        { version: '1.0.0-beta.1' },
        { version: '0.9.0' },
      ],
    });

    const result = await suggestNextVersion('@team', 'my-package');
    expect(result).toBe('0.9.1');
  });

  it('应该建议 0.0.1 当所有版本都是预发布版本', async () => {
    mockGetVersions.mockResolvedValue({
      items: [
        { version: '1.0.0-alpha.1' },
        { version: '1.0.0-beta.2' },
      ],
    });

    const result = await suggestNextVersion('@team', 'my-package');
    expect(result).toBe('0.0.1');
  });

  it('应该在 API 调用失败时返回 0.0.1', async () => {
    mockGetVersions.mockRejectedValue(new Error('Network error'));

    const result = await suggestNextVersion('@team', 'my-package');
    expect(result).toBe('0.0.1');
  });
});
