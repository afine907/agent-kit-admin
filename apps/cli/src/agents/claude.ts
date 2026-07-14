/**
 * Claude Code 适配器
 * 配置路径: ~/.claude/mcp.json
 * 格式: { "mcpServers": { "name": { "command": "...", "args": [...], "env": {} } } }
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { AgentAdapter, MCPConfig, MCPEntry } from './types.js';

export class ClaudeAdapter implements AgentAdapter {
  name = 'Claude Code';

  private configDir: string;
  private configPath: string;

  constructor(baseDir?: string) {
    this.configDir = baseDir ? join(baseDir, '.claude') : join(homedir(), '.claude');
    this.configPath = join(this.configDir, 'mcp.json');
  }

  async detect(): Promise<boolean> {
    // 检查 ~/.claude 目录是否存在
    return existsSync(this.configDir);
  }

  getConfigPath(): string {
    return this.configPath;
  }

  async readConfig(): Promise<MCPConfig> {
    if (!existsSync(this.configPath)) {
      return { mcpServers: {} };
    }

    try {
      const content = readFileSync(this.configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      // 配置文件损坏，备份并创建新的
      const backupPath = this.configPath + '.corrupt.' + Date.now();
      try {
        const backupContent = readFileSync(this.configPath, 'utf-8');
        writeFileSync(backupPath, backupContent);
      } catch {
        // 文件已被删除或无法读取，跳过备份
      }
      writeFileSync(this.configPath, JSON.stringify({ mcpServers: {} }, null, 2));
      return { mcpServers: {} };
    }
  }

  async writeConfig(entry: MCPEntry): Promise<void> {
    const config = await this.readConfig();

    // 备份已有配置（constitution.md 要求）
    if (config.mcpServers && (config.mcpServers as Record<string, unknown>)[entry.name]) {
      const backupPath = this.configPath + '.bak';
      writeFileSync(backupPath, JSON.stringify(config, null, 2));
    }

    // 确保目录存在
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }

    // 写入配置
    config.mcpServers = config.mcpServers || {};
    (config.mcpServers as Record<string, unknown>)[entry.name] = {
      command: entry.command,
      args: entry.args,
      env: entry.env || {},
    };

    writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  async removeConfig(packageName: string): Promise<void> {
    const config = await this.readConfig();

    if (config.mcpServers) {
      // 备份
      const backupPath = this.configPath + '.bak';
      writeFileSync(backupPath, JSON.stringify(config, null, 2));

      // 删除配置
      delete (config.mcpServers as Record<string, unknown>)[packageName];
      writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    }
  }

  async hasConfig(packageName: string): Promise<boolean> {
    const config = await this.readConfig();
    return !!(config.mcpServers && (config.mcpServers as Record<string, unknown>)[packageName]);
  }
}
