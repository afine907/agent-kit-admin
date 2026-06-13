# 前端 TypeScript 类型定义

## 概述

本文档定义前端与后端 API 交互所需的 TypeScript 类型。这些类型与后端 API 响应格式一一对应，确保前后端契约一致。

---

## src/types/api.ts — 通用类型

```typescript
/**
 * API 统一响应结构
 */
export interface ApiResponse<T> {
  data: T
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  data: T[]
  pagination: Pagination
}

export interface Pagination {
  page: number
  per_page: number
  total: number
  total_pages: number
}

/**
 * 错误响应
 */
export interface ApiError {
  error: {
    code: number
    message: string
    details?: Record<string, unknown>
  }
}

/**
 * 排序选项
 */
export type SortField = 'updated_at' | 'downloads' | 'rating'
export type SortOrder = 'asc' | 'desc'

/**
 * 包类型
 */
export type PackageType = 'mcp' | 'skill'

/**
 * 包可见性
 */
export type Visibility = 'public' | 'team' | 'private'

/**
 * 用户角色
 */
export type TeamRole = 'owner' | 'admin' | 'member'
```

---

## src/types/user.ts — 用户相关

```typescript
import type { TeamRole } from './api'

/**
 * 用户信息
 */
export interface User {
  id: string
  username: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

/**
 * 当前用户（含团队信息）
 */
export interface CurrentUser extends User {
  teams: UserTeam[]
}

export interface UserTeam {
  id: string
  name: string
  slug: string
  role: TeamRole
}

/**
 * OAuth 登录响应
 */
export interface LoginResponse {
  token: string
  user: User
}

/**
 * 团队信息
 */
export interface Team {
  id: string
  name: string
  slug: string
  description: string | null
  avatar_url: string | null
  member_count?: number
  created_at: string
}

/**
 * 团队成员
 */
export interface TeamMember {
  user: User
  role: TeamRole
  joined_at: string
}

/**
 * API Key
 */
export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  permissions: string[]
  last_used_at: string | null
  expires_at: string | null
  created_at: string
}

/**
 * 创建 API Key 响应（含完整 key）
 */
export interface ApiKeyCreateResponse extends ApiKey {
  key: string  // 仅创建时返回
}
```

---

## src/types/package.ts — 包相关

```typescript
import type { PackageType, Visibility, Pagination } from './api'

/**
 * 包列表项
 */
export interface PackageSummary {
  id: string
  name: string
  scope: string
  full_name: string
  type: PackageType
  description: string | null
  license: string
  downloads_count: number
  rating_avg: number | null
  rating_count: number
  latest_version: string | null
  tags: string[]
  updated_at: string
}

/**
 * 包详情
 */
export interface PackageDetail {
  id: string
  name: string
  scope: string
  full_name: string
  type: PackageType
  description: string | null
  license: string
  repository: string | null
  homepage: string | null
  visibility: Visibility
  owner: PackageOwner
  downloads_count: number
  rating_avg: number | null
  rating_count: number
  latest_version: string | null
  tags: string[]
  versions: VersionSummary[]
  created_at: string
  updated_at: string
}

export interface PackageOwner {
  id: string
  name: string
  type: 'user' | 'team'
}

/**
 * 版本摘要（包详情页内嵌）
 */
export interface VersionSummary {
  version: string
  tag: string | null
  published_at: string
  deprecated: boolean
  yanked: boolean
}

/**
 * 版本详情
 */
export interface VersionDetail {
  id: string
  version: string
  manifest: Manifest
  tarball_hash: string
  tarball_size: number
  tag: string | null
  published_by: {
    id: string
    username: string
  }
  published_at: string
  deprecated: boolean
  yanked: boolean
}

/**
 * MCP Manifest 结构
 */
export interface MCPManifest {
  type: 'mcp'
  transport: 'stdio' | 'sse' | 'streamable-http'
  command?: string
  args?: string[]
  url?: string
  env?: EnvVar[]
  capabilities?: ('tools' | 'resources' | 'prompts')[]
  tools?: ToolInfo[]
}

/**
 * Skill Manifest 结构
 */
export interface SkillManifest {
  type: 'skill'
  trigger: 'command' | 'auto'
  command?: string
  content: string
  hooks?: string[]
  permissions?: string[]
}

export type Manifest = MCPManifest | SkillManifest

export interface EnvVar {
  name: string
  required: boolean
  description?: string
  default?: string
}

export interface ToolInfo {
  name: string
  description?: string
}

/**
 * 评分
 */
export interface Review {
  id: string
  user: {
    id: string
    username: string
    avatar_url: string | null
  }
  rating: number
  comment: string | null
  version: string | null
  created_at: string
  updated_at: string
}

/**
 * 评分摘要
 */
export interface ReviewSummary {
  average: number
  total: number
  distribution: {
    5: number
    4: number
    3: number
    2: number
    1: number
  }
}

/**
 * 包统计
 */
export interface PackageStats {
  downloads: {
    total: number
    daily: DailyDownload[]
  }
  rating: {
    average: number
    count: number
  }
}

export interface DailyDownload {
  date: string
  count: number
}

/**
 * 发布版本请求
 */
export interface PublishVersionRequest {
  version: string
  manifest: string  // JSON string
  tarball: File
  tag?: string
}

/**
 * 创建包请求
 */
export interface CreatePackageRequest {
  name: string
  scope?: string
  type: PackageType
  description?: string
  license?: string
  repository?: string
  visibility?: Visibility
}

/**
 * 提交评分请求
 */
export interface SubmitReviewRequest {
  rating: number
  comment?: string
  version?: string
}
```

