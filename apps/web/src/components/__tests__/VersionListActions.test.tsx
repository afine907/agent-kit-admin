/**
 * VersionList deprecate/yank 功能测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VersionList } from '../VersionList';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'en' },
  }),
}));

// Mock api
const mockUpdateVersion = vi.fn();
vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      updateVersion: (...args: unknown[]) => mockUpdateVersion(...args),
    },
  };
});

// Mock authStore - 默认已认证
let mockIsAuthenticated = true;
vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({
    isAuthenticated: mockIsAuthenticated,
    user: mockIsAuthenticated ? { id: 'user-1' } : null,
  }),
}));

const baseVersion = {
  id: 'v1',
  version: '1.0.0',
  manifest: {},
  tarball_hash: 'abc123',
  tarball_size: 1024,
  deprecated: false,
  yanked: false,
  published_at: '2024-01-01T00:00:00Z',
};

describe('VersionList - deprecate/yank actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateVersion.mockResolvedValue({});
    mockIsAuthenticated = true;
  });

  it('shows deprecate button for active versions', () => {
    render(<VersionList versions={[baseVersion]} scope="test" name="pkg" />);
    expect(screen.getByRole('button', { name: /deprecate/i })).toBeInTheDocument();
  });

  it('shows yank button for active versions', () => {
    render(<VersionList versions={[baseVersion]} scope="test" name="pkg" />);
    expect(screen.getByRole('button', { name: /yank/i })).toBeInTheDocument();
  });

  it('shows un-deprecate button for deprecated versions', () => {
    const deprecated = { ...baseVersion, deprecated: true };
    render(<VersionList versions={[deprecated]} scope="test" name="pkg" />);
    expect(screen.getByRole('button', { name: /undeprecate/i })).toBeInTheDocument();
  });

  it('shows un-yank button for yanked versions', () => {
    const yanked = { ...baseVersion, yanked: true };
    render(<VersionList versions={[yanked]} scope="test" name="pkg" />);
    expect(screen.getByRole('button', { name: /unyank/i })).toBeInTheDocument();
  });

  it('calls updateVersion with deprecated=true on deprecate click', async () => {
    const user = userEvent.setup();
    render(<VersionList versions={[baseVersion]} scope="test-scope" name="test-pkg" />);

    await user.click(screen.getByRole('button', { name: /deprecate/i }));

    await waitFor(() => {
      expect(mockUpdateVersion).toHaveBeenCalledWith('test-scope', 'test-pkg', '1.0.0', {
        deprecated: true,
      });
    });
  });

  it('calls updateVersion with yanked=true on yank click', async () => {
    const user = userEvent.setup();
    render(<VersionList versions={[baseVersion]} scope="test-scope" name="test-pkg" />);

    await user.click(screen.getByRole('button', { name: /yank/i }));

    await waitFor(() => {
      expect(mockUpdateVersion).toHaveBeenCalledWith('test-scope', 'test-pkg', '1.0.0', {
        yanked: true,
      });
    });
  });

  it('calls updateVersion with deprecated=false on un-deprecate click', async () => {
    const user = userEvent.setup();
    const deprecated = { ...baseVersion, deprecated: true };
    render(<VersionList versions={[deprecated]} scope="test-scope" name="test-pkg" />);

    await user.click(screen.getByRole('button', { name: /undeprecate/i }));

    await waitFor(() => {
      expect(mockUpdateVersion).toHaveBeenCalledWith('test-scope', 'test-pkg', '1.0.0', {
        deprecated: false,
      });
    });
  });

  it('hides action buttons when user is not authenticated', () => {
    mockIsAuthenticated = false;
    render(<VersionList versions={[baseVersion]} scope="test" name="pkg" />);
    expect(screen.queryByRole('button', { name: /deprecate/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /yank/i })).not.toBeInTheDocument();
  });
});
