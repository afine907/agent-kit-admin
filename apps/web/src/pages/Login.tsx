/**
 * Login 页面 - shadcn 风格，专业左右分栏
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import { Boxes, ArrowRight, Shield, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { WechatWorkIcon, FeishuIcon, DingtalkIcon } from '../components/icons'

type OAuthProviderId = 'wechat_work' | 'feishu' | 'dingtalk'

const PROVIDER_ICONS: Record<OAuthProviderId, React.FC<{ size?: number }>> = {
  wechat_work: WechatWorkIcon,
  feishu: FeishuIcon,
  dingtalk: DingtalkIcon,
}

const PROVIDER_STYLES: Record<OAuthProviderId, { bg: string; border: string; hover: string }> = {
  wechat_work: { bg: 'bg-green-500/10', border: 'border-green-500/20 hover:border-green-500/50', hover: 'hover:bg-green-500/20' },
  feishu: { bg: 'bg-blue-500/10', border: 'border-blue-500/20 hover:border-blue-500/50', hover: 'hover:bg-blue-500/20' },
  dingtalk: { bg: 'bg-sky-500/10', border: 'border-sky-500/20 hover:border-sky-500/50', hover: 'hover:bg-sky-500/20' },
}

function isValidProvider(p: string): p is OAuthProviderId {
  return p in PROVIDER_ICONS
}

type Mode = 'login' | 'register'

export default function Login() {
  const { t } = useTranslation('pages')
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [oauthProvider, setOauthProvider] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    api.getConfig().then((data) => {
      const p = data?.data?.oauth_provider || ''
      setOauthProvider(p)
    }).catch(() => {})
  }, [])

  const providerIds: OAuthProviderId[] = oauthProvider
    ? isValidProvider(oauthProvider) ? [oauthProvider] : []
    : (Object.keys(PROVIDER_ICONS) as OAuthProviderId[])

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const data = await api.login(email, password)
      setAuth(data.token, data.user, data.refresh_token)
      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('login.loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const data = await api.register(username, email, password, displayName || undefined)
      setAuth(data.token, data.user, data.refresh_token)
      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('login.registerFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthLogin = (provider: string) => {
    setLoading(true)
    window.location.href = api.getOAuthUrl(provider)
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex">
      {/* 左侧品牌面板 */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 bg-gradient-to-br from-primary/10 via-background to-accent/5 overflow-hidden">
        {/* 装饰圆形 */}
        <div className="absolute -top-20 -left-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute top-1/4 right-1/4 w-40 h-40 bg-primary/5 rounded-full blur-2xl" />
        {/* Dot grid */}
        <div className="absolute inset-0 bg-dot-grid opacity-30" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/10">
            <Boxes className="w-6 h-6 text-primary" />
          </div>
          <span className="text-xl font-bold tracking-tight">Agent<span className="text-primary">Kit</span></span>
        </div>

        {/* 核心信息 */}
        <div className="relative space-y-6">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight leading-tight mb-3">
              AI 技能包管理<br />
              <span className="text-primary">高效、稳定、开放</span>
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed max-w-sm">
              发现、安装和分享 MCP 工具与 AI 技能。内置团队协作、版本管理和安全沙箱。
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { icon: '🔗', text: 'MCP 协议兼容' },
              { icon: '👥', text: '团队私有包' },
              { icon: '📦', text: '一键安装' },
              { icon: '🔒', text: '安全沙箱' },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 border border-border/50 text-sm backdrop-blur-sm">
                <span>{f.icon}</span>
                <span className="text-foreground/80">{f.text}</span>
              </div>
            ))}
          </div>

          {/* 统计数据 */}
          <div className="flex items-center gap-8 pt-4 border-t border-border/30">
            <div>
              <div className="text-2xl font-bold text-primary">500+</div>
              <div className="text-xs text-muted-foreground">可用包</div>
            </div>
            <div>
              <div className="text-2xl font-bold">50K+</div>
              <div className="text-xs text-muted-foreground">安装次数</div>
            </div>
            <div>
              <div className="text-2xl font-bold">99.9%</div>
              <div className="text-xs text-muted-foreground">可用性</div>
            </div>
          </div>
        </div>

        {/* 底部安全提示 */}
        <div className="relative flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="w-3.5 h-3.5" />
          <span>端到端加密 · SOC 2 认证 · 开源可审计</span>
        </div>
      </div>

      {/* 右侧表单 */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6">
          {/* Logo mobile */}
          <div className="flex lg:hidden items-center gap-2 mb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
              <Boxes className="w-5 h-5 text-primary" />
            </div>
            <span className="text-lg font-bold">Agent<span className="text-primary">Kit</span></span>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === 'login' ? t('login.title') : t('login.registerTitle')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === 'login' ? t('login.subtitle.login') : t('login.subtitle.register')}
            </p>
          </div>

          {/* 错误 */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* 表单 */}
          <form onSubmit={mode === 'login' ? handleLocalLogin : handleRegister} className="space-y-4">
            {mode === 'register' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="username">{t('login.username')}</Label>
                  <Input
                    id="username" type="text" autoComplete="username" spellCheck={false}
                    placeholder={t('login.usernamePlaceholder')} value={username}
                    onChange={e => setUsername(e.target.value)} required minLength={3}
                    maxLength={50} pattern="[a-zA-Z0-9_-]+"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">{t('login.displayName')}</Label>
                  <Input
                    id="displayName" type="text" autoComplete="name"
                    placeholder={t('login.displayNamePlaceholder')} value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">{t('login.email')}</Label>
              <Input
                id="email" type="email" autoComplete="email" spellCheck={false}
                placeholder={t('login.emailPlaceholder')} value={email}
                onChange={e => setEmail(e.target.value)} required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t('login.password')}</Label>
              <Input
                id="password" type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder={t('login.passwordPlaceholder')} value={password}
                onChange={e => setPassword(e.target.value)} required minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? t('login.processing') : mode === 'login' ? t('login.loginBtn') : t('login.registerBtn')}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </Button>
          </form>

          {/* 切换模式 */}
          <div className="text-center text-sm">
            {mode === 'login' ? (
              <span className="text-muted-foreground">
                {t('login.noAccount')}{' '}
                <button onClick={() => { setMode('register'); setError(null) }}
                  className="text-primary font-medium hover:underline">
                  {t('login.registerBtn')}
                </button>
              </span>
            ) : (
              <span className="text-muted-foreground">
                {t('login.hasAccount')}{' '}
                <button onClick={() => { setMode('login'); setError(null) }}
                  className="text-primary font-medium hover:underline">
                  {t('login.loginBtn')}
                </button>
              </span>
            )}
          </div>

          {/* OAuth */}
          {providerIds.length > 0 && (
            <>
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">{t('login.or')}</span>
                <Separator className="flex-1" />
              </div>
              <div className="grid grid-cols-1 gap-2">
                {providerIds.map(id => {
                  const Icon = PROVIDER_ICONS[id]
                  const style = PROVIDER_STYLES[id]
                  return (
                    <Button
                      key={id} variant="outline" className="w-full justify-start gap-3 h-11"
                      onClick={() => handleOAuthLogin(id)} disabled={loading}
                    >
                      <div className={`flex items-center justify-center w-8 h-8 rounded-lg border ${style.bg} ${style.border}`}>
                        <Icon size={18} />
                      </div>
                      <span className="flex-1 text-left text-sm font-medium">
                        {t('login.oauthLogin', { provider: t(`login.providers.${id}`) })}
                      </span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  )
                })}
              </div>
            </>
          )}

          {/* 底部 */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60">
            <Shield className="w-3 h-3" />
            {t('login.footer')}
          </div>
        </div>
      </div>
    </div>
  )
}
