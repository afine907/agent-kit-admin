/**
 * CLI 配置管理器
 * 配置路径: ~/.akit/config.json
 */

import Conf from 'conf';

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
}

const DEFAULT_CONFIG: ConfigData = {
  registry: 'http://localhost',
  installed_packages: [],
};

class ConfigManager {
  private config: Conf<ConfigData>;

  constructor() {
    this.config = new Conf<ConfigData>({
      projectName: 'akit',
      defaults: DEFAULT_CONFIG,
    });
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
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return this.config.path;
  }
}

// 单例导出
export const configManager = new ConfigManager();
