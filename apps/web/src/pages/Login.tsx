/**
 * 登录/注册页面 - 支持本地登录和 OAuth
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { Boxes, ArrowRight, Shield, Mail, Lock, User } from 'lucide-react';
import { WechatWorkIcon, FeishuIcon, DingtalkIcon } from '../components/icons';

type OAuthProviderId = 'wechat_work' | 'feishu' | 'dingtalk';

const PROVIDER_ICONS: Record<OAuthProviderId, React.FC<{ size?: number }>> = {
  wechat_work: WechatWorkIcon,
  feishu: FeishuIcon,
  dingtalk: DingtalkIcon,
};

const PROVIDER_STYLES: Record<OAuthProviderId, { color: string; bg: string; border: string }> = {
  wechat_work: { color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  feishu: { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  dingtalk: { color: 'text-sky-500', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
};

function isValidProvider(p: string): p is OAuthProviderId {
  return p in PROVIDER_ICONS;
}

type Mode = 'login' | 'register';

export default function Login() {
  const { t } = useTranslation('pages');
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthProvider, setOauthProvider] = useState<string>('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    api.getConfig()
      .then((data) => setOauthProvider(data?.data?.oauth_provider || ''))
      .catch(() => {});
  }, []);

  const providerIds: OAuthProviderId[] = oauthProvider
    ? isValidProvider(oauthProvider)
      ? [oauthProvider]
      : []
    : (Object.keys(PROVIDER_ICONS) as OAuthProviderId[]);

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await api.login(email, password);
      setAuth(data.token, data.user, data.refresh_token);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('login.loginFailed'));
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('login.registerFailed'));
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
          <h1 className="text-2xl font-extrabold tracking-tight">{t('login.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'login' ? t('login.subtitle.login') : t('login.subtitle.register')}
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div role="alert" aria-live="polite" className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
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
                  aria-label={t('login.username')}
                  placeholder={t('login.usernamePlaceholder')}
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
                aria-label={t('login.displayName')}
                placeholder={t('login.displayNamePlaceholder')}
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
              aria-label={t('login.email')}
              placeholder={t('login.emailPlaceholder')}
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
              aria-label={t('login.password')}
              placeholder={t('login.passwordPlaceholder')}
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
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/20"
          >
            {loading ? t('login.processing') : mode === 'login' ? t('login.loginBtn') : t('login.registerBtn')}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* 切换登录/注册 */}
        <div className="mt-4 text-center text-sm">
          {mode === 'login' ? (
            <span className="text-muted-foreground">
              {t('login.noAccount')}{' '}
              <button onClick={() => { setMode('register'); setError(null); }} className="text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none">
                {t('login.registerBtn')}
              </button>
            </span>
          ) : (
            <span className="text-muted-foreground">
              {t('login.hasAccount')}{' '}
              <button onClick={() => { setMode('login'); setError(null); }} className="text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none">
                {t('login.loginBtn')}
              </button>
            </span>
          )}
        </div>

        {/* 分隔线 */}
        <div className="flex items-center gap-3 my-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">{t('login.or')}</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* OAuth 登录 */}
        {providerIds.length > 0 && (
          <div className="space-y-2.5">
            {providerIds.map((id, i) => {
              const Icon = PROVIDER_ICONS[id];
              const style = PROVIDER_STYLES[id];
              return (
                <button
                  key={id}
                  onClick={() => handleOAuthLogin(id)}
                  disabled={loading}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors duration-200 group bg-card border-border/50 hover:border-border hover:bg-secondary/30 disabled:opacity-50"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${style.bg} ${style.border}`}>
                    <Icon size={20} />
                  </div>
                  <span className="flex-1 text-left text-sm font-medium">
                    {t('login.oauthLogin', { provider: t(`login.providers.${id}`) })}
                  </span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                </button>
              );
            })}
          </div>
        )}

        {/* 底部提示 */}
        <div className="flex items-center justify-center gap-1.5 mt-6 text-xs text-muted-foreground/60">
          <Shield className="w-3 h-3" />
          {t('login.footer')}
        </div>
      </div>
    </div>
  );
}
