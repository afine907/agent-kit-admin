/**
 * SkillChat - 可复用聊天组件
 *
 * 根据传入的 scope/name/version 加载 Skill content 作为 system prompt，
 * 提供流式对话能力。可被 /agent 页和包详情页「测试此 Skill」复用。
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Square, Trash2, AlertCircle, Bot, User } from 'lucide-react';
import { api, ChatMessage } from '@/lib/api';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/cn';

export interface SkillChatProps {
  scope?: string;
  name?: string;
  version?: string;
}

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

let messageCounter = 0;
function nextId() {
  messageCounter += 1;
  return `msg-${messageCounter}`;
}

export function SkillChat({ scope, name, version }: SkillChatProps) {
  const { t } = useTranslation('pages');
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingIdRef = useRef<string | null>(null);

  const isConfigured = Boolean(scope && name && version);

  // 自动滚动到底部
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading || !isConfigured) return;

    setError(null);
    const userMessage: DisplayMessage = { id: nextId(), role: 'user', content: text };
    const streamingId = nextId();
    streamingIdRef.current = streamingId;
    setMessages((prev) => [...prev, userMessage, { id: streamingId, role: 'assistant', content: '', isStreaming: true }]);
    setInput('');
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    // 构造历史（含当前用户消息）
    const history: ChatMessage[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ];

    try {
      await api.agent.chat(
        { scope: scope!, name: name!, version, messages: history },
        {
          signal: controller.signal,
          onDelta: (delta) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingId ? { ...m, content: m.content + delta } : m
              )
            );
          },
        },
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : t('agent.errorSend'));
      // 移除流式占位消息（若为空）或标记失败
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingId && !m.content ? { ...m, isStreaming: false, content: '' } : m
        ).filter((m) => !(m.id === streamingId && !m.content))
      );
      streamingIdRef.current = null;
    } finally {
      setIsLoading(false);
      abortRef.current = null;
      setMessages((prev) => prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)));
    }
  }, [input, isLoading, isConfigured, messages, scope, name, version, t]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    streamingIdRef.current = null;
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  if (!isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Bot className="w-10 h-10 mb-3 opacity-40" />
        <p className="text-sm">{t('agent.selectSkill')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[60vh] border border-border/50 rounded-xl bg-card">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{t('agent.title')}</span>
          <span className="text-xs text-muted-foreground">
            @{scope}/{name}
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10 transition-colors"
            title={t('agent.clear')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 消息列表 */}
      <ScrollArea ref={scrollRef} className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p className="text-sm">{t('agent.empty')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-3',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/60 text-foreground'
                  )}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {msg.content || (msg.isStreaming && <span className="opacity-50">▍</span>)}
                  </div>
                </div>
                {msg.role === 'user' && (
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-secondary/60 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* 错误横幅 */}
      {error && (
        <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* 输入区 */}
      <div className="p-3 border-t border-border/50">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('agent.chatPlaceholder')}
            disabled={isLoading}
            rows={1}
            className="resize-none min-h-[40px] max-h-[120px]"
          />
          {isLoading ? (
            <button
              onClick={stopStreaming}
              className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              title={t('agent.stop')}
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={t('agent.send')}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{t('agent.inputHint')}</p>
      </div>
    </div>
  );
}
