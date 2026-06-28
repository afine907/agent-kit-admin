/**
 * Cline 适配器测试
 * 配置路径: ~/.cline/mcp.json
 * 格式: { "mcpServers": { "name": { "command": "...", "args": [...], "env": {} } } }
 * (与 Cursor/Windsurf 格式相同，但路径不同)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ClineAdapter } from '../../src/agents/cline';

describe('ClineAdapter', () => {
  let adapter: ClineAdapter;
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'akit-test-cline-'));
    adapter = new ClineAdapter(tempDir);
    configPath = path.join(tempDir, '.cline', 'mcp.json');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should have correct name', () => {
    expect(adapter.name).toBe('Cline');
  });

  it('should return correct config path', () => {
    const cfgPath = adapter.getConfigPath();
    expect(cfgPath).toContain('.cline');
    expect(cfgPath).toContain('mcp.json');
    expect(cfgPath).toBe(configPath);
  });

  it('should detect Cline installation', async () => {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, '{}');

    const detected = await adapter.detect();
    expect(detected).toBe(true);
  });

  it('should return false when not installed', async () => {
    const detected = await adapter.detect();
    expect(detected).toBe(false);
  });

  it('should read config and return default structure', async () => {
    const config = await adapter.readConfig();
    expect(config).toHaveProperty('mcpServers');
    expect(config.mcpServers).toEqual({});
  });

  it('should read existing config', async () => {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    const existingConfig = {
      mcpServers: {
        'test-mcp': {
          command: 'node',
          args: ['index.js'],
          env: { API_KEY: 'test' },
        },
      },
    };
    await fs.writeFile(configPath, JSON.stringify(existingConfig));

    const config = await adapter.readConfig();
    expect(config.mcpServers['test-mcp']).toBeDefined();
    expect(config.mcpServers['test-mcp'].command).toBe('node');
  });

  it('should write config correctly', async () => {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, '{"mcpServers": {}}');

    await adapter.writeConfig({
      name: 'test-mcp',
      command: 'node',
      args: ['index.js'],
      env: { API_KEY: 'test' },
    });

    const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    expect(config.mcpServers['test-mcp']).toBeDefined();
    expect(config.mcpServers['test-mcp'].command).toBe('node');
    expect(config.mcpServers['test-mcp'].args).toEqual(['index.js']);
    expect(config.mcpServers['test-mcp'].env.API_KEY).toBe('test');
  });

  it('should backup existing config before overwrite', async () => {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    const existingConfig = { mcpServers: { 'old-mcp': {} } };
    await fs.writeFile(configPath, JSON.stringify(existingConfig));

    await adapter.writeConfig({
      name: 'old-mcp',
      command: 'node',
      args: ['new.js'],
    });

    const backup = await fs.readFile(configPath + '.bak', 'utf-8');
    const backupConfig = JSON.parse(backup);
    expect(backupConfig.mcpServers['old-mcp']).toBeDefined();
  });

  it('should remove config correctly', async () => {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(
      configPath,
      JSON.stringify({
        mcpServers: {
          'test-mcp': { command: 'node', args: [] },
          'other-mcp': { command: 'node', args: [] },
        },
      }),
    );

    await adapter.removeConfig('test-mcp');

    const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    expect(config.mcpServers['test-mcp']).toBeUndefined();
    expect(config.mcpServers['other-mcp']).toBeDefined();
  });

  it('should check if config exists', async () => {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(
      configPath,
      JSON.stringify({
        mcpServers: {
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

    const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    expect(config.mcpServers['new-mcp']).toBeDefined();
  });
});
