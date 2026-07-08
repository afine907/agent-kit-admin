/**
 * AuthCallback 页面测试
 *
 * 测试场景:
 * - 正常 token 提取和存储
 * - 登录后重定向
 * - 缺少 token 的错误处理
 * - 用户信息解析
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthCallback from '../AuthCallback';
import { useAuthStore } from '@/stores/authStore';

// Mock react-router-dom 的 useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Helper to create a valid JWT-like token for testing
function createTestToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const signature = 'test-signature';
  return `${header}.${body}.${signature}`;
}

describe('AuthCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset auth store
    useAuthStore.getState().clearAuth();
  });

  it('should extract token and redirect to home', async () => {
    const token = createTestToken({
      sub: 'user-123',
      username: 'testuser',
      display_name: 'Test User',
    });

    render(
      <MemoryRouter initialEntries={[`/auth/callback?token=${token}`]}>
        <AuthCallback />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });

    // Verify token was stored
    const state = useAuthStore.getState();
    expect(state.token).toBe(token);
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.username).toBe('testuser');
  });

  it('should redirect to custom returnTo path', async () => {
    const token = createTestToken({
      sub: 'user-123',
      username: 'testuser',
    });

    render(
      <MemoryRouter initialEntries={[`/auth/callback?token=${token}&returnTo=/dashboard`]}>
        <AuthCallback />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('should show error when token is missing', async () => {
    render(
      <MemoryRouter initialEntries={['/auth/callback']}>
        <AuthCallback />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/未收到认证令牌/)).toBeInTheDocument();
    });

    // Should have a link to login
    expect(screen.getByText('返回登录')).toBeInTheDocument();
  });

  it('should show error when token is empty string', async () => {
    render(
      <MemoryRouter initialEntries={['/auth/callback?token=']}>
        <AuthCallback />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/未收到认证令牌/)).toBeInTheDocument();
    });
  });

  it('should parse user from user parameter', async () => {
    const token = 'some-token';
    const user = JSON.stringify({
      id: 'user-456',
      username: 'oauth-user',
      display_name: 'OAuth User',
    });

    render(
      <MemoryRouter initialEntries={[`/auth/callback?token=${token}&user=${encodeURIComponent(user)}`]}>
        <AuthCallback />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });

    const state = useAuthStore.getState();
    expect(state.user?.id).toBe('user-456');
    expect(state.user?.username).toBe('oauth-user');
  });

  it('should store refresh token when provided', async () => {
    const token = createTestToken({ sub: 'user-123', username: 'testuser' });
    const refreshToken = 'refresh-token-abc';

    render(
      <MemoryRouter initialEntries={[`/auth/callback?token=${token}&refresh_token=${refreshToken}`]}>
        <AuthCallback />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });

    const state = useAuthStore.getState();
    expect(state.refreshToken).toBe(refreshToken);
  });

  it('should show error on invalid token format', async () => {
    render(
      <MemoryRouter initialEntries={['/auth/callback?token=invalid-token-format']}>
        <AuthCallback />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/认证信息解析失败/)).toBeInTheDocument();
    });
  });
});
