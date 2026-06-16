/**
 * 评分分布图组件
 *
 * 显示 1-5 星的评价数量分布条形图，左侧显示平均分和总评价数。
 */

interface RatingDistributionProps {
  averageRating: number;
  totalReviews: number;
  distribution: Record<number, number>;
}

export function RatingDistribution({ averageRating, totalReviews, distribution }: RatingDistributionProps) {
  const maxCount = Math.max(...Object.values(distribution), 1);

  return (
    <div className="flex items-start gap-6">
      {/* 左侧大数字 */}
      <div className="text-center">
        <div className="text-4xl font-bold text-gray-900">{averageRating.toFixed(1)}</div>
        <div className="text-sm text-gray-400 mt-1">
          {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
        </div>
      </div>

      {/* 右侧分布条 */}
      <div className="flex-1 space-y-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = distribution[star] || 0;
          const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
          const barWidth = totalReviews > 0 ? (count / maxCount) * 100 : 0;

          return (
            <div key={star} className="flex items-center gap-2 text-sm">
              <span className="w-8 text-right text-gray-500">{star}★</span>
              <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full transition-all duration-300"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <span className="w-10 text-right text-gray-400 text-xs">{count}</span>
              <span className="w-10 text-right text-gray-400 text-xs">{percentage.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
