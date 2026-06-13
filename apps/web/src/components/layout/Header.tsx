/**
 * Header 组 - 终端风格导航栏
 */

import React, { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Terminal, LogOut, User, Boxes, Shield } from 'lucide-react';

export const Header = React.memo(function Header() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  const handleLogout = useCallback(() => {
    clearAuth();
    navigate('/');
  }, [clearAuth, navigate]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors">
            <Boxes className="w-4 h-4 text-primary" />
          </div>
          <span className="text-base font-bold tracking-tight">
            Agent<span className="text-primary">Kit</span>
          </span>
        </Link>

        {/* 导航 */}
        <nav className="flex items-center gap-1">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/50 transition-colors"
          >
            <Terminal className="w-3.5 h-3.5" />
            包列表
          </Link>

          {isAuthenticated ? (
            <>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-orange-500 hover:text-orange-400 rounded-md hover:bg-orange-500/10 transition-colors"
                >
                  <Shield className="w-3.5 h-3.5" />
                  管理后台
                </Link>
              )}
              <Link
                to="/profile"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/50 transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                我的包
              </Link>
              <div className="w-px h-5 bg-border mx-1" />
              <div className="flex items-center gap-2">
                {user?.avatar_url && (
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    className="w-6 h-6 rounded-full ring-2 ring-border"
                  />
                )}
                <span className="text-sm text-muted-foreground">
                  {user?.display_name || user?.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10 transition-colors"
                  title="退出登录"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors glow-cyan"
            >
              登录
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
});
