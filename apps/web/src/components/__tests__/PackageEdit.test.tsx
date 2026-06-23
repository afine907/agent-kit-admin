/**
 * PackageEdit 组件测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PackageEdit } from '../PackageEdit';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'en' },
  }),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ scope: 'test-scope', name: 'test-pkg' }),
  Link: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <a {...props}>{children}</a>,
}));

// Mock api
const mockUpdatePackage = vi.fn();
vi.mock('../../lib/api', () => ({
  api: {
    getPackage: vi.fn(),
    updatePackage: (...args: unknown[]) => mockUpdatePackage(...args),
  },
}));

// Mock usePackage hook
const mockRefetch = vi.fn();
vi.mock('../../hooks/usePackages', () => ({
  usePackage: vi.fn(),
}));

import { usePackage } from '../../hooks/usePackages';

const mockPackage = {
  id: '1',
  name: 'test-pkg',
  scope: 'test-scope',
  full_name: 'test-scope/test-pkg',
  type: 'mcp' as const,
  description: 'Original description',
  visibility: 'public',
  tags: ['ai', 'tool'],
  license: 'MIT',
  downloads_count: 100,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
};

describe('PackageEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePackage).mockReturnValue({
      data: mockPackage,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    } as unknown as ReturnType<typeof usePackage>);
    mockUpdatePackage.mockResolvedValue({});
  });

  it('renders current package info', () => {
    render(<PackageEdit />);
    expect(screen.getByDisplayValue('Original description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ai, tool')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(usePackage).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof usePackage>);
    render(<PackageEdit />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('allows editing description', async () => {
    const user = userEvent.setup();
    render(<PackageEdit />);

    const descInput = screen.getByLabelText(/description/i);
    await user.clear(descInput);
    await user.type(descInput, 'New description');

    expect(descInput).toHaveValue('New description');
  });

  it('allows editing tags', async () => {
    const user = userEvent.setup();
    render(<PackageEdit />);

    const tagsInput = screen.getByLabelText(/tags/i);
    await user.clear(tagsInput);
    await user.type(tagsInput, 'mcp, search');

    expect(tagsInput).toHaveValue('mcp, search');
  });

  it('allows changing visibility', async () => {
    const user = userEvent.setup();
    render(<PackageEdit />);

    const visibilitySelect = screen.getByLabelText(/visibility/i);
    await user.selectOptions(visibilitySelect, 'private');

    expect(visibilitySelect).toHaveValue('private');
  });

  it('calls updatePackage on submit', async () => {
    const user = userEvent.setup();
    render(<PackageEdit />);

    const descInput = screen.getByLabelText(/description/i);
    await user.clear(descInput);
    await user.type(descInput, 'Updated description');

    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockUpdatePackage).toHaveBeenCalledWith('test-scope', 'test-pkg', {
        description: 'Updated description',
        tags: ['ai', 'tool'],
        visibility: 'public',
      });
    });
  });

  it('shows success message after update', async () => {
    const user = userEvent.setup();
    render(<PackageEdit />);

    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });
  });

  it('shows error message on failure', async () => {
    mockUpdatePackage.mockRejectedValue(new Error('API Error (500): Internal Server Error'));
    const user = userEvent.setup();
    render(<PackageEdit />);

    const submitButton = screen.getByRole('button', { name: /save/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
