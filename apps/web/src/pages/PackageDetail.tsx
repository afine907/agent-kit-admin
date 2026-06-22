/**
 * PackageDetail 页面 - 终端风格包详情
 */

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePackage, useVersions } from '../hooks/usePackages';
import { VersionList } from '../components/VersionList';
import { InstallCommand } from '../components/InstallCommand';
import { ReviewList } from '../components/ReviewList';
import { ReviewForm } from '../components/ReviewForm';
import { RatingDistribution } from '../components/RatingDistribution';
import { PackageStats } from '../components/PackageStats';
import { useReviews } from '../hooks/useReviews';
import { ReviewResponse } from '../lib/api';
import {
  ChevronRight,
  ArrowLeft,
  Download,
  Tag,
  Shield,
  Calendar,
  ExternalLink,
  AlertCircle,
  Loader2,
  Star,
  Pencil,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

export default function PackageDetail() {
  const { t, i18n } = useTranslation('pages');
  const { scope, name } = useParams<{ scope: string; name: string }>();
  const [editingReview, setEditingReview] = useState<ReviewResponse | null>(null);
  const { isAuthenticated } = useAuthStore();

  const { data: pkg, isLoading, error } = usePackage(scope || '', name || '');
  const { data: versions } = useVersions(scope || '', name || '');
  const { data: reviewsData } = useReviews(scope || '', name || '');

  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US';

  if (isLoading) {
    return (
      <div className="container mx-auto py-16 flex flex-col items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin mb-3" />
        <p className="text-sm text-muted-foreground font-mono">{t('packageDetail.loading')}</p>
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="container mx-auto py-16 flex flex-col items-center justify-center animate-fade-in-up">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-destructive/10 border border-destructive/20 mb-4">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <p className="text-destructive font-medium mb-1">{t('packageDetail.notFound')}</p>
        <Link
          to="/"
          className="flex items-center gap-1.5 mt-4 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('packageDetail.backToList')}
        </Link>
      </div>
    );
  }

  const isMCP = pkg.type === 'mcp';

  return (
    <div className="container mx-auto py-8">
      {/* 面包屑 */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-8 animate-fade-in-up">
        <Link to="/" className="hover:text-primary transition-colors">
          {t('packageDetail.breadcrumb')}
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-medium">{pkg.full_name}</span>
      </div>

      {/* 主内容 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左侧 - 主要信息 */}
        <div className="lg:col-span-2 space-y-8">
          {/* 标题 */}
          <div className="animate-fade-in-up">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-extrabold tracking-tight">{pkg.full_name}</h1>
              {isAuthenticated && (
                <Link
                  to={`/packages/${scope}/${name}/edit`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-secondary/50 text-muted-foreground rounded-md border border-border/30 hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </Link>
              )}
              <span
                className={`inline-flex items-center px-2.5 py-0.5 text-xs font-mono font-medium rounded-md ${
                  isMCP
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-accent/10 text-accent border border-accent/20'
                }`}
              >
                {isMCP ? 'MCP' : 'SKILL'}
              </span>
            </div>
            <p className="text-muted-foreground mt-2 leading-relaxed">
              {pkg.description || t('empty.noDescription')}
            </p>
          </div>

          {/* 安装命令 */}
          <div className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <h2 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider mb-3">
              {t('packageDetail.install')}
            </h2>
            <InstallCommand scope={pkg.scope} name={pkg.name} />
          </div>

          {/* 标签 */}
          {pkg.tags.length > 0 && (
            <div className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
              <h2 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider mb-3">
                {t('packageDetail.tags')}
              </h2>
              <div className="flex flex-wrap gap-2">
                {pkg.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono bg-secondary/50 text-muted-foreground rounded-md border border-border/30"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 版本列表 */}
          <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <h2 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider mb-3">
              {t('packageDetail.versionHistory')}
            </h2>
            <VersionList versions={versions?.data || []} />
          </div>

          {/* 评价区域 */}
          <div className="animate-fade-in-up" style={{ animationDelay: '250ms' }}>
            <h2 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider mb-3">
              {t('packageDetail.reviews.title')}
            </h2>

            {/* 评分分布 */}
            {reviewsData?.stats && (
              <div className="mb-4">
                <RatingDistribution
                  averageRating={reviewsData.stats.average_rating}
                  totalReviews={reviewsData.stats.total_reviews}
                  distribution={reviewsData.stats.rating_distribution}
                />
              </div>
            )}

            {/* 评价表单 */}
            <div className="mb-4">
              <ReviewForm
                scope={scope || ''}
                name={name || ''}
                editingReview={editingReview}
                onCancelEdit={() => setEditingReview(null)}
              />
            </div>

            {/* 评价列表 */}
            <ReviewList
              scope={scope || ''}
              name={name || ''}
              onEdit={setEditingReview}
            />
          </div>
        </div>

        {/* 右侧 - 元信息 */}
        <div className="space-y-4">
          {/* 信息卡片 */}
          <div className="p-5 rounded-xl bg-card border border-border/50 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider mb-4">
              {t('packageDetail.info')}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Tag className="w-3.5 h-3.5" />
                  {t('packageDetail.latestVersion')}
                </span>
                <span className="font-mono font-medium">{pkg.latest_version || '-'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Download className="w-3.5 h-3.5" />
                  {t('packageDetail.downloads')}
                </span>
                <span className="font-mono font-medium">{pkg.downloads_count.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Shield className="w-3.5 h-3.5" />
                  {t('packageDetail.license')}
                </span>
                <span className="font-medium">{pkg.license || '-'}</span>
              </div>
              {pkg.repository && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('packageDetail.repository')}</span>
                  <a
                    href={pkg.repository}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline font-medium"
                  >
                    GitHub
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* 时间卡片 */}
          <div className="p-5 rounded-xl bg-card border border-border/50 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider mb-4">
              {t('packageDetail.time')}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  {t('packageDetail.createdAt')}
                </span>
                <span className="text-xs font-mono">
                  {new Date(pkg.created_at).toLocaleDateString(locale)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  {t('packageDetail.updatedAt')}
                </span>
                <span className="text-xs font-mono">
                  {new Date(pkg.updated_at).toLocaleDateString(locale)}
                </span>
              </div>
            </div>
          </div>

          {/* 下载统计 */}
          <div className="animate-fade-in-up" style={{ animationDelay: '250ms' }}>
            <PackageStats scope={pkg.scope} name={pkg.name} />
          </div>

          {/* 快速评分概览 */}
          {reviewsData?.stats && reviewsData.stats.total_reviews > 0 && (
            <div className="p-5 rounded-xl bg-card border border-border/50 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
              <h3 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider mb-4">
                {t('packageDetail.reviews.rating')}
              </h3>
              <div className="flex items-center gap-3">
                <div className="text-3xl font-bold text-primary">
                  {reviewsData.stats.average_rating.toFixed(1)}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= Math.round(reviewsData.stats.average_rating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {reviewsData.stats.total_reviews} {t('packageDetail.reviews.reviews')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
