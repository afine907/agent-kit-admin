/**
 * Header 组件 - 导航栏
 */

import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export function Header() {
  const { user, isAuthenticated, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuth();
    navigate('/');
  };

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl font-bold">📦 Agent Kit</span>
        </Link>

        {/* 导航 */}
        <nav className="flex items-center gap-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            包列表
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <Link to="/profile" className="text-sm text-muted-foreground hover:text-foreground">
                我的包
              </Link>
              <div className="flex items-center gap-2">
                {user?.avatar_url && (
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-sm">{user?.display_name || user?.username}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  退出
                </button>
              </div>
            </div>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              登录
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
