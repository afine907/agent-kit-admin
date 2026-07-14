/**
 * Agent Kit Admin - API 客户端
 */

import axios, { AxiosInstance } from 'axios';
import { configManager } from '../config/manager.js';

// 扩展 Axios 类型以支持重试计数
declare module 'axios' {
  interface AxiosRequestConfig {
    __retryCount?: number;
  }
}

// 类型定义
export interface AuthResponse {
  token: string;
  refresh_token?: string;
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    role?: string;
    status?: string;
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

export interface APIKeyResponse {
  id: string;
  name: string;
  key?: string;  // 只在创建时返回
  key_prefix: string;
  permissions: string[];
  last_used_at?: string;
  created_at: string;
}

export interface TeamInfo {
  id: string;
  name: string;
  slug: string;
  description?: string;
  avatar_url?: string;
  member_count: number;
  created_at: string;
}

export interface TeamPackageInfo {
  id: string;
  name: string;
  scope: string;
  full_name: string;
  type: 'mcp' | 'skill';
  description?: string;
  visibility: string;
  owner_type: string;
  downloads_count: number;
  latest_version?: string;
  created_at: string;
  updated_at: string;
  // 安装状态（仅 listTeamPackages 时返回）
  my_installed_version?: string | null;
  has_update?: boolean;
}

export interface InstalledPackageInfo {
  package_id: string;
  version_installed: string;
  installed_at: string;
  package_name?: string;
  package_scope?: string;
  package_type?: string;
  latest_version?: string;
  has_update?: boolean;
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

    // 响应拦截器 - 带重试的统一错误处理
    const RETRYABLE_STATUSES = [429, 502, 503, 504];
    const MAX_RETRIES = 3;

    // 中文友好错误消息
    const USER_FRIENDLY_ERRORS: Record<number, string> = {
      400: '请求参数错误',
      401: '未登录或登录已过期，请运行 akit login',
      403: '没有权限执行此操作',
      404: '找不到请求的资源',
      409: '资源冲突，可能已存在',
      422: '请求参数验证失败',
      429: '请求过于频繁，请稍后再试',
      500: '服务器内部错误，请稍后重试',
      502: '服务暂时不可用，请稍后重试',
      503: '服务暂时不可用，请稍后重试',
    };

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;

        // 判断是否可重试
        const isRetryable =
          !error.response || RETRYABLE_STATUSES.includes(error.response.status);

        if (isRetryable && config && (config.__retryCount ?? 0) < MAX_RETRIES) {
          config.__retryCount = (config.__retryCount ?? 0) + 1;

          // 429 响应优先使用 Retry-After 头
          let delay: number;
          if (error.response?.status === 429) {
            const retryAfter = error.response.headers?.['retry-after'];
            if (retryAfter !== undefined && retryAfter !== null) {
              const parsed = parseInt(retryAfter, 10);
              delay = isNaN(parsed) ? Math.pow(2, config.__retryCount) * 1000 : parsed * 1000;
            } else {
              delay = Math.pow(2, config.__retryCount) * 1000;
            }
          } else {
            delay = Math.pow(2, config.__retryCount) * 1000;
          }

          await new Promise((r) => setTimeout(r, delay));
          return this.client(config);
        }

        // 格式化错误消息（中文友好）
        if (error.response) {
          const { status, data } = error.response;
          const apiMessage = data?.error?.message || data?.message || error.message;
          const friendlyMsg = USER_FRIENDLY_ERRORS[status];
          const hint = friendlyMsg && friendlyMsg !== apiMessage ? ` → ${friendlyMsg}` : '';
          throw new Error(`${apiMessage}${hint}`);
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

  /**
   * 本地登录
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>(
      '/api/v1/auth/login',
      { email, password }
    );
    return response.data;
  }

  /**
   * 本地注册
   */
  async register(username: string, email: string, password: string, displayName?: string): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>(
      '/api/v1/auth/register',
      { username, email, password, display_name: displayName }
    );
    return response.data;
  }

  /**
   * 刷新 Token
   */
  async refreshToken(refreshToken: string): Promise<{ token: string }> {
    const response = await this.client.post<{ token: string }>(
      '/api/v1/auth/refresh',
      { refresh_token: refreshToken }
    );
    return response.data;
  }

