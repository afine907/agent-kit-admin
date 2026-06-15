/**
 * 评价数据 Hooks - TanStack Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ReviewListResponse } from '../lib/api';

/**
 * 获取包评价列表
 */
export function useReviews(scope: string, name: string, params?: { page?: number; per_page?: number }) {
  return useQuery<ReviewListResponse>({
    queryKey: ['reviews', scope, name, params],
    queryFn: () => api.listReviews(scope, name, params),
    enabled: !!scope && !!name,
  });
}

/**
 * 创建评价
 */
export function useCreateReview(scope: string, name: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { rating: number; comment?: string; version_id?: string }) =>
      api.createReview(scope, name, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', scope, name] });
      queryClient.invalidateQueries({ queryKey: ['package', scope, name] });
    },
  });
}

/**
 * 更新评价
 */
export function useUpdateReview(scope: string, name: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId, data }: { reviewId: string; data: { rating: number; comment?: string } }) =>
      api.updateReview(scope, name, reviewId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', scope, name] });
    },
  });
}

/**
 * 删除评价
 */
export function useDeleteReview(scope: string, name: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reviewId: string) => api.deleteReview(scope, name, reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', scope, name] });
      queryClient.invalidateQueries({ queryKey: ['package', scope, name] });
    },
  });
}
