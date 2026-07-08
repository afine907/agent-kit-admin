/**
 * OAuth 回调页面 - 从 URL 参数中提取 token 并存储
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 尝试从 URL search params 获取 token
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refresh_token');
    const userStr = searchParams.get('user');
    const returnTo = searchParams.get('returnTo') || '/';

    if (!token) {
      setError('未收到认证令牌，请重试');
      return;
    }

    try {
      // 解析用户信息（如果有）
      let user = null;
      if (userStr) {
        user = JSON.parse(userStr);
      } else {
        // 如果没有 user 参数，用 token 解析基本信息
        // JWT payload 在第二段
        const payload = JSON.parse(atob(token.split('.')[1]));
        user = {
          id: payload.sub || payload.user_id || '',
          username: payload.username || payload.sub || '',
          display_name: payload.display_name || payload.username || '',
        };
      }

      setAuth(token, user, refreshToken || undefined);
      navigate(returnTo, { replace: true });
    } catch {
      setError('认证信息解析失败，请重试');
    }
  }, [searchParams, setAuth, navigate]);

  if (error) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm max-w-md">
            {error}
          </div>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="text-sm text-primary hover:underline"
          >
            返回登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>正在完成登录...</span>
      </div>
    </div>
  );
}
