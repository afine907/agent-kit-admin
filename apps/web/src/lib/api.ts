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
export interface AdminPackageResponse extends PackageResponse {
  admin_status: string;
  deleted_at?: string;
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
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

// 评价相关类型
export interface ReviewResponse {
  id: string;
  package_id: string;
  version_id?: string;
  user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  rating: number;
  comment?: string;
  created_at: string;
  updated_at: string;
}

export interface ReviewListResponse {
  data: ReviewResponse[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
  stats: {
    average_rating: number;
    total_reviews: number;
    rating_distribution: Record<number, number>;
  };
}

// 包统计类型
export interface PackageStatsResponse {
  total_downloads: number;
  recent_downloads: number;
  trends: DownloadTrend[];
}

export interface AppConfig {
  oauth_provider: string;
}

// 团队相关类型
export interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatar_url?: string;
  member_count: number;
  created_at: string;
}

export interface TeamMember {
  user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export interface TeamPackage {
  id: string;
  name: string;
  scope: string;
  full_name: string;
  type: 'mcp' | 'skill';
  description?: string;
  visibility: 'team' | 'public';
  owner_type: 'team' | 'user';
  latest_version?: string;
  my_installed_version: string | null;
  has_update: boolean;
  downloads_count: number;
  created_at: string;
  updated_at: string;
}

export interface PublishTeamPackageData {
  name: string;
  type: 'mcp' | 'skill';
  description?: string;
  visibility?: 'team' | 'public';
  owner_type: 'team';
  manifest: Record<string, unknown>;
  tarball: string; // base64 encoded
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

  createPackage: (data: {
    name: string;
    scope: string;
    type: 'mcp' | 'skill';
    description?: string;
    license?: string;
    repository?: string;
    homepage?: string;
    visibility?: string;
    tags?: string[];
  }) => client.post<PackageResponse>('/api/v1/packages', data).then((r) => r.data),

  updatePackage: (scope: string, name: string, data: {
    description?: string;
    tags?: string[];
    visibility?: string;
  }) => client.patch<PackageResponse>(`/api/v1/packages/${scope}/${name}`, data).then((r) => r.data),

  updateVersion: (scope: string, name: string, version: string, data: {
    deprecated?: boolean;
    yanked?: boolean;
  }) => client.patch(`/api/v1/packages/${scope}/${name}/versions/${version}`, data).then((r) => r.data),

  listVersions: (scope: string, name: string) =>
    client.get<VersionListResponse>(`/api/v1/packages/${scope}/${name}/versions`).then((r) => r.data),

  getDownloadUrl: (scope: string, name: string, version?: string) =>
    `/api/v1/packages/${scope}/${name}/download${version ? `?version=${version}` : ''}`,

  publishVersion: (scope: string, name: string, formData: FormData) =>
    client.post(`/api/v1/packages/${scope}/${name}/versions`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),

  // 评价
  listReviews: (scope: string, name: string, params?: { page?: number; per_page?: number }) =>
    client.get<ReviewListResponse>(`/api/v1/packages/${scope}/${name}/reviews`, { params }).then((r) => r.data),

  createReview: (scope: string, name: string, data: { rating: number; comment?: string; version_id?: string }) =>
    client.post<ReviewResponse>(`/api/v1/packages/${scope}/${name}/reviews`, data).then((r) => r.data),

  updateReview: (scope: string, name: string, reviewId: string, data: { rating: number; comment?: string }) =>
    client.put<ReviewResponse>(`/api/v1/packages/${scope}/${name}/reviews/${reviewId}`, data).then((r) => r.data),

  deleteReview: (scope: string, name: string, reviewId: string) =>
    client.delete(`/api/v1/packages/${scope}/${name}/reviews/${reviewId}`).then((r) => r.data),

  // 包统计
  getPackageStats: (scope: string, name: string) =>
    client.get<PackageStatsResponse>(`/api/v1/packages/${scope}/${name}/stats`).then((r) => r.data),

  // 用户资料
  updateProfile: (data: { display_name?: string; avatar_url?: string }) =>
    client.patch<User>('/api/v1/auth/me', data).then((r) => r.data),

  // 团队管理
  listTeams: () =>
    client.get<Team[]>('/api/v1/teams').then((r) => r.data),

  createTeam: (data: { name: string; slug: string; description?: string }) =>
    client.post<Team>('/api/v1/teams', data).then((r) => r.data),

  getTeam: (teamId: string) =>
    client.get<Team>(`/api/v1/teams/${teamId}`).then((r) => r.data),

  updateTeam: (teamId: string, data: { name?: string; description?: string }) =>
    client.put<Team>(`/api/v1/teams/${teamId}`, data).then((r) => r.data),

  deleteTeam: (teamId: string) =>
    client.delete(`/api/v1/teams/${teamId}`).then((r) => r.data),

  listTeamMembers: (teamId: string) =>
    client.get<TeamMember[]>(`/api/v1/teams/${teamId}/members`).then((r) => r.data),

  addTeamMember: (teamId: string, data: { user_id: string; role?: string }) =>
    client.post<TeamMember>(`/api/v1/teams/${teamId}/members`, data).then((r) => r.data),

  removeTeamMember: (teamId: string, userId: string) =>
    client.delete(`/api/v1/teams/${teamId}/members/${userId}`).then((r) => r.data),

  updateTeamMemberRole: (teamId: string, userId: string, role: string) =>
    client.put<TeamMember>(`/api/v1/teams/${teamId}/members/${userId}`, { role }).then((r) => r.data),

  // 团队包管理
  listTeamPackages: (teamId: string) =>
    client.get<TeamPackage[]>(`/api/v1/teams/${teamId}/packages`).then((r) => r.data),

  publishTeamPackage: (teamId: string, data: PublishTeamPackageData) =>
    client.post<TeamPackage>(`/api/v1/teams/${teamId}/packages`, data).then((r) => r.data),

  getTeamPackage: (teamId: string, packageId: string) =>
    client.get<TeamPackage>(`/api/v1/teams/${teamId}/packages/${packageId}`).then((r) => r.data),

  deleteTeamPackage: (teamId: string, packageId: string) =>
    client.delete(`/api/v1/teams/${teamId}/packages/${packageId}`).then((r) => r.data),

  getTeamPackageVersions: (teamId: string, packageId: string) =>
    client.get<VersionResponse[]>(`/api/v1/teams/${teamId}/packages/${packageId}/versions`).then((r) => r.data),

  installTeamPackage: (teamId: string, packageId: string, version?: string) =>
    client.post(
      `/api/v1/teams/${teamId}/packages/${packageId}/install`,
      version ? { version } : {}
    ).then((r) => r.data),

  // 管理后台
  admin: {
    // 用户管理
    listUsers: (params?: {
      page?: number;
      per_page?: number;
      role?: string;
      status?: string;
      keyword?: string;
    }) => client.get<{ data: AdminUserResponse[]; pagination: Pagination }>('/api/v1/admin/users', { params }).then((r) => r.data),

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
    }) => client.get<{ data: AdminPackageResponse[]; pagination: Pagination }>('/api/v1/admin/packages', { params }).then((r) => r.data),

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
