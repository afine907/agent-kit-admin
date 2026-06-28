/**
 * Teams 页面 - Add Member Modal 功能测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Teams from '../Teams';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'zh' },
  }),
}));

// Mock api
const mockAddTeamMember = vi.fn();
const mockListTeamMembers = vi.fn();
const mockListTeams = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      addTeamMember: (...args: unknown[]) => mockAddTeamMember(...args),
      listTeamMembers: (...args: unknown[]) => mockListTeamMembers(...args),
      listTeams: (...args: unknown[]) => mockListTeams(...args),
    },
  };
});

// Mock authStore - 默认已认证
vi.mock('../../stores/authStore', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
    user: { id: 'user-1', name: 'Test User', email: 'test@test.com' },
  }),
}));

const mockTeam = {
  id: 'team-1',
  name: 'Test Team',
  slug: 'test-team',
  description: 'A test team',
  avatar_url: null,
  member_count: 2,
  created_at: '2024-01-01T00:00:00Z',
};

const mockMembers = [
  {
    user_id: 'user-1',
    username: 'testuser',
    display_name: 'Test User',
    email: 'test@test.com',
    role: 'owner',
    avatar_url: null,
    joined_at: '2024-01-01T00:00:00Z',
  },
  {
    user_id: 'user-2',
    username: 'otheruser',
    display_name: 'Other User',
    email: 'other@test.com',
    role: 'member',
    avatar_url: null,
    joined_at: '2024-01-02T00:00:00Z',
  },
];

describe('Teams - Add Member Modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTeams.mockResolvedValue([mockTeam]);
    mockListTeamMembers.mockResolvedValue(mockMembers);
    mockAddTeamMember.mockResolvedValue({
      user_id: 'user-3',
      username: 'newuser',
      role: 'member',
    });
  });

  it('点击添加成员按钮应打开 Modal', async () => {
    render(<Teams />);

    // 点击团队卡片打开详情
    const teamCard = await screen.findByText('Test Team');
    await userEvent.click(teamCard);

    // 等待 members tab 出现
    await screen.findByText('Test User');

    // 点击添加成员按钮（在 members 列表右上角）
    const addBtn = await screen.findByRole('button', { name: /addMember|添加成员/i });
    await userEvent.click(addBtn);

    // Modal 应打开，显示用户名输入框
    await waitFor(() => {
      expect(screen.getByTestId('invite-username-input')).toBeInTheDocument();
    });
  });

  it('填写用户名并提交应调用 addTeamMember API', async () => {
    render(<Teams />);

    // 打开团队详情
    const teamCard = await screen.findByText('Test Team');
    await userEvent.click(teamCard);
    await screen.findByText('Test User');

    // 打开添加成员 Modal
    const addBtn = await screen.findByRole('button', { name: /addMember|添加成员/i });
    await userEvent.click(addBtn);

    // 填写用户名
    const input = await screen.getByTestId('invite-username-input');
    await userEvent.type(input, 'newuser');

    // Dialog 打开后，通过 UserPlus 图标所在按钮定位确认按钮
    const dialogContent = await screen.findByRole('dialog');
    const dialogBtns = within(dialogContent).getAllByRole('button');
    // 第二个按钮是确认按钮（第一个是取消）
    const submitBtn = dialogBtns[dialogBtns.length - 1];
    await userEvent.click(submitBtn);

    // 验证 API 调用
    await waitFor(() => {
      expect(mockAddTeamMember).toHaveBeenCalledWith('team-1', {
        user_id: 'newuser',
        role: 'member',
      });
    });
  });

  it('添加成功后 Modal 应关闭', async () => {
    render(<Teams />);

    const teamCard = await screen.findByText('Test Team');
    await userEvent.click(teamCard);
    await screen.findByText('Test User');

    const addBtn = await screen.findByRole('button', { name: /addMember|添加成员/i });
    await userEvent.click(addBtn);

    const input = await screen.findByPlaceholderText(/username|用户名/i);
    await userEvent.type(input, 'newuser');

    // Dialog 打开后，点击确认按钮
    const dialogContent = await screen.findByRole('dialog');
    const dialogBtns = within(dialogContent).getAllByRole('button');
    const submitBtn = dialogBtns[dialogBtns.length - 1];
    await userEvent.click(submitBtn);

    // Modal 关闭，输入框消失
    await waitFor(() => {
      expect(screen.queryByTestId('invite-username-input')).not.toBeInTheDocument();
    });
  });

  it('非管理员不应看到添加成员按钮', async () => {
    // user-1 是 owner，但这里模拟非管理成员场景
    const nonAdminMembers = [
      { ...mockMembers[0], role: 'member' as const },
    ];
    mockListTeamMembers.mockResolvedValue(nonAdminMembers);

    render(<Teams />);

    const teamCard = await screen.findByText('Test Team');
    await userEvent.click(teamCard);
    await screen.findByText('Test User');

    // 添加成员按钮不应出现
    expect(screen.queryByRole('button', { name: /addMember|添加成员/i })).not.toBeInTheDocument();
  });
});