  /**
   * 登出
   */
  async logout(): Promise<void> {
    await this.client.post('/api/v1/auth/logout');
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
    owner_type?: 'user' | 'team';
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
   * 获取特定版本的 manifest
   */
  async getVersion(scope: string, name: string, version: string): Promise<VersionResponse> {
    const response = await this.client.get<VersionResponse>(
      `/api/v1/packages/${scope}/${name}/versions/${version}`
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
    // API returns 302 redirect to MinIO presigned URL; accept non-2xx as valid
    const response = await this.client.get(
      `/api/v1/packages/${scope}/${name}/download`,
      { params, maxRedirects: 0, validateStatus: (status) => status < 500 }
    );
    if (response.status === 302 || response.status === 301) {
      const location = response.headers['location'] as string | undefined;
      if (!location) throw new Error('No Location header in redirect response');
      return location;
    }
    if (response.status >= 400) {
      throw new Error(`Download URL request failed: ${response.status}`);
    }
    // Some APIs return URL in body
    const data = response.data as { url?: string };
    return data.url || (typeof data === 'string' ? data : '');
  }

  /**
   * 检查依赖是否存在
   */
  async checkDependencies(
    dependencies: Record<string, string>
  ): Promise<{ all_exist: boolean; results: Array<{ name: string; constraint: string; exists: boolean; latest_version: string | null }> }> {
    const response = await this.client.post('/api/v1/packages/check-dependencies', { dependencies });
    return response.data;
  }

  /**
   * 搜索包
   */
  async searchPackages(query: string, type?: 'mcp' | 'skill'): Promise<PackageListResponse> {
    return this.listPackages({ search: query, type });
  }

  // ============================================
  // API Key 管理
  // ============================================

  /**
   * 创建 API Key
   */
  async createAPIKey(name: string): Promise<APIKeyResponse> {
    const response = await this.client.post<APIKeyResponse>(
      '/api/v1/auth/api-keys',
      { name }
    );
    return response.data;
  }

  /**
   * 列出 API Key
   */
  async listAPIKeys(): Promise<APIKeyResponse[]> {
    const response = await this.client.get<APIKeyResponse[]>(
      '/api/v1/auth/api-keys'
    );
    return response.data;
  }

  /**
   * 删除 API Key
   */
  async deleteAPIKey(keyId: string): Promise<void> {
    await this.client.delete(`/api/v1/auth/api-keys/${keyId}`);
  }

  /**
   * 获取当前用户所属团队列表
   */
  async listTeams(): Promise<TeamInfo[]> {
    const response = await this.client.get<TeamInfo[]>('/api/v1/teams');
    return response.data;
  }

  // ============================================
  // 团队包管理
  // ============================================

  /**
   * 列出团队所有包（含当前用户安装状态）
   * GET /api/v1/teams/{team_id}/packages
   */
  async listTeamPackages(teamId: string): Promise<TeamPackageInfo[]> {
    const response = await this.client.get<TeamPackageInfo[]>(
      `/api/v1/teams/${teamId}/packages`
    );
    return response.data;
  }

  /**
   * 发布包到团队
   * POST /api/v1/teams/{team_id}/packages
   */
  async publishTeamPackage(
    teamId: string,
    data: {
      name: string;
      type: 'mcp' | 'skill';
      description?: string;
      visibility?: string;
      owner_type?: 'user' | 'team';
      manifest?: Record<string, unknown>;
      tarball?: string;
    }
  ): Promise<TeamPackageInfo> {
    const response = await this.client.post<TeamPackageInfo>(
      `/api/v1/teams/${teamId}/packages`,
      data
    );
    return response.data;
  }

  /**
   * 安装团队包（记录安装状态）
   * POST /api/v1/teams/{team_id}/packages/{package_id}/install
   */
  async installTeamPackage(
    teamId: string,
    packageId: string
  ): Promise<{ package_id: string; version_installed: string; installed_at: string }> {
    const response = await this.client.post(
      `/api/v1/teams/${teamId}/packages/${packageId}/install`
    );
    return response.data;
  }

  /**
   * 获取我安装的包（支持按 team_id 筛选）
   * GET /api/v1/me/installed?team_id=X
   */
  async getInstalledPackages(teamId?: string): Promise<InstalledPackageInfo[]> {
    const params = teamId ? { team_id: teamId } : {};
    const response = await this.client.get<{ data: InstalledPackageInfo[]; total: number }>(
      '/api/v1/me/installed',
      { params }
    );
    return response.data.data;
  }

  /**
   * 列出包的所有版本
   * GET /api/v1/teams/{team_id}/packages/{package_id}/versions
   */
  async getTeamPackageVersions(
    teamId: string,
    packageId: string
  ): Promise<VersionListResponse> {
    const response = await this.client.get<{ data: VersionResponse[]; total: number }>(
      `/api/v1/teams/${teamId}/packages/${packageId}/versions`
    );
    return { items: response.data.data, total: response.data.total };
  }

  /**
   * 获取团队包下载链接（302 redirect to MinIO presigned URL）
   * GET /api/v1/teams/{team_id}/packages/{package_id}/download
   */
  async getTeamPackageDownloadUrl(
    teamId: string,
    packageId: string,
    version?: string
  ): Promise<string> {
    const path = version
      ? `/api/v1/teams/${teamId}/packages/${packageId}/versions/${version}/download`
      : `/api/v1/teams/${teamId}/packages/${packageId}/download`;
    // API returns 302 redirect, follow Location header
    const response = await this.client.get<string>(path, {
      headers: { Accept: 'application/json' },
      maxRedirects: 0,
    });
    // Location header contains the actual download URL
    const location = response.headers['location'] as string | undefined;
    if (!location) {
      throw new Error('No download URL in response');
    }
    return location;
  }

  // ============================================
  // Webhook 管理
  // ============================================

  async listWebhooks(teamId: string): Promise<WebhookInfo[]> {
    const response = await this.client.get<{ data: WebhookInfo[] }>(
      `/api/v1/teams/${teamId}/webhooks`
    );
    return response.data.data;
  }

  async createWebhook(
    teamId: string,
    data: { url: string; events: string[]; secret?: string }
  ): Promise<WebhookInfo> {
    const response = await this.client.post<WebhookInfo>(
      `/api/v1/teams/${teamId}/webhooks`,
      data
    );
    return response.data;
  }

  async deleteWebhook(teamId: string, webhookId: string): Promise<void> {
    await this.client.delete(`/api/v1/teams/${teamId}/webhooks/${webhookId}`);
  }

  // ============================================
  // 批量操作
  // ============================================

  async batchDeletePackages(packages: string[]): Promise<BatchResultResponse> {
    const response = await this.client.post<BatchResultResponse>(
      '/api/v1/packages/batch/delete',
      { packages }
    );
    return response.data;
  }

  async batchDeprecatePackages(
    packages: string[],
    deprecated: boolean
  ): Promise<BatchResultResponse> {
    const response = await this.client.post<BatchResultResponse>(
      '/api/v1/packages/batch/deprecate',
      { packages, deprecated }
    );
    return response.data;
  }

  // Team invites & membership management

  async createTeamInvite(teamId: string): Promise<{ invite_code: string; expires_at: string }> {
    const response = await this.client.post<{ invite_code: string; expires_at: string }>(
      `/api/v1/teams/${teamId}/invites`
    );
    return response.data;
  }

  async listTeamInvites(teamId: string): Promise<Array<{
    id: string; code: string; created_by: string; created_at: string; expires_at: string; used: boolean;
  }>> {
    const response = await this.client.get(`/api/v1/teams/${teamId}/invites`);
    return response.data.items ?? response.data;
  }

  async revokeTeamInvite(teamId: string, inviteId: string): Promise<void> {
    await this.client.delete(`/api/v1/teams/${teamId}/invites/${inviteId}`);
  }

  async joinTeam(token: string): Promise<{ team_id: string; team_name: string; role: string }> {
    const response = await this.client.post<{ team_id: string; team_name: string; role: string }>(
      '/api/v1/teams/join', { token }
    );
    return response.data;
  }

  async listTeamMembers(teamId: string): Promise<Array<{
    user_id: string; username: string; display_name: string; role: string; joined_at: string;
  }>> {
    const response = await this.client.get(`/api/v1/teams/${teamId}/members`);
    return response.data.items ?? response.data;
  }

  async updateMemberRole(teamId: string, userId: string, role: string): Promise<{ user_id: string; role: string }> {
    const response = await this.client.put<{ user_id: string; role: string }>(
      `/api/v1/teams/${teamId}/members/${userId}/role`, { role }
    );
    return response.data;
  }

  async getTeamSettings(teamId: string): Promise<{ name: string; description: string; avatar_url?: string }> {
    const response = await this.client.get(`/api/v1/teams/${teamId}/settings`);
    return response.data;
  }

  async updateTeamSettings(teamId: string, data: { name?: string; description?: string; avatar_url?: string }):
    Promise<{ name: string; description: string; avatar_url?: string }> {
    const response = await this.client.put(`/api/v1/teams/${teamId}/settings`, data);
    return response.data;
  }

  async getTeamByName(name: string): Promise<{
    id: string; name: string; slug: string; description?: string; avatar_url?: string;
  }> {
    const response = await this.client.get<{
      id: string; name: string; slug: string; description?: string; avatar_url?: string;
    }>('/api/v1/teams', { params: { name } });
    const items = (response.data as unknown as { items?: Array<{
      id: string; name: string; slug: string; description?: string; avatar_url?: string;
    }> }).items ?? response.data;
    if (Array.isArray(items) && items.length > 0) {
      return items[0];
    }
    throw new Error(`Team not found: ${name}`);
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    await this.client.delete(`/api/v1/teams/${teamId}/members/${userId}`);
  }
}

export interface BatchResultResponse {
  success: string[];
  failed: Array<{ name: string; error: string }>;
}

export interface WebhookInfo {
  id: string;
  team_id: string;
  url: string;
  events: string[];
  created_at: string;
  last_triggered_at?: string;
}

// Singleton export
export const apiClient = new ApiClient();
