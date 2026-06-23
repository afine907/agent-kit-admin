/**
 * WorkspaceSwitcher - 工作空间切换组件
 *
 * 侧边栏顶部显示当前 workspace，支持切换到个人或团队 workspace
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useWorkspaceStore, Workspace } from '../../stores/workspaceStore';
import { api } from '../../lib/api';
import { Building2, User, ChevronDown, Check, Plus, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TeamInfo {
  slug: string;
  name: string;
  avatar?: string;
}

export const WorkspaceSwitcher = React.memo(function WorkspaceSwitcher() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const current = useWorkspaceStore((s) => s.current);
  const setCurrent = useWorkspaceStore((s) => s.setCurrent);
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const isLoading = useWorkspaceStore((s) => s.isLoading);
  const setLoading = useWorkspaceStore((s) => s.setLoading);

  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // 加载用户所属团队
  useEffect(() => {
    if (!open || !isAuthenticated) return;
    if (teams.length > 0) return; // 已加载

    const loadTeams = async () => {
      setLoading(true);
      try {
        const teams = await api.listTeams();
        const teamList: TeamInfo[] = (teams || []).map((t: { slug: string; name: string; avatar_url?: string }) => ({
          slug: t.slug,
          name: t.name,
          avatar: t.avatar_url,
        }));
        setTeams(teamList);

        // 初始化 workspace 列表
        const userWorkspace: Workspace = {
          scope: `@${user!.username}`,
          type: 'user',
          name: user!.display_name || user!.username,
          slug: user!.username,
          avatar: user!.avatar_url,
        };

        // 如果没有当前 workspace，设置默认
        if (!current) {
          setCurrent(userWorkspace);
        }

        // 构建所有可用 workspace
        const all: Workspace[] = [userWorkspace];
        for (const team of teamList) {
          all.push({
            scope: `@${team.slug}`,
            type: 'team',
            name: team.name,
            slug: team.slug,
            avatar: team.avatar,
          });
        }
        setWorkspaces(all);
      } catch (err) {
        console.error('Failed to load teams:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTeams();
  }, [open, isAuthenticated, teams.length, user, current, setCurrent, setWorkspaces, setLoading]);

  // 切换到指定 workspace
  const switchTo = useCallback(
    (ws: Workspace) => {
      setCurrent(ws);
      setOpen(false);

      // 导航到该 workspace 的包列表页面（scope 查询过滤）
      // 同时将 scope 参数传递下去
      const params = new URLSearchParams();
      if (ws.type === 'team') {
        params.set('scope', ws.scope);
      }
      const query = params.toString();
      navigate(`/${query ? `?${query}` : ''}`);
    },
    [setCurrent, navigate]
  );

  // 未登录时不渲染
  if (!isAuthenticated || !user) return null;

  // 构建显示的 workspace 列表（从 workspaces 状态或动态计算）
  const personalWs: Workspace = {
    scope: `@${user.username}`,
    type: 'user',
    name: user.display_name || user.username,
    slug: user.username,
    avatar: user.avatar_url,
  };

  const teamWsList: Workspace[] = teams.map((t) => ({
    scope: `@${t.slug}`,
    type: 'team' as const,
    name: t.name,
    slug: t.slug,
    avatar: t.avatar,
  }));

  const displayCurrent = current || personalWs;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 触发按钮 */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors text-left group"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex-shrink-0">
          {displayCurrent.type === 'team' ? (
            <Building2 className="w-4 h-4" />
          ) : (
            <User className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {displayCurrent.type === 'team' ? t('workspace.team') : t('workspace.personal')}
          </div>
          <div className="text-sm font-medium truncate">{displayCurrent.scope}</div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* 下拉列表 */}
      {open && (
        <div
          className="absolute left-0 top-full mt-1 w-64 bg-popover border border-border rounded-xl shadow-xl z-50 py-1 animate-fade-in-up"
          role="listbox"
        >
          {/* 个人工作空间 */}
          <div className="px-2 py-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 mb-1">
              {t('workspace.personal')}
            </div>
            <button
              onClick={() => switchTo(personalWs)}
              className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors ${
                displayCurrent.type === 'user'
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-secondary/50 text-foreground'
              }`}
              role="option"
              aria-selected={displayCurrent.type === 'user'}
            >
              <User className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left text-sm font-medium truncate">
                {personalWs.name}
              </span>
              <span className="text-xs text-muted-foreground">{personalWs.scope}</span>
              {displayCurrent.type === 'user' && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
            </button>
          </div>

          {/* 团队工作空间 */}
          {teamWsList.length > 0 && (
            <div className="px-2 py-1 border-t border-border/50 mt-1 pt-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 mb-1">
                {t('workspace.teams')}
              </div>
              {teamWsList.map((ws) => (
                <button
                  key={ws.scope}
                  onClick={() => switchTo(ws)}
                  className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors ${
                    displayCurrent.type === 'team' && displayCurrent.scope === ws.scope
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-secondary/50 text-foreground'
                  }`}
                  role="option"
                  aria-selected={displayCurrent.type === 'team' && displayCurrent.scope === ws.scope}
                >
                  <Building2 className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left text-sm font-medium truncate">{ws.name}</span>
                  <span className="text-xs text-muted-foreground">{ws.scope}</span>
                  {displayCurrent.type === 'team' && displayCurrent.scope === ws.scope && (
                    <Check className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* 加载状态 */}
          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('workspace.loading')}
            </div>
          )}

          {/* 创建/加入团队 */}
          <div className="border-t border-border/50 mt-1 pt-1 px-2 pb-1">
            <button
              onClick={() => {
                setOpen(false);
                navigate('/teams');
              }}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              {t('workspace.createTeam')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
