/**
 * Agent Kit Admin - API 客户端
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { configManager } from '../config/manager.js';

// 类型定义
export interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
  };
}

export interface PackageResponse {
  id: string;
  name: string;
  scope: string;
  full_name: string;
  type: 'mcp' | 'skill';
  description?: string;
  license?: string;
  repository?: string;
  homepage?: string;
  visibility: string;
  latest_version?: string;
  downloads_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface PackageListResponse {
  items: PackageResponse[];
  total: number;
  page: number;
  per_page: number;
}

export interface VersionResponse {
  id: string;
  version: string;
  manifest: Record<string, unknown>;
  tarball_hash: string;
  tarball_size: number;
  tag?: string;
  deprecated: boolean;
  yanked: boolean;
  published_at: string;
}

export interface VersionListResponse {
  items: VersionResponse[];
  total: number;
}

export interface ListPackagesParams {
  search?: string;
  type?: 'mcp' | 'skill';
  page?: number;
  per_page?: number;
  tag?: string;
}

export class ApiClient {
  private client: AxiosInstance;
  private token?: string;

  constructor(baseUrl?: string, token?: string) {
    this.token = token || configManager.getToken();

    this.client = axios.create({
      baseURL: baseUrl || configManager.getRegistry(),
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 请求拦截器 - 添加 token
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // 响应拦截器 - 统一错误处理
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const { status, data } = error.response;
          const message = data?.error?.message || data?.message || error.message;
          throw new Error(`API Error (${status}): ${message}`);
        }
        throw error;
      }
    );
  }

  /**
   * 设置 token
   */
  setToken(token: string): void {
    this.token = token;
  }

  // ============================================
  // 认证相关
  // ============================================

  /**
   * 获取 OAuth 登录 URL
   */
  async getOAuthUrl(provider: string): Promise<string> {
    const response = await this.client.get<{ url: string }>(
      `/api/v1/auth/oauth/${provider}`
    );
    return response.data.url;
  }

  /**
   * 处理 OAuth 回调
   */
  async handleOAuthCallback(provider: string, code: string): Promise<AuthResponse> {
    const response = await this.client.get<AuthResponse>(
      `/api/v1/auth/oauth/${provider}/callback`,
      { params: { code } }
    );
    return response.data;
  }

  /**
   * 获取当前用户信息
   */
  async getMe(): Promise<AuthResponse['user']> {
    const response = await this.client.get<AuthResponse['user']>(
      '/api/v1/auth/me'
    );
    return response.data;
  }

  // ============================================
  // 包管理
  // ============================================

  /**
   * 列出包
   */
  async listPackages(params: ListPackagesParams = {}): Promise<PackageListResponse> {
    const response = await this.client.get<PackageListResponse>(
      '/api/v1/packages',
      { params }
    );
    return response.data;
  }

  /**
   * 获取包详情
   */
  async getPackage(scope: string, name: string): Promise<PackageResponse> {
    const response = await this.client.get<PackageResponse>(
      `/api/v1/packages/${scope}/${name}`
    );
    return response.data;
  }

  /**
   * 创建包
   */
  async createPackage(data: {
    name: string;
    scope: string;
    type: 'mcp' | 'skill';
    description?: string;
    license?: string;
    visibility?: string;
    tags?: string[];
  }): Promise<PackageResponse> {
    const response = await this.client.post<PackageResponse>(
      '/api/v1/packages',
      data
    );
    return response.data;
  }

  /**
   * 获取版本列表
   */
  async getVersions(scope: string, name: string): Promise<VersionListResponse> {
    const response = await this.client.get<VersionListResponse>(
      `/api/v1/packages/${scope}/${name}/versions`
    );
    return response.data;
  }

  /**
   * 发布版本
   */
  async publishVersion(
    scope: string,
    name: string,
    formData: FormData
  ): Promise<VersionResponse> {
    const response = await this.client.post<VersionResponse>(
      `/api/v1/packages/${scope}/${name}/versions`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  /**
   * 获取下载 URL
   */
  async getDownloadUrl(
    scope: string,
    name: string,
    version?: string
  ): Promise<string> {
    const params = version ? { version } : {};
    const response = await this.client.get<{ url: string }>(
      `/api/v1/packages/${scope}/${name}/download`,
      { params }
    );
    return response.data.url;
  }

  /**
   * 搜索包
   */
  async searchPackages(query: string, type?: 'mcp' | 'skill'): Promise<PackageListResponse> {
    return this.listPackages({ search: query, type });
  }
}

// 单例导出
export const apiClient = new ApiClient();
