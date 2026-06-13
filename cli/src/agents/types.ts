/**
 * Agent 适配器接口定义
 */

export interface AgentAdapter {
  /** 适配器名称 */
  name: string;

  /** 检测 Agent 是否已安装 */
  detect(): Promise<boolean>;

  /** 获取配置文件路径 */
  getConfigPath(): string;

  /** 读取配置 */
  readConfig(): Promise<MCPConfig>;

  /** 写入配置（追加） */
  writeConfig(entry: MCPEntry): Promise<void>;

  /** 移除配置 */
  removeConfig(packageName: string): Promise<void>;

  /** 检查是否已配置指定包 */
  hasConfig(packageName: string): Promise<boolean>;
}

export interface MCPConfig {
  [key: string]: unknown;
}

export interface MCPEntry {
  /** 包名（作为配置 key） */
  name: string;
  /** 启动命令 */
  command: string;
  /** 命令参数 */
  args: string[];
  /** 环境变量 */
  env?: Record<string, string>;
}
