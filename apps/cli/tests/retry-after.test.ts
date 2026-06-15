/**
 * #14 429 响应 + Retry-After 头测试
 *
 * 测试场景：
 * - 正确解析 Retry-After 头并等待
 * - 无 Retry-After 头时使用默认指数退避
 * - Retry-After 为 0 时不等待
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock configManager
vi.mock('../src/config/manager', () => ({
  configManager: {
    getToken: vi.fn().mockReturnValue('test-token'),
    getRegistry: vi.fn().mockReturnValue('http://localhost:3000'),
  },
}));

// 创建 mock axios instance，支持调用自身（重试）
const mockClientFn = vi.fn();
const mockInterceptors = {
  request: { use: vi.fn() },
  response: { use: vi.fn() },
};

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => {
      mockClientFn.interceptors = mockInterceptors;
      return mockClientFn;
    }),
  },
}));

describe('#14 429 响应 + Retry-After 头', () => {
  let errorHandler: (error: unknown) => Promise<unknown>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // 重新加载模块以注册拦截器
    vi.resetModules();
    await import('../src/api/client');

    // 获取注册的 response error handler
    errorHandler = mockInterceptors.response.use.mock.calls[0]?.[1];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('应该在 429 响应时使用 Retry-After 头的值作为延迟', async () => {
    const error = {
      config: { __retryCount: 0, headers: {} },
      response: {
        status: 429,
        headers: { 'retry-after': '30' },
        data: { error: { code: 20006, message: 'Rate limited' } },
      },
    };

    const successResponse = { data: { success: true } };
    mockClientFn.mockResolvedValueOnce(successResponse);

    const resultPromise = errorHandler(error);

    // 快进 30 秒（Retry-After 值）
    await vi.advanceTimersByTimeAsync(30000);

    const result = await resultPromise;
    expect(result).toEqual(successResponse);
  });

  it('应该在无 Retry-After 头时使用默认指数退避', async () => {
    const error = {
      config: { __retryCount: 1, headers: {} },
      response: {
        status: 429,
        headers: {},
        data: { error: { code: 20006, message: 'Rate limited' } },
      },
    };

    const successResponse = { data: { success: true } };
    mockClientFn.mockResolvedValueOnce(successResponse);

    const resultPromise = errorHandler(error);

    // 默认延迟 = 2^retryCount * 1000 = 2^2 * 1000 = 4000ms
    await vi.advanceTimersByTimeAsync(4000);

    const result = await resultPromise;
    expect(result).toEqual(successResponse);
  });

  it('应该在 Retry-After 为 0 时不等待直接重试', async () => {
    const error = {
      config: { __retryCount: 0, headers: {} },
      response: {
        status: 429,
        headers: { 'retry-after': '0' },
        data: { error: { code: 20006, message: 'Rate limited' } },
      },
    };

    const successResponse = { data: { success: true } };
    mockClientFn.mockResolvedValueOnce(successResponse);

    const resultPromise = errorHandler(error);

    // 即使 delay 为 0，fake timers 也需要 advance
    await vi.advanceTimersByTimeAsync(0);

    const result = await resultPromise;
    expect(result).toEqual(successResponse);
  });

  it('应该在达到最大重试次数后抛出错误', async () => {
    const error = {
      config: { __retryCount: 3, headers: {} },
      response: {
        status: 429,
        headers: { 'retry-after': '10' },
        data: { error: { code: 20006, message: 'Rate limited' } },
      },
    };

    await expect(errorHandler(error)).rejects.toThrow('API Error (429)');
  });
});
