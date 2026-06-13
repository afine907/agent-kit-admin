/**
 * CLI 配置管理器
 * 配置路径: ~/.akit/config.json
 */

import Conf from 'conf';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface UserInfo {
  id: string;
  username: string;
  display_name: string;
}

export interface ConfigData {
  token?: string;
  user?: UserInfo;
  registry: string;
  updated_at?: string;
}

const DEFAULT_CONFIG: ConfigData = {
  registry: 'http://localhost',
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
   * 获取用户信息
   */
  getUser(): UserInfo | undefined {
    return this.get('user');
  }

  /**
   * 设置用户信息
   */
  setUser(user: UserInfo): void {
    this.set('user', user);
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
    this.config.delete('user');
    this.config.delete('updated_at');
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
