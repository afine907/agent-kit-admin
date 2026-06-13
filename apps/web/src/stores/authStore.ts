/**
 * 认证状态管理 - Zustand Store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  email?: string;
  role?: string;
  status?: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;

  // Actions
  setAuth: (token: string, user: User, refreshToken?: string) => void;
  clearAuth: () => void;
  getToken: () => string | null;
  getRefreshToken: () => string | null;
  updateToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      isAdmin: false,

      setAuth: (token: string, user: User, refreshToken?: string) => {
        const isAdmin = user.role === 'admin' || user.role === 'super_admin';
        set({ token, refreshToken: refreshToken || null, user, isAuthenticated: true, isAdmin });
      },

      clearAuth: () => {
        set({ token: null, refreshToken: null, user: null, isAuthenticated: false, isAdmin: false });
      },

      getToken: () => get().token,
      getRefreshToken: () => get().refreshToken,

      updateToken: (token: string) => {
        set({ token });
      },
    }),
    {
      name: 'akit-auth',
    }
  )
);
