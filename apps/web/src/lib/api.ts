/**
 * API 客户端
 */

import axios, { AxiosInstance } from 'axios';
import { useAuthStore, User } from '../stores/authStore';

// API 基础 URL
const BASE_URL = import.meta.env.VITE_API_URL || '';

// 创建 axios 实例
const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加 token
client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器 - 统一错误处理
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      const message = data?.error?.message || data?.message || error.message;

      // 401 清除认证状态
      if (status === 401) {
        useAuthStore.getState().clearAuth();
      }

      throw new Error(`API Error (${status}): ${message}`);
    }
    throw error;
  }
);

// 类型定义
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
  data: PackageResponse[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
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
  data: VersionResponse[];
  total: number;
}

// 类型定义
export interface AuthResponse {
  token: string;
  refresh_token?: string;
  user: User;
}

export interface AdminUserResponse {
  id: string;
  username: string;
  email?: string;
  display_name?: string;
  avatar_url?: string;
  role: string;
  status: string;
  oauth_provider: string;
  last_login_at?: string;
  created_at?: string;
}

export interface AdminStatsResponse {
  total_users: number;
  active_users: number;
  total_packages: number;
}

export interface DownloadTrend {
  date: string;
  downloads: number;
}

export interface DownloadTrendsResponse {
  trends: DownloadTrend[];
  days: number;
}

export interface APIKeyResponse {
  id: string;
  name: string;
  key?: string;  // 只在创建时返回
  key_prefix: string;
  permissions: string[];
  last_used_at?: string;
  created_at: string;
}

export interface AppConfig {
  oauth_provider: string;
}

// API 函数
export const api = {
  // 配置
  getConfig: () => client.get<{ data: AppConfig }>('/api/v1/config').then((r) => r.data),

  // 认证
  getOAuthUrl: (provider: string) => `/api/v1/auth/oauth/${provider}`,
  getMe: () => client.get<User>('/api/v1/auth/me').then((r) => r.data),

  // 本地登录/注册
  login: (email: string, password: string) =>
    client.post<AuthResponse>('/api/v1/auth/login', { email, password }).then((r) => r.data),

  register: (username: string, email: string, password: string, display_name?: string) =>
    client.post<AuthResponse>('/api/v1/auth/register', { username, email, password, display_name }).then((r) => r.data),

  refreshToken: (refresh_token: string) =>
    client.post<{ token: string }>('/api/v1/auth/refresh', { refresh_token }).then((r) => r.data),

  logout: () => client.post('/api/v1/auth/logout').then((r) => r.data),

  // API Key 管理
  createAPIKey: (name: string) =>
    client.post<APIKeyResponse>('/api/v1/auth/api-keys', { name }).then((r) => r.data),

  listAPIKeys: () =>
    client.get<APIKeyResponse[]>('/api/v1/auth/api-keys').then((r) => r.data),

  deleteAPIKey: (keyId: string) =>
    client.delete(`/api/v1/auth/api-keys/${keyId}`).then((r) => r.data),

  // 包
  listPackages: (params?: {
    search?: string;
    type?: string;
    scope?: string;
    sort?: string;
    order?: string;
    page?: number;
    per_page?: number;
  }) => client.get<PackageListResponse>('/api/v1/packages', { params }).then((r) => r.data),

  getPackage: (scope: string, name: string) =>
    client.get<PackageResponse>(`/api/v1/packages/${scope}/${name}`).then((r) => r.data),

  listVersions: (scope: string, name: string) =>
    client.get<VersionListResponse>(`/api/v1/packages/${scope}/${name}/versions`).then((r) => r.data),

  getDownloadUrl: (scope: string, name: string, version?: string) =>
    `/api/v1/packages/${scope}/${name}/download${version ? `?version=${version}` : ''}`,

  // 管理后台
  admin: {
    // 用户管理
    listUsers: (params?: {
      page?: number;
      per_page?: number;
      role?: string;
      status?: string;
      keyword?: string;
    }) => client.get<{ data: AdminUserResponse[]; pagination: any }>('/api/v1/admin/users', { params }).then((r) => r.data),

    getUser: (userId: string) =>
      client.get<AdminUserResponse>(`/api/v1/admin/users/${userId}`).then((r) => r.data),

    updateUserStatus: (userId: string, status: string, reason?: string) =>
      client.patch(`/api/v1/admin/users/${userId}/status`, { status, reason }).then((r) => r.data),

    updateUserRole: (userId: string, role: string) =>
      client.patch(`/api/v1/admin/users/${userId}/role`, { role }).then((r) => r.data),

    deleteUser: (userId: string) =>
      client.delete(`/api/v1/admin/users/${userId}`).then((r) => r.data),

    // 包管理
    listPackages: (params?: {
      page?: number;
      per_page?: number;
      type?: string;
      include_deleted?: boolean;
    }) => client.get<{ data: any[]; pagination: any }>('/api/v1/admin/packages', { params }).then((r) => r.data),

    updatePackageStatus: (packageId: string, status: string, reason?: string) =>
      client.patch(`/api/v1/admin/packages/${packageId}/status`, { status, reason }).then((r) => r.data),

    deletePackage: (packageId: string) =>
      client.delete(`/api/v1/admin/packages/${packageId}`).then((r) => r.data),

    // 统计
    getStats: () =>
      client.get<AdminStatsResponse>('/api/v1/admin/stats').then((r) => r.data),

    getDownloadTrends: (days: number = 30) =>
      client.get<DownloadTrendsResponse>('/api/v1/admin/stats/downloads', { params: { days } }).then((r) => r.data),
  },
};
