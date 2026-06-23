/**
 * Workspace 状态管理 - Zustand Store
 *
 * 管理当前 workspace 上下文（个人或团队）
 * workspace scope 格式：@username（个人）或 @team-slug（团队）
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Workspace {
  scope: string;       // "@username" 或 "@team-slug"
  type: 'user' | 'team';
  name: string;        // 显示名称
  slug: string;        // 去掉 @ 的 slug
  avatar?: string;    // 团队头像或用户头像
}

interface WorkspaceState {
  /** 当前激活的 workspace */
  current: Workspace | null;

  /** 已加载的 workspace 列表 */
  workspaces: Workspace[];

  /** 加载状态 */
  isLoading: boolean;

  // Actions
  setCurrent: (workspace: Workspace) => void;
  addWorkspace: (workspace: Workspace) => void;
  removeWorkspace: (scope: string) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setLoading: (loading: boolean) => void;

  /** 获取当前 scope（带 @），未设置时返回 null */
  getScope: () => string | null;

  /** 是否为团队 workspace */
  isTeamWorkspace: () => boolean;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      current: null,
      workspaces: [],
      isLoading: false,

      setCurrent: (workspace) => set({ current: workspace }),

      addWorkspace: (workspace) =>
        set((state) => ({
          workspaces: state.workspaces.some((w) => w.scope === workspace.scope)
            ? state.workspaces
            : [...state.workspaces, workspace],
        })),

      removeWorkspace: (scope) =>
        set((state) => ({
          workspaces: state.workspaces.filter((w) => w.scope !== scope),
          current: state.current?.scope === scope ? null : state.current,
        })),

      setWorkspaces: (workspaces) => set({ workspaces }),

      setLoading: (loading) => set({ isLoading: loading }),

      getScope: () => get().current?.scope ?? null,

      isTeamWorkspace: () => get().current?.type === 'team',
    }),
    {
      name: 'akit-workspace',
    }
  )
);
