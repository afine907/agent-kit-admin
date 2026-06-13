/**
 * 包数据 Hooks - TanStack Query
 */

import { useQuery } from '@tanstack/react-query';
import { api, PackageListResponse, PackageResponse, VersionListResponse } from '../lib/api';

/**
 * 获取包列表
 */
export function usePackages(params?: {
  search?: string;
  type?: string;
  scope?: string;
  page?: number;
  per_page?: number;
}) {
  return useQuery<PackageListResponse>({
    queryKey: ['packages', params],
    queryFn: () => api.listPackages(params),
  });
}

/**
 * 获取包详情
 */
export function usePackage(scope: string, name: string) {
  return useQuery<PackageResponse>({
    queryKey: ['package', scope, name],
    queryFn: () => api.getPackage(scope, name),
    enabled: !!scope && !!name,
  });
}

/**
 * 获取版本列表
 */
export function useVersions(scope: string, name: string) {
  return useQuery<VersionListResponse>({
    queryKey: ['versions', scope, name],
    queryFn: () => api.listVersions(scope, name),
    enabled: !!scope && !!name,
  });
}
