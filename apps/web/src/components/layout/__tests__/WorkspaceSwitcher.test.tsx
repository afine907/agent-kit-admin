/**
 * WorkspaceSwitcher 组件测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceSwitcher } from '../WorkspaceSwitcher';

// Mock zustand/middleware before any store imports
vi.mock('zustand/middleware', () => ({
  persist: vi.fn(() => (fn: any) => fn),
}));

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

// Mock authStore
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: '1', username: 'testuser', display_name: 'Test User', avatar_url: undefined },
    isAuthenticated: true,
    isAdmin: false,
    clearAuth: vi.fn(),
  })),
}));

// Mock workspaceStore
vi.mock('../../../stores/workspaceStore', () => ({
  useWorkspaceStore: vi.fn(() => ({
    current: null,
    workspaces: [],
    isLoading: false,
    setCurrent: vi.fn(),
    addWorkspace: vi.fn(),
    removeWorkspace: vi.fn(),
    setWorkspaces: vi.fn(),
    setLoading: vi.fn(),
    getScope: () => null,
    isTeamWorkspace: () => false,
  })),
}));

// Mock api
vi.mock('../../../lib/api', () => ({
  api: {
    listTeams: vi.fn(),
  },
}));

import { api } from '../../../lib/api';

function renderSwitcher() {
  return render(
    <MemoryRouter>
      <WorkspaceSwitcher />
    </MemoryRouter>
  );
}

describe('WorkspaceSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('渲染切换按钮', () => {
    renderSwitcher();
    expect(screen.getByText('@testuser')).toBeInTheDocument();
  });

  it('点击按钮展开下拉', async () => {
    renderSwitcher();
    fireEvent.click(screen.getByText('@testuser'));

    await waitFor(() => {
      expect(screen.getByText(/personal/i)).toBeInTheDocument();
    });
  });

  it('加载团队后显示团队选项', async () => {
    vi.mocked(api.listTeams).mockResolvedValue([
      { id: 't1', name: 'Test Team', slug: 'test-team', avatar_url: undefined, member_count: 2, created_at: '' },
    ]);
    renderSwitcher();
    fireEvent.click(screen.getByText('@testuser'));

    await waitFor(() => {
      expect(screen.getByText('Test Team')).toBeInTheDocument();
    });
  });
});
