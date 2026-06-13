/**
 * Codex 适配器
 * 配置路径: ~/.codex/config.toml
 * 格式: TOML [mcp_servers.name] 段
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { parse, stringify } from 'smol-toml';
import { AgentAdapter, MCPConfig, MCPEntry } from './types.js';

export class CodexAdapter implements AgentAdapter {
  name = 'Codex';

  private configDir: string;
  private configPath: string;

  constructor(baseDir?: string) {
    this.configDir = baseDir ? join(baseDir, '.codex') : join(homedir(), '.codex');
    this.configPath = join(this.configDir, 'config.toml');
  }

  async detect(): Promise<boolean> {
    // 检查 ~/.codex 目录是否存在
    return existsSync(this.configDir);
  }

  getConfigPath(): string {
    return this.configPath;
  }

  async readConfig(): Promise<MCPConfig> {
    if (!existsSync(this.configPath)) {
      return { mcp_servers: {} };
    }

    try {
      const content = readFileSync(this.configPath, 'utf-8');
      return parse(content) as MCPConfig;
    } catch {
      return { mcp_servers: {} };
    }
  }

  async writeConfig(entry: MCPEntry): Promise<void> {
    const config = await this.readConfig();

    // 备份已有配置（constitution.md 要求）
    if (config.mcp_servers && (config.mcp_servers as Record<string, unknown>)[entry.name]) {
      const backupPath = this.configPath + '.bak';
      writeFileSync(backupPath, stringify(config as Record<string, unknown>));
    }

    // 确保目录存在
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }

    // 写入配置
    config.mcp_servers = config.mcp_servers || {};
    (config.mcp_servers as Record<string, unknown>)[entry.name] = {
      command: entry.command,
      args: entry.args,
      enabled: true,
      env: entry.env || {},
    };

    writeFileSync(this.configPath, stringify(config as Record<string, unknown>));
  }

  async removeConfig(packageName: string): Promise<void> {
    const config = await this.readConfig();

    if (config.mcp_servers) {
      // 备份
      const backupPath = this.configPath + '.bak';
      writeFileSync(backupPath, stringify(config as Record<string, unknown>));

      // 删除配置
      delete (config.mcp_servers as Record<string, unknown>)[packageName];
      writeFileSync(this.configPath, stringify(config as Record<string, unknown>));
    }
  }

  async hasConfig(packageName: string): Promise<boolean> {
    const config = await this.readConfig();
    return !!(config.mcp_servers && (config.mcp_servers as Record<string, unknown>)[packageName]);
  }
}
