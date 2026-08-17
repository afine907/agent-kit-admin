/**
 * Agent 页面测试
 *
 * 测试场景：
 * - 未登录时显示登录提示
 * - 已登录时渲染 Skill 选择器和聊天组件
 * - 搜索包并选中后传递给 SkillChat
 * - 从 URL 参数初始化选中状态
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Agent from '../Agent';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'en' },
  }),
}));

// Mock react-router-dom
const mockSetSearchParams = vi.fn();
vi.mock('react-router-dom', () => ({
  useSearchParams: () => {
    const params = new URLSearchParams();
    return [params, mockSetSearchParams];
  },
}));

// Mock auth store
import { useAuthStore } from '../../stores/authStore';
vi.mock('../../stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

// Mock api
const mockListPackages = vi.fn();
const mockGetContent = vi.fn();
vi.mock('../../lib/api', () => ({
  api: {
    listPackages: (...args: unknown[]) => mockListPackages(...args),
    getContent: (...args: unknown[]) => mockGetContent(...args),
    agent: { chat: vi.fn().mockResolvedValue(undefined) },
  },
}));

describe('Agent page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockImplementation(() => ({
      isAuthenticated: true,
      user: null,
      isAdmin: false,
      getToken: () => null,
      getRefreshToken: () => null,
      setAuth: vi.fn(),
      updateToken: vi.fn(),
      clearAuth: vi.fn(),
    }));
  });

  it('shows login required when not authenticated', () => {
    vi.mocked(useAuthStore).mockImplementation(() => ({
      isAuthenticated: false,
      user: null,
      isAdmin: false,
      getToken: () => null,
      getRefreshToken: () => null,
      setAuth: vi.fn(),
      updateToken: vi.fn(),
      clearAuth: vi.fn(),
    }));
    render(<Agent />);
    expect(screen.getByText('agent.loginRequired')).toBeInTheDocument();
  });

  it('renders title and search when authenticated', () => {
    render(<Agent />);
    expect(screen.getByText('agent.title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('agent.searchPlaceholder')).toBeInTheDocument();
  });

  it('searches packages and displays results', async () => {
    const user = userEvent.setup();
    mockListPackages.mockResolvedValue({
      data: [
        {
          id: '1',
          name: 'web-search',
          scope: '@test',
          full_name: '@test/web-search',
          type: 'skill',
          description: 'Search the web',
          latest_version: '1.0.0',
          downloads_count: 0,
          tags: [],
          created_at: '',
          updated_at: '',
        },
      ],
      pagination: { page: 1, per_page: 10, total: 1, total_pages: 1 },
    });
    mockGetContent.mockResolvedValue({
      content: 'skill content',
      source: 'inline',
      package: { scope: '@test', name: 'web-search', full_name: '@test/web-search' },
      version: '1.0.0',
    });

    render(<Agent />);

    const searchInput = screen.getByPlaceholderText('agent.searchPlaceholder');
    await user.type(searchInput, 'web');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('@test/web-search')).toBeInTheDocument();
    });
  });

  it('selects a skill and updates URL params', async () => {
    const user = userEvent.setup();
    mockListPackages.mockResolvedValue({
      data: [
        {
          id: '1',
          name: 'web-search',
          scope: '@test',
          full_name: '@test/web-search',
          type: 'skill',
          description: 'Search',
          latest_version: '1.0.0',
          downloads_count: 0,
          tags: [],
          created_at: '',
          updated_at: '',
        },
      ],
      pagination: { page: 1, per_page: 10, total: 1, total_pages: 1 },
    });
    mockGetContent.mockResolvedValue({
      content: 'content',
      source: 'inline',
      package: { scope: '@test', name: 'web-search', full_name: '@test/web-search' },
      version: '1.0.0',
    });

    render(<Agent />);

    const searchInput = screen.getByPlaceholderText('agent.searchPlaceholder');
    await user.type(searchInput, 'web');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('@test/web-search')).toBeInTheDocument();
    });

    await user.click(screen.getByText('@test/web-search'));

    expect(mockSetSearchParams).toHaveBeenCalledWith(
      expect.objectContaining({ scope: '@test', name: 'web-search', version: '1.0.0' }),
      { replace: true },
    );
  });
});
