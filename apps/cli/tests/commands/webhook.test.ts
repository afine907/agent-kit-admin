/**
 * webhook 命令测试
 * Task 5 of PLAN_phase4_ecosystem
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock config manager
const mockGetToken = vi.fn();
vi.mock('../../src/config/manager', () => ({
  configManager: { getToken: mockGetToken },
}));

// Mock API client
const mockListWebhooks = vi.fn();
const mockCreateWebhook = vi.fn();
const mockDeleteWebhook = vi.fn();
const mockListTeams = vi.fn();
vi.mock('../../src/api/client', () => ({
  apiClient: {
    setToken: vi.fn(),
    listWebhooks: mockListWebhooks,
    createWebhook: mockCreateWebhook,
    deleteWebhook: mockDeleteWebhook,
    listTeams: mockListTeams,
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

describe('webhook command', () => {
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
    const { webhookCommand } = await import('../../src/commands/webhook');
    expect(webhookCommand.name()).toBe('webhook');
    expect(webhookCommand.commands).toHaveLength(3);
    expect(webhookCommand.commands.find((c: any) => c.name() === 'list')).toBeDefined();
    expect(webhookCommand.commands.find((c: any) => c.name() === 'add')).toBeDefined();
    expect(webhookCommand.commands.find((c: any) => c.name() === 'remove')).toBeDefined();
  });

  it('should list webhooks successfully', async () => {
    mockListTeams.mockResolvedValue([{ id: 'team-123', slug: 'my-team' }]);
    mockListWebhooks.mockResolvedValue([
      {
        id: 'wh-abc',
        team_id: 'team-123',
        url: 'https://example.com/webhook',
        events: ['publish', 'delete'],
        created_at: '2024-01-01T00:00:00Z',
        last_triggered_at: '2024-01-02T00:00:00Z',
      },
    ]);

    const { webhookCommand } = await import('../../src/commands/webhook');
    const listCmd = webhookCommand.commands.find((c) => c.name() === 'list')!;
    await listCmd.parseAsync(['node', 'test', '--team', '@my-team']);

    expect(mockListWebhooks).toHaveBeenCalledWith('team-123');
  });

  it('should report error when not logged in', async () => {
    mockGetToken.mockReturnValue(null);

    const { webhookCommand } = await import('../../src/commands/webhook');
    const listCmd = webhookCommand.commands.find((c) => c.name() === 'list')!;

    await expect(listCmd.parseAsync(['node', 'test', '--team', '@my-team'])).rejects.toThrow('exit');
    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('未登录'));
  });

  it('should create webhook successfully', async () => {
    mockListTeams.mockResolvedValue([{ id: 'team-123', slug: 'my-team' }]);
    mockCreateWebhook.mockResolvedValue({
      id: 'wh-new',
      team_id: 'team-123',
      url: 'https://example.com/hook',
      events: ['publish'],
      created_at: '2024-01-01T00:00:00Z',
    });

    const { webhookCommand } = await import('../../src/commands/webhook');
    const addCmd = webhookCommand.commands.find((c) => c.name() === 'add')!;
    await addCmd.parseAsync([
      'node', 'test',
      '--team', '@my-team',
      '--url', 'https://example.com/hook',
      '--events', 'publish',
    ]);

    expect(mockCreateWebhook).toHaveBeenCalledWith('team-123', {
      url: 'https://example.com/hook',
      events: ['publish'],
    });
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
  });

  it('should reject invalid event types', async () => {
    mockListTeams.mockResolvedValue([{ id: 'team-123', slug: 'my-team' }]);

    const { webhookCommand } = await import('../../src/commands/webhook');
    const addCmd = webhookCommand.commands.find((c) => c.name() === 'add')!;

    await expect(
      addCmd.parseAsync([
        'node', 'test',
        '--team', '@my-team',
        '--url', 'https://example.com/hook',
        '--events', 'invalid_event',
      ])
    ).rejects.toThrow('exit');
    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('无效的事件类型'));
  });

  it('should delete webhook with confirmation', async () => {
    mockListTeams.mockResolvedValue([{ id: 'team-123', slug: 'my-team' }]);
    mockDeleteWebhook.mockResolvedValue(undefined);

    const { webhookCommand } = await import('../../src/commands/webhook');
    const removeCmd = webhookCommand.commands.find((c) => c.name() === 'remove')!;
    await removeCmd.parseAsync([
      'node', 'test',
      '--team', '@my-team',
      '--id', 'wh-abc123',
      '--yes',
    ]);

    expect(mockDeleteWebhook).toHaveBeenCalledWith('team-123', 'wh-abc123');
    expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
  });

  it('should report error when team not found', async () => {
    mockListTeams.mockResolvedValue([{ id: 'team-123', slug: 'other-team' }]);

    const { webhookCommand } = await import('../../src/commands/webhook');
    const listCmd = webhookCommand.commands.find((c) => c.name() === 'list')!;

    await expect(
      listCmd.parseAsync(['node', 'test', '--team', '@nonexistent'])
    ).rejects.toThrow('exit');
    expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('不存在'));
  });
});
