/**
 * akit team packages CLI 测试
 * 基于 docs/specs/team-skill-management.md AC-02/AC-07/AC-08
 *
 * 注意: process.exit 相关错误场景通过手动测试验证
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================================================
// Mock API client
// =============================================================================

const mockListTeamPackages = vi.fn();
const mockListTeams = vi.fn();
const mockGetToken = vi.fn();
const mockGetRegistry = vi.fn();
const mockGetUser = vi.fn();
const mockSetToken = vi.fn();

vi.mock('../../src/api/client', () => ({
  apiClient: {
    listTeamPackages: mockListTeamPackages,
    listTeams: mockListTeams,
    setToken: mockSetToken,
  },
}));

vi.mock('../../src/config/manager', () => ({
  configManager: {
    getToken: mockGetToken,
    getUser: mockGetUser,
    getRegistry: mockGetRegistry,
  },
}));

// Mock console
let mockConsoleLog: ReturnType<typeof vi.spyOn>;

describe('team packages CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockGetToken.mockReturnValue('fake-token');
    mockGetRegistry.mockReturnValue('https://registry.example.com');
    mockGetUser.mockReturnValue({ username: 'testuser' });
    mockSetToken.mockImplementation(() => {});
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
  });

  // ===========================================================================
  // AC-08: akit list --team @frontend
  // ===========================================================================
  describe('akit list --team', () => {
    it('should display team packages with update status (has_update=true)', async () => {
      mockListTeams.mockResolvedValue([
        { id: 'team-1', slug: 'frontend', name: 'Frontend Team' },
      ]);
      mockListTeamPackages.mockResolvedValue([
        {
          id: 'pkg-1',
          name: 'web-search-mcp',
          scope: '@frontend',
          full_name: '@frontend/web-search-mcp',
          type: 'mcp',
          latest_version: 'v1.2.0',
          my_installed_version: 'v1.1.0',
          has_update: true,
          downloads_count: 42,
          visibility: 'team',
          owner_type: 'team',
          created_at: '2026-06-20T00:00:00Z',
          updated_at: '2026-06-20T00:00:00Z',
        },
      ]);

      const { listCommand } = await import('../../src/commands/list');
      await listCommand.parseAsync(['node', 'test', '--team', '@frontend']);

      expect(mockListTeamPackages).toHaveBeenCalledWith('team-1');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('web-search-mcp'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('🔔'));
    });

    it('should show ✓ when package is up to date', async () => {
      mockListTeams.mockResolvedValue([
        { id: 'team-1', slug: 'frontend', name: 'Frontend Team' },
      ]);
      mockListTeamPackages.mockResolvedValue([
        {
          id: 'pkg-2',
          name: 'db-toolkit',
          scope: '@frontend',
          full_name: '@frontend/db-toolkit',
          type: 'mcp',
          latest_version: 'v1.5.0',
          my_installed_version: 'v1.5.0',
          has_update: false,
          downloads_count: 18,
          visibility: 'team',
          owner_type: 'team',
          created_at: '2026-06-20T00:00:00Z',
          updated_at: '2026-06-20T00:00:00Z',
        },
      ]);

      const { listCommand } = await import('../../src/commands/list');
      await listCommand.parseAsync(['node', 'test', '--team', '@frontend']);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('✓'));
    });

    it('should show 未安装 when no installed version', async () => {
      mockListTeams.mockResolvedValue([
        { id: 'team-1', slug: 'frontend', name: 'Frontend Team' },
      ]);
      mockListTeamPackages.mockResolvedValue([
        {
          id: 'pkg-3',
          name: 'auth-skill',
          scope: '@frontend',
          full_name: '@frontend/auth-skill',
          type: 'skill',
          latest_version: 'v0.5.0',
          my_installed_version: null,
          has_update: false,
          downloads_count: 5,
          visibility: 'team',
          owner_type: 'team',
          created_at: '2026-06-20T00:00:00Z',
          updated_at: '2026-06-20T00:00:00Z',
        },
      ]);

      const { listCommand } = await import('../../src/commands/list');
      await listCommand.parseAsync(['node', 'test', '--team', '@frontend']);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('auth-skill'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('未安装'));
    });

    it('should output JSON when --json flag is set', async () => {
      mockListTeams.mockResolvedValue([
        { id: 'team-1', slug: 'frontend', name: 'Frontend Team' },
      ]);
      mockListTeamPackages.mockResolvedValue([
        {
          id: 'pkg-1',
          name: 'web-search-mcp',
          scope: '@frontend',
          full_name: '@frontend/web-search-mcp',
          type: 'mcp',
          latest_version: 'v1.2.0',
          my_installed_version: 'v1.1.0',
          has_update: true,
          downloads_count: 42,
          visibility: 'team',
          owner_type: 'team',
          created_at: '2026-06-20T00:00:00Z',
          updated_at: '2026-06-20T00:00:00Z',
        },
      ]);

      const { listCommand } = await import('../../src/commands/list');
      await listCommand.parseAsync(['node', 'test', '--team', '@frontend', '--json']);

      // Find the JSON output call
      const jsonCall = mockConsoleLog.mock.calls.find((call) => {
        try {
          JSON.parse(call[0] as string);
          return true;
        } catch {
          return false;
        }
      });
      expect(jsonCall).toBeDefined();
      const jsonData = JSON.parse(jsonCall![0] as string);
      expect(jsonData[0].hasUpdate).toBe(true);
    });

    it('should resolve team by slug correctly', async () => {
      mockListTeams.mockResolvedValue([
        { id: 'team-1', slug: 'frontend', name: 'Frontend Team' },
        { id: 'team-2', slug: 'backend', name: 'Backend Team' },
      ]);
      mockListTeamPackages.mockResolvedValue([]);

      const { listCommand } = await import('../../src/commands/list');
      await listCommand.parseAsync(['node', 'test', '--team', '@frontend']);

      expect(mockListTeams).toHaveBeenCalled();
      expect(mockListTeamPackages).toHaveBeenCalledWith('team-1');
    });

    it('should handle multiple team slugs', async () => {
      mockListTeams.mockResolvedValue([
        { id: 'team-1', slug: 'frontend', name: 'Frontend Team' },
        { id: 'team-2', slug: 'backend', name: 'Backend Team' },
      ]);
      mockListTeamPackages
        .mockResolvedValueOnce([
          { name: 'fe-tool', scope: '@frontend', latest_version: 'v1.0.0', has_update: false, downloads_count: 0, visibility: 'team', owner_type: 'team', created_at: '', updated_at: '' },
        ])
        .mockResolvedValueOnce([
          { name: 'be-tool', scope: '@backend', latest_version: 'v2.0.0', has_update: true, downloads_count: 0, visibility: 'team', owner_type: 'team', created_at: '', updated_at: '' },
        ]);

      const { listCommand } = await import('../../src/commands/list');
      await listCommand.parseAsync(['node', 'test', '--team', '@frontend', '@backend']);

      expect(mockListTeamPackages).toHaveBeenCalled();
    });
  });
});
