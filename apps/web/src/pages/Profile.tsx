/**
 * Profile 页面 - 个人中心（含编辑和 API Key 管理）
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { usePackages } from '../hooks/usePackages';
import { PackageCard } from '../components/PackageCard';
import { PackageResponse, api } from '../lib/api';
import {
  User, LogOut, Package, Terminal, ArrowRight, Loader2, Box,
  Edit2, Key, Copy, Trash2, Plus, Check, X
} from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
}

export default function Profile() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  // 编辑状态
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.display_name || '');
  const [saving, setSaving] = useState(false);

  // API Key 状态
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  // 获取用户的包
  const { data, isLoading, error } = usePackages({
    scope: user ? `@${user.username}` : undefined,
    per_page: 100,
  });

  // 缓存下载量计算
  const totalDownloads = useMemo(
    () => data?.data.reduce((sum: number, pkg: PackageResponse) => sum + (pkg.downloads_count || 0), 0) ?? 0,
    [data],
  );

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // TODO: 实现更新用户资料 API
      setIsEditing(false);
    } catch (err: any) {
      alert(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const loadApiKeys = async () => {
    setLoadingKeys(true);
    try {
      // TODO: 实现获取 API Key 列表 API
      setApiKeys([]);
    } catch (err: any) {
      console.error('加载 API Key 失败:', err);
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      // TODO: 实现创建 API Key API
      const mockKey = `akit_${Math.random().toString(36).substring(2, 15)}`;
      setCreatedKey(mockKey);
      setNewKeyName('');
      setShowNewKeyForm(false);
      loadApiKeys();
    } catch (err: any) {
      alert(err.message || '创建失败');
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    if (!confirm('确定要删除此 API Key 吗？')) return;
    try {
      // TODO: 实现删除 API Key API
      loadApiKeys();
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center space-y-6 animate-fade-in-up">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <User className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">个人中心</h1>
            <p className="text-muted-foreground mt-2">请先登录以查看个人信息</p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all hover:gap-3"
          >
            登录
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 space-y-8">
      {/* 用户信息卡片 */}
      <div className="rounded-xl border border-border/50 bg-card p-6 animate-fade-in-up">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-5">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.username} className="w-16 h-16 rounded-xl border-2 border-primary/20" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                <User className="w-8 h-8 text-primary" />
              </div>
            )}
            <div className="space-y-1">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="px-3 py-1 rounded-lg bg-background border border-input focus:border-primary outline-none"
                  />
                  <button onClick={handleSaveProfile} disabled={saving} className="p-1.5 rounded-lg bg-primary text-primary-foreground">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setIsEditing(false)} className="p-1.5 rounded-lg bg-secondary">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">{user?.display_name || user?.username}</h1>
                  <button onClick={() => setIsEditing(true)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              )}
              <p className="font-mono text-sm text-muted-foreground">@{user?.username}</p>
              {user?.email && <p className="text-sm text-muted-foreground">{user.email}</p>}
            </div>
          </div>
          <button
            onClick={clearAuth}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 text-sm text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </div>

        {/* 统计信息 */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border/50">
          <div className="text-center">
            <div className="text-2xl font-bold font-mono text-primary">{data?.data.length ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1">发布的包</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold font-mono text-accent">{totalDownloads}</div>
            <div className="text-xs text-muted-foreground mt-1">总下载量</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold font-mono text-emerald-400">活跃</div>
            <div className="text-xs text-muted-foreground mt-1">账户状态</div>
          </div>
        </div>
      </div>

      {/* API Key 管理 */}
      <div className="rounded-xl border border-border/50 bg-card p-6 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Key className="w-4 h-4 text-orange-500" />
            </div>
            <h2 className="text-lg font-bold tracking-tight">API Key</h2>
          </div>
          <button
            onClick={() => { setShowApiKeys(!showApiKeys); if (!showApiKeys) loadApiKeys(); }}
            className="text-sm text-primary hover:underline"
          >
            {showApiKeys ? '收起' : '管理 API Key'}
          </button>
        </div>

        {showApiKeys && (
          <div className="space-y-4">
            {/* 新建 API Key */}
            {createdKey ? (
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm font-medium text-green-500 mb-2">API Key 已创建！请立即复制，之后将无法再次查看。</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 rounded bg-background font-mono text-sm">{createdKey}</code>
                  <button onClick={() => copyToClipboard(createdKey)} className="p-2 rounded-lg bg-primary text-primary-foreground">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <button onClick={() => setCreatedKey(null)} className="mt-2 text-sm text-muted-foreground hover:text-foreground">
                  关闭
                </button>
              </div>
            ) : showNewKeyForm ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Key 名称（如 CI/CD）"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-background border border-input focus:border-primary outline-none text-sm"
                />
                <button onClick={handleCreateApiKey} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">
                  创建
                </button>
                <button onClick={() => setShowNewKeyForm(false)} className="px-4 py-2 rounded-lg bg-secondary text-sm">
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewKeyForm(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-border hover:border-primary text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Plus className="w-4 h-4" />
                创建新 API Key
              </button>
            )}

            {/* API Key 列表 */}
            {loadingKeys ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : apiKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">暂无 API Key</p>
            ) : (
              <div className="space-y-2">
                {apiKeys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                    <div>
                      <p className="text-sm font-medium">{key.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{key.key_prefix}...</p>
                    </div>
                    <button onClick={() => handleDeleteApiKey(key.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 我的包 */}
      <div className="space-y-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-lg font-bold tracking-tight">我的包</h2>
          </div>
          {data && data.data.length > 0 && (
            <span className="font-mono text-xs text-muted-foreground px-2 py-1 rounded bg-secondary/50">
              {data.data.length} 个包
            </span>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        )}

        {!isLoading && error && (
          <div className="text-center py-16 rounded-xl border border-dashed border-destructive/30 space-y-2">
            <p className="text-destructive font-medium">加载失败</p>
            <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          </div>
        )}

        {!isLoading && !error && data && data.data.length === 0 && (
          <div className="text-center py-16 rounded-xl border border-dashed border-border/50 space-y-4">
            <div className="w-12 h-12 mx-auto rounded-xl bg-secondary/50 flex items-center justify-center">
              <Box className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-muted-foreground">暂无发布的包</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                使用 <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-secondary text-primary">akit publish</code> 发布你的第一个包
              </p>
            </div>
          </div>
        )}

        {!isLoading && data && data.data.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.data.map((pkg: PackageResponse, index: number) => (
              <div key={pkg.id} className="animate-fade-in-up" style={{ animationDelay: `${0.15 + index * 0.05}s` }}>
                <PackageCard package={pkg} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 快捷操作 */}
      <div className="rounded-xl border border-border/50 bg-card p-6 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-accent" />
          </div>
          <h3 className="font-bold tracking-tight">快速开始</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-secondary/30 border border-border/30">
            <p className="text-xs text-muted-foreground mb-2">发布新包</p>
            <code className="font-mono text-xs text-primary">akit publish</code>
          </div>
          <div className="p-3 rounded-lg bg-secondary/30 border border-border/30">
            <p className="text-xs text-muted-foreground mb-2">浏览注册表</p>
            <Link to="/" className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1">
              查看所有包 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
