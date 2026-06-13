/**
 * 管理后台 - 包管理
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { ArrowLeft, Search, Package, Trash2, RotateCcw, Pause, Play } from 'lucide-react';

interface AdminPackage {
  id: string;
  name: string;
  scope: string;
  full_name: string;
  type: string;
  description?: string;
  visibility: string;
  admin_status: string;
  downloads_count: number;
  latest_version?: string;
  deleted_at?: string;
  created_at?: string;
}

export default function AdminPackages() {
  const [packages, setPackages] = useState<AdminPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, per_page: 20, total: 0, total_pages: 0 });

  // 筛选条件
  const [typeFilter, setTypeFilter] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  useEffect(() => {
    loadPackages();
  }, [pagination.page, typeFilter, includeDeleted]);

  const loadPackages = async () => {
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
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (packageId: string, newStatus: string) => {
    const reason = newStatus === 'suspended' ? prompt('请输入下架原因（可选）') : undefined;

    try {
      await api.admin.updatePackageStatus(packageId, newStatus, reason || undefined);
      loadPackages();
    } catch (err: any) {
      alert(err.message || '操作失败');
    }
  };

  const handleDelete = async (packageId: string) => {
    if (!confirm('确定要永久删除该包吗？此操作不可恢复。')) return;

    try {
      await api.admin.deletePackage(packageId);
      loadPackages();
    } catch (err: any) {
      alert(err.message || '操作失败');
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

  const getStatusBadge = (pkg: AdminPackage) => {
    if (pkg.deleted_at) {
      return <span className="px-2 py-1 rounded-full text-xs border bg-gray-500/10 text-gray-500 border-gray-500/20">已删除</span>;
    }
    if (pkg.admin_status === 'suspended') {
      return <span className="px-2 py-1 rounded-full text-xs border bg-yellow-500/10 text-yellow-500 border-yellow-500/20">已下架</span>;
    }
    return <span className="px-2 py-1 rounded-full text-xs border bg-green-500/10 text-green-500 border-green-500/20">正常</span>;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 头部 */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/admin" className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold">包管理</h1>
          <p className="text-muted-foreground mt-1">共 {pagination.total} 个包</p>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 rounded-lg bg-background border border-input"
        >
          <option value="">所有类型</option>
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
          <span className="text-sm">显示已删除</span>
        </label>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
          {error}
        </div>
      )}

      {/* 包列表 */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-secondary/50">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium">包名</th>
              <th className="px-6 py-3 text-left text-sm font-medium">类型</th>
              <th className="px-6 py-3 text-left text-sm font-medium">状态</th>
              <th className="px-6 py-3 text-left text-sm font-medium">版本</th>
              <th className="px-6 py-3 text-left text-sm font-medium">下载量</th>
              <th className="px-6 py-3 text-left text-sm font-medium">创建时间</th>
              <th className="px-6 py-3 text-right text-sm font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                  加载中...
                </td>
              </tr>
            ) : packages.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                  暂无数据
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
                    {pkg.created_at ? new Date(pkg.created_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {!pkg.deleted_at && (
                        <>
                          {pkg.admin_status === 'active' ? (
                            <button
                              onClick={() => handleStatusChange(pkg.id, 'suspended')}
                              className="p-2 rounded-lg hover:bg-yellow-500/10 text-yellow-500"
                              title="下架"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStatusChange(pkg.id, 'active')}
                              className="p-2 rounded-lg hover:bg-green-500/10 text-green-500"
                              title="恢复"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(pkg.id)}
                            className="p-2 rounded-lg hover:bg-red-500/10 text-red-500"
                            title="永久删除"
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
