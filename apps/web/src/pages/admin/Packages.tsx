/**
 * 管理后台 - 包管理
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, AdminPackageResponse } from '../../lib/api';
import { ArrowLeft, Trash2, Pause, Play } from 'lucide-react';



export default function AdminPackages() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [packages, setPackages] = useState<AdminPackageResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, total_pages: 0 });

  const [typeFilter, setTypeFilter] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US';

  const loadPackages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.admin.listPackages({
        page: pagination.page,
        per_page: pagination.per_page,
        type: typeFilter || undefined,
        include_deleted: includeDeleted,
      });
      setPackages(data.data);
      setPagination(data.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common:error.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.per_page, typeFilter, includeDeleted, t]);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  const handleStatusChange = async (packageId: string, newStatus: string) => {
    const reason = newStatus === 'suspended' ? prompt(t('packages.confirm.suspendPrompt')) : undefined;

    try {
      await api.admin.updatePackageStatus(packageId, newStatus, reason || undefined);
      loadPackages();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t('common:error.operationFailed'));
    }
  };

  const handleDelete = async (packageId: string) => {
    if (!confirm(t('packages.confirm.delete'))) return;

    try {
      await api.admin.deletePackage(packageId);
      loadPackages();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t('common:error.operationFailed'));
    }
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      mcp: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      skill: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs border ${styles[type] || ''}`}>
        {type.toUpperCase()}
      </span>
    );
  };

  const getStatusBadge = (pkg: AdminPackageResponse) => {
    if (pkg.deleted_at) {
      return <span className="px-2 py-1 rounded-full text-xs border bg-gray-500/10 text-gray-500 border-gray-500/20">{t('packages.status.deleted')}</span>;
    }
    if (pkg.admin_status === 'suspended') {
      return <span className="px-2 py-1 rounded-full text-xs border bg-yellow-500/10 text-yellow-500 border-yellow-500/20">{t('packages.status.suspended')}</span>;
    }
    return <span className="px-2 py-1 rounded-full text-xs border bg-green-500/10 text-green-500 border-green-500/20">{t('packages.status.active')}</span>;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 头部 */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/admin" aria-label={t('common:actions.back')} className="p-2 rounded-lg hover:bg-secondary transition-colors focus-visible:ring-2 focus-visible:ring-primary/20">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{t('packages.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('packages.totalPackages', { count: pagination.total })}</p>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label={t('packages.table.type')}
          className="px-4 py-2 rounded-lg bg-background border border-input"
        >
          <option value="">{t('packages.allTypes')}</option>
          <option value="mcp">MCP</option>
          <option value="skill">Skill</option>
        </select>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => setIncludeDeleted(e.target.checked)}
            className="rounded border-input"
          />
          <span className="text-sm">{t('packages.showDeleted')}</span>
        </label>
      </div>

      {/* 错误提示 */}
      {error && (
        <div role="alert" aria-live="polite" className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
          {error}
        </div>
      )}

      {/* 包列表 */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-secondary/50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium">{t('packages.table.name')}</th>
              <th className="px-6 py-3 text-left text-sm font-medium">{t('packages.table.type')}</th>
              <th className="px-6 py-3 text-left text-sm font-medium">{t('packages.table.status')}</th>
              <th className="px-6 py-3 text-left text-sm font-medium">{t('packages.table.version')}</th>
              <th className="px-6 py-3 text-left text-sm font-medium">{t('packages.table.downloads')}</th>
              <th className="px-6 py-3 text-left text-sm font-medium">{t('packages.table.createdAt')}</th>
              <th className="px-6 py-3 text-right text-sm font-medium">{t('packages.table.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                  {t('packages.loading')}
                </td>
              </tr>
            ) : packages.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                  {t('common:empty.noData')}
                </td>
              </tr>
            ) : (
              packages.map((pkg) => (
                <tr key={pkg.id} className="hover:bg-secondary/30">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium">{pkg.full_name}</p>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {pkg.description || '-'}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">{getTypeBadge(pkg.type)}</td>
                  <td className="px-6 py-4">{getStatusBadge(pkg)}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {pkg.latest_version || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {pkg.downloads_count.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {pkg.created_at ? new Date(pkg.created_at).toLocaleDateString(locale) : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {!pkg.deleted_at && (
                        <>
                          {pkg.admin_status === 'active' ? (
                            <button
                              onClick={() => handleStatusChange(pkg.id, 'suspended')}
                              aria-label={t('packages.actions.suspend')}
                              className="p-2 rounded-lg hover:bg-yellow-500/10 text-yellow-500 focus-visible:ring-2 focus-visible:ring-primary/20"
                              title={t('packages.actions.suspend')}
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStatusChange(pkg.id, 'active')}
                              aria-label={t('packages.actions.restore')}
                              className="p-2 rounded-lg hover:bg-green-500/10 text-green-500 focus-visible:ring-2 focus-visible:ring-primary/20"
                              title={t('packages.actions.restore')}
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(pkg.id)}
                            aria-label={t('packages.actions.permanentDelete')}
                            className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 focus-visible:ring-2 focus-visible:ring-primary/20"
                            title={t('packages.actions.permanentDelete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-muted-foreground">
            {t('common:pagination.pageInfo', { page: pagination.page, total: pagination.total_pages })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page <= 1}
              className="px-4 py-2 rounded-lg border border-input hover:bg-secondary disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              {t('common:pagination.prev')}
            </button>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page >= pagination.total_pages}
              className="px-4 py-2 rounded-lg border border-input hover:bg-secondary disabled:opacity-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              {t('common:pagination.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
