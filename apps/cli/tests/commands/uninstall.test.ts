/**
 * akit uninstall 命令测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uninstallCommand } from '../../src/commands/uninstall';

describe('uninstall --all', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should expose --all flag', () => {
    const opt = uninstallCommand.options.find((o) => o.long === '--all');
    expect(opt).toBeDefined();
  });

  it('should expose --force flag', () => {
    const opt = uninstallCommand.options.find((o) => o.long === '--force');
    expect(opt).toBeDefined();
  });
});
