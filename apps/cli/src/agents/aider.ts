/**
 * Aider 适配器
 * 配置路径: ~/.aider\.aider.conf.yml
 * 格式: YAML，包含 mcp_servers 段落
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import { AgentAdapter, MCPConfig, MCPEntry } from './types.js';

const YAML_DUMP_OPTIONS = { lineWidth: -1, indent: 2, noRefs: true };

export class AiderAdapter implements AgentAdapter {
  name = 'Aider';

  private configDir: string;
  private configPath: string;

  constructor(baseDir?: string) {
    this.configDir = baseDir ? join(baseDir, '.aider') : join(homedir(), '.aider');
    this.configPath = join(this.configDir, '.aider.conf.yml');
  }

  async detect(): Promise<boolean> {
    return existsSync(this.configPath);
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
      const parsed = yamlLoad(content) as Record<string, unknown> | null;
      return (parsed || { mcp_servers: {} }) as MCPConfig;
    } catch {
      // 配置文件损坏，备份并创建新的
      const backupPath = this.configPath + '.corrupt.' + Date.now();
      try {
        const backupContent = readFileSync(this.configPath, 'utf-8');
        writeFileSync(backupPath, backupContent);
      } catch {
        // 文件已被删除或无法读取，跳过备份
      }
      writeFileSync(this.configPath, yamlDump({ mcp_servers: {} }, YAML_DUMP_OPTIONS));
      return { mcp_servers: {} };
    }
  }

  async writeConfig(entry: MCPEntry): Promise<void> {
    const config = await this.readConfig();

    // 备份将被覆盖的已有 entry 配置
    if (
      config.mcp_servers &&
      (config.mcp_servers as Record<string, unknown>)[entry.name]
    ) {
      const backupPath = this.configPath + '.bak';
      try { unlinkSync(backupPath); } catch { /* 旧备份不存在则跳过 */ }
      writeFileSync(backupPath, yamlDump(config, YAML_DUMP_OPTIONS));
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
      env: entry.env || {},
    };

    writeFileSync(this.configPath, yamlDump(config, YAML_DUMP_OPTIONS));
  }

  async removeConfig(packageName: string): Promise<void> {
    const config = await this.readConfig();

    if (
      config.mcp_servers &&
      (config.mcp_servers as Record<string, unknown>)[packageName]
    ) {
      // 备份
      const backupPath = this.configPath + '.bak';
      try { unlinkSync(backupPath); } catch { /* 旧备份不存在则跳过 */ }
      writeFileSync(backupPath, yamlDump(config, YAML_DUMP_OPTIONS));

      // 删除配置
      delete (config.mcp_servers as Record<string, unknown>)[packageName];
      writeFileSync(this.configPath, yamlDump(config, YAML_DUMP_OPTIONS));
    }
  }

  async hasConfig(packageName: string): Promise<boolean> {
    const config = await this.readConfig();
    return !!(
      config.mcp_servers &&
      (config.mcp_servers as Record<string, unknown>)[packageName]
    );
  }
}
