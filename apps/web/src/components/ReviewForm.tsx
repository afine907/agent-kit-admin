/**
 * 评价表单组件
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateReview, useUpdateReview } from '../hooks/useReviews';
import { useAuthStore } from '../stores/authStore';
import { ReviewResponse } from '../lib/api';
import { Star, Send, X } from 'lucide-react';

interface ReviewFormProps {
  scope: string;
  name: string;
  editingReview?: ReviewResponse | null;
  onCancelEdit?: () => void;
}

export function ReviewForm({ scope, name, editingReview, onCancelEdit }: ReviewFormProps) {
  const { t } = useTranslation('pages');
  const { user } = useAuthStore();
  const [rating, setRating] = useState(editingReview?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState(editingReview?.comment || '');
  const [ratingError, setRatingError] = useState(false);

  const createMutation = useCreateReview(scope, name);
  const updateMutation = useUpdateReview(scope, name);

  const isEditing = !!editingReview;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      setRatingError(true);
      return;
    }
    setRatingError(false);

    if (isEditing && editingReview) {
      updateMutation.mutate(
        { reviewId: editingReview.id, data: { rating, comment: comment || undefined } },
        {
          onSuccess: () => {
            setRating(0);
            setComment('');
            onCancelEdit?.();
          },
        }
      );
    } else {
      createMutation.mutate(
        { rating, comment: comment || undefined },
        {
          onSuccess: () => {
            setRating(0);
            setComment('');
          },
        }
      );
    }
  };

  if (!user) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <p>{t('packageDetail.reviews.loginRequired')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-muted/30 rounded-lg border border-border/50">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium">
          {isEditing ? t('packageDetail.reviews.editReview') : t('packageDetail.reviews.writeReview')}
        </h4>
        {isEditing && onCancelEdit && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 星级评分 */}
      <div className="mb-4">
        <label className="text-sm text-muted-foreground mb-2 block">
          {t('packageDetail.reviews.rating')}
        </label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={`w-6 h-6 ${
                  star <= (hoverRating || rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-2 text-sm text-muted-foreground">
              {rating}/5
            </span>
          )}
        </div>
        {ratingError && (
          <p className="text-sm text-destructive mt-1">
            {t('packageDetail.reviews.ratingRequired')}
          </p>
        )}
      </div>

      {/* 评价内容 */}
      <div className="mb-4">
        <label htmlFor="review-comment" className="text-sm text-muted-foreground mb-2 block">
          {t('packageDetail.reviews.comment')}
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('packageDetail.reviews.commentPlaceholder')}
          rows={3}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 resize-none"
        />
      </div>

      {/* 提交按钮 */}
      <div className="flex items-center justify-end gap-2">
        {isEditing && onCancelEdit && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
          >
            {t('common:actions.cancel')}
          </button>
        )}
        <button
          type="submit"
          disabled={isPending || rating === 0}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
          {isPending
            ? t('common:actions.submitting')
            : isEditing
              ? t('common:actions.update')
              : t('common:actions.submit')}
        </button>
      </div>
    </form>
  );
}
