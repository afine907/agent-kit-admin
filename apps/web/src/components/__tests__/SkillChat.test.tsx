/**
 * SkillChat 组件测试
 *
 * 测试场景：
 * - 未配置 scope/name/version 时显示提示
 * - 发送消息后消息列表追加 user + assistant 气泡
 * - 流式 delta 拼接到助手消息
 * - 停止按钮可中断请求
 * - 清空对话按钮重置列表
 * - 错误事件显示错误横幅
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SkillChat } from '../chat/SkillChat';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback || key,
    i18n: { language: 'en' },
  }),
}));

// Mock api
const mockChat = vi.fn();
vi.mock('../../lib/api', () => ({
  api: {
    agent: {
      chat: (...args: unknown[]) => mockChat(...args),
    },
  },
}));

describe('SkillChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows placeholder when no skill is configured', () => {
    render(<SkillChat />);
    expect(screen.getByText('agent.selectSkill')).toBeInTheDocument();
  });

  it('sends a message and appends user + assistant bubbles', async () => {
    const user = userEvent.setup();
    // 模拟流式响应：立即调用 onDelta
    mockChat.mockImplementation((_data: unknown, options: { onDelta: (d: string) => void }) => {
      options.onDelta('Hi');
      options.onDelta(' there');
      return Promise.resolve();
    });

    render(<SkillChat scope="@test" name="my-skill" version="1.0.0" />);

    const input = screen.getByPlaceholderText('agent.chatPlaceholder');
    await user.type(input, 'Hello');
    await user.click(screen.getByTitle('agent.send'));

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeInTheDocument();
    });
    // 助手消息
    expect(screen.getByText('Hi there')).toBeInTheDocument();
    expect(mockChat).toHaveBeenCalledWith(
      expect.objectContaining({ scope: '@test', name: 'my-skill', version: '1.0.0' }),
      expect.any(Object),
    );
  });

  it('clears messages when clear button clicked', async () => {
    const user = userEvent.setup();
    mockChat.mockImplementation((_data: unknown, options: { onDelta: (d: string) => void }) => {
      options.onDelta('response');
      return Promise.resolve();
    });

    render(<SkillChat scope="@test" name="my-skill" version="1.0.0" />);

    const input = screen.getByPlaceholderText('agent.chatPlaceholder');
    await user.type(input, 'Hi');
    await user.click(screen.getByTitle('agent.send'));

    await waitFor(() => {
      expect(screen.getByText('response')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('agent.clear'));

    expect(screen.queryByText('response')).not.toBeInTheDocument();
    expect(screen.getByText('agent.empty')).toBeInTheDocument();
  });

  it('shows error banner on chat failure', async () => {
    const user = userEvent.setup();
    mockChat.mockRejectedValue(new Error('LLM 服务未配置'));

    render(<SkillChat scope="@test" name="my-skill" version="1.0.0" />);

    const input = screen.getByPlaceholderText('agent.chatPlaceholder');
    await user.type(input, 'Hello');
    await user.click(screen.getByTitle('agent.send'));

    await waitFor(() => {
      expect(screen.getByText('LLM 服务未配置')).toBeInTheDocument();
    });
  });

  it('stop button aborts the request', async () => {
    const user = userEvent.setup();
    // 监听 abort 信号后 reject AbortError，模拟真实 fetch 的中止行为
    mockChat.mockImplementation((_data: unknown, options: { signal?: AbortSignal }) => {
      return new Promise((_, reject) => {
        options.signal?.addEventListener('abort', () => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    render(<SkillChat scope="@test" name="my-skill" version="1.0.0" />);

    const input = screen.getByPlaceholderText('agent.chatPlaceholder');
    await user.type(input, 'Hello');
    await user.click(screen.getByTitle('agent.send'));

    // 发送后出现停止按钮
    await waitFor(() => {
      expect(screen.getByTitle('agent.stop')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('agent.stop'));

    // 停止后恢复发送按钮
    await waitFor(() => {
      expect(screen.getByTitle('agent.send')).toBeInTheDocument();
    });
  });
});
