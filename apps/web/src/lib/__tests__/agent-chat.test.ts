/**
 * agent.chat SSE 流式解析测试
 *
 * 通过 mock 全局 fetch 返回 ReadableStream，验证：
 * - meta / delta / [DONE] 事件解析
 * - 中文 token 跨块拼接
 * - SSE 错误事件抛出 AgentChatError
 * - 不完整块（跨 read 边界）正确缓冲
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, AgentChatError } from '../api';

// 构造一个 ReadableStream，逐块产出字符串对应的 UTF-8 字节
function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index += 1;
      } else {
        controller.close();
      }
    },
  });
}

describe('api.agent.chat', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses meta + delta events and resolves on [DONE]', async () => {
    const body = makeStream([
      'data: {"meta":{"model":"gpt-4o-mini"}}\n\n',
      'data: {"delta":"你"}\n\n',
      'data: {"delta":"好"}\n\n',
      'data: [DONE]\n\n',
    ]);
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const deltas: string[] = [];
    let model: string | undefined;
    await api.agent.chat(
      { scope: '@test', name: 'skill', messages: [{ role: 'user', content: 'hi' }] },
      {
        onDelta: (d) => deltas.push(d),
        onMeta: (m) => {
          model = m;
        },
      },
    );

    expect(model).toBe('gpt-4o-mini');
    expect(deltas).toEqual(['你', '好']);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/agent/chat'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('handles Chinese token split across chunk boundaries', async () => {
    // "你" = E4 BD A0 (3 bytes)，故意在字节边界切开
    const encoder = new TextEncoder();
    const full = 'data: {"delta":"你好"}\n\ndata: [DONE]\n\n';
    const bytes = encoder.encode(full);
    // 在第 2 个字节处切分，确保一个中文字符被跨块
    const chunk1 = bytes.slice(0, 2);
    const chunk2 = bytes.slice(2);

    let index = 0;
    const chunks = [chunk1, chunk2];
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (index < chunks.length) {
          controller.enqueue(chunks[index]);
          index += 1;
        } else {
          controller.close();
        }
      },
    });
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(stream, { status: 200 })
    );

    const deltas: string[] = [];
    await api.agent.chat(
      { scope: '@test', name: 'skill', messages: [] },
      { onDelta: (d) => deltas.push(d) },
    );

    expect(deltas.join('')).toBe('你好');
  });

  it('throws AgentChatError on SSE error event', async () => {
    // 每次调用使用独立 stream，避免读者锁被前一个 chat 持有
    vi.mocked(globalThis.fetch).mockImplementation(() =>
      Promise.resolve(
        new Response(
          makeStream(['data: {"error":{"code":20007,"message":"LLM 服务未配置"}}\n\n']),
          { status: 200 },
        ),
      )
    );

    await expect(
      api.agent.chat(
        { scope: '@test', name: 'skill', messages: [] },
        { onDelta: () => {} },
      ),
    ).rejects.toThrow(AgentChatError);
    await expect(
      api.agent.chat(
        { scope: '@test', name: 'skill', messages: [] },
        { onDelta: () => {} },
      ),
    ).rejects.toThrow('LLM 服务未配置');
  });

  it('throws on HTTP error status', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response('error', { status: 500, statusText: 'Internal Server Error' })
    );

    await expect(
      api.agent.chat(
        { scope: '@test', name: 'skill', messages: [] },
        { onDelta: () => {} },
      ),
    ).rejects.toThrow('API Error (500)');
  });

  it('buffers incomplete events across reads', async () => {
    // 一个 delta 事件被拆成两次 read：第一次不含 \n\n 结尾
    const body = makeStream([
      'data: {"delta":"Hel"}\n',
      '\ndata: {"delta":"lo"}\n\ndata: [DONE]\n\n',
    ]);
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(body, { status: 200 })
    );

    const deltas: string[] = [];
    await api.agent.chat(
      { scope: '@test', name: 'skill', messages: [] },
      { onDelta: (d) => deltas.push(d) },
    );

    expect(deltas).toEqual(['Hel', 'lo']);
  });
});
