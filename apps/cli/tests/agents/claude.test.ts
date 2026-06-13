/**
 * Claude 适配器测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeAdapter } from '../../src/agents/claude';

describe('ClaudeAdapter', () => {
  let adapter: ClaudeAdapter;

  beforeEach(() => {
    adapter = new ClaudeAdapter();
  });

  it('should have correct name', () => {
    expect(adapter.name).toBe('Claude Code');
  });

  it('should return correct config path', () => {
    const path = adapter.getConfigPath();
    expect(path).toContain('.claude');
    expect(path).toContain('mcp.json');
  });

  it('should detect if Claude is installed', async () => {
    // 这个测试需要实际的文件系统
    // 在 CI 环境中可能会失败
    const detected = await adapter.detect();
    expect(typeof detected).toBe('boolean');
  });

  it('should read config and return default structure', async () => {
    const config = await adapter.readConfig();
    expect(config).toHaveProperty('mcpServers');
  });
});
