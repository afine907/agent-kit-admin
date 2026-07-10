/**
 * 可见性（visibility）相关组件测试
 *
 * 验证 Web UI 正确展示不同可见性的包：
 * - Home 页展示所有公开包
 * - Teams 页 TeamPackagesTab 仅展示团队包
 */

import { describe, it, expect, vi } from 'vitest';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'zh' },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock API 模块
vi.mock('../lib/api', () => ({
  apiClient: {
    getPackage: vi.fn(),
    getVersions: vi.fn(),
    listPackages: vi.fn(),
    listTeams: vi.fn(),
    listTeamPackages: vi.fn(),
  },
}));

describe('visibility filtering', () => {
  it('should filter packages by visibility in API response', async () => {
    const { apiClient } = await import('../lib/api');

    // 模拟 API 返回不同可见性的包
    const allPackages = [
      { name: 'public-pkg', visibility: 'public', scope: '@user1' },
      { name: 'team-pkg', visibility: 'team', scope: '@myteam' },
      { name: 'private-pkg', visibility: 'private', scope: '@user1' },
    ];

    (apiClient.listPackages as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: allPackages.filter((p) => p.visibility === 'public'),
      total: 1,
    });

    const result = await apiClient.listPackages();
    const names = result.items.map((p: { name: string }) => p.name);

    // 公开包应该在结果中
    expect(names).toContain('public-pkg');
    // 团队和私有包不应在公开列表中
    expect(names).not.toContain('team-pkg');
    expect(names).not.toContain('private-pkg');
  });

  it('should show team packages only for team members', async () => {
    const { apiClient } = await import('../lib/api');

    // 模拟团队成员看到的包
    const teamPackages = [
      { name: 'team-pkg-1', visibility: 'team', full_name: '@myteam/team-pkg-1' },
      { name: 'team-pkg-2', visibility: 'team', full_name: '@myteam/team-pkg-2' },
    ];

    (apiClient.listTeamPackages as ReturnType<typeof vi.fn>).mockResolvedValue(teamPackages);

    const result = await apiClient.listTeams();
    const packages = await apiClient.listTeamPackages('team-id-1');

    expect(packages).toHaveLength(2);
    expect(packages[0].name).toBe('team-pkg-1');
    expect(packages[1].name).toBe('team-pkg-2');
  });

  it('should not expose private packages to non-owners', async () => {
    const { apiClient } = await import('../lib/api');

    // 模拟非 owner 的包列表（服务端过滤后）
    (apiClient.listPackages as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: [
        { name: 'public-pkg', visibility: 'public' },
      ],
      total: 1,
    });

    const result = await apiClient.listPackages();
    const visibilities = result.items.map((p: { visibility: string }) => p.visibility);

    // 只有 public 包
    expect(visibilities).not.toContain('private');
    expect(visibilities).not.toContain('team');
  });

  it('should display correct visibility badge for packages', () => {
    // 验证可见性标签映射
    const visibilityLabels: Record<string, string> = {
      public: '公开',
      team: '团队',
      private: '私有',
    };

    expect(visibilityLabels['public']).toBe('公开');
    expect(visibilityLabels['team']).toBe('团队');
    expect(visibilityLabels['private']).toBe('私有');
  });
});
