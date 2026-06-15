/**
 * Header 组 - 终端风格导航栏
 */

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Terminal, LogOut, User, Boxes, Shield, Languages, Plus, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const Header = React.memo(function Header() {
  const { t, i18n } = useTranslation('common');
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  const handleLogout = useCallback(() => {
    clearAuth();
    navigate('/');
  }, [clearAuth, navigate]);

  const changeLanguage = useCallback((lng: string) => {
    i18n.changeLanguage(lng);
    setLangOpen(false);
  }, [i18n]);

  // 点击外部关闭语言菜单
  useEffect(() => {
    if (!langOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [langOpen]);

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
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/50 transition-colors focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            <Terminal className="w-3.5 h-3.5" />
            {t('nav.packages')}
          </Link>

          {isAuthenticated ? (
            <>
              <Link
                to="/publish"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors focus-visible:ring-2 focus-visible:ring-green-500/20"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('nav.publish')}
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-orange-500 hover:text-orange-400 rounded-md hover:bg-orange-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-primary/20"
                >
                  <Shield className="w-3.5 h-3.5" />
                  {t('nav.admin')}
                </Link>
              )}
              <Link
                to="/teams"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/50 transition-colors focus-visible:ring-2 focus-visible:ring-primary/20"
              >
                <Users className="w-3.5 h-3.5" />
                {t('nav.teams')}
              </Link>
              <Link
                to="/profile"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/50 transition-colors focus-visible:ring-2 focus-visible:ring-primary/20"
              >
                <User className="w-3.5 h-3.5" />
                {t('nav.myPackages')}
              </Link>
              <div className="w-px h-5 bg-border mx-1" />
              <div className="flex items-center gap-2 min-w-0">
                {user?.avatar_url && (
                  <img
                    src={user.avatar_url}
                    alt={user.username}
                    width={24}
                    height={24}
                    loading="lazy"
                    className="w-6 h-6 rounded-full ring-2 ring-border"
                  />
                )}
                <span className="text-sm text-muted-foreground truncate">
                  {user?.display_name || user?.username}
                </span>
                <button
                  onClick={handleLogout}
                  aria-label={t('nav.logout')}
                  className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10 transition-colors focus-visible:ring-2 focus-visible:ring-primary/20"
                  title={t('nav.logout')}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors glow-cyan focus-visible:ring-2 focus-visible:ring-primary/20"
            >
              {t('nav.login')}
            </Link>
          )}

          {/* 语言切换器 */}
          <div className="relative ml-1" ref={langRef}>
            <button
              onClick={() => setLangOpen(!langOpen)}
              aria-label={t('language.label')}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary/50 transition-colors focus-visible:ring-2 focus-visible:ring-primary/20"
              title={t('language.label')}
            >
              <Languages className="w-3.5 h-3.5" />
            </button>
            {langOpen && (
              <div className="absolute right-0 top-full mt-1 py-1 w-28 bg-popover border border-border rounded-lg shadow-lg animate-fade-in-up z-50">
                <button
                  onClick={() => changeLanguage('zh')}
                  className={`w-full px-3 py-1.5 text-left text-sm hover:bg-secondary/50 transition-colors ${
                    i18n.language === 'zh' ? 'text-primary font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {t('language.zh')}
                </button>
                <button
                  onClick={() => changeLanguage('en')}
                  className={`w-full px-3 py-1.5 text-left text-sm hover:bg-secondary/50 transition-colors ${
                    i18n.language === 'en' ? 'text-primary font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {t('language.en')}
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
});
