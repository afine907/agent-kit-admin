/**
 * Profile 页面 - 个人中心
 */

import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { usePackages } from '../hooks/usePackages';
import { PackageCard } from '../components/PackageCard';
import { PackageResponse } from '../lib/api';
import {
  User,
  LogOut,
  Package,
  Terminal,
  ArrowRight,
  Loader2,
  Box,
} from 'lucide-react';

export default function Profile() {
  const { user, isAuthenticated, clearAuth } = useAuthStore();

  // 获取用户的包
  const { data, isLoading } = usePackages({
    scope: user ? `@${user.username}` : undefined,
    per_page: 100,
  });

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
              <img
                src={user.avatar_url}
                alt={user.username}
                className="w-16 h-16 rounded-xl border-2 border-primary/20"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                <User className="w-8 h-8 text-primary" />
              </div>
            )}
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight">
                {user?.display_name || user?.username}
              </h1>
              <p className="font-mono text-sm text-muted-foreground">
                @{user?.username}
              </p>
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
            <div className="text-2xl font-bold font-mono text-primary">
              {data?.data.length ?? 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">发布的包</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold font-mono text-accent">
              {data?.data.reduce((sum: number, pkg: PackageResponse) => sum + (pkg.downloads_count || 0), 0) ?? 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">总下载量</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold font-mono text-emerald-400">
              活跃
            </div>
            <div className="text-xs text-muted-foreground mt-1">账户状态</div>
          </div>
        </div>
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

        {!isLoading && data && data.data.length === 0 && (
          <div className="text-center py-16 rounded-xl border border-dashed border-border/50 space-y-4">
            <div className="w-12 h-12 mx-auto rounded-xl bg-secondary/50 flex items-center justify-center">
              <Box className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-muted-foreground">暂无发布的包</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                使用{' '}
                <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-secondary text-primary">
                  akit publish
                </code>{' '}
                发布你的第一个包
              </p>
            </div>
          </div>
        )}

        {!isLoading && data && data.data.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.data.map((pkg: PackageResponse, index: number) => (
              <div
                key={pkg.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${0.15 + index * 0.05}s` }}
              >
                <PackageCard package={pkg} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 快捷操作 */}
      <div
        className="rounded-xl border border-border/50 bg-card p-6 animate-fade-in-up"
        style={{ animationDelay: '0.2s' }}
      >
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
            <Link
              to="/"
              className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              查看所有包 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
