/**
 * Claude 适配器测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { ClaudeAdapter } from '../../src/agents/claude';

describe('ClaudeAdapter', () => {
  let adapter: ClaudeAdapter;
  let tempDir: string;
  let configPath: string;

  beforeEach(async () => {
    adapter = new ClaudeAdapter();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'akit-test-'));
    configPath = path.join(tempDir, '.claude', 'mcp.json');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should have correct name', () => {
    expect(adapter.name).toBe('Claude Code');
  });

  it('should return correct config path', () => {
    const cfgPath = adapter.getConfigPath();
    expect(cfgPath).toContain('.claude');
    expect(cfgPath).toContain('mcp.json');
  });

  it('should detect Claude Code installation', async () => {
    // 创建配置文件
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, '{}');

    // 覆盖 getConfigPath 方法
    const originalGetConfigPath = adapter.getConfigPath.bind(adapter);
    adapter.getConfigPath = () => configPath;

    const detected = await adapter.detect();
    expect(detected).toBe(true);

    // 恢复原始方法
    adapter.getConfigPath = originalGetConfigPath;
  });

  it('should return false when not installed', async () => {
    // 覆盖 getConfigPath 方法指向不存在的路径
    adapter.getConfigPath = () => path.join(tempDir, 'nonexistent', 'mcp.json');

    const detected = await adapter.detect();
    expect(detected).toBe(false);
  });

  it('should read config and return default structure', async () => {
    // 覆盖 getConfigPath 方法
    adapter.getConfigPath = () => path.join(tempDir, 'nonexistent', 'mcp.json');

    const config = await adapter.readConfig();
    expect(config).toHaveProperty('mcpServers');
    expect(config.mcpServers).toEqual({});
  });

  it('should read existing config', async () => {
    // 创建配置文件
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

    // 覆盖 getConfigPath 方法
    adapter.getConfigPath = () => configPath;

    const config = await adapter.readConfig();
    expect(config.mcpServers['test-mcp']).toBeDefined();
    expect(config.mcpServers['test-mcp'].command).toBe('node');
  });

  it('should write config correctly', async () => {
    // 创建配置文件
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, '{"mcpServers": {}}');

    // 覆盖 getConfigPath 方法
    adapter.getConfigPath = () => configPath;

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
    // 创建配置文件
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    const existingConfig = '{"mcpServers": {"old-mcp": {}}}';
    await fs.writeFile(configPath, existingConfig);

    // 覆盖 getConfigPath 方法
    adapter.getConfigPath = () => configPath;

    await adapter.writeConfig({
      name: 'old-mcp',
      command: 'node',
      args: ['new.js'],
    });

    const backup = await fs.readFile(configPath + '.bak', 'utf-8');
    expect(backup).toBe(existingConfig);
  });

  it('should remove config correctly', async () => {
    // 创建配置文件
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(
      configPath,
      JSON.stringify({
        mcpServers: {
          'test-mcp': { command: 'node', args: [] },
          'other-mcp': { command: 'node', args: [] },
        },
      })
    );

    // 覆盖 getConfigPath 方法
    adapter.getConfigPath = () => configPath;

    await adapter.removeConfig('test-mcp');

    const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    expect(config.mcpServers['test-mcp']).toBeUndefined();
    expect(config.mcpServers['other-mcp']).toBeDefined();
  });

  it('should check if config exists', async () => {
    // 创建配置文件
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(
      configPath,
      JSON.stringify({
        mcpServers: {
          'test-mcp': { command: 'node', args: [] },
        },
      })
    );

    // 覆盖 getConfigPath 方法
    adapter.getConfigPath = () => configPath;

    expect(await adapter.hasConfig('test-mcp')).toBe(true);
    expect(await adapter.hasConfig('nonexistent')).toBe(false);
  });
});
