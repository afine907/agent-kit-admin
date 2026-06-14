/**
 * 管理后台 - 用户管理
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, AdminUserResponse } from '../../lib/api';
import { ArrowLeft, Search, Shield, UserCheck, UserX, Ban } from 'lucide-react';

export default function AdminUsers() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const [users, setUsers] = useState<AdminUserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, total_pages: 0 });

  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');

  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US';

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.admin.listUsers({
        page: pagination.page,
        per_page: pagination.per_page,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        keyword: keyword || undefined,
      });
      setUsers(data.data);
      setPagination(data.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common:error.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.per_page, roleFilter, statusFilter, keyword, t]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadUsers();
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    const msg = newStatus === 'suspended' ? t('users.confirm.suspend') : t('users.confirm.activate');
    if (!confirm(msg)) return;

    try {
      await api.admin.updateUserStatus(userId, newStatus);
      loadUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t('common:error.operationFailed'));
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm(t('users.confirm.changeRole', { role: newRole }))) return;

    try {
      await api.admin.updateUserRole(userId, newRole);
      loadUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t('common:error.operationFailed'));
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm(t('users.confirm.delete'))) return;

    try {
      await api.admin.deleteUser(userId);
      loadUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t('common:error.operationFailed'));
    }
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      super_admin: 'bg-red-500/10 text-red-500 border-red-500/20',
      admin: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      member: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs border ${styles[role] || styles.member}`}>
        {t(`common:roles.${role}`, role)}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-500/10 text-green-500 border-green-500/20',
      suspended: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      banned: 'bg-red-500/10 text-red-500 border-red-500/20',
      deleted: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs border ${styles[status] || styles.active}`}>
        {t(`common:status.${status}`, status)}
      </span>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 头部 */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/admin" aria-label={t('common:actions.back')} className="p-2 rounded-lg hover:bg-secondary transition-colors focus-visible:ring-2 focus-visible:ring-primary/20">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{t('users.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('users.totalUsers', { count: pagination.total })}</p>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            name="keyword"
            aria-label={t('users.searchPlaceholder')}
            autoComplete="off"
            placeholder={t('users.searchPlaceholder')}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-input focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label={t('users.table.role')}
          className="px-4 py-2 rounded-lg bg-background border border-input"
        >
          <option value="">{t('users.allRoles')}</option>
          <option value="super_admin">{t('common:roles.super_admin')}</option>
          <option value="admin">{t('common:roles.admin')}</option>
          <option value="member">{t('common:roles.member')}</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label={t('users.table.status')}
          className="px-4 py-2 rounded-lg bg-background border border-input"
        >
          <option value="">{t('users.allStatuses')}</option>
          <option value="active">{t('common:status.active')}</option>
          <option value="suspended">{t('common:status.suspended')}</option>
          <option value="banned">{t('common:status.banned')}</option>
        </select>
      </div>

      {/* 错误提示 */}
      {error && (
        <div role="alert" aria-live="polite" className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
          {error}
        </div>
      )}

      {/* 用户列表 */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-secondary/50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium">{t('users.table.user')}</th>
              <th className="px-6 py-3 text-left text-sm font-medium">{t('users.table.role')}</th>
              <th className="px-6 py-3 text-left text-sm font-medium">{t('users.table.status')}</th>
              <th className="px-6 py-3 text-left text-sm font-medium">{t('users.table.loginMethod')}</th>
              <th className="px-6 py-3 text-left text-sm font-medium">{t('users.table.registeredAt')}</th>
              <th className="px-6 py-3 text-right text-sm font-medium">{t('users.table.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  {t('users.loading')}
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  {t('common:empty.noData')}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-secondary/30">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium">{user.display_name || user.username}</p>
                      <p className="text-sm text-muted-foreground">{user.email || '-'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                  <td className="px-6 py-4">{getStatusBadge(user.status)}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {user.oauth_provider === 'local' ? t('users.local') : user.oauth_provider}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString(locale) : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {user.status === 'active' ? (
                        <button
                          onClick={() => handleStatusChange(user.id, 'suspended')}
                          aria-label={t('users.actions.suspend')}
                          className="p-2 rounded-lg hover:bg-yellow-500/10 text-yellow-500 focus-visible:ring-2 focus-visible:ring-primary/20"
                          title={t('users.actions.suspend')}
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStatusChange(user.id, 'active')}
                          aria-label={t('users.actions.activate')}
                          className="p-2 rounded-lg hover:bg-green-500/10 text-green-500 focus-visible:ring-2 focus-visible:ring-primary/20"
                          title={t('users.actions.activate')}
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                      {user.role === 'member' && (
                        <button
                          onClick={() => handleRoleChange(user.id, 'admin')}
                          aria-label={t('users.actions.setAdmin')}
                          className="p-2 rounded-lg hover:bg-orange-500/10 text-orange-500 focus-visible:ring-2 focus-visible:ring-primary/20"
                          title={t('users.actions.setAdmin')}
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                      )}
                      {user.role === 'admin' && (
                        <button
                          onClick={() => handleRoleChange(user.id, 'member')}
                          aria-label={t('users.actions.removeAdmin')}
                          className="p-2 rounded-lg hover:bg-blue-500/10 text-blue-500 focus-visible:ring-2 focus-visible:ring-primary/20"
                          title={t('users.actions.removeAdmin')}
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(user.id)}
                        aria-label={t('users.actions.delete')}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 focus-visible:ring-2 focus-visible:ring-primary/20"
                        title={t('users.actions.delete')}
                      >
                        <Ban className="w-4 h-4" />
                      </button>
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
