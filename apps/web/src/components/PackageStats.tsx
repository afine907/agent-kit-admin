/**
 * 包统计组件 - 展示下载趋势
 */

import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api, PackageStatsResponse, DownloadTrend } from '../lib/api';
import { Download, TrendingUp } from 'lucide-react';

interface PackageStatsProps {
  scope: string;
  name: string;
}

export function PackageStats({ scope, name }: PackageStatsProps) {
  const { t } = useTranslation('pages');

  const { data: stats, isLoading, error } = useQuery<PackageStatsResponse>({
    queryKey: ['package-stats', scope, name],
    queryFn: () => api.getPackageStats(scope, name),
    enabled: !!scope && !!name,
  });

  if (isLoading) {
    return (
      <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/3" />
          <div className="h-8 bg-muted rounded w-1/2" />
          <div className="h-20 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return null;
  }

  // 计算趋势图的最大值
  const maxDownloads = Math.max(...stats.trends.map((trend: DownloadTrend) => trend.downloads), 1);

  return (
    <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
      <h4 className="font-medium mb-4">{t('packageDetail.stats.title')}</h4>

      {/* 统计数字 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Download className="w-4 h-4" />
            {t('packageDetail.stats.totalDownloads')}
          </div>
          <div className="text-2xl font-bold mt-1">
            {stats.total_downloads.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <TrendingUp className="w-4 h-4" />
            {t('packageDetail.stats.recentDownloads')}
          </div>
          <div className="text-2xl font-bold mt-1">
            {stats.recent_downloads.toLocaleString()}
          </div>
        </div>
      </div>

      {/* 趋势图 */}
      {stats.trends.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-2">
            {t('packageDetail.stats.last30Days')}
          </div>
          <div className="flex items-end gap-1 h-24">
            {stats.trends.map((item: DownloadTrend, index: number) => {
              const height = maxDownloads > 0
                ? (item.downloads / maxDownloads) * 100
                : 0;

              return (
                <div
                  key={index}
                  className="flex-1 flex flex-col items-center"
                  title={`${item.date}: ${item.downloads} downloads`}
                >
                  <div
                    className="w-full bg-primary/80 rounded-t transition-all duration-300 hover:bg-primary"
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground">
              {stats.trends[0]?.date}
            </span>
            <span className="text-xs text-muted-foreground">
              {stats.trends[stats.trends.length - 1]?.date}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
