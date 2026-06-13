/**
 * 登录/注册页面 - 支持本地登录和 OAuth
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { Boxes, MessageSquare, Bird, Smartphone, ArrowRight, Shield, Mail, Lock, User } from 'lucide-react';

const PROVIDERS = [
  {
    id: 'wechat_work',
    name: '企业微信',
    icon: MessageSquare,
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    border: 'border-green-400/20',
  },
  {
    id: 'feishu',
    name: '飞书',
    icon: Bird,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20',
  },
  {
    id: 'dingtalk',
    name: '钉钉',
    icon: Smartphone,
    color: 'text-sky-400',
    bg: 'bg-sky-400/10',
    border: 'border-sky-400/20',
  },
];

type Mode = 'login' | 'register';

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 表单数据
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await api.login(email, password);
      setAuth(data.token, data.user, data.refresh_token);
      navigate('/');
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await api.register(username, email, password, displayName || undefined);
      setAuth(data.token, data.user, data.refresh_token);
      navigate('/');
    } catch (err: any) {
      setError(err.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = (provider: string) => {
    setLoading(true);
    window.location.href = api.getOAuthUrl(provider);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm animate-fade-in-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4 glow-cyan">
            <Boxes className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Agent Kit</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'login' ? '登录到包注册中心' : '注册新账号'}
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* 本地登录/注册表单 */}
        <form onSubmit={mode === 'login' ? handleLocalLogin : handleRegister} className="space-y-3">
          {mode === 'register' && (
            <>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  spellCheck={false}
                  aria-label="用户名"
                  placeholder="用户名…"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={50}
                  pattern="[a-zA-Z0-9_-]+"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-background border border-input focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary outline-none transition-colors text-sm"
                />
              </div>
              <input
                id="displayName"
                name="displayName"
                type="text"
                autoComplete="name"
                aria-label="显示名称"
                placeholder="显示名称（可选）…"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-background border border-input focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary outline-none transition-colors text-sm"
              />
            </>
          )}
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              aria-label="邮箱"
              placeholder="邮箱…"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-background border border-input focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary outline-none transition-colors text-sm"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              aria-label="密码"
              placeholder="密码…"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-background border border-input focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary outline-none transition-colors text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? '处理中…' : mode === 'login' ? '登录' : '注册'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* 切换登录/注册 */}
        <div className="mt-4 text-center text-sm">
          {mode === 'login' ? (
            <span className="text-muted-foreground">
              没有账号？{' '}
              <button onClick={() => { setMode('register'); setError(null); }} className="text-primary hover:underline">
                注册
              </button>
            </span>
          ) : (
            <span className="text-muted-foreground">
              已有账号？{' '}
              <button onClick={() => { setMode('login'); setError(null); }} className="text-primary hover:underline">
                登录
              </button>
            </span>
          )}
        </div>

        {/* 分隔线 */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">或</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* OAuth 登录 */}
        <div className="space-y-2.5">
          {PROVIDERS.map((provider, i) => {
            const Icon = provider.icon;
            return (
              <button
                key={provider.id}
                onClick={() => handleOAuthLogin(provider.id)}
                disabled={loading}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors duration-200 group bg-card border-border/50 hover:border-border hover:bg-secondary/30 disabled:opacity-50`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${provider.bg} ${provider.border}`}>
                  <Icon className={`w-4.5 h-4.5 ${provider.color}`} />
                </div>
                <span className="flex-1 text-left text-sm font-medium">
                  使用 {provider.name} 登录
                </span>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </button>
            );
          })}
        </div>

        {/* 底部提示 */}
        <div className="flex items-center justify-center gap-1.5 mt-6 text-xs text-muted-foreground/60">
          <Shield className="w-3 h-3" />
          登录即表示您同意我们的服务条款和隐私政策
        </div>
      </div>
    </div>
  );
}
