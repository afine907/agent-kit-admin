/**
 * Profile 页面 - 个人中心
 */

import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { usePackages } from '../hooks/usePackages';
import { PackageCard } from '../components/PackageCard';
import { PackageResponse } from '../lib/api';

export default function Profile() {
  const { user, isAuthenticated } = useAuthStore();

  // 获取用户的包
  const { data, isLoading } = usePackages({
    scope: user ? `@${user.username}` : undefined,
    per_page: 100,
  });

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">个人中心</h1>
        <p className="text-muted-foreground mb-4">请先登录</p>
        <Link
          to="/login"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          登录
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {/* 用户信息 */}
      <div className="flex items-center gap-4 mb-8">
        {user?.avatar_url && (
          <img
            src={user.avatar_url}
            alt={user.username}
            className="w-16 h-16 rounded-full"
          />
        )}
        <div>
          <h1 className="text-2xl font-bold">{user?.display_name || user?.username}</h1>
          <p className="text-muted-foreground">@{user?.username}</p>
        </div>
      </div>

      {/* 我的包 */}
      <div>
        <h2 className="text-xl font-semibold mb-4">我的包</h2>

        {isLoading && (
          <p className="text-muted-foreground">加载中...</p>
        )}

        {data && data.data.length === 0 && (
          <div className="text-center py-12 border rounded-lg">
            <p className="text-muted-foreground mb-4">暂无发布的包</p>
            <p className="text-sm text-muted-foreground">
              使用 <code className="px-2 py-0.5 bg-secondary rounded">akit publish</code> 发布你的第一个包
            </p>
          </div>
        )}

        {data && data.data.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.data.map((pkg: PackageResponse) => (
              <PackageCard key={pkg.id} package={pkg} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
