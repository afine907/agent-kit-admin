/**
 * 评分分布图组件
 *
 * 显示 1-5 星的评价数量分布条形图，左侧显示平均分和总评价数。
 */

import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';

interface RatingDistributionProps {
  averageRating: number;
  totalReviews: number;
  distribution: Record<string, number>;
}

export function RatingDistribution({ averageRating, totalReviews, distribution }: RatingDistributionProps) {
  const { t } = useTranslation('pages');

  if (totalReviews === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <p>{t('packageDetail.reviews.noRatings')}</p>
      </div>
    );
  }

  const maxCount = Math.max(...Object.values(distribution), 1);

  return (
    <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
      <h4 className="font-medium mb-4">{t('packageDetail.reviews.ratingDistribution')}</h4>

      <div className="flex items-start gap-6">
        {/* 左侧大数字 */}
        <div className="text-center">
          <div className="text-4xl font-bold text-primary">
            {averageRating.toFixed(1)}
          </div>
          <div className="flex items-center justify-center gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= Math.round(averageRating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {t('packageDetail.reviews.totalReviews', { count: totalReviews })}
          </div>
        </div>

        {/* 右侧分布条 */}
        <div className="flex-1 space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = distribution[String(star)] || 0;
            const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
            const barWidth = totalReviews > 0 ? (count / maxCount) * 100 : 0;

            return (
              <div key={star} className="flex items-center gap-2 text-sm">
                <span className="w-8 text-right text-muted-foreground">{star}★</span>
                <div className="flex-1 h-2.5 bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-all duration-300"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="w-10 text-right text-muted-foreground text-xs">{count}</span>
                <span className="w-10 text-right text-muted-foreground text-xs">{percentage.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
