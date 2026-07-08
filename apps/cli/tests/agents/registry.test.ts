/**
 * Agent Registry 测试
 *
 * 测试场景:
 * - 注册和获取 adapter
 * - detectAll 自动发现
 * - 未知 agent 处理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRegistry } from '../../src/agents/registry';
import type { AgentAdapter } from '../../src/agents/types';

// 创建 mock adapter
function createMockAdapter(name: string, detected = false): AgentAdapter {
  return {
    name,
    detect: vi.fn().mockResolvedValue(detected),
    readConfig: vi.fn().mockResolvedValue({}),
    writeConfig: vi.fn().mockResolvedValue(undefined),
    removeConfig: vi.fn().mockResolvedValue(undefined),
    hasConfig: vi.fn().mockResolvedValue(false),
    getConfigPath: vi.fn().mockReturnValue(`/mock/${name}/config`),
  };
}

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  it('should register and retrieve adapter by name', () => {
    const adapter = createMockAdapter('Claude Code');
    registry.register(adapter);

    const retrieved = registry.get('claude code');
    expect(retrieved).toBe(adapter);
  });

  it('should be case-insensitive when getting adapter', () => {
    const adapter = createMockAdapter('Claude Code');
    registry.register(adapter);

    expect(registry.get('Claude Code')).toBe(adapter);
    expect(registry.get('CLAUDE CODE')).toBe(adapter);
    expect(registry.get('claude code')).toBe(adapter);
  });

  it('should return undefined for unknown agent', () => {
    const result = registry.get('nonexistent');
    expect(result).toBeUndefined();
  });

  it('should return all registered adapters', () => {
    const adapter1 = createMockAdapter('Claude Code');
    const adapter2 = createMockAdapter('Codex');
    registry.register(adapter1);
    registry.register(adapter2);

    const all = registry.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContain(adapter1);
    expect(all).toContain(adapter2);
  });

  it('should detectAll returns only detected adapters', async () => {
    const detected = createMockAdapter('Claude Code', true);
    const notDetected = createMockAdapter('Codex', false);
    registry.register(detected);
    registry.register(notDetected);

    const result = await registry.detectAll();
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(detected);
  });

  it('should detectAll returns empty when no adapters detected', async () => {
    const adapter = createMockAdapter('Claude Code', false);
    registry.register(adapter);

    const result = await registry.detectAll();
    expect(result).toHaveLength(0);
  });

  it('should allow overwriting existing adapter with same name', () => {
    const adapter1 = createMockAdapter('Claude Code');
    const adapter2 = createMockAdapter('Claude Code');
    registry.register(adapter1);
    registry.register(adapter2);

    expect(registry.get('claude code')).toBe(adapter2);
    expect(registry.getAll()).toHaveLength(1);
  });
});
