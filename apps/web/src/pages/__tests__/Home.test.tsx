/**
 * Home 页面测试
 *
 * 测试场景:
 * - 页面渲染
 * - 搜索栏存在
 * - 类型筛选存在
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from '../Home';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'zh' },
  }),
}));

// Mock usePackages hook
vi.mock('../../hooks/usePackages', () => ({
  usePackages: vi.fn(() => ({
    data: {
      data: [],
      pagination: { total: 0, page: 1, pageSize: 20, totalPages: 0 },
    },
    isLoading: false,
    error: null,
  })),
}));

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    // 页面应该渲染成功
    expect(document.body).toBeTruthy();
  });

  it('should render search input', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    // 应该有搜索输入框
    const searchInput = screen.queryByRole('searchbox') ||
      screen.queryByPlaceholderText(/search|搜索/i) ||
      screen.queryByRole('textbox');
    expect(searchInput).toBeInTheDocument();
  });

  it('should render type filter buttons', async () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    // 应该有类型筛选相关的按钮
    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  it('should render hero section', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    // 应该有标题或欢迎文字
    const heading = screen.queryByRole('heading') ||
      screen.queryByText(/agent kit|包管理/i);
    expect(heading).toBeInTheDocument();
  });
});
