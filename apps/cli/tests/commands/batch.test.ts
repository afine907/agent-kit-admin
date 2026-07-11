/**
 * batch 命令测试
 * Task 6 of PLAN_phase4_ecosystem
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config manager
const mockGetToken = vi.fn();
vi.mock('../../src/config/manager', () => ({
  configManager: { getToken: mockGetToken },
}));

// Mock API client
const mockBatchDeletePackages = vi.fn();
const mockBatchDeprecatePackages = vi.fn();
vi.mock('../../src/api/client', () => ({
  apiClient: {
    setToken: vi.fn(),
    batchDeletePackages: mockBatchDeletePackages,
    batchDeprecatePackages: mockBatchDeprecatePackages,
  },
}));

// Mock inquirer
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn().mockResolvedValue({ confirmed: true }),
  },
}));

let mockConsoleLog: ReturnType<typeof vi.spyOn>;
let mockConsoleError: ReturnType<typeof vi.spyOn>;
let mockProcessExit: ReturnType<typeof vi.spyOn>;

describe('batch command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockReturnValue('fake-token');
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
  });

  it('should have correct command structure', async () => {
    const { batchCommand } = await import('../../src/commands/batch');
    expect(batchCommand.name()).toBe('batch');
    expect(batchCommand.commands).toHaveLength(2);
    expect(batchCommand.commands.find((c: any) => c.name() === 'delete')).toBeDefined();
    expect(batchCommand.commands.find((c: any) => c.name() === 'deprecate')).toBeDefined();
  });

  it('should delete packages with confirmation', async () => {
    mockBatchDeletePackages.mockResolvedValue({
      success: ['@owner/pkg1', '@owner/pkg2'],
      failed: [],
    });

    const { batchCommand } = await import('../../src/commands/batch');
    const deleteCmd = batchCommand.commands.find((c: any) => c.name() === 'delete')!;
    await deleteCmd.parseAsync(['node', 'test', '@owner/pkg1', '@owner/pkg2']);

    expect(mockBatchDeletePackages).toHaveBeenCalledWith(['@owner/pkg1', '@owner/pkg2']);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
  });

  it('should deprecate packages with confirmation', async () => {
    mockBatchDeprecatePackages.mockResolvedValue({
      success: ['@owner/pkg1'],
      failed: [],
    });

    const { batchCommand } = await import('../../src/commands/batch');
    const deprecateCmd = batchCommand.commands.find((c: any) => c.name() === 'deprecate')!;
    await deprecateCmd.parseAsync(['node', 'test', '@owner/pkg1']);

    expect(mockBatchDeprecatePackages).toHaveBeenCalledWith(['@owner/pkg1'], true);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('废弃'));
  });

  it('should un-deprecate with --undeprecate flag', async () => {
    mockBatchDeprecatePackages.mockResolvedValue({
      success: ['@owner/pkg1'],
      failed: [],
    });

    const { batchCommand } = await import('../../src/commands/batch');
    const deprecateCmd = batchCommand.commands.find((c: any) => c.name() === 'deprecate')!;
    await deprecateCmd.parseAsync(['node', 'test', '@owner/pkg1', '--undeprecate']);

    expect(mockBatchDeprecatePackages).toHaveBeenCalledWith(['@owner/pkg1'], false);
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('取消废弃'));
  });

  it('should show failed packages in result', async () => {
    mockBatchDeletePackages.mockResolvedValue({
      success: ['@owner/pkg1'],
      failed: [{ name: '@owner/pkg2', error: 'Permission denied' }],
    });

    const { batchCommand } = await import('../../src/commands/batch');
    const deleteCmd = batchCommand.commands.find((c: any) => c.name() === 'delete')!;
    await deleteCmd.parseAsync(['node', 'test', '@owner/pkg1', '@owner/pkg2']);

    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('✖'));
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Permission denied'));
  });

  it('should report error when not logged in', async () => {
    mockGetToken.mockReturnValue(null);

    const { batchCommand } = await import('../../src/commands/batch');
    const deleteCmd = batchCommand.commands.find((c: any) => c.name() === 'delete')!;

    await expect(
      deleteCmd.parseAsync(['node', 'test', '@owner/pkg1'])
    ).rejects.toThrow('exit');
    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('未登录'));
  });
});
