/**
 * CLI 配置管理器
 * 配置路径: ~/.akit/config.json
 */

import path from 'node:path';
import Conf from 'conf';
import { readFile, writeFile } from 'fs/promises';

export interface UserInfo {
  id: string;
  username: string;
  display_name: string;
  role?: string;
}

export interface InstalledPackage {
  name: string;
  full_name: string;
  scope: string;
  version: string;
  type: string;
  agent: string;
  installed_at: string;
  updated_at?: string;
}

export interface ConfigData {
  token?: string;
  refresh_token?: string;
  user?: UserInfo;
  registry: string;
  updated_at?: string;
  installed_packages?: InstalledPackage[];
  /** 当前 workspace scope，格式为 @username 或 @team-slug */
  workspace?: string;
}

const DEFAULT_CONFIG: ConfigData = {
  registry: 'http://localhost',
  installed_packages: [],
};

export interface RecoveryResult {
  recovered: boolean;
  backupPath?: string;
}

/**
 * 生成备份路径
 * 如果 .bak 已存在，使用带日期的备份名
 */
function getBackupPath(configPath: string): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const defaultBackup = configPath + '.bak';
  // 使用同步版本检查，因为这是辅助函数
  const fs = require('fs');
  if (fs.existsSync(defaultBackup)) {
    return `${configPath}.bak.${dateStr}`;
  }
  return defaultBackup;
}

/**
 * 检测并恢复损坏的配置文件（异步版本）
 *
 * 如果配置文件 JSON 损坏，备份为 .bak 并创建新配置。
 *
 * @param configPath - 配置文件路径
 * @returns 恢复结果
 */
export async function recoverConfig(configPath: string): Promise<RecoveryResult> {
  try {
    const content = await readFile(configPath, 'utf-8');
    try {
      JSON.parse(content);
      return { recovered: false }; // 有效 JSON，无需恢复
    } catch {
      // JSON 损坏，需要恢复
      const backupPath = getBackupPath(configPath);
      await writeFile(backupPath, content, 'utf-8');
      await writeFile(configPath, '{}', 'utf-8');
      return { recovered: true, backupPath };
    }
  } catch {
    // 文件不存在或无法读取，无需恢复
    return { recovered: false };
  }
}

/**
 * 检测并恢复损坏的配置文件（同步版本）
 * 用于构造函数中需要同步操作的场景
 *
 * @param configPath - 配置文件路径
 * @returns 是否进行了恢复
 */
function checkAndRecoverySync(configPath: string): boolean {
  try {
    const fs = require('fs');
    if (!fs.existsSync(configPath)) return false;
    const content = fs.readFileSync(configPath, 'utf-8');
    try {
      JSON.parse(content);
      return false; // 有效 JSON，无需恢复
    } catch {
      // JSON 损坏，同步恢复
      const backupPath = getBackupPath(configPath);
      fs.writeFileSync(backupPath, content, 'utf-8');
      fs.writeFileSync(configPath, '{}', 'utf-8');
      return true;
    }
  } catch {
    // 忽略读取错误
    return false;
  }
}

export class ConfigManager {
  private config: Conf<ConfigData>;

  constructor(configPath?: string) {
    if (configPath) {
      // 测试模式：使用指定路径
      const dir = path.dirname(configPath);
      const name = path.basename(configPath, path.extname(configPath));
      this.config = new Conf<ConfigData>({
        projectName: 'akit',
        cwd: dir,
        configName: name,
        defaults: DEFAULT_CONFIG,
      });
    } else {
      this.config = new Conf<ConfigData>({
        projectName: 'akit',
        defaults: DEFAULT_CONFIG,
      });
    }

    // 自动检测并恢复损坏的配置
    checkAndRecoverySync(this.config.path);
  }

  /**
   * 获取配置值
   */
  get<K extends keyof ConfigData>(key: K): ConfigData[K] {
    return this.config.get(key);
  }

  /**
   * 设置配置值
   */
  set<K extends keyof ConfigData>(key: K, value: ConfigData[K]): void {
    this.config.set(key, value);
  }

  /**
   * 获取 token
   */
  getToken(): string | undefined {
    return this.get('token');
  }

  /**
   * 设置 token
   */
  setToken(token: string): void {
    this.set('token', token);
    this.set('updated_at', new Date().toISOString());
  }

  /**
   * 获取 refresh token
   */
  getRefreshToken(): string | undefined {
    return this.get('refresh_token');
  }

  /**
   * 设置 refresh token
   */
  setRefreshToken(token: string): void {
    this.set('refresh_token', token);
  }

  /**
   * 获取用户信息
   */
  getUser(): UserInfo | undefined {
    return this.get('user');
  }

  /**
   * 设置用户信息
   */
  setUser(user: UserInfo | null): void {
    if (user) {
      this.set('user', user);
    } else {
      this.config.delete('user');
    }
  }

  /**
   * 获取 registry URL
   */
  getRegistry(): string {
    return this.get('registry');
  }

  /**
   * 设置 registry URL
   */
  setRegistry(url: string): void {
    this.set('registry', url);
  }

  /**
   * 检查是否已登录
   */
  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  /**
   * 清除认证信息
   */
  clearAuth(): void {
    this.config.delete('token');
    this.config.delete('refresh_token');
    this.config.delete('user');
    this.config.delete('updated_at');
  }

  /**
   * 获取已安装的包列表
   */
  getInstalledPackages(): InstalledPackage[] {
    return this.get('installed_packages') || [];
  }

  /**
   * 添加已安装的包
   */
  addInstalledPackage(pkg: InstalledPackage): void {
    const packages = this.getInstalledPackages();
    const existing = packages.findIndex((p) => p.full_name === pkg.full_name);
    if (existing >= 0) {
      packages[existing] = pkg;
    } else {
      packages.push(pkg);
    }
    this.set('installed_packages', packages);
  }

  /**
   * 移除已安装的包
   */
  removeInstalledPackage(fullName: string): void {
    const packages = this.getInstalledPackages().filter((p) => p.full_name !== fullName);
    this.set('installed_packages', packages);
  }

  /**
   * 更新已安装的包
   */
  updateInstalledPackage(fullName: string, updates: Partial<InstalledPackage>): void {
    const packages = this.getInstalledPackages();
    const index = packages.findIndex((p) => p.full_name === fullName);
    if (index >= 0) {
      packages[index] = { ...packages[index], ...updates };
      this.set('installed_packages', packages);
    }
  }

  /**
   * 重置所有配置
   */
  reset(): void {
    this.config.clear();
    this.config.set('registry', DEFAULT_CONFIG.registry);
    this.config.set('installed_packages', []);
  }

  /**
   * 获取当前 workspace scope（无时返回 null）
   */
  getWorkspace(): string | null {
    return this.get('workspace') ?? null;
  }

  /**
   * 设置当前 workspace scope
   */
  setWorkspace(scope: string): void {
    this.set('workspace', scope);
  }

  /**
   * 清除当前 workspace
   */
  clearWorkspace(): void {
    this.config.delete('workspace');
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return this.config.path;
  }
}

// 单例导出
export const configManager = new ConfigManager();
