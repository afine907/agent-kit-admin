/**
 * #13 版本号自动递增建议测试
 *
 * 测试场景：
 * - 有历史版本时建议 patch +1
 * - 无历史版本时建议 0.0.1
 * - 预发布版本不参与建议
 *
 * 使用依赖注入模式，直接传入 mock fetcher，无需 mock 模块。
 */

import { describe, it, expect, vi } from 'vitest';
import { suggestNextVersion, type VersionFetcher } from '../src/utils/version-suggest';

/** 创建 mock fetcher */
function createMockFetcher(items: { version: string }[] = []): VersionFetcher {
  return vi.fn().mockResolvedValue({ items });
}

describe('#13 版本号自动递增建议', () => {
  it('应该建议 0.0.1 当没有历史版本时', async () => {
    const fetcher = createMockFetcher([]);
    const result = await suggestNextVersion('@team', 'my-package', fetcher);
    expect(result).toBe('0.0.1');
  });

  it('应该建议 1.0.1 当最新版本是 1.0.0 时', async () => {
    const fetcher = createMockFetcher([{ version: '1.0.0' }]);
    const result = await suggestNextVersion('@team', 'my-package', fetcher);
    expect(result).toBe('1.0.1');
  });

  it('应该建议 2.3.4 当最新版本是 2.3.3 时', async () => {
    const fetcher = createMockFetcher([{ version: '2.3.3' }]);
    const result = await suggestNextVersion('@team', 'my-package', fetcher);
    expect(result).toBe('2.3.4');
  });

  it('应该忽略预发布版本', async () => {
    const fetcher = createMockFetcher([
      { version: '1.0.0-beta.1' },
      { version: '0.9.0' },
    ]);
    const result = await suggestNextVersion('@team', 'my-package', fetcher);
    expect(result).toBe('0.9.1');
  });

  it('应该建议 0.0.1 当所有版本都是预发布版本', async () => {
    const fetcher = createMockFetcher([
      { version: '1.0.0-alpha.1' },
      { version: '1.0.0-beta.2' },
    ]);
    const result = await suggestNextVersion('@team', 'my-package', fetcher);
    expect(result).toBe('0.0.1');
  });

  it('应该在 API 调用失败时返回 0.0.1', async () => {
    const fetcher: VersionFetcher = vi.fn().mockRejectedValue(new Error('Network error'));
    const result = await suggestNextVersion('@team', 'my-package', fetcher);
    expect(result).toBe('0.0.1');
  });

  it('应该正确排序多版本号', async () => {
    const fetcher = createMockFetcher([
      { version: '1.0.0' },
      { version: '2.1.0' },
      { version: '1.5.3' },
      { version: '2.0.9' },
    ]);
    const result = await suggestNextVersion('@team', 'my-package', fetcher);
    expect(result).toBe('2.1.1');
  });
});
