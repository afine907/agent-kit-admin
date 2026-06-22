/**
 * App 组件冒烟测试 - 验证测试基础设施工作正常
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock lazy-loaded pages
vi.mock('../pages/Home', () => ({
  default: () => <div data-testid="home-page">Home</div>,
}));
vi.mock('../pages/Login', () => ({
  default: () => <div data-testid="login-page">Login</div>,
}));
vi.mock('../pages/PackageDetail', () => ({
  default: () => <div data-testid="package-detail-page">PackageDetail</div>,
}));
vi.mock('../pages/Profile', () => ({
  default: () => <div data-testid="profile-page">Profile</div>,
}));
vi.mock('../pages/Publish', () => ({
  default: () => <div data-testid="publish-page">Publish</div>,
}));
vi.mock('../pages/Teams', () => ({
  default: () => <div data-testid="teams-page">Teams</div>,
}));
vi.mock('../pages/NotFound', () => ({
  default: () => <div data-testid="not-found-page">NotFound</div>,
}));
vi.mock('../pages/admin/Dashboard', () => ({
  default: () => <div data-testid="admin-dashboard">AdminDashboard</div>,
}));
vi.mock('../pages/admin/Users', () => ({
  default: () => <div data-testid="admin-users">AdminUsers</div>,
}));
vi.mock('../pages/admin/Packages', () => ({
  default: () => <div data-testid="admin-packages">AdminPackages</div>,
}));

// Mock Header
vi.mock('../components/layout/Header', () => ({
  Header: () => <header data-testid="header">Header</header>,
}));

// Mock ErrorBoundary
vi.mock('../components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock authStore
vi.mock('../stores/authStore', () => ({
  useAuthStore: Object.assign(
    () => ({ isAuthenticated: false, isAdmin: false, user: null, getToken: () => null }),
    {
      getState: () => ({ isAuthenticated: false, isAdmin: false, user: null, getToken: () => null, clearAuth: vi.fn() }),
    }
  ),
}));

describe('App', () => {
  it('renders without crashing', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('renders home page on root route', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );
    // Wait for lazy-loaded component
    const homePage = await screen.findByTestId('home-page');
    expect(homePage).toBeInTheDocument();
  });

  it('renders 404 page for unknown routes', async () => {
    render(
      <MemoryRouter initialEntries={['/unknown-route']}>
        <App />
      </MemoryRouter>
    );
    const notFound = await screen.findByTestId('not-found-page');
    expect(notFound).toBeInTheDocument();
  });
});
