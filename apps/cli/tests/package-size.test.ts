/**
 * #11 包大小预检测试
 *
 * 测试场景：
 * - 超过 100MB 时返回警告
 * - 未超过时正常通过
 * - 边界值测试（恰好 100MB）
 */

import { describe, it, expect } from 'vitest';

describe('#11 包大小预检', () => {
  it('应该允许小于 100MB 的包', async () => {
    const { checkPackageSize } = await import('../src/utils/package-size');
    const result = checkPackageSize(50 * 1024 * 1024); // 50MB
    expect(result.ok).toBe(true);
    expect(result.size).toBe(50 * 1024 * 1024);
  });

  it('应该拒绝超过 100MB 的包', async () => {
    const { checkPackageSize } = await import('../src/utils/package-size');
    const size = 150 * 1024 * 1024; // 150MB
    const result = checkPackageSize(size);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('150.0 MB');
    expect(result.message).toContain('100 MB');
  });

  it('应该允许恰好 100MB 的包', async () => {
    const { checkPackageSize } = await import('../src/utils/package-size');
    const size = 100 * 1024 * 1024; // 100MB
    const result = checkPackageSize(size);
    expect(result.ok).toBe(true);
  });

  it('应该拒绝恰好超过 100MB 的包', async () => {
    const { checkPackageSize } = await import('../src/utils/package-size');
    const size = 100 * 1024 * 1024 + 1; // 100MB + 1 byte
    const result = checkPackageSize(size);
    expect(result.ok).toBe(false);
  });

  it('应该支持自定义包名', async () => {
    const { checkPackageSize } = await import('../src/utils/package-size');
    const size = 150 * 1024 * 1024;
    const result = checkPackageSize(size, 'my-package');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('my-package');
  });

  it('应该正确格式化大小显示', async () => {
    const { checkPackageSize } = await import('../src/utils/package-size');
    const size = 200 * 1024 * 1024; // 200MB
    const result = checkPackageSize(size);
    expect(result.message).toContain('200.0 MB');
  });
});
