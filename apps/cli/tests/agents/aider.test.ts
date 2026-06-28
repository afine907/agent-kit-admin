/**
 * Aider 适配器测试
 * 配置路径: ~/.aider/.aider.conf.yml
 * 格式: YAML，包含 mcp_servers 段落
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import { AiderAdapter } from '../../src/agents/aider';

describe('AiderAdapter', () => {
  let adapter: AiderAdapter;
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'akit-test-aider-'));
    adapter = new AiderAdapter(tempDir);
    configPath = path.join(tempDir, '.aider', '.aider.conf.yml');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should have correct name', () => {
    expect(adapter.name).toBe('Aider');
  });

  it('should return correct config path', () => {
    const cfgPath = adapter.getConfigPath();
    expect(cfgPath).toContain('.aider.conf.yml');
    expect(cfgPath).toBe(configPath);
  });

  it('should detect Aider installation', async () => {
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

  it('should read existing YAML config', async () => {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    const existingConfig = {
      mcp_servers: {
        'test-mcp': {
          command: 'node',
          args: ['index.js'],
          env: { API_KEY: 'test' },
        },
      },
    };
    await fs.writeFile(configPath, yamlDump(existingConfig));

    const config = await adapter.readConfig();
    expect(config.mcp_servers['test-mcp']).toBeDefined();
    expect(config.mcp_servers['test-mcp'].command).toBe('node');
  });

  it('should write config correctly as YAML', async () => {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, '');

    await adapter.writeConfig({
      name: 'test-mcp',
      command: 'node',
      args: ['index.js'],
      env: { API_KEY: 'test' },
    });

    const content = await fs.readFile(configPath, 'utf-8');
    const config = yamlLoad(content) as Record<string, unknown>;
    const mcpServers = config.mcp_servers as Record<string, unknown>;
    expect(mcpServers['test-mcp']).toBeDefined();
    expect((mcpServers['test-mcp'] as Record<string, unknown>).command).toBe('node');
    expect((mcpServers['test-mcp'] as Record<string, unknown>).args).toEqual(['index.js']);
    expect(((mcpServers['test-mcp'] as Record<string, unknown>).env as Record<string, string>).API_KEY).toBe('test');
  });

  it('should backup existing config before overwrite', async () => {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, yamlDump({ mcp_servers: { 'old-mcp': { command: 'echo' } } }));

    await adapter.writeConfig({
      name: 'old-mcp',
      command: 'node',
      args: ['new.js'],
    });

    const backup = await fs.readFile(configPath + '.bak', 'utf-8');
    const backupConfig = yamlLoad(backup) as Record<string, unknown>;
    const backupMcp = backupConfig.mcp_servers as Record<string, unknown>;
    expect(backupMcp['old-mcp']).toBeDefined();
  });

  it('should remove config correctly', async () => {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(
      configPath,
      yamlDump({
        mcp_servers: {
          'test-mcp': { command: 'node', args: [] },
          'other-mcp': { command: 'node', args: [] },
        },
      }),
    );

    await adapter.removeConfig('test-mcp');

    const content = await fs.readFile(configPath, 'utf-8');
    const config = yamlLoad(content) as Record<string, unknown>;
    const mcpServers = config.mcp_servers as Record<string, unknown>;
    expect(mcpServers['test-mcp']).toBeUndefined();
    expect(mcpServers['other-mcp']).toBeDefined();
  });

  it('should check if config exists', async () => {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(
      configPath,
      yamlDump({
        mcp_servers: {
          'test-mcp': { command: 'node', args: [] },
        },
      }),
    );

    expect(await adapter.hasConfig('test-mcp')).toBe(true);
    expect(await adapter.hasConfig('nonexistent')).toBe(false);
  });

  it('should create config dir on write if missing', async () => {
    await adapter.writeConfig({
      name: 'new-mcp',
      command: 'node',
      args: ['index.js'],
    });

    const content = await fs.readFile(configPath, 'utf-8');
    const config = yamlLoad(content) as Record<string, unknown>;
    const mcpServers = config.mcp_servers as Record<string, unknown>;
    expect(mcpServers['new-mcp']).toBeDefined();
  });
});
