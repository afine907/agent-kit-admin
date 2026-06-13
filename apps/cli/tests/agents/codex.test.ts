/**
 * Codex 适配器测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { CodexAdapter } from '../../src/agents/codex';

describe('CodexAdapter', () => {
  let adapter: CodexAdapter;
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'akit-test-'));
    adapter = new CodexAdapter(tempDir);
    configPath = path.join(tempDir, '.codex', 'config.toml');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should have correct name', () => {
    expect(adapter.name).toBe('Codex');
  });

  it('should return correct config path', () => {
    const cfgPath = adapter.getConfigPath();
    expect(cfgPath).toContain('.codex');
    expect(cfgPath).toContain('config.toml');
    expect(cfgPath).toBe(configPath);
  });

  it('should detect Codex installation', async () => {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, '');

    const detected = await adapter.detect();
    expect(detected).toBe(true);
  });

  it('should return false when not installed', async () => {
    const detected = await adapter.detect();
    expect(detected).toBe(false);
  });

  it('should read config and return default structure', async () => {
    const config = await adapter.readConfig();
    expect(config).toHaveProperty('mcp_servers');
    expect(config.mcp_servers).toEqual({});
  });

  it('should read existing config', async () => {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    const tomlContent = `
[mcp_servers.test-mcp]
command = "node"
args = ["index.js"]
enabled = true

[mcp_servers.test-mcp.env]
API_KEY = "test"
`;
    await fs.writeFile(configPath, tomlContent);

    const config = await adapter.readConfig();
    expect(config.mcp_servers['test-mcp']).toBeDefined();
    expect(config.mcp_servers['test-mcp'].command).toBe('node');
  });

  it('should write config correctly', async () => {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, '');

    await adapter.writeConfig({
      name: 'test-mcp',
      command: 'node',
      args: ['index.js'],
      env: { API_KEY: 'test' },
    });

    const content = await fs.readFile(configPath, 'utf-8');
    expect(content).toContain('test-mcp');
    expect(content).toContain('node');
    expect(content).toContain('index.js');
    expect(content).toContain('API_KEY');
  });

  it('should remove config correctly', async () => {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    const tomlContent = `
[mcp_servers.test-mcp]
command = "node"
args = []
enabled = true

[mcp_servers.other-mcp]
command = "node"
args = []
enabled = true
`;
    await fs.writeFile(configPath, tomlContent);

    await adapter.removeConfig('test-mcp');

    const content = await fs.readFile(configPath, 'utf-8');
    expect(content).not.toContain('test-mcp');
    expect(content).toContain('other-mcp');
  });

  it('should check if config exists', async () => {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    const tomlContent = `
[mcp_servers.test-mcp]
command = "node"
args = []
enabled = true
`;
    await fs.writeFile(configPath, tomlContent);

    expect(await adapter.hasConfig('test-mcp')).toBe(true);
    expect(await adapter.hasConfig('nonexistent')).toBe(false);
  });
});
