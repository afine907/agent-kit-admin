/**
 * Codex 适配器测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodexAdapter } from '../../src/agents/codex';

describe('CodexAdapter', () => {
  let adapter: CodexAdapter;

  beforeEach(() => {
    adapter = new CodexAdapter();
  });

  it('should have correct name', () => {
    expect(adapter.name).toBe('Codex');
  });

  it('should return correct config path', () => {
    const path = adapter.getConfigPath();
    expect(path).toContain('.codex');
    expect(path).toContain('config.toml');
  });

  it('should detect if Codex is installed', async () => {
    const detected = await adapter.detect();
    expect(typeof detected).toBe('boolean');
  });

  it('should read config and return default structure', async () => {
    const config = await adapter.readConfig();
    expect(config).toHaveProperty('mcp_servers');
  });
});
