/**
 * 评价列表组件
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReviews, useDeleteReview } from '../hooks/useReviews';
import { useAuthStore } from '../stores/authStore';
import { ReviewResponse } from '../lib/api';
import { Star, Trash2, Edit2, User, ChevronLeft, ChevronRight } from 'lucide-react';

interface ReviewListProps {
  scope: string;
  name: string;
  onEdit?: (review: ReviewResponse) => void;
}

export function ReviewList({ scope, name, onEdit }: ReviewListProps) {
  const { t } = useTranslation('pages');
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  const perPage = 10;

  const { data, isLoading, error } = useReviews(scope, name, { page, per_page: perPage });
  const deleteMutation = useDeleteReview(scope, name);

  const handleDelete = async (reviewId: string) => {
    if (!confirm(t('packageDetail.reviews.deleteConfirm'))) return;
    deleteMutation.mutate(reviewId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        {t('packageDetail.reviews.loadError')}
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t('packageDetail.reviews.empty')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 评价列表 */}
      {data.data.map((review) => (
        <div
          key={review.id}
          className="p-4 bg-muted/30 rounded-lg border border-border/50"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {/* 用户头像 */}
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {review.avatar_url ? (
                  <img
                    src={review.avatar_url}
                    alt={review.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-5 h-5 text-primary" />
                )}
              </div>

              {/* 评价内容 */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {review.display_name || review.username}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* 星级评分 */}
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= review.rating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>

                {/* 评价文本 */}
                {review.comment && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {review.comment}
                  </p>
                )}
              </div>
            </div>

            {/* 操作按钮 */}
            {user && user.id === review.user_id && (
              <div className="flex items-center gap-2">
                {onEdit && (
                  <button
                    onClick={() => onEdit(review)}
                    className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    title={t('common:actions.edit')}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(review.id)}
                  className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  title={t('common:actions.delete')}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* 分页 */}
      {data.pagination.total_pages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            {t('common:pagination.prev')}
          </button>
          <span className="text-sm text-muted-foreground">
            {t('common:pagination.page', { page, total: data.pagination.total_pages })}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.pagination.total_pages, p + 1))}
            disabled={page === data.pagination.total_pages}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('common:pagination.next')}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
