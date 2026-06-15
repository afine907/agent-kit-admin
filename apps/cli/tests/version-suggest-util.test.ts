/**
 * #13 版本号建议 - 纯函数测试（不需要 mock）
 */

import { describe, it, expect } from 'vitest';

describe('#13 版本号建议 - 纯函数', () => {
  describe('isPrerelease', () => {
    it('应该识别预发布版本', async () => {
      const { isPrerelease } = await import('../src/utils/version-utils');
      expect(isPrerelease('1.0.0-alpha.1')).toBe(true);
      expect(isPrerelease('1.0.0-beta.2')).toBe(true);
      expect(isPrerelease('1.0.0-rc.1')).toBe(true);
    });

    it('应该识别正式版本', async () => {
      const { isPrerelease } = await import('../src/utils/version-utils');
      expect(isPrerelease('1.0.0')).toBe(false);
      expect(isPrerelease('2.3.4')).toBe(false);
    });
  });

  describe('getNextPatchVersion', () => {
    it('应该递增 patch 版本号', async () => {
      const { getNextPatchVersion } = await import('../src/utils/version-utils');
      expect(getNextPatchVersion('1.0.0')).toBe('1.0.1');
      expect(getNextPatchVersion('1.0.1')).toBe('1.0.2');
      expect(getNextPatchVersion('2.3.9')).toBe('2.3.10');
    });

    it('应该处理多位数版本号', async () => {
      const { getNextPatchVersion } = await import('../src/utils/version-utils');
      expect(getNextPatchVersion('0.0.0')).toBe('0.0.1');
      expect(getNextPatchVersion('99.99.99')).toBe('99.99.100');
    });
  });
});