---

## src/lib/queryClient.ts — React Query 配置

```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 分钟内数据视为新鲜
      gcTime: 10 * 60 * 1000,         // 10 分钟后清除缓存（原 cacheTime）
      retry: 2,                         // 失败重试 2 次
      refetchOnWindowFocus: false,      // 窗口聚焦不自动刷新
    },
    mutations: {
      retry: 0,                         // mutation 不重试
    },
  },
})
```

---

## src/hooks/usePackages.ts — 示例 Hook

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type {
  PackageSummary,
  PackageDetail,
  PaginatedResponse,
  Review,
  ReviewSummary,
  PackageStats,
  CreatePackageRequest,
  SubmitReviewRequest,
} from '../types/package'

/**
 * 包列表
 */
export function usePackages(params: {
  type?: string
  search?: string
  scope?: string
  tag?: string
  sort?: string
  order?: string
  page?: number
  per_page?: number
}) {
  return useQuery<PaginatedResponse<PackageSummary>>({
    queryKey: ['packages', params],
    queryFn: () => api.get('/packages', { params }).then(r => r.data),
  })
}

/**
 * 包详情
 */
export function usePackage(scope: string, name: string) {
  return useQuery<PackageDetail>({
    queryKey: ['package', scope, name],
    queryFn: () => api.get(`/packages/${scope}/${name}`).then(r => r.data),
    enabled: !!scope && !!name,
  })
}

/**
 * 包评分列表
 */
export function useReviews(scope: string, name: string, page = 1) {
  return useQuery<{ data: Review[]; summary: ReviewSummary }>({
    queryKey: ['reviews', scope, name, page],
    queryFn: () => api.get(`/packages/${scope}/${name}/reviews`, { params: { page } }).then(r => r.data),
    enabled: !!scope && !!name,
  })
}

/**
 * 包统计
 */
export function usePackageStats(scope: string, name: string) {
  return useQuery<PackageStats>({
    queryKey: ['package-stats', scope, name],
    queryFn: () => api.get(`/packages/${scope}/${name}/stats`).then(r => r.data),
    enabled: !!scope && !!name,
  })
}

/**
 * 创建包
 */
export function useCreatePackage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePackageRequest) =>
      api.post('/packages', data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] })
    },
  })
}

/**
 * 提交评分
 */
export function useSubmitReview(scope: string, name: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SubmitReviewRequest) =>
      api.post(`/packages/${scope}/${name}/reviews`, data).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', scope, name] })
      queryClient.invalidateQueries({ queryKey: ['package', scope, name] })
    },
  })
}
```

---

## src/stores/authStore.ts — 认证状态

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CurrentUser } from '../types/user'

interface AuthState {
  token: string | null
  user: CurrentUser | null
  isAuthenticated: boolean

  setAuth: (token: string, user: CurrentUser) => void
  logout: () => void
  updateUser: (user: Partial<CurrentUser>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      setAuth: (token, user) =>
        set({ token, user, isAuthenticated: true }),

      logout: () =>
        set({ token: null, user: null, isAuthenticated: false }),

      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),
    }),
    {
      name: 'auth-storage',  // localStorage key
      partialize: (state) => ({ token: state.token }),  // 只持久化 token
    }
  )
)
```

---

## 类型与 API 对照表

| API 端点 | 响应类型 | 请求类型 |
|---|---|---|
| `GET /auth/me` | `CurrentUser` | - |
| `GET /auth/api-keys` | `ApiKey[]` | - |
| `POST /auth/api-keys` | `ApiKeyCreateResponse` | `{ name, permissions?, expires_at? }` |
| `GET /packages` | `PaginatedResponse<PackageSummary>` | 查询参数 |
| `GET /packages/:scope/:name` | `PackageDetail` | - |
| `POST /packages` | `PackageDetail` | `CreatePackageRequest` |
| `GET /packages/:scope/:name/versions` | `VersionDetail[]` | - |
| `POST /packages/:scope/:name/versions` | `VersionDetail` | `PublishVersionRequest` (multipart) |
| `GET /packages/:scope/:name/reviews` | `{ data: Review[], summary: ReviewSummary }` | 分页参数 |
| `POST /packages/:scope/:name/reviews` | `Review` | `SubmitReviewRequest` |
| `GET /packages/:scope/:name/stats` | `PackageStats` | - |
| `GET /teams` | `Team[]` | - |
| `GET /teams/:slug` | `Team` | - |
| `GET /teams/:slug/members` | `TeamMember[]` | - |
