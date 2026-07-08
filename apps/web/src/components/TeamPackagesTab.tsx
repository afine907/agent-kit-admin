/**
 * 团队包管理 Tab 组件
 * 显示团队所有包，含安装状态
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, type TeamPackage } from '../lib/api';
import {
  Package,
  Download,
  Trash2,
  Plus,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Bell,
  Circle,
} from 'lucide-react';

interface TeamPackagesTabProps {
  teamId: string;
  canManage: boolean; // 只有 owner/admin 能发布/删除
}

export default function TeamPackagesTab({ teamId, canManage }: TeamPackagesTabProps) {
  const { t } = useTranslation('pages');
  const navigate = useNavigate();
  const [packages, setPackages] = useState<TeamPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installingVersion, setInstallingVersion] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TeamPackage | null>(null);

  const loadPackages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.listTeamPackages(teamId);
      setPackages(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('teams.packages.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [teamId, t]);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  const handleInstall = async (pkg: TeamPackage) => {
    try {
      setInstallingId(pkg.id);
      setInstallingVersion(pkg.latest_version ?? null);
      await api.installTeamPackage(teamId, pkg.id, pkg.latest_version);
      // 刷新状态
      await loadPackages();
    } catch (err: unknown) {
      console.error('Install failed:', err);
      alert(`${t('teams.packages.installFailed')}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setInstallingId(null);
      setInstallingVersion(null);
    }
  };

  const handleDelete = async (pkg: TeamPackage) => {
    try {
      setDeletingId(pkg.id);
      await api.deleteTeamPackage(teamId, pkg.id);
      setDeleteConfirm(null);
      await loadPackages();
    } catch (err: unknown) {
      console.error('Delete failed:', err);
      alert(`${t('teams.packages.deleteFailed')}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusIcon = (pkg: TeamPackage) => {
    if (!pkg.my_installed_version) {
      return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
    if (pkg.has_update) {
      return <Bell className="w-4 h-4 text-yellow-500" />;
    }
    return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  };

  const getStatusText = (pkg: TeamPackage) => {
    if (!pkg.my_installed_version) {
      return t('teams.packages.notInstalled');
    }
    if (pkg.has_update) {
      return `${pkg.my_installed_version} → ${pkg.latest_version}`;
    }
    return `${pkg.my_installed_version} ${t('teams.packages.latest')}`;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold">
            {t('teams.packages.title')} ({packages.length})
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadPackages}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {t('common:refresh')}
          </button>
          {canManage && (
            <button
              onClick={() => navigate(`/publish?scope=team:${teamId}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              {t('teams.packages.publish')}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={loadPackages} className="ml-auto underline">
            {t('common:actions.retry')}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && packages.length === 0 && (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">{t('common:loading')}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && packages.length === 0 && !error && (
        <div className="text-center py-12">
          <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">{t('teams.packages.empty')}</p>
          {canManage && (
            <p className="text-sm text-muted-foreground mt-1">
              {t('teams.packages.emptyHint')}
            </p>
          )}
        </div>
      )}

      {/* Package List */}
      {packages.length > 0 && (
        <div className="space-y-3">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors"
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-primary" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium truncate">{pkg.full_name}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                    {pkg.type}
                  </span>
                </div>
                {pkg.description && (
                  <p className="text-sm text-muted-foreground truncate mb-1">
                    {pkg.description}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>v{pkg.latest_version || '-'}</span>
                  <span>{t('teams.packages.downloading', { count: pkg.downloads_count })}</span>
                  <span>{new Date(pkg.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-1.5 text-sm">
                  {getStatusIcon(pkg)}
                  <span className={pkg.has_update ? 'text-yellow-600' : pkg.my_installed_version ? 'text-green-600' : 'text-muted-foreground'}>
                    {getStatusText(pkg)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 ml-2">
                  {/* Install/Update button */}
                  {pkg.my_installed_version ? (
                    pkg.has_update ? (
                      <button
                        onClick={() => handleInstall(pkg)}
                        disabled={installingId === pkg.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 disabled:opacity-50"
                        title={t('teams.packages.updateTo', { version: pkg.latest_version })}
                      >
                        {installingId === pkg.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        {t('teams.packages.update')}
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-green-600 bg-green-50 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t('teams.packages.installed')}
                      </span>
                    )
                  ) : (
                    <button
                      onClick={() => handleInstall(pkg)}
                      disabled={installingId === pkg.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
                    >
                      {installingId === pkg.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      {installingId === pkg.id && installingVersion ? `${t('teams.packages.installing')} ${installingVersion}` : t('teams.packages.install')}
                    </button>
                  )}

                  {/* Delete (admin only) */}
                  {canManage && (
                    <button
                      onClick={() => setDeleteConfirm(pkg)}
                      disabled={deletingId === pkg.id}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg disabled:opacity-50"
                      title={t('teams.packages.deletePackage')}
                    >
                      {deletingId === pkg.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4 shadow-lg">
            <h3 className="text-lg font-semibold mb-2">{t('teams.packages.deleteConfirmTitle')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('teams.packages.deleteConfirmMessage', { name: deleteConfirm.full_name })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deletingId === deleteConfirm.id}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted disabled:opacity-50"
              >
                {t('common:actions.cancel')}
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deletingId === deleteConfirm.id}
                className="px-4 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 flex items-center gap-2"
              >
                {deletingId === deleteConfirm.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {t('common:actions.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
