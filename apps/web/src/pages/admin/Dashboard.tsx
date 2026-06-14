/**
 * 管理后台 - 仪表盘
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, AdminStatsResponse, DownloadTrend } from '../../lib/api';
import { Users, Package, Activity, ArrowRight, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
  const { t, i18n } = useTranslation('admin');
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [downloadTrends, setDownloadTrends] = useState<DownloadTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US';

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [statsData, trendsData] = await Promise.all([
          api.admin.getStats(),
          api.admin.getDownloadTrends(30),
        ]);
        setStats(statsData);
        setDownloadTrends(trendsData.trends);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t('common:error.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [t]);

  const totalDownloads = downloadTrends.reduce((sum, item) => sum + item.downloads, 0);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground mt-2">{t('dashboard.subtitle')}</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="p-6 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.totalUsers')}</p>
              <p className="text-3xl font-bold">{stats?.total_users || 0}</p>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-green-500/10">
              <Activity className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.activeUsers')}</p>
              <p className="text-3xl font-bold">{stats?.active_users || 0}</p>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10">
              <Package className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.totalPackages')}</p>
              <p className="text-3xl font-bold">{stats?.total_packages || 0}</p>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-orange-500/10">
              <Download className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('dashboard.recentDownloads')}</p>
              <p className="text-3xl font-bold">{totalDownloads}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 下载趋势图 */}
      <div className="mb-8 p-6 rounded-xl bg-card border border-border">
        <h2 className="text-lg font-semibold mb-4">{t('dashboard.downloadTrend')}</h2>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={downloadTrends}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                labelFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString(locale, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  });
                }}
                formatter={(value) => [value, t('dashboard.downloads')]}
              />
              <Line
                type="monotone"
                dataKey="downloads"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 快捷入口 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to="/admin/users"
          className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors group focus-visible:ring-2 focus-visible:ring-primary/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{t('dashboard.userManagement')}</h3>
              <p className="text-sm text-muted-foreground mt-1">{t('dashboard.userManagementDesc')}</p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </Link>

        <Link
          to="/admin/packages"
          className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors group focus-visible:ring-2 focus-visible:ring-primary/20"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{t('dashboard.packageManagement')}</h3>
              <p className="text-sm text-muted-foreground mt-1">{t('dashboard.packageManagementDesc')}</p>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </Link>
      </div>
    </div>
  );
}
