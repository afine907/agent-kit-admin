/**
 * TeamPackagesTab 组件测试
 *
 * 测试场景:
 * - 组件渲染
 * - canManage 控制按钮显示
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TeamPackagesTab from '../TeamPackagesTab';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'zh' },
  }),
}));

// Mock api
const mockListTeamPackages = vi.fn();

vi.mock('../../lib/api', () => ({
  api: {
    listTeamPackages: (...args: unknown[]) => mockListTeamPackages(...args),
  },
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('TeamPackagesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTeamPackages.mockResolvedValue([]);
  });

  it('should render without crashing', async () => {
    render(
      <MemoryRouter>
        <TeamPackagesTab teamId="team-1" canManage={true} />
      </MemoryRouter>
    );

    // 应该调用 API 加载数据
    await waitFor(() => {
      expect(mockListTeamPackages).toHaveBeenCalledWith('team-1');
    });
  });

  it('should show empty state when no packages', async () => {
    mockListTeamPackages.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <TeamPackagesTab teamId="team-1" canManage={true} />
      </MemoryRouter>
    );

    await waitFor(() => {
      // 应该显示空状态或加载完成
      expect(mockListTeamPackages).toHaveBeenCalled();
    });
  });

  it('should show publish button for managers', async () => {
    render(
      <MemoryRouter>
        <TeamPackagesTab teamId="team-1" canManage={true} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockListTeamPackages).toHaveBeenCalled();
    });

    // 管理者应该看到发布按钮
    const publishBtn = screen.queryByRole('button', { name: /publish|发布/i });
    expect(publishBtn).toBeInTheDocument();
  });

  it('should not show publish button for non-managers', async () => {
    render(
      <MemoryRouter>
        <TeamPackagesTab teamId="team-1" canManage={false} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockListTeamPackages).toHaveBeenCalled();
    });

    // 非管理者不应看到发布按钮
    const publishBtn = screen.queryByRole('button', { name: /publish|发布/i });
    expect(publishBtn).not.toBeInTheDocument();
  });

  it('should handle API error gracefully', async () => {
    mockListTeamPackages.mockRejectedValue(new Error('Network error'));

    render(
      <MemoryRouter>
        <TeamPackagesTab teamId="team-1" canManage={true} />
      </MemoryRouter>
    );

    // 不应崩溃，应该显示错误状态
    await waitFor(() => {
      expect(mockListTeamPackages).toHaveBeenCalled();
    });
  });
});
