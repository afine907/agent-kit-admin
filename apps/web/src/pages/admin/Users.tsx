/**
 * 管理后台 - 用户管理
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, AdminUserResponse } from '../../lib/api';
import { ArrowLeft, Search, Shield, UserCheck, UserX, Ban } from 'lucide-react';

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, total_pages: 0 });

  // 筛选条件
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    loadUsers();
  }, [pagination.page, roleFilter, statusFilter]);

  const loadUsers = async () => {
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
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadUsers();
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    if (!confirm(`确定要${newStatus === 'suspended' ? '停用' : '启用'}该用户吗？`)) return;

    try {
      await api.admin.updateUserStatus(userId, newStatus);
      loadUsers();
    } catch (err: any) {
      alert(err.message || '操作失败');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm(`确定要将该用户角色修改为 ${newRole} 吗？`)) return;

    try {
      await api.admin.updateUserRole(userId, newRole);
      loadUsers();
    } catch (err: any) {
      alert(err.message || '操作失败');
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('确定要删除该用户吗？此操作不可恢复。')) return;

    try {
      await api.admin.deleteUser(userId);
      loadUsers();
    } catch (err: any) {
      alert(err.message || '操作失败');
    }
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      super_admin: 'bg-red-500/10 text-red-500 border-red-500/20',
      admin: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      member: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    };
    const labels: Record<string, string> = {
      super_admin: '超级管理员',
      admin: '管理员',
      member: '普通用户',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs border ${styles[role] || styles.member}`}>
        {labels[role] || role}
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
    const labels: Record<string, string> = {
      active: '正常',
      suspended: '已停用',
      banned: '已封禁',
      deleted: '已删除',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs border ${styles[status] || styles.active}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 头部 */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/admin" className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold">用户管理</h1>
          <p className="text-muted-foreground mt-1">共 {pagination.total} 个用户</p>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索用户名/邮箱..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 rounded-lg bg-background border border-input"
        >
          <option value="">所有角色</option>
          <option value="super_admin">超级管理员</option>
          <option value="admin">管理员</option>
          <option value="member">普通用户</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 rounded-lg bg-background border border-input"
        >
          <option value="">所有状态</option>
          <option value="active">正常</option>
          <option value="suspended">已停用</option>
          <option value="banned">已封禁</option>
        </select>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
          {error}
        </div>
      )}

      {/* 用户列表 */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-secondary/50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium">用户</th>
              <th className="px-6 py-3 text-left text-sm font-medium">角色</th>
              <th className="px-6 py-3 text-left text-sm font-medium">状态</th>
              <th className="px-6 py-3 text-left text-sm font-medium">登录方式</th>
              <th className="px-6 py-3 text-left text-sm font-medium">注册时间</th>
              <th className="px-6 py-3 text-right text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  加载中...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  暂无数据
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
                    {user.oauth_provider === 'local' ? '本地' : user.oauth_provider}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {user.status === 'active' ? (
                        <button
                          onClick={() => handleStatusChange(user.id, 'suspended')}
                          className="p-2 rounded-lg hover:bg-yellow-500/10 text-yellow-500"
                          title="停用"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStatusChange(user.id, 'active')}
                          className="p-2 rounded-lg hover:bg-green-500/10 text-green-500"
                          title="启用"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                      {user.role === 'member' && (
                        <button
                          onClick={() => handleRoleChange(user.id, 'admin')}
                          className="p-2 rounded-lg hover:bg-orange-500/10 text-orange-500"
                          title="设为管理员"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                      )}
                      {user.role === 'admin' && (
                        <button
                          onClick={() => handleRoleChange(user.id, 'member')}
                          className="p-2 rounded-lg hover:bg-blue-500/10 text-blue-500"
                          title="取消管理员"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-red-500"
                        title="删除"
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
            第 {pagination.page} / {pagination.total_pages} 页
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page <= 1}
              className="px-4 py-2 rounded-lg border border-input hover:bg-secondary disabled:opacity-50"
            >
              上一页
            </button>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={pagination.page >= pagination.total_pages}
              className="px-4 py-2 rounded-lg border border-input hover:bg-secondary disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
